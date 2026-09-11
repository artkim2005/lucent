import "server-only";

import { analyzeArticleOnce, embedArticleOnce } from "@/lib/ai/analyze-article";
import { logRun } from "@/lib/pipeline/logger";
import type { AnalysisSummary } from "@/lib/pipeline/analyze-types";
import {
  getArticlesPendingEmbedding,
  insertArticleAnalysis,
  updateArticleAnalysisEmbedding,
} from "@/lib/supabase/queries/article-analyses";
import { getPendingArticles } from "@/lib/supabase/queries/articles";
import { getSourcesByIds } from "@/lib/supabase/queries/sources";
import type { ArticleAnalysesTable, ArticleRow } from "@/lib/supabase/types";

const PIPELINE_SOURCE = "analyze";

const DEFAULT_BATCH_SIZE = 5;

const STANDARD_DISCLAIMER =
  "This analysis is AI-generated from the article text and may contain inaccuracies. It is not a substitute for reading the full source article.";

function getBatchSize(): number {
  const raw = process.env.ANALYSIS_BATCH_SIZE;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function analyzeOneArticle(
  article: ArticleRow,
  sourceName: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let result = await analyzeArticleOnce(article, sourceName);

  if (!result.ok) {
    logRun("warn", PIPELINE_SOURCE, "analysis failed, retrying once", {
      articleId: article.id,
      reason: result.reason,
    });
    result = await analyzeArticleOnce(article, sourceName);
  }

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  // Embedding generation (AGENTS.md section 20). Retried once like the
  // analysis call above. If it still fails, nothing is inserted -- the
  // article stays in the "no article_analyses row" bucket and both the
  // analysis and embedding are retried together on the next run.
  let embedResult = await embedArticleOnce(article);

  if (!embedResult.ok) {
    logRun("warn", PIPELINE_SOURCE, "embedding failed, retrying once", {
      articleId: article.id,
      reason: embedResult.reason,
    });
    embedResult = await embedArticleOnce(article);
  }

  if (!embedResult.ok) {
    return { ok: false, reason: `embedding failed: ${embedResult.reason}` };
  }

  const { output, model } = result;
  const insert: ArticleAnalysesTable["Insert"] = {
    article_id: article.id,
    summary: output.summary,
    sentiment_score: output.sentimentScore,
    sentiment_label: output.sentimentLabel,
    bias_score: (output.rightPercentage - output.leftPercentage) / 100,
    bias_label: output.biasLabel,
    left_percentage: output.leftPercentage,
    center_percentage: output.centerPercentage,
    right_percentage: output.rightPercentage,
    confidence: output.confidence,
    framing_notes: output.framingNotes,
    loaded_terms: output.loadedTerms,
    disclaimer: STANDARD_DISCLAIMER,
    model,
    embedding: embedResult.embedding,
  };

  // `insertArticleAnalysis` sets `articles.analyzed_at` immediately after
  // this insert succeeds, so `analyzed_at` is only ever set once both the
  // analysis and the embedding are already saved together in this row.
  await insertArticleAnalysis(insert);
  return { ok: true };
}

async function backfillEmbedding(
  article: ArticleRow,
): Promise<{ ok: true; embedding: number[] } | { ok: false; reason: string }> {
  let result = await embedArticleOnce(article);

  if (!result.ok) {
    logRun("warn", PIPELINE_SOURCE, "embedding backfill failed, retrying once", {
      articleId: article.id,
      reason: result.reason,
    });
    result = await embedArticleOnce(article);
  }

  return result;
}

/**
 * Orchestrates an analysis run (AGENTS.md section 19): resolves the set of
 * pending articles to process (all pending, an explicit id list, and/or a
 * limit), then processes them in fixed-size batches with retry-once and
 * per-article failure isolation, and logs progress throughout.
 */
export async function analyzeArticles(options: {
  articleIds?: string[];
  limit?: number;
}): Promise<AnalysisSummary> {
  const startedAt = Date.now();
  const batchSize = getBatchSize();

  // Fetch the full pending set (unbounded) rather than passing `limit` to
  // getPendingArticles: that function applies its SQL limit before the
  // pending filter, which can under-return when already-analyzed rows sort
  // ahead of pending ones. Slicing here after the fact avoids that.
  let pendingArticles = await getPendingArticles();

  if (options.articleIds && options.articleIds.length > 0) {
    const wanted = new Set(options.articleIds);
    pendingArticles = pendingArticles.filter((article) => wanted.has(article.id));
  }

  if (options.limit !== undefined) {
    pendingArticles = pendingArticles.slice(0, options.limit);
  }

  const articlesChecked = pendingArticles.length;

  logRun("info", PIPELINE_SOURCE, `analysis started for ${articlesChecked} pending article(s)`, {
    batchSize,
    articleIds: options.articleIds,
    limit: options.limit,
  });

  const sourceIds = Array.from(new Set(pendingArticles.map((article) => article.source_id)));
  const sources = await getSourcesByIds(sourceIds);
  const sourceNameById = new Map(sources.map((source) => [source.id, source.name]));

  let articlesAnalyzed = 0;
  const failures: Array<{ articleId: string; reason: string }> = [];

  const batches = chunk(pendingArticles, batchSize);

  for (const [index, batch] of batches.entries()) {
    logRun("info", PIPELINE_SOURCE, `batch ${index + 1}/${batches.length} start`, {
      articleCount: batch.length,
    });

    const results = await Promise.all(
      batch.map((article) =>
        analyzeOneArticle(article, sourceNameById.get(article.source_id) ?? "Unknown source"),
      ),
    );

    results.forEach((result, i) => {
      const article = batch[i];
      if (result.ok) {
        articlesAnalyzed += 1;
        logRun("info", PIPELINE_SOURCE, "article analyzed", { articleId: article.id });
      } else {
        failures.push({ articleId: article.id, reason: result.reason });
        logRun("error", PIPELINE_SOURCE, "article analysis failed after retry", {
          articleId: article.id,
          reason: result.reason,
        });
      }
    });
  }

  // Embedding backfill for legacy analyzed articles (AGENTS.md section 20):
  // always runs in full, independent of `articleIds`/`limit`, since it is
  // an automatic side effect of every analysis run, not a user-selected
  // batch of articles to analyze.
  const embeddingPending = await getArticlesPendingEmbedding();
  const embeddingsChecked = embeddingPending.length;

  logRun(
    "info",
    PIPELINE_SOURCE,
    `embedding backfill started for ${embeddingsChecked} article(s)`,
  );

  let embeddingsBackfilled = 0;
  const embeddingBatches = chunk(embeddingPending, batchSize);

  for (const [index, batch] of embeddingBatches.entries()) {
    logRun("info", PIPELINE_SOURCE, `embedding backfill batch ${index + 1}/${embeddingBatches.length} start`, {
      articleCount: batch.length,
    });

    const results = await Promise.all(
      batch.map((pending) => backfillEmbedding(pending.article)),
    );

    for (const [i, result] of results.entries()) {
      const pending = batch[i];
      if (result.ok) {
        await updateArticleAnalysisEmbedding(pending.analysisId, result.embedding);
        embeddingsBackfilled += 1;
        logRun("info", PIPELINE_SOURCE, "embedding backfilled", { articleId: pending.article.id });
      } else {
        failures.push({
          articleId: pending.article.id,
          reason: `embedding backfill failed: ${result.reason}`,
        });
        logRun("error", PIPELINE_SOURCE, "embedding backfill failed after retry", {
          articleId: pending.article.id,
          reason: result.reason,
        });
      }
    }
  }

  const summary: AnalysisSummary = {
    status: failures.length > 0 ? "failed" : "ok",
    articlesChecked,
    articlesAnalyzed,
    articlesFailed: failures.length,
    embeddingsChecked,
    embeddingsBackfilled,
    totalDurationMs: Date.now() - startedAt,
    failures,
  };

  logRun("info", PIPELINE_SOURCE, "analysis completed", summary as unknown as Record<string, unknown>);

  return summary;
}
