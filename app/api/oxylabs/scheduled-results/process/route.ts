import { NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/auth/admin-secret";
import { processScheduledResults } from "@/lib/pipeline/process-scheduled-results";

export const maxDuration = 300;

export async function POST(request: Request) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const summary = await processScheduledResults();
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[oxylabs-process] unexpected failure", err);
    return NextResponse.json({ error: "Processing failed unexpectedly" }, { status: 500 });
  }
}
