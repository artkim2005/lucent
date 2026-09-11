import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  ArticleAnalysisRow,
  ArticleRow,
  ArticlesTable,
  BiasLabel,
  SentimentLabel,
  SourceRow,
} from "@/lib/supabase/types";

const URL_CHUNK_SIZE = 15;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * URL existence check (AGENTS.md section 9): never pass more than 15 URLs
 * to a single `.in()` filter.
 */
export async function findExistingUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) {
    return new Set();
  }

  const supabase = createServiceRoleClient();
  const existing = new Set<string>();

  for (const batch of chunk(urls, URL_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("articles")
      .select("original_url")
      .in("original_url", batch);

    if (error) {
      throw new Error(`Failed to check existing article URLs: ${error.message}`);
    }

    for (const row of data) {
      existing.add(row.original_url);
    }
  }

  return existing;
}

export async function insertArticle(
  article: ArticlesTable["Insert"],
): Promise<ArticleRow> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("articles")
    .insert(article)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to insert article: ${error.message}`);
  }

  return data;
}

/**
 * Pending-analysis check (AGENTS.md section 19): an article is pending when
 * no `article_analyses` row exists for it. Per the section 21 joined-table
 * filter gotcha, fetch the embedded relation with no filter on the foreign
 * table and apply the condition in JS instead of `.eq('article_analyses.x', v)`.
 */
export async function getPendingArticles(limit?: number): Promise<ArticleRow[]> {
  const supabase = createServiceRoleClient();

  let query = supabase
    .from("articles")
    .select("*, article_analyses(id)")
    .order("scraped_at", { ascending: true });

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load pending articles: ${error.message}`);
  }

  return data.filter((row) => row.article_analyses === null) as ArticleRow[];
}

export interface PublishedArticle extends ArticleRow {
  sources: Pick<SourceRow, "name"> | null;
  article_analyses: ArticleAnalysisRow | null;
}

/**
 * Homepage read path (AGENTS.md section 5): uses the public/anon client, not
 * the service role, so it can never return more than RLS already allows an
 * anonymous visitor -- active sources, analyzed articles, any saved
 * analysis. Per the section 21 joined-table gotcha, the embedded relations
 * are selected with no filter and the null-analysis/null-source case
 * (should not occur given the RLS invariants, but defensive) is filtered out
 * in JS.
 */
export async function getPublishedArticlesForHomepage(): Promise<
  Array<PublishedArticle & { sources: Pick<SourceRow, "name">; article_analyses: ArticleAnalysisRow }>
> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("articles")
    .select("*, sources(name), article_analyses(*)")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load published articles: ${error.message}`);
  }

  return (data as PublishedArticle[]).filter(
    (row): row is PublishedArticle & { sources: Pick<SourceRow, "name">; article_analyses: ArticleAnalysisRow } =>
      row.sources !== null && row.article_analyses !== null,
  );
}

/**
 * News details page read path (AGENTS.md section 5/19): single-article
 * lookup by id, same public/anon-client + RLS posture as
 * `getPublishedArticlesForHomepage`. Returns null when the row doesn't
 * exist, isn't analyzed yet, or its source is inactive (RLS already hides
 * these from the anon client) -- the page treats null as "not found".
 */
export async function getPublishedArticleById(
  id: string,
): Promise<
  (PublishedArticle & { sources: Pick<SourceRow, "name">; article_analyses: ArticleAnalysisRow }) | null
> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("articles")
    .select("*, sources(name), article_analyses(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load article: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as PublishedArticle;
  if (row.sources === null || row.article_analyses === null) {
    return null;
  }

  return row as PublishedArticle & { sources: Pick<SourceRow, "name">; article_analyses: ArticleAnalysisRow };
}

export interface RelatedArticle {
  id: string;
  title: string;
  imageUrl: string;
  publishedAt: string;
  sourceName: string;
  sentimentLabel: SentimentLabel;
  biasLabel: BiasLabel;
  leftPercentage: number;
  centerPercentage: number;
  rightPercentage: number;
  confidence: number;
}

/**
 * Related articles via pgvector cosine similarity (AGENTS.md section 20).
 * `embedding` is the raw pgvector text representation already read off the
 * current article's `article_analyses` row -- Postgres casts it to `vector`
 * for the RPC parameter, so no client-side parsing is needed. Uses the
 * service-role client per section 20's explicit instruction; the underlying
 * SQL function is `security invoker` and only returns fields already public
 * under the existing RLS policies.
 */
export async function getRelatedArticles(
  articleId: string,
  embedding: string,
): Promise<RelatedArticle[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("match_related_articles", {
    query_embedding: embedding,
    exclude_article_id: articleId,
    match_count: 5,
  });

  if (error) {
    throw new Error(`Failed to load related articles: ${error.message}`);
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    sourceName: row.source_name,
    sentimentLabel: row.sentiment_label,
    biasLabel: row.bias_label,
    leftPercentage: row.left_percentage,
    centerPercentage: row.center_percentage,
    rightPercentage: row.right_percentage,
    confidence: row.confidence,
  }));
}
