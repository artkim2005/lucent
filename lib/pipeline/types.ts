export type RejectionReason =
  | "missing_title"
  | "missing_image"
  | "missing_published_date"
  | "canonical_points_to_listing"
  | "body_too_short"
  | "fetch_failed";

export interface CleanedArticle {
  title: string;
  imageUrl: string;
  publishedAt: string;
  canonicalUrl: string | null;
  rawText: string;
}

export type ArticleValidationResult =
  | { ok: true; article: CleanedArticle }
  | { ok: false; reason: RejectionReason };

export interface SourceScrapeResult {
  sourceId: string;
  sourceName: string;
  candidatesFound: number;
  candidatesRejectedBeforeDetail: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  rejectionReasons: Partial<Record<RejectionReason, number>>;
  sourceError: string | null;
}

export interface ScrapeSummary {
  status: "ok" | "failed";
  sourcesChecked: number;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  totalDurationMs: number;
  rejectionReasons: Partial<Record<RejectionReason, number>>;
  sources: SourceScrapeResult[];
}
