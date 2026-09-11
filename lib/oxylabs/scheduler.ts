import "server-only";

const SCHEDULER_BASE = "https://data.oxylabs.io/v1";
const FETCH_TIMEOUT_MS = 30_000;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export class OxylabsSchedulerError extends Error {
  constructor(message: string) {
    super(`Oxylabs Scheduler request failed: ${message}`);
    this.name = "OxylabsSchedulerError";
  }
}

export interface CreatedSchedule {
  scheduleId: string;
  active: boolean;
  cron: string;
  endTime: string;
  nextRunAt: string | null;
}

export interface ScheduleJob {
  jobId: string;
  resultStatus: string;
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing OXY_WSA_USERNAME or OXY_WSA_PASSWORD environment variable");
  }

  return { username, password };
}

function authHeader(): string {
  const { username, password } = getCredentials();
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/**
 * Quotes specific integer JSON fields in raw response text before
 * `JSON.parse` ever sees them. Oxylabs schedule/run/job ids are 64-bit
 * integers that exceed `Number.MAX_SAFE_INTEGER` (AGENTS.md section 18) --
 * `JSON.parse` would silently corrupt the last digits. Turning
 * `"field":123...` into `"field":"123..."` in the text first means
 * `JSON.parse` reads a string, so no precision is ever lost.
 */
function quoteBigIntFields(rawText: string, fieldNames: string[]): string {
  const pattern = new RegExp(`"(${fieldNames.join("|")})"\\s*:\\s*(\\d+)`, "g");
  return rawText.replace(pattern, '"$1":"$2"');
}

async function scheduledFetch(path: string, init: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${SCHEDULER_BASE}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: authHeader(),
      },
      signal: controller.signal,
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new OxylabsSchedulerError(`${init.method ?? "GET"} ${path} -> HTTP ${response.status}: ${rawText}`);
    }

    return rawText;
  } catch (err) {
    if (err instanceof OxylabsSchedulerError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new OxylabsSchedulerError(`${init.method ?? "GET"} ${path} timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw new OxylabsSchedulerError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timeout);
  }
}

function formatEndTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * Creates a new Oxylabs schedule for a single homepage URL (one item per
 * schedule, per source). `end_time` defaults to two years out since Oxylabs
 * requires the field and AGENTS.md does not specify a shorter lifetime.
 */
export async function createSchedule(url: string, cron: string): Promise<CreatedSchedule> {
  const endTime = formatEndTime(new Date(Date.now() + TWO_YEARS_MS));

  const rawText = await scheduledFetch("/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cron,
      items: [{ source: "universal", url }],
      end_time: endTime,
    }),
  });

  const parsed = JSON.parse(quoteBigIntFields(rawText, ["schedule_id"])) as {
    schedule_id: string;
    active: boolean;
    cron: string;
    end_time: string;
    next_run_at: string | null;
  };

  return {
    scheduleId: parsed.schedule_id,
    active: parsed.active,
    cron: parsed.cron,
    endTime: parsed.end_time,
    nextRunAt: parsed.next_run_at ?? null,
  };
}

/**
 * Lists every schedule id that currently exists on Oxylabs, used for orphan
 * reconciliation (AGENTS.md section 18). `{"schedules":[...]}` holds large
 * integers that may come back bare or quoted depending on the id's size, so
 * ids are extracted directly from the raw text (stripping quotes if
 * present) rather than via `JSON.parse`.
 */
export async function listOxylabsScheduleIds(): Promise<string[]> {
  const rawText = await scheduledFetch("/schedules", { method: "GET" });

  const match = rawText.match(/"schedules"\s*:\s*\[([^\]]*)\]/);
  if (!match) {
    throw new OxylabsSchedulerError("unexpected response shape from GET /schedules");
  }

  return match[1]
    .split(",")
    .map((id) => id.trim().replace(/^"|"$/g, ""))
    .filter((id) => id.length > 0);
}

export async function setScheduleActive(scheduleId: string, active: boolean): Promise<void> {
  await scheduledFetch(`/schedules/${scheduleId}/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
}

/**
 * Flattens `GET /schedules/{id}/runs` into individual jobs. Per AGENTS.md
 * section 18, `result_status` must be read per job (`runs[].jobs[]`), never
 * per run -- a run only wraps one or more jobs, it has no status of its own.
 */
export async function getScheduleJobs(scheduleId: string): Promise<ScheduleJob[]> {
  const rawText = await scheduledFetch(`/schedules/${scheduleId}/runs`, { method: "GET" });

  const parsed = JSON.parse(quoteBigIntFields(rawText, ["run_id", "id"])) as {
    runs: Array<{
      run_id: string;
      jobs: Array<{ id: string; result_status: string }>;
    }>;
  };

  const jobs: ScheduleJob[] = [];
  for (const run of parsed.runs ?? []) {
    for (const job of run.jobs ?? []) {
      jobs.push({ jobId: job.id, resultStatus: job.result_status });
    }
  }
  return jobs;
}

/**
 * Fetches the raw HTML result of a completed job. Job ids here come back
 * from `getScheduleJobs` as strings already, so they pass through untouched
 * -- no numeric round-trip, no precision risk.
 */
export async function getJobResultHtml(jobId: string): Promise<string> {
  const rawText = await scheduledFetch(`/queries/${jobId}/results?type=raw`, { method: "GET" });

  const parsed = JSON.parse(rawText) as {
    results?: Array<{ content?: string; status_code?: number }>;
  };
  const result = parsed.results?.[0];

  if (!result || typeof result.content !== "string") {
    throw new OxylabsSchedulerError(`no result content for job ${jobId}`);
  }

  const statusCode = result.status_code ?? 0;
  if (statusCode < 200 || statusCode >= 300) {
    throw new OxylabsSchedulerError(`job ${jobId} result returned status ${statusCode}`);
  }

  return result.content;
}
