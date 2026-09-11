import "server-only";

import { NextResponse } from "next/server";

const ADMIN_SECRET_HEADER = "x-LUCENT-admin-secret";

/**
 * Guards action routes with the shared admin secret (AGENTS.md section 15).
 * Returns a 401 response when missing/invalid, or null when the request is
 * authorized.
 */
export function requireAdminSecret(request: Request): NextResponse | null {
  const expected = process.env.LUCENT_ADMIN_SECRET;
  const provided = request.headers.get(ADMIN_SECRET_HEADER);

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
