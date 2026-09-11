import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ArticleAnalysesTable, ArticleAnalysisRow, ArticleRow } from "@/lib/supabase/types";

/**
 * Saves an analysis and marks the article analyzed. Pending-analysis
 * detection (AGENTS.md section 19) is defined by `article_analyses` row
 * existence, not `analyzed_at` -- so if the `analyzed_at` update below fails
 * after the insert succeeds, the article is still correctly excluded from
 * future pending scans and does not need to be rolled back.
 */
export async function insertArticleAnalysis(
  analysis: ArticleAnalysesTable["Insert"],
): Promise<ArticleAnalysisRow> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("article_analyses")
    .insert(analysis)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to insert article analysis: ${error.message}`);
  }

  const { error: updateError } = await supabase
    .from("articles")
    .update({ analyzed_at: new Date().toISOString() })
    .eq("id", analysis.article_id);

  if (updateError) {
    throw new Error(
      `Analysis saved but failed to set articles.analyzed_at: ${updateError.message}`,
    );
  }

  return data;
}

export interface AnalysisPendingEmbedding {
  analysisId: string;
  article: ArticleRow;
}

/**
 * Embedding backfill detection (AGENTS.md section 20): finds
 * `article_analyses` rows that already exist (already analyzed, in some
 * cases before the `embedding` column existed) but have no embedding yet.
 * `embedding` lives on `article_analyses` itself, so filtering it directly
 * is not a joined-table filter and the section 21 gotcha does not apply.
 */
export async function getArticlesPendingEmbedding(): Promise<AnalysisPendingEmbedding[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("article_analyses")
    .select("id, articles(*)")
    .is("embedding", null);

  if (error) {
    throw new Error(`Failed to load analyses pending embedding: ${error.message}`);
  }

  return data
    .filter((row): row is typeof row & { articles: ArticleRow } => row.articles !== null)
    .map((row) => ({ analysisId: row.id, article: row.articles }));
}

/**
 * Saves a backfilled embedding for a legacy analysis row. `analyzed_at` is
 * already set from the original analysis, so it is not touched here.
 */
export async function updateArticleAnalysisEmbedding(
  analysisId: string,
  embedding: number[],
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from("article_analyses")
    .update({ embedding })
    .eq("id", analysisId);

  if (error) {
    throw new Error(`Failed to save embedding backfill: ${error.message}`);
  }
}
