import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSecret } from "@/lib/auth/admin-secret";
import { scrapeSourcesManually } from "@/lib/pipeline/manual-scrape";
import { getActiveSources, getActiveSourcesByIds } from "@/lib/supabase/queries/sources";

export const maxDuration = 300;

const DEFAULT_LIMIT_PER_SOURCE = 5;

const requestBodySchema = z.object({
  sourceIds: z.array(z.string()).optional(),
  limitPerSource: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  const rawBody = await request.text();
  let parsedBody: unknown = {};
  if (rawBody.trim().length > 0) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const result = requestBodySchema.safeParse(parsedBody);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: result.error.flatten() },
      { status: 400 },
    );
  }

  const { sourceIds, limitPerSource = DEFAULT_LIMIT_PER_SOURCE } = result.data;

  try {
    const sources = sourceIds
      ? await getActiveSourcesByIds(sourceIds)
      : await getActiveSources();

    const summary = await scrapeSourcesManually(sources, limitPerSource);

    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[scrape] unexpected failure", err);
    return NextResponse.json({ error: "Scrape failed unexpectedly" }, { status: 500 });
  }
}
