# Oxylabs Scheduler + Vercel Cron (AGENTS.md section 18)

## Goal

Implement hourly automatic scraping via Oxylabs Scheduler, processed 15 minutes
later by a Vercel Cron job that chains scheduled-result processing into AI
analysis, so the pipeline runs end-to-end with no manual intervention once set
up.

## Skills read

- `.agents/skills/oxylabs-web-scraper/SKILL.md` (+ `examples.md`)
- `.agents/skills/supabase/SKILL.md`
- Live docs fetched per section 18's explicit instruction (not from training
  data): `https://developers.oxylabs.io/products/web-scraper-api/features/scheduler`
  and `https://developers.oxylabs.io/products/web-scraper-api/integration-methods/push-pull.md`
  (for fetching a completed job's result content by id).

## Existing code inspected

- `lib/pipeline/manual-scrape.ts`, `lib/pipeline/process-homepage.ts`,
  `lib/pipeline/types.ts`, `lib/pipeline/logger.ts` — the shared
  scrape-to-insert pipeline (section 9). `processSourceHomepage(source, html,
  limit)` already takes homepage HTML from any origin and does steps 3-8
  (extract candidates, reject, dedupe via `findExistingUrls`, detail-scrape,
  validate, insert). This will be reused unchanged for scheduled processing.
- `lib/oxylabs/client.ts` — Realtime `fetchPage()` used by manual scraping.
  Scheduler needs different endpoints (`data.oxylabs.io`), so this gets a new
  sibling file rather than being modified.
- `lib/supabase/types.ts` and `supabase/schema.sql` — `oxylabs_schedules` and
  `oxylabs_schedule_runs` tables and their TS types **already exist** (RLS
  default-deny, service-role only). No schema or type changes needed.
- `lib/supabase/queries/sources.ts`, `articles.ts`, `article-analyses.ts` —
  existing query patterns (service-role client, 15-item `.in()` chunking,
  the joined-table-filter-in-JS workaround) to follow for the new schedule
  queries.
- `lib/pipeline/analyze.ts` + `app/api/analyze/route.ts` — existing AI
  analysis entrypoint (`analyzeArticles({...})`), to be called as step two of
  the cron route.
- `lib/auth/admin-secret.ts` — `requireAdminSecret()` guard used by
  `app/api/scrape/route.ts` and `app/api/analyze/route.ts`; reused for the new
  action routes.
- No `middleware.ts` exists, so no Clerk route protection to account for on
  the new API routes.
- `.env.example` — already lists `LUCENT_ADMIN_SECRET`; correctly does **not**
  list `CRON_SECRET` (per section 21, Vercel injects it, never added to
  `.env.local`). No env file changes needed.

## Oxylabs Scheduler API (fetched from live docs just now)

Base URL: `https://data.oxylabs.io/v1`, Basic Auth.

- `POST /schedules` — body `{ cron, items: [{ source, url, ... }], end_time }`
  → `{ schedule_id, active, items_count, cron, end_time, next_run_at }`
- `GET /schedules` → `{ schedules: [id, id, ...] }`
- `GET /schedules/{id}/runs` → `{ runs: [{ run_id, jobs: [{ id,
  create_status_code, result_status, created_at, result_created_at }],
  success_rate }] }` — `result_status` is `"pending" | "done" | "failed"`,
  read **per job**, not per run.
- `PUT /schedules/{id}/state` — body `{ active }` → 202, no body.
- Fetch a completed job's HTML: `GET /queries/{job_id}/results?type=raw` →
  `{ results: [{ content, status_code, url, job_id, ... }], job: {...} }`.

`schedule_id`, `run_id`, and job `id` are 64-bit integers that exceed
`Number.MAX_SAFE_INTEGER` — per section 18's "Large integer precision"
requirement, these are read from the raw response text and never round-tripped
through a parsed JS number. Implementation: regex-quote those specific integer
fields directly in the raw response text (e.g. `"schedule_id":123...` →
`"schedule_id":"123..."`) before calling `JSON.parse`, so `JSON.parse` sees
strings and cannot lose precision. Job ids in `/queries/{id}/results` are
already returned as quoted strings, so no transform is needed there.

## Decisions / assumptions (flagging before implementation)

1. **Cron cadence**: schedule cron `"0 * * * *"` (top of every hour, matching
   "Oxylabs Scheduler runs its jobs at the top of every hour"); Vercel Cron at
   `"15 * * * *"` (15 minutes later), per section 18.
2. **`end_time`**: Oxylabs requires this field. Using "now + 2 years" as a
   long-lived default so the schedule doesn't silently expire; not otherwise
   specified in AGENTS.md.
3. **Sync route is idempotent, not destructive**: `POST
   /api/oxylabs/schedules` only creates a new Oxylabs schedule for an active
   source that has no stored `oxylabs_schedules` row yet. It does not delete
   or recreate schedules for sources that already have one — Oxylabs has no
   "edit schedule items" endpoint, so recreating on every call would spam
   duplicate hourly schedules. For a source that is no longer active (or
   whose row was manually deleted and needs to be superseded), sync
   deactivates the stale DB row and its Oxylabs schedule. It then runs the
   section-18-mandated orphan reconciliation: `GET /v1/schedules` listed
   against every `oxylabs_schedule_id` ever stored in the DB, deactivating any
   Oxylabs-side schedule not present in that set.
4. **Run/job tracking granularity**: `oxylabs_schedule_runs.oxylabs_run_id`
   stores a completed **job id** (not the outer `run_id`), and
   `result_status` stores that job's status. Each schedule has exactly one
   item (one source homepage), so each run maps to one job — this lets
   "already processed" tracking dedupe at the same granularity section 18
   filters on (`result_status === 'done'`, fetched by job id).
5. **No standalone `GET /api/oxylabs/runs` route.** Section 18's "always
   deliver all parts together" checklist lists exactly five parts (sync
   route, list-schedules route, manual process route, Vercel Cron config,
   cron pipeline route) — a runs-listing endpoint isn't among them, and
   nothing in the UI needs it. Run/job bookkeeping stays internal to the
   processing pipeline to avoid overbuilding. `GET /api/oxylabs/schedules`
   covers schedule-level observability.
