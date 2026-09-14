# Change Oxylabs Scheduler cadence from daily to monthly

## Goal

Change the Oxylabs Scheduler + Vercel Cron pipeline from running once per day
to once per month (1st of the month, same 3:00 AM UTC time), and keep
`AGENTS.md` in sync with the new cadence.

## Skills read

- `.agents/skills/oxylabs-web-scraper/SKILL.md` — confirms `cron` is a plain
  cron expression on the schedule; no other Scheduler API shape changes with
  cadence.

## Existing code inspected

- `app/api/oxylabs/schedules/route.ts` — `DAILY_CRON = "0 3 * * *"` is the
  cron expression passed to `createSchedule()` when syncing a new schedule
  per active source (changed from hourly to daily in the previous prompt,
  `prompts/oxylabs-scheduler-daily-cadence.md`).
- `vercel.json` — `{ "path": "/api/cron/pipeline", "schedule": "15 3 * * *" }`
  registers the Vercel Cron trigger 15 minutes after the Oxylabs run.
- `AGENTS.md` section 18 documents daily cadence in the same six places
  updated last time: the section intro, the orphan-schedule-deactivation
  billing note, the "two separate one-time setups" bullets, the "Automatic
  daily pipeline" heading + step 1, the "deliver all parts together"
  checklist, and the closing two-bullet recap.
- No other code references the cadence.

## Decisions (per user answer)

1. Oxylabs schedule cron: `"0 3 1 * *"` (3:00 AM UTC on the 1st of every
   month).
2. Vercel Cron: `"15 3 1 * *"` (3:15 AM UTC on the 1st, 15 minutes later,
   same give-Oxylabs-time-to-finish rationale as before).
3. `AGENTS.md` section 18 updated in all six places to describe monthly
   cadence instead of daily, consistent with the daily-cadence change.
4. Same as the hourly→daily change: Oxylabs has no "edit schedule" endpoint,
   so the 4 already-running daily schedules are not automatically migrated
   by this code change. Moving them to monthly is the same manual follow-up
   (delete their `oxylabs_schedules` rows — and any dependent
   `oxylabs_schedule_runs` rows first, per the FK — then re-run
   `POST /api/oxylabs/schedules`, which recreates them with the new cron and
   deactivates the old ones via orphan reconciliation), covered in the test
   steps below, not new code.

## Files to change

- `app/api/oxylabs/schedules/route.ts` — rename `DAILY_CRON` to
  `MONTHLY_CRON`, value `"0 3 1 * *"`.
- `vercel.json` — schedule `"15 3 1 * *"`.
- `AGENTS.md` — update all six daily references in section 18 to monthly
  equivalents (wording only, no semantic changes beyond cadence).

## Implementation requirements

- No change to route logic — only the cron expression values and their
  surrounding comments/log strings that mention "daily".
- Keep the existing 15-minute offset between the Oxylabs schedule and the
  Vercel Cron trigger.

## Security requirements

None beyond what's already in place — no new inputs, no new secrets, no
change to auth guards.

## Acceptance criteria

- A freshly-synced source gets an Oxylabs schedule with cron `"0 3 1 * *"`.
- `vercel.json`'s cron entry is `"15 3 1 * *"`.
- `AGENTS.md` section 18 reads consistently as a monthly pipeline (no
  leftover "daily" wording).
- `npm run typecheck` and `npm run lint` pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` not required (only a string literal and a JSON config
  value change, no route signatures/schema/logic changed).

## Manual test steps (after implementation)

```bash
# Confirm the constant/config changed correctly (no live call needed)
grep -n "MONTHLY_CRON" app/api/oxylabs/schedules/route.ts
cat vercel.json
```

To move the 4 already-running daily schedules onto the new monthly cadence
(manual, one-time, same procedure used for the hourly→daily migration):

1. In Supabase, delete any `oxylabs_schedule_runs` rows referencing the 4
   existing `oxylabs_schedules` rows (required first, due to the foreign
   key), then delete the 4 `oxylabs_schedules` rows themselves.
2. Re-run `POST /api/oxylabs/schedules` with the `x-LUCENT-admin-secret`
   header — creates 4 new schedules with the monthly cron and inserts fresh
   rows.
3. The orphan-reconciliation step in that same sync call deactivates the 4
   old daily Oxylabs-side schedules, since they're no longer tracked in the
   DB.
4. Confirm via `GET /api/oxylabs/schedules` that the 4 stored rows match the
   new Oxylabs schedule ids, and that the old 4 show `"active":false` on
   Oxylabs.
