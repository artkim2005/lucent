import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSecret } from "@/lib/auth/admin-secret";
import { analyzeArticles } from "@/lib/pipeline/analyze";

export const maxDuration = 300;

const requestBodySchema = z.object({
  articleIds: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
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

  try {
    const summary = await analyzeArticles(result.data);
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[analyze] unexpected failure", err);
    return NextResponse.json({ error: "Analysis failed unexpectedly" }, { status: 500 });
  }
}
