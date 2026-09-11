# Change Oxylabs Scheduler cadence from hourly to daily

## Goal

Change the Oxylabs Scheduler + Vercel Cron pipeline from running once per
hour to once per day, and keep `AGENTS.md` in sync with the new cadence.

## Skills read

- `.agents/skills/oxylabs-web-scraper/SKILL.md` — confirms `cron` is a plain
  cron expression on the schedule; no other Scheduler API shape changes with
  cadence.

## Existing code inspected

- `app/api/oxylabs/schedules/route.ts` — `HOURLY_CRON = "0 * * * *"` is the
  cron expression passed to `createSchedule()` when syncing a new schedule
  per active source.
- `vercel.json` — `{ "path": "/api/cron/pipeline", "schedule": "15 * * * *" }`
  registers the Vercel Cron trigger 15 minutes after the Oxylabs run.
- `AGENTS.md` section 18 documents hourly cadence in six places: the section
  intro, the orphan-schedule-deactivation note about billing, the "two
  separate one-time setups" bullets, the "Automatic hourly pipeline"
  heading + step 1, the "deliver all parts together" checklist, and the
  closing two-bullet recap.
- No other code references the cadence — `lib/oxylabs/scheduler.ts` and
  `lib/pipeline/process-scheduled-results.ts` are cadence-agnostic (they just
  process whatever `done` jobs exist next time they're called).

## Decisions (per user answers)

1. Oxylabs schedule cron: `"0 3 * * *"` (3:00 AM UTC daily).
2. Vercel Cron: `"15 3 * * *"` (3:15 AM UTC daily, 15 minutes later, same
   give-Oxylabs-time-to-finish rationale as before).
3. `AGENTS.md` section 18 will be updated in all six places identified above
   to describe the new daily cadence instead of hourly, so the doc stays the
   source of truth.
4. Existing Oxylabs-side schedules created under the old hourly cron are not
   automatically migrated by this change — Oxylabs has no "edit schedule"
   endpoint. Per the sync route's existing idempotent behavior (skip sources
   that already have a stored schedule row), the 4 already-created hourly
   schedules will keep running hourly until manually superseded. This prompt
   covers the code change only; switching already-running schedules to the
   new cadence (delete the stored DB rows for the 4 existing schedules, let
   the next sync call recreate them with the new daily cron, and manually
   deactivate the old Oxylabs-side hourly schedules) is a manual follow-up
   step called out in the test steps below, not new code.

## Files to change

- `app/api/oxylabs/schedules/route.ts` — rename `HOURLY_CRON` to
  `DAILY_CRON`, value `"0 3 * * *"`.
- `vercel.json` — schedule `"15 3 * * *"`.
- `AGENTS.md` — update all six hourly references in section 18 to daily
  equivalents (wording only, no semantic changes beyond cadence).

## Implementation requirements

- No change to the sync/process/cron route logic itself — only the cron
  expression values and their surrounding comments/log strings that mention
  "hourly".
- Keep the existing "15 minutes after the source cron fires" offset between
  the Oxylabs schedule and the Vercel Cron trigger.

## Security requirements

None beyond what's already in place — no new inputs, no new secrets, no
change to auth guards.

## Acceptance criteria

- A freshly-synced source gets an Oxylabs schedule with cron `"0 3 * * *"`.
- `vercel.json`'s cron entry is `"15 3 * * *"`.
- `AGENTS.md` section 18 reads consistently as a daily pipeline (no leftover
  "hourly" or "top of every hour" wording).
- `npm run typecheck` and `npm run lint` pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` is not required (no route signatures, schema, or logic
  changed — only a string literal and a JSON config value).

## Manual test steps (after implementation)

```bash
# 1. Confirm the constant/config changed correctly (no live call needed)
grep -n "DAILY_CRON" app/api/oxylabs/schedules/route.ts
cat vercel.json
```

To move the 4 already-created hourly schedules onto the new daily cadence
(manual, one-time, outside this code change):

1. In Supabase, delete the 4 existing rows in `oxylabs_schedules` (Reuters,
   NPR, BBC News, The Guardian).
2. Re-run `POST /api/oxylabs/schedules` with the `x-LUCENT-admin-secret`
   header — this creates 4 new schedules with the daily cron and inserts
   fresh rows.
3. The orphan-reconciliation step in that same sync call will automatically
   deactivate the 4 old hourly Oxylabs-side schedules, since they're no
   longer tracked in the DB.
4. Confirm via `GET /api/oxylabs/schedules` that the 4 stored rows now match
   the new Oxylabs schedule ids.
