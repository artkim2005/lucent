import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { OxylabsScheduleRow, SourceRow } from "@/lib/supabase/types";

export async function getAllStoredSchedules(): Promise<OxylabsScheduleRow[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.from("oxylabs_schedules").select("*");

  if (error) {
    throw new Error(`Failed to load stored schedules: ${error.message}`);
  }

  return data;
}

export interface ScheduleWithSource {
  schedule: OxylabsScheduleRow;
  source: SourceRow;
}

/**
 * Active schedules joined to their source. Per the section 21 joined-table
 * filter gotcha, `active` is filtered directly on `oxylabs_schedules` (its
 * own column, not a joined one) via `.eq`, while the embedded `sources`
 * relation is fetched unfiltered and checked in JS.
 */
export async function getActiveSchedulesWithSource(): Promise<ScheduleWithSource[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .select("*, sources(*)")
    .eq("active", true);

  if (error) {
    throw new Error(`Failed to load active schedules: ${error.message}`);
  }

  return data
    .filter(
      (row): row is OxylabsScheduleRow & { sources: SourceRow } =>
        row.sources !== null && row.sources.active === true,
    )
    .map((row) => {
      const { sources, ...schedule } = row;
      return { schedule, source: sources };
    });
}

export async function insertSchedule(
  sourceId: string,
  oxylabsScheduleId: string,
): Promise<OxylabsScheduleRow> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .insert({ source_id: sourceId, oxylabs_schedule_id: oxylabsScheduleId, active: true })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to insert schedule: ${error.message}`);
  }

  return data;
}

export async function setStoredScheduleActive(id: string, active: boolean): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from("oxylabs_schedules")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update stored schedule: ${error.message}`);
  }
}

/**
 * Job-processing dedupe (AGENTS.md section 18): jobs already recorded for
 * this schedule should never be fetched or inserted again.
 */
export async function getProcessedJobIds(
  scheduleId: string,
  jobIds: string[],
): Promise<Set<string>> {
  if (jobIds.length === 0) {
    return new Set();
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("oxylabs_schedule_runs")
    .select("oxylabs_run_id")
    .eq("schedule_id", scheduleId)
    .in("oxylabs_run_id", jobIds);

  if (error) {
    throw new Error(`Failed to load processed job ids: ${error.message}`);
  }

  // String(...) guards the same way as the schedule-id comparison in the
  // sync route: if this column ever comes back as a JS number instead of
  // the declared string, a Set-of-numbers compared against the string job
  // ids from Oxylabs would silently never match, and every "already
  // processed" job would look new and get reprocessed.
  return new Set(data.map((row) => String(row.oxylabs_run_id)));
}

export async function recordProcessedJob(
  scheduleId: string,
  jobId: string,
  resultStatus: string,
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from("oxylabs_schedule_runs").insert({
    schedule_id: scheduleId,
    oxylabs_run_id: jobId,
    result_status: resultStatus,
    processed: true,
    processed_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to record processed job: ${error.message}`);
  }
}
