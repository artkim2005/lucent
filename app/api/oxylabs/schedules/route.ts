import { NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/auth/admin-secret";
import { createSchedule, listOxylabsScheduleIds, setScheduleActive } from "@/lib/oxylabs/scheduler";
import { logRun } from "@/lib/pipeline/logger";
import {
  getAllStoredSchedules,
  insertSchedule,
  setStoredScheduleActive,
} from "@/lib/supabase/queries/oxylabs-schedules";
import { getActiveSources } from "@/lib/supabase/queries/sources";
import type { OxylabsScheduleRow } from "@/lib/supabase/types";

export const maxDuration = 120;

const SCHEDULE_SOURCE = "oxylabs-sync";
const DAILY_CRON = "0 3 * * *";

/**
 * Syncs Oxylabs schedules from active sources (AGENTS.md section 18):
 * creates one schedule per active source missing one, reactivates a
 * previously-deactivated schedule if its source became active again,
 * deactivates schedules for sources no longer active, then reconciles
 * orphans by deactivating any Oxylabs-side schedule not tracked in the DB.
 * Idempotent -- re-running with an unchanged source set is a no-op.
 */
export async function POST(request: Request) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const [activeSources, storedSchedules] = await Promise.all([
      getActiveSources(),
      getAllStoredSchedules(),
    ]);

    const storedBySourceId = new Map<string, OxylabsScheduleRow>();
    for (const row of storedSchedules) {
      storedBySourceId.set(row.source_id, row);
    }

    const activeSourceIds = new Set(activeSources.map((source) => source.id));

    let created = 0;
    let reactivated = 0;
    let deactivated = 0;

    for (const source of activeSources) {
      const existing = storedBySourceId.get(source.id);

      if (!existing) {
        logRun("info", SCHEDULE_SOURCE, `creating schedule for ${source.name}`);
        const schedule = await createSchedule(source.listing_url, DAILY_CRON);
        await insertSchedule(source.id, schedule.scheduleId);
        created += 1;
        continue;
      }

      if (!existing.active) {
        logRun("info", SCHEDULE_SOURCE, `reactivating schedule for ${source.name}`);
        await setScheduleActive(existing.oxylabs_schedule_id, true);
        await setStoredScheduleActive(existing.id, true);
        reactivated += 1;
      }
    }

    for (const row of storedSchedules) {
      if (row.active && !activeSourceIds.has(row.source_id)) {
        logRun("info", SCHEDULE_SOURCE, `deactivating schedule for inactive source ${row.source_id}`);
        await setScheduleActive(row.oxylabs_schedule_id, false);
        await setStoredScheduleActive(row.id, false);
        deactivated += 1;
      }
    }

    // Orphan reconciliation: any Oxylabs schedule id not tracked in the DB
    // at all (e.g. its DB row was deleted and later recreated) is stale and
    // must be deactivated so it stops running -- and billing -- daily.
    // Re-fetches stored schedules rather than reusing the snapshot from
    // above the create/reactivate/deactivate loops -- otherwise every
    // schedule just created in this same request would incorrectly look
    // like an orphan and get deactivated immediately after being created.
    const refreshedSchedules = await getAllStoredSchedules();
    // `String(...)` guards against a schema/type drift like the one that
    // caused this exact comparison to silently deactivate every live
    // schedule: if `oxylabs_schedule_id` ever comes back as a JS `number`
    // instead of the declared `string` (e.g. the column reverts to
    // `bigint`), a bare Set-of-numbers vs strings-from-Oxylabs comparison
    // fails for every entry with no error, so nothing here would look wrong
    // until it starts deactivating live schedules.
    const trackedIds = new Set(refreshedSchedules.map((row) => String(row.oxylabs_schedule_id)));
    const oxylabsScheduleIds = await listOxylabsScheduleIds();
    const orphanIds = oxylabsScheduleIds.filter((id) => !trackedIds.has(id));

    for (const orphanId of orphanIds) {
      logRun("warn", SCHEDULE_SOURCE, `deactivating orphaned Oxylabs schedule ${orphanId}`);
      await setScheduleActive(orphanId, false);
    }

    const summary = {
      status: "ok" as const,
      activeSourcesChecked: activeSources.length,
      schedulesCreated: created,
      schedulesReactivated: reactivated,
      schedulesDeactivated: deactivated,
      orphansDeactivated: orphanIds.length,
    };

    logRun("info", SCHEDULE_SOURCE, "sync completed", summary);

    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[oxylabs-sync] unexpected failure", err);
    return NextResponse.json({ error: "Schedule sync failed unexpectedly" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const schedules = await getAllStoredSchedules();
    return NextResponse.json({ schedules }, { status: 200 });
  } catch (err) {
    console.error("[oxylabs-schedules] unexpected failure", err);
    return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}
