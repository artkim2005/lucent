import "server-only";

import { getJobResultHtml, getScheduleJobs } from "@/lib/oxylabs/scheduler";
import { logRun } from "@/lib/pipeline/logger";
import { processSourceHomepage } from "@/lib/pipeline/process-homepage";
import type { RejectionReason, ScrapeSummary, SourceScrapeResult } from "@/lib/pipeline/types";
import {
  getActiveSchedulesWithSource,
  getProcessedJobIds,
  recordProcessedJob,
} from "@/lib/supabase/queries/oxylabs-schedules";
import type { SourceRow } from "@/lib/supabase/types";

const PIPELINE_SOURCE = "scheduler";
const LIMIT_PER_SOURCE = 5;

function emptySourceResult(source: SourceRow, sourceError: string | null): SourceScrapeResult {
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

function mergeInto(target: SourceScrapeResult, addition: SourceScrapeResult): void {
  target.candidatesFound += addition.candidatesFound;
  target.candidatesRejectedBeforeDetail += addition.candidatesRejectedBeforeDetail;
  target.duplicatesSkipped += addition.duplicatesSkipped;
  target.detailPagesScraped += addition.detailPagesScraped;
  target.articlesInserted += addition.articlesInserted;
  target.articlesRejected += addition.articlesRejected;
  target.articlesFailed += addition.articlesFailed;
  for (const [reason, count] of Object.entries(addition.rejectionReasons)) {
    const key = reason as RejectionReason;
    target.rejectionReasons[key] = (target.rejectionReasons[key] ?? 0) + (count ?? 0);
  }
}

/**
 * Scheduler variant of the scrape-to-insert pipeline (AGENTS.md section 18):
 * for each active stored schedule, pulls completed Oxylabs jobs not yet
 * processed, feeds their homepage HTML through the same shared
 * `processSourceHomepage` steps 3-8 used by manual scraping (section 9), and
 * records each processed job so it is never reprocessed. A per-schedule
 * failure never stops the rest of the run.
 */
export async function processScheduledResults(): Promise<ScrapeSummary> {
  const startedAt = Date.now();
  const schedules = await getActiveSchedulesWithSource();

  logRun(
    "info",
    PIPELINE_SOURCE,
    `processing started for ${schedules.length} active schedule(s)`,
  );

  const results: SourceScrapeResult[] = [];

  for (const { schedule, source } of schedules) {
    logRun("info", source.name, "schedule check start");

    let jobs;
    try {
      jobs = await getScheduleJobs(schedule.oxylabs_schedule_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logRun("error", source.name, "failed to fetch schedule runs", { error: message });
      results.push(emptySourceResult(source, message));
      continue;
    }

    const doneJobIds = jobs.filter((job) => job.resultStatus === "done").map((job) => job.jobId);
    const alreadyProcessed = await getProcessedJobIds(schedule.id, doneJobIds);
    const newJobs = jobs.filter(
      (job) => job.resultStatus === "done" && !alreadyProcessed.has(job.jobId),
    );

    if (newJobs.length === 0) {
      logRun("info", source.name, "no new completed jobs");
      results.push(emptySourceResult(source, null));
      continue;
    }

    logRun("info", source.name, `${newJobs.length} new completed job(s) to process`);

    const combined = emptySourceResult(source, null);

    for (const job of newJobs) {
      let html: string;
      try {
        html = await getJobResultHtml(job.jobId);
      } catch (err) {
        logRun("warn", source.name, `failed to fetch job result ${job.jobId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const result = await processSourceHomepage(source, html, LIMIT_PER_SOURCE);
      mergeInto(combined, result);

      await recordProcessedJob(schedule.id, job.jobId, job.resultStatus);
    }

    logRun("info", source.name, "schedule check completed", {
      articlesInserted: combined.articlesInserted,
      articlesRejected: combined.articlesRejected,
      articlesFailed: combined.articlesFailed,
    });
    results.push(combined);
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

  logRun(
    "info",
    PIPELINE_SOURCE,
    "processing completed",
    summary as unknown as Record<string, unknown>,
  );

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
