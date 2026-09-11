# pgvector + Related Articles (AGENTS.md section 20)

## Goal

Enable pgvector, add an `embedding vector(1536)` column to `article_analyses`,
update the AI analysis pipeline to generate and save an embedding alongside
every analysis (plus backfill embeddings for already-analyzed legacy rows),
and add a "Related Articles" section to the news details page powered by
cosine-similarity search.

## Skills read

- `.agents/skills/supabase/SKILL.md` (Supabase conventions, RLS/security
  checklist, "verify against current docs" principle)
- `.agents/skills/ai-sdk/SKILL.md`, plus the bundled, version-matched docs at
  `node_modules/ai/docs/07-reference/01-ai-sdk-core/05-embed.mdx` and the
  installed `@ai-sdk/openai` type defs (`embeddingModel` is current;
  `textEmbeddingModel` is deprecated in the installed version)
- Fetched current Supabase pgvector guidance
  (`https://supabase.com/docs/guides/ai/vector-columns.md`) confirming: (a)
  `create extension vector`, (b) PostgREST/supabase-js cannot order by a
  pgvector operator directly — a Postgres RPC function is required and
  called via `.rpc()`.

## Existing code inspected

- `supabase/schema.sql` — current tables, RLS policies, grants. `pgcrypto` is
  enabled with no schema qualifier, so pgvector will follow the same
  convention.
- `lib/supabase/types.ts` — hand-written `Database` types (no codegen).
  `Functions` is currently `Record<string, never>`.
- `lib/ai/schema.ts` / `lib/ai/analyze-article.ts` — Zod-validated structured
  analysis output via `generateText` + `Output.object`; `ANALYSIS_MODEL_ID`
  pattern to mirror for the embedding model id.
- `lib/pipeline/analyze.ts` / `analyze-types.ts` — batch runner:
  `analyzeOneArticle` retries analysis once, then calls
  `insertArticleAnalysis`, which inserts the row and then sets
  `articles.analyzed_at`.
- `lib/supabase/queries/article-analyses.ts` — `insertArticleAnalysis`.
- `lib/supabase/queries/articles.ts` — `getPendingArticles` (LEFT JOIN,
  pending = no `article_analyses` row), `getPublishedArticleById` /
  `getPublishedArticlesForHomepage` (public/anon client, `select("*, ...")` so
  `article_analyses(*)` already includes any new column with no query
  changes needed).
- `lib/supabase/service-role.ts` — service-role client factory.
- `app/api/analyze/route.ts` — thin handler, just calls `analyzeArticles()`
  and returns the summary JSON; no changes needed here since the summary
  shape change flows through automatically.
- `app/article/[id]/page.tsx` — news details page, server component.
- `components/news-card.tsx` — exact card shape needed for "Related
  Articles" (href, title, sourceName, publishedAgo, sentiment/bias fields,
  percentages, confidence, imageUrl) — will be reused as-is, no new
  component needed.
- `app/page.tsx` — shows the same `NewsCard` grid pattern to mirror for the
  related-articles grid.

## Decisions / assumptions

1. **Extension + column via one idempotent SQL block appended to
   `supabase/schema.sql`**, following the file's existing `if not exists`
   style so it can be re-run safely (this doubles as the exact "ALTER SQL"
   to paste into the Supabase Dashboard SQL Editor):
   - `create extension if not exists vector;` (no schema qualifier, matching
     `pgcrypto`)
   - `alter table public.article_analyses add column if not exists embedding vector(1536);`
   - IVFFlat cosine index: `using ivfflat (embedding vector_cosine_ops) with (lists = 100)`
   - A `match_related_articles` SQL function (`security invoker`, fully
     schema-qualified table names, no `set search_path` override since
     invoker context doesn't carry the definer search-path-hijack risk) that
     joins `articles` + `article_analyses` + `sources`, filters
     `embedding is not null`, `analyzed_at is not null`,
     `id <> exclude_article_id`, orders by `<=>`, limits to `match_count`
     (default 5). Called via `.rpc()` from `getRelatedArticles`, per section
     20's requirement (RPC is required — PostgREST can't order by a pgvector
     operator natively).
2. **Wire format**: `embed()` (AI SDK) returns `number[]`, which is what
   Supabase's own docs pass straight into an insert for a vector column —
   used as-is for `article_analyses.embedding` inserts/updates. Reading the
   column back through PostgREST returns the pgvector text representation
   (a string), so `Database["public"]["Tables"]["article_analyses"]["Row"]["embedding"]`
   is typed `string | null`, and `getRelatedArticles(articleId, embedding)`
   takes that string straight through as the RPC's `query_embedding` arg
   (Postgres casts the text literal to `vector` for the function parameter —
   no client-side parsing needed).
3. **Embedding input text**: reuse the same truncation constant
   (`MAX_ARTICLE_TEXT_CHARS`) already used for the analysis prompt, embedding
   `${title}\n\n${truncated raw_text}`.
4. **New-analysis flow (no more overbuilding than necessary)**: for an
   article with no `article_analyses` row yet, generate the structured
   analysis (existing retry-once behavior unchanged), then generate the
   embedding (same retry-once pattern). If the embedding fails after retry,
   the whole article is marked failed for this run and **nothing is
   inserted** — the article stays in the "no analysis row" bucket and gets
   fully retried (analysis + embedding) on the next run. If both succeed,
   `embedding` is included directly in the single `article_analyses` insert,
   and `analyzed_at` is set immediately after — satisfying "update
   `analyzed_at` only after both analysis and embedding are saved" without
   introducing a partial-row intermediate state for the live path.
