import "server-only";

import { insertLog } from "@/lib/supabase/queries/logs";
import type { LogLevel } from "@/lib/supabase/types";

const CONSOLE_METHOD: Record<LogLevel, "log" | "warn" | "error"> = {
  debug: "log",
  info: "log",
  warn: "warn",
  error: "error",
};

/**
 * Run logging (AGENTS.md section 9): writes to the terminal and
 * best-effort to the `logs` table. A logging failure never aborts the run.
 */
export function logRun(
  level: LogLevel,
  source: string,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  const method = CONSOLE_METHOD[level];
  const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
  console[method](`[scrape] [${source}] ${message}${suffix}`);

  insertLog({ level, source, message, metadata }).catch(() => {
    // best-effort only; never let logging failures break the run
  });
}
