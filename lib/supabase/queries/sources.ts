import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SourceRow } from "@/lib/supabase/types";

export async function getActiveSources(): Promise<SourceRow[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load active sources: ${error.message}`);
  }

  return data;
}

/**
 * Looks up sources by id regardless of `active` status, for contexts (like
 * analysis) that need a source's name for an already-scraped article even
 * if the source has since been deactivated.
 */
export async function getSourcesByIds(ids: string[]): Promise<SourceRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.from("sources").select("*").in("id", ids);

  if (error) {
    throw new Error(`Failed to load sources by id: ${error.message}`);
  }

  return data;
}

export async function getActiveSourcesByIds(ids: string[]): Promise<SourceRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("active", true)
    .in("id", ids)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load active sources by id: ${error.message}`);
  }

  return data;
}