6. **Manual process route only processes results**, it does not also trigger
   analysis — section 18 explicitly separates "process scheduled results"
   from "run AI analysis" as two manual fallback steps until cron is wired
   up. Only the cron route chains both.
7. **Cron secret check is skipped when not running on Vercel** (`process.env.
   VERCEL` unset, i.e. `next dev`), matching "in local development, skip the
   secret check". When deployed, Vercel Cron sends `Authorization: Bearer
   $CRON_SECRET`.
8. **Scheduled-processing per-source article limit** reuses the same default
   as manual scraping (5 valid articles per source per run) since AGENTS.md
   gives no different number for scheduler processing.

## Files to add

- `lib/oxylabs/scheduler.ts` — Scheduler API client: `createSchedule`,
  `listOxylabsScheduleIds`, `setScheduleActive`, `getScheduleRuns`,
  `getJobResultHtml`. Owns the big-int-safe raw-text parsing.
- `lib/supabase/queries/oxylabs-schedules.ts` — `getAllStoredSchedules`,
  `getActiveSchedulesWithSource` (join to `sources`, filtered in JS per the
  section 21 joined-filter gotcha), `insertSchedule`, `deactivateSchedule`,
  `getProcessedJobIds`, `recordProcessedJob`.
- `lib/pipeline/process-scheduled-results.ts` — the scheduler variant of the
  scrape-to-insert pipeline: for each active stored schedule, pull `/runs`,
  find `done` jobs not yet processed, fetch each job's HTML, run the shared
  `processSourceHomepage`, record the job as processed, and return the same
  `ScrapeSummary` shape (with the same run logging) as manual scraping.
- `app/api/oxylabs/schedules/route.ts` — `POST` (sync, admin-secret-guarded)
  and `GET` (list stored schedule rows, read-only).
- `app/api/oxylabs/scheduled-results/process/route.ts` — `POST`
  (admin-secret-guarded), calls `processScheduledResults()`.
- `app/api/cron/pipeline/route.ts` — `GET`, `CRON_SECRET`-guarded (skipped
  locally), chains `processScheduledResults()` then `analyzeArticles({})`
  unconditionally (step two always runs even if step one throws).
- `vercel.json` — registers the `15 * * * *` cron on `/api/cron/pipeline`.

No changes needed to `supabase/schema.sql` or `lib/supabase/types.ts` (already
in place), and no changes to the existing manual scrape/analyze code paths.

## Security requirements

- `POST /api/oxylabs/schedules` and `POST /api/oxylabs/scheduled-results/process`
  require the `x-LUCENT-admin-secret` header via the existing
  `requireAdminSecret()` guard; 401 on missing/invalid.
- `GET /api/cron/pipeline` requires `Authorization: Bearer $CRON_SECRET` when
  `process.env.VERCEL` is set; 401 on missing/invalid; not required for local
  `next dev`. Never guarded by `LUCENT_ADMIN_SECRET`.
- `GET /api/oxylabs/schedules` is a read-only status route (no admin secret),
  consistent with `GET /api/sources` / `GET /api/logs` conventions in section
  14 — it returns only schedule metadata (ids, source, active), never
  credentials.
- Oxylabs Basic Auth credentials (`OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD`) stay
  server-only inside `lib/oxylabs/scheduler.ts`, never reach a client
  component or an API response body.

## Acceptance criteria

- `POST /api/oxylabs/schedules` creates exactly one Oxylabs schedule per
  active source lacking one, persists it in `oxylabs_schedules`, deactivates
  schedules for sources no longer active, and deactivates any Oxylabs-side
  schedule not tracked in the DB (orphan cleanup).
- `GET /api/oxylabs/schedules` returns the stored schedule rows.
- `POST /api/oxylabs/scheduled-results/process` processes only `done` jobs
  not previously processed, reuses the exact same validation/cleanup/dedupe/
  logging as manual scraping, never saves a homepage as an article, and
  returns a `ScrapeSummary` in the same shape as `POST /api/scrape`.
- `GET /api/cron/pipeline` runs processing then analysis in sequence, runs
  analysis even if processing throws, is rejected with 401 when
  `CRON_SECRET` is wrong/missing on Vercel, and is not guarded locally.
- `vercel.json` registers the cron at `15 * * * *` on `/api/cron/pipeline`.
- No duplicate articles, no raw homepage content saved as an article, no
  large integer precision loss anywhere a schedule/run/job id is logged or
  stored.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new routes + `vercel.json` affect the build)

## Manual test steps (after implementation)

Requires `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`,
and `LUCENT_ADMIN_SECRET` set in `.env.local`, and at least one active source
row in Supabase. Watch the `npm run dev` terminal for pipeline logs throughout.

```bash
# 1. Create/sync Oxylabs schedules for all active sources
curl -X POST http://localhost:3000/api/oxylabs/schedules \
  -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET"

# 2. Confirm stored schedule rows
curl http://localhost:3000/api/oxylabs/schedules

# 3. Wait for the top of the hour for Oxylabs to run the schedule job(s),
#    then process completed results manually
curl -X POST http://localhost:3000/api/oxylabs/scheduled-results/process \
  -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET"

# 4. Run analysis manually on whatever got inserted
curl -X POST http://localhost:3000/api/analyze \
  -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET"

# 5. Exercise the cron route locally (no CRON_SECRET needed off Vercel)
curl http://localhost:3000/api/cron/pipeline
```

For the fully automatic path in production: deploy to Vercel (registers the
`vercel.json` cron automatically), run step 1 once against the deployed URL,
and confirm `/api/cron/pipeline` starts firing hourly at :15 in the Vercel
Cron dashboard/logs — no further manual calls should be needed.
