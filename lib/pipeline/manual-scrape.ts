import "server-only";

import { fetchPage } from "@/lib/oxylabs/client";
import { logRun } from "@/lib/pipeline/logger";
import { processSourceHomepage } from "@/lib/pipeline/process-homepage";
import type { RejectionReason, ScrapeSummary, SourceScrapeResult } from "@/lib/pipeline/types";
import type { SourceRow } from "@/lib/supabase/types";

const PIPELINE_SOURCE = "pipeline";

function emptySourceResult(source: SourceRow, sourceError: string): SourceScrapeResult {
  return {
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
    sourceError,
  };
}

/**
 * Orchestrates a full manual scrape run (AGENTS.md sections 9 and 16):
 * live homepage fetch per source, then the shared homepage-processing
 * pipeline, then summary aggregation. A source-level failure never stops
 * the rest of the run.
 */
export async function scrapeSourcesManually(
  sources: SourceRow[],
  limitPerSource: number,
): Promise<ScrapeSummary> {
  const startedAt = Date.now();
  logRun("info", PIPELINE_SOURCE, `scrape started for ${sources.length} source(s)`, {
    sources: sources.map((s) => s.name),
    limitPerSource,
  });

  const results: SourceScrapeResult[] = [];

  for (const source of sources) {
    logRun("info", source.name, "source start");

    let homepageHtml: string;
    try {
      const page = await fetchPage(source.listing_url);
      homepageHtml = page.html;
      logRun("info", source.name, "homepage fetched");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logRun("error", source.name, "failed to fetch homepage", { error: message });
      results.push(emptySourceResult(source, message));
      continue;
    }

    const result = await processSourceHomepage(source, homepageHtml, limitPerSource);
    logRun("info", source.name, "source completed", {
      articlesInserted: result.articlesInserted,
      articlesRejected: result.articlesRejected,
      articlesFailed: result.articlesFailed,
    });
    results.push(result);
  }

  const summary: ScrapeSummary = {
    status: results.some((r) => r.sourceError) ? "failed" : "ok",
    sourcesChecked: results.length,
    candidatesFound: sum(results, (r) => r.candidatesFound),
    candidatesRejected: sum(results, (r) => r.candidatesRejectedBeforeDetail),
    duplicatesSkipped: sum(results, (r) => r.duplicatesSkipped),
    detailPagesScraped: sum(results, (r) => r.detailPagesScraped),
    articlesInserted: sum(results, (r) => r.articlesInserted),
    articlesRejected: sum(results, (r) => r.articlesRejected),
    articlesFailed: sum(results, (r) => r.articlesFailed),
    totalDurationMs: Date.now() - startedAt,
    rejectionReasons: mergeRejectionReasons(results),
    sources: results,
  };

  logRun("info", PIPELINE_SOURCE, "scrape completed", summary as unknown as Record<string, unknown>);

  return summary;
}

function sum(results: SourceScrapeResult[], pick: (r: SourceScrapeResult) => number): number {
  return results.reduce((total, r) => total + pick(r), 0);
}

function mergeRejectionReasons(
  results: SourceScrapeResult[],
): Partial<Record<RejectionReason, number>> {
  const merged: Partial<Record<RejectionReason, number>> = {};
  for (const result of results) {
    for (const [reason, count] of Object.entries(result.rejectionReasons)) {
      const key = reason as RejectionReason;
      merged[key] = (merged[key] ?? 0) + (count ?? 0);
    }
  }
  return merged;
}
