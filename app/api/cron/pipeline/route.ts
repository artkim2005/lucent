import { NextResponse } from "next/server";
import { logRun } from "@/lib/pipeline/logger";
import { analyzeArticles } from "@/lib/pipeline/analyze";
import { processScheduledResults } from "@/lib/pipeline/process-scheduled-results";

export const maxDuration = 300;

const PIPELINE_SOURCE = "cron-pipeline";

/**
 * Guards against browser/user calls (AGENTS.md section 18): verifies
 * Vercel's `Authorization: Bearer $CRON_SECRET` header, but only when
 * actually running on Vercel -- locally (`next dev`, no `VERCEL` env var)
 * the check is skipped so the route can be tested manually. Never guarded
 * by `LUCENT_ADMIN_SECRET`.
 */
function isUnauthorizedCronRequest(request: Request): boolean {
  if (!process.env.VERCEL) {
    return false;
  }

  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");

  return !expected || provided !== `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (isUnauthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logRun("info", PIPELINE_SOURCE, "cron pipeline started");

  let scrape: unknown = null;
  let scrapeError: string | null = null;
  try {
    scrape = await processScheduledResults();
  } catch (err) {
    scrapeError = err instanceof Error ? err.message : String(err);
    logRun("error", PIPELINE_SOURCE, "processing step failed", { error: scrapeError });
  }

  // Step two always runs, even if step one failed -- there may be
  // pre-existing unanalyzed articles from a previous run.
  let analyze: unknown = null;
  let analyzeError: string | null = null;
  try {
    analyze = await analyzeArticles({});
  } catch (err) {
    analyzeError = err instanceof Error ? err.message : String(err);
    logRun("error", PIPELINE_SOURCE, "analysis step failed", { error: analyzeError });
  }

  logRun("info", PIPELINE_SOURCE, "cron pipeline completed", {
    scrapeFailed: scrapeError !== null,
    analyzeFailed: analyzeError !== null,
  });

  return NextResponse.json(
    {
      status: scrapeError || analyzeError ? "failed" : "ok",
      scrape,
      scrapeError,
      analyze,
      analyzeError,
    },
    { status: 200 },
  );
}
