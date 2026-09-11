import { z } from "zod";

/**
 * Structured output requested from the model (AGENTS.md section 19).
 * `bias_score` is not requested here -- it is derived server-side from the
 * percentages after validation. `disclaimer` and `model` are also set
 * server-side, not generated.
 */
export const articleAnalysisOutputSchema = z
  .object({
    summary: z.string().min(1),
    sentimentScore: z.number().min(-1).max(1),
    sentimentLabel: z.enum(["positive", "neutral", "negative"]),
    biasLabel: z.enum(["left", "center", "right", "mixed", "unclear"]),
    leftPercentage: z.number().int().min(0).max(100),
    centerPercentage: z.number().int().min(0).max(100),
    rightPercentage: z.number().int().min(0).max(100),
    confidence: z.number().min(0).max(1),
    framingNotes: z.string().nullable(),
    loadedTerms: z.array(z.string()),
  })
  .refine(
    (value) =>
      value.leftPercentage + value.centerPercentage + value.rightPercentage === 100,
    { message: "leftPercentage + centerPercentage + rightPercentage must equal 100" },
  );

export type ArticleAnalysisOutput = z.infer<typeof articleAnalysisOutputSchema>;
