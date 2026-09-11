export interface AnalysisSummary {
  status: "ok" | "failed";
  articlesChecked: number;
  articlesAnalyzed: number;
  articlesFailed: number;
  // Embedding backfill for legacy analyzed articles (AGENTS.md section 20).
  embeddingsChecked: number;
  embeddingsBackfilled: number;
  totalDurationMs: number;
  failures: Array<{ articleId: string; reason: string }>;
}