5. **Legacy backfill flow**: rows that already existed before this column
   existed have `analyzed_at` set but `embedding is null`. A separate query,
   `getArticlesPendingEmbedding()`, finds these (`article_analyses` joined to
   `articles`, filtered `embedding is null` directly on `article_analyses` —
   not a joined-table filter, so the section 21 gotcha doesn't apply). Each
   run backfills these in the same batch size, retry-once, and
   `updateArticleAnalysisEmbedding(analysisId, embedding)` — no
   `analyzed_at` change needed since it's already set. This is exactly the
   mechanism section 20 describes.
6. **`AnalysisSummary` gains two fields**: `embeddingsChecked` and
   `embeddingsBackfilled`. Backfill failures are pushed into the existing
   `failures` array (reason prefixed `"embedding backfill failed: ..."`) so
   the type surface doesn't grow further and `status`/`articlesFailed`
   keep meaning "did anything go wrong in this run."
7. No new API route, no new env vars (`OPENAI_API_KEY` already covers
   embeddings), no changes to `app/api/analyze/route.ts` needed.
8. Related Articles section reuses the existing `NewsCard` component and its
   `/article/[id]` href pattern — no new UI component.

## Files likely to change

- `supabase/schema.sql` (extension, column, index, RPC function)
- `lib/supabase/types.ts` (`embedding` column on `article_analyses`
  Row/Insert/Update, `Functions.match_related_articles`)
- `lib/ai/analyze-article.ts` (add `EMBEDDING_MODEL_ID`, `embedArticleOnce`)
- `lib/pipeline/analyze-types.ts` (`AnalysisSummary` new fields)
- `lib/pipeline/analyze.ts` (embed-then-insert for new analyses; embedding
  backfill loop for legacy rows)
- `lib/supabase/queries/article-analyses.ts`
  (`getArticlesPendingEmbedding`, `updateArticleAnalysisEmbedding`)
- `lib/supabase/queries/articles.ts` (`getRelatedArticles`, per section 20's
  explicit instruction to put it here)
- `app/article/[id]/page.tsx` (fetch + render Related Articles section)

## Implementation requirements

- Do not touch scraping, Oxylabs, or Clerk code.
- Keep UI as a pure display of stored/queried data (no client-side
  mutation); related-articles fetch happens server-side in the page
  component via the service-role client, per section 20.
- Only show the Related Articles section when the current article has a
  non-null `embedding`; otherwise render nothing extra (no empty section, no
  loading state needed since it's a server component).
- Use `openai.embeddingModel(EMBEDDING_MODEL_ID)` (not the deprecated
  `textEmbeddingModel`).
- Follow the existing `chunk`/batch-size pattern already in `analyze.ts` for
  the backfill loop instead of introducing a new batching helper.
- Log embedding backfill progress and completion with `logRun`, matching the
  existing console log style (batch start/end, per-article result, final
  counts in the summary object).

## Security requirements

- Never expose `OPENAI_API_KEY` or the service-role key to the browser (both
  already server-only; no new exposure surface introduced).
- The `match_related_articles` function must be `security invoker` (not
  `security definer`) — it must not bypass RLS or run with elevated
  privileges; it's called through the service-role client precisely because
  the pipeline layer, not the public client, needs unrestricted read access
  for this feature.
- No new columns or tables are exposed to `anon`/`authenticated` beyond what
  the existing `article_analyses` public-read policy already permits (the
  new `embedding` column falls under that same existing policy — no new
  grant needed).
- Do not select or forward the raw `embedding` string into any client
  component prop or client bundle; it's only read and used server-side.

## Acceptance criteria

- `pgvector` extension enabled; `article_analyses.embedding vector(1536)`
  exists with an IVFFlat cosine index.
- Running `POST /api/analyze` on unanalyzed articles produces
  `article_analyses` rows with a non-null `embedding`, and `analyzed_at` is
  set only once both the analysis and the embedding are saved.
- Running `POST /api/analyze` again with no new articles (or after manually
  nulling an existing row's `embedding` in the SQL editor) backfills that
  row's embedding without re-generating its `summary`/`sentiment`/etc., and
  the response summary reports `embeddingsBackfilled >= 1`.
- The news details page for an analyzed article with an embedding shows a
  "Related Articles" section with up to 5 other analyzed articles, ordered
  by similarity, excluding itself.
- An article whose analysis has no embedding yet renders the page with no
  Related Articles section (no error).
- `getRelatedArticles` never leaks a raw embedding vector to the rendered
  page.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (route/server module and schema-adjacent changes warrant
  this)

## Manual test steps

1. In the Supabase Dashboard → SQL Editor, run the appended block from
   `supabase/schema.sql` (extension + column + index + function) once.
2. Confirm at least a few articles already have analyses (from prior
   `/api/analyze` runs). Their `embedding` will be `NULL` immediately after
   the ALTER.
3. Backfill legacy rows:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Watch the `next dev` terminal for `embedding backfilled` log lines, and
   check the JSON response for `embeddingsBackfilled`.
4. Scrape or otherwise insert a brand-new unanalyzed article, then re-run
   the same `curl` above — confirm its `article_analyses` row is inserted
   with a non-null `embedding` and `analyzed_at` set.
5. Open `http://localhost:3000/article/<id>` for an analyzed article that
   has at least a few other similar analyzed articles in the DB — confirm a
   "Related Articles" section renders below the main content with up to 5
   cards, none of which is the current article.
6. In the SQL editor, run
   `update article_analyses set embedding = null where article_id = '<id>';`
   for one article, reload its details page, and confirm the Related
   Articles section is simply absent (no error, no empty box).
