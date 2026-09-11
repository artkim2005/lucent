import "server-only";

import { fetchPage } from "@/lib/oxylabs/client";
import { extractCandidateLinks } from "@/lib/parsing/extract-candidate-links";
import { isRejectedPath } from "@/lib/parsing/reject-patterns";
import { validateAndCleanArticle } from "@/lib/parsing/validate-article";
import { logRun } from "@/lib/pipeline/logger";
import type { SourceScrapeResult } from "@/lib/pipeline/types";
import { findExistingUrls, insertArticle } from "@/lib/supabase/queries/articles";
import type { SourceRow } from "@/lib/supabase/types";

/**
 * Pipeline steps 3-8 (AGENTS.md section 9) for one source, given its
 * homepage HTML. Shared by manual scraping and (later) scheduler
 * processing -- they differ only in where the homepage HTML comes from.
 */
export async function processSourceHomepage(
  source: SourceRow,
  homepageHtml: string,
  limit: number,
): Promise<SourceScrapeResult> {
  const result: SourceScrapeResult = {
    sourceId: source.id,
    sourceName: source.name,
    candidatesFound: 0,
    candidatesRejectedBeforeDetail: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    articlesInserted: 0,
    articlesRejected: 0,
    articlesFailed: 0,
    rejectionReasons: {},
    sourceError: null,
  };

  const rawCandidates = extractCandidateLinks(homepageHtml, source.listing_url);
  result.candidatesFound = rawCandidates.length;
  logRun("info", source.name, `found ${rawCandidates.length} candidate links`);

  const candidates: string[] = [];
  for (const url of rawCandidates) {
    try {
      if (isRejectedPath(new URL(url).pathname)) {
        result.candidatesRejectedBeforeDetail += 1;
        continue;
      }
    } catch {
      result.candidatesRejectedBeforeDetail += 1;
      continue;
    }
    candidates.push(url);
  }

  const existing = await findExistingUrls(candidates);
  const newCandidates = candidates.filter((url) => {
    if (existing.has(url)) {
      result.duplicatesSkipped += 1;
      return false;
    }
    return true;
  });

  logRun(
    "info",
    source.name,
    `${newCandidates.length} new candidates after dedupe, target ${limit} valid articles`,
  );

  for (const url of newCandidates) {
    if (result.articlesInserted >= limit) {
      break;
    }

    let html: string;
    try {
      const page = await fetchPage(url);
      html = page.html;
      result.detailPagesScraped += 1;
    } catch (err) {
      result.articlesFailed += 1;
      logRun("warn", source.name, `failed to fetch detail page ${url}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const validation = validateAndCleanArticle(html, url);
    if (!validation.ok) {
      result.articlesRejected += 1;
      result.rejectionReasons[validation.reason] =
        (result.rejectionReasons[validation.reason] ?? 0) + 1;
      logRun("info", source.name, `rejected ${url}`, { reason: validation.reason });
      continue;
    }

    try {
      await insertArticle({
        source_id: source.id,
        original_url: url,
        canonical_url: validation.article.canonicalUrl,
        title: validation.article.title,
        image_url: validation.article.imageUrl,
        published_at: validation.article.publishedAt,
        raw_text: validation.article.rawText,
      });
      result.articlesInserted += 1;
      logRun("info", source.name, `inserted article: ${validation.article.title}`);
    } catch (err) {
      result.articlesFailed += 1;
      logRun("error", source.name, `failed to insert article ${url}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
