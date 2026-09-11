import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { LogRow, LogsTable } from "@/lib/supabase/types";

export async function insertLog(entry: LogsTable["Insert"]): Promise<LogRow> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("logs")
    .insert(entry)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to insert log: ${error.message}`);
  }

  return data;
}

export async function getRecentLogs(limit = 100): Promise<LogRow[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load logs: ${error.message}`);
  }

  return data;
}
