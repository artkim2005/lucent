import "server-only";

import { openai } from "@ai-sdk/openai";
import { embed, generateText, NoObjectGeneratedError, Output } from "ai";
import { articleAnalysisOutputSchema, type ArticleAnalysisOutput } from "@/lib/ai/schema";
import type { ArticleRow } from "@/lib/supabase/types";

// Most recent OpenAI model with a stable "mini" cost tier (checked against
// GET /v1/models) -- appropriate for a batch classification pipeline over
// gpt-5.4/gpt-5.5, which have no mini tier at this model generation.
export const ANALYSIS_MODEL_ID = "gpt-5.4-mini";

// AGENTS.md section 20 -- OpenAI's small embedding model, 1536 dimensions,
// matching the `article_analyses.embedding vector(1536)` column.
export const EMBEDDING_MODEL_ID = "text-embedding-3-small";

const MAX_ARTICLE_TEXT_CHARS = 12000;

export type AnalyzeArticleResult =
  | { ok: true; output: ArticleAnalysisOutput; model: string }
  | { ok: false; reason: string };

function buildPrompt(article: ArticleRow, sourceName: string): string {
  const text = article.raw_text.slice(0, MAX_ARTICLE_TEXT_CHARS);

  return [
    "You are a neutral news analyst. Analyze the article below for sentiment",
    "and political framing, using only evidence from the article text itself.",
    "Do not infer bias from the source's name or reputation -- judge the text alone.",
    "If the evidence for a political lean is weak or mixed, use biasLabel",
    '"unclear" and keep confidence low rather than guessing.',
    "",
    `Source: ${sourceName}`,
    `Title: ${article.title}`,
    "Article text:",
    text,
  ].join("\n");
}

/**
 * Single analysis attempt for one article. Callers retry once on failure
 * (AGENTS.md section 19) -- this function does not retry internally.
 */
export async function analyzeArticleOnce(
  article: ArticleRow,
  sourceName: string,
): Promise<AnalyzeArticleResult> {
  try {
    const { output } = await generateText({
      model: openai(ANALYSIS_MODEL_ID),
      output: Output.object({
        name: "ArticleAnalysis",
        description: "AI-estimated sentiment and political framing for a news article.",
        schema: articleAnalysisOutputSchema,
      }),
      prompt: buildPrompt(article, sourceName),
    });

    const validated = articleAnalysisOutputSchema.safeParse(output);
    if (!validated.success) {
      return { ok: false, reason: validated.error.message };
    }

    return { ok: true, output: validated.data, model: ANALYSIS_MODEL_ID };
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return { ok: false, reason: `model did not return valid structured output: ${err.message}` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: message };
  }
}

export type EmbedArticleResult =
  | { ok: true; embedding: number[] }
  | { ok: false; reason: string };

/**
 * Single embedding attempt for one article (AGENTS.md section 20). Callers
 * retry once on failure, mirroring `analyzeArticleOnce` -- this function
 * does not retry internally.
 */
export async function embedArticleOnce(article: ArticleRow): Promise<EmbedArticleResult> {
  try {
    const { embedding } = await embed({
      model: openai.embeddingModel(EMBEDDING_MODEL_ID),
      value: `${article.title}\n\n${article.raw_text.slice(0, MAX_ARTICLE_TEXT_CHARS)}`,
    });

    return { ok: true, embedding };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: message };
  }
}
