# Wire Homepage to Supabase Data

## Goal

Replace `app/page.tsx`'s mock data (`lib/mock-articles.ts`) with real,
server-rendered reads from Supabase: published (analyzed) articles joined to
their source and analysis, respecting RLS. This pass only wires the home
page — the news details page (`app/article/[id]/page.tsx`) stays on mock
data for now (out of scope, confirmed with user).

## Skills read

- `.agents/skills/supabase/SKILL.md` — RLS/security checklist, public vs.
  service-role client usage, joined-table query patterns.

## Existing code inspected

- `app/page.tsx` — currently imports `mockArticles`, derives `categories`
  from `article.category` for `TopicFilter`, renders a `NewsCard` grid.
- `lib/mock-articles.ts` — `MockArticle` type/data with fields that don't
  exist in the real schema: `category`, `country`, `author`,
  `readTimeMinutes`, `publishedAgo` (pre-formatted string),
  `bodyParagraphs` (string array).
- `components/news-card.tsx` — `NewsCardProps` currently requires `category`
  and `country` (typed from `lib/mock-articles`'s `SentimentLabel`/`BiasLabel`).
- `components/topic-filter.tsx` — static pill row driven by `categories: string[]`.
- `supabase/schema.sql` / `lib/supabase/types.ts` — real schema. Relevant
  columns: `sources.name`, `sources.active`; `articles.title`,
  `articles.image_url`, `articles.published_at`, `articles.analyzed_at`,
  `articles.source_id`; `article_analyses.summary`, `.sentiment_label`,
  `.bias_label`, `.left_percentage`, `.center_percentage`,
  `.right_percentage`, `.confidence`. No `category`, `country`, `author`, or
  `read_time` columns anywhere.
- `lib/supabase/public.ts` — `createPublicClient()` using
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, RLS-restricted.
- `lib/supabase/queries/articles.ts` — existing functions
  (`findExistingUrls`, `insertArticle`, `getPendingArticles`) all use
  `createServiceRoleClient()` for the scrape/analysis pipeline. None of them
  read published articles for UI display.
- `supabase/schema.sql` RLS policies: `sources` readable when `active = true`;
  `articles` readable when `analyzed_at is not null`; `article_analyses`
  readable unconditionally (row only exists once analysis is saved). This
  means an anon-client query naturally returns exactly "active source +
  published article" rows — no extra `.eq()` filters needed for that part.
- Section 21 joined-table gotcha: never `.eq('foreignTable.column', value)`
  on an embedded relation — filter in JS after the query returns instead.

## Decisions / assumptions (confirmed with user)

1. **Drop category and country from the real homepage.** Neither field
   exists in the stored schema. `TopicFilter` is removed from `app/page.tsx`
   (no real taxonomy to back it), and cards no longer show a country badge.
   `components/topic-filter.tsx` is left in place unused (not deleted — it's
   a generic, harmless component; deleting it is an unrelated cleanup beyond
   this task's scope).
2. **Direct server-side Supabase read, no new API route.** `app/page.tsx`
   becomes an `async` Server Component that calls a new query function
   directly. This matches Next.js App Router convention for server-rendered
   read paths and AGENTS.md's read-route list (section 14) — which doesn't
   include an articles route — while still respecting "API: thin route
   handlers only" (no route handler needed when there's no HTTP boundary to
   cross).
3. **New query function uses the public (anon) client, not the service
   role.** Per architecture (section 5, "Database" layer serves reads to
   "Website"), and since RLS already encodes exactly the right public-read
   shape (active sources, analyzed articles, all analyses), the UI read path
   should go through `createPublicClient()` so a future bug can't leak
   unanalyzed articles or inactive-source rows to the browser. This is a new
   function, not a reuse of the pipeline's service-role functions in
   `lib/supabase/queries/articles.ts`.
4. **Query shape**: select `articles.*` with the embedded `sources(name)` and
   `article_analyses(*)` relations in one call, then in JS: filter out any
   row whose `article_analyses` is null (defensive — RLS should already
   guarantee an analyzed article has a matching analysis row per the
   pending-analysis invariant in section 19, but the join can theoretically
   return null if that invariant is ever violated), and order by
   `published_at` descending. No pagination/limit in this pass (matches
   "minimal" scope; add later if the article count grows).
5. **New function location**: add `getPublishedArticlesForHomepage()` to
   `lib/supabase/queries/articles.ts`, clearly separated from and documented
   apart from the existing service-role pipeline functions in that file
   (doc comment noting it uses the public client for UI reads, unlike the
   rest of the file).
6. **Relative time formatting** (`"2h ago"`): no date library is installed
   (checked `package.json`). Add a small `formatRelativeTime(iso: string):
   string` helper in `lib/utils.ts` (buckets: `just now`, `Xm ago`, `Xh ago`,
   `Xd ago`, then falls back to a short absolute date like `Jan 5`) — no new
   dependency for one function.
7. **`NewsCardProps.category` and `.country` become optional**, not removed,
   so `app/article/[id]/page.tsx` (still on mock data, still passing
   `category`/`country`) keeps compiling unchanged. The homepage simply
   omits them; `NewsCard` renders the source-name badge without a country
   segment and skips the `category · publishedAgo` caption's category half
   when `category` is undefined (caption becomes just `publishedAgo`).
8. **Empty state**: when the query returns zero articles (expected right now
   — nothing scraped/analyzed yet), render a centered message ("No analyzed
   articles yet.") in place of the grid, using existing text tokens
   (`text-body-s text-subtle`) — no new component needed.
9. **Image handling**: `articles.image_url` is `not null` in the schema (a
   save-time invariant per section 7/13), so `NewsCard`'s existing
   `imageUrl?` optional prop is passed a guaranteed string for real articles
   — no placeholder-vs-real branching logic needed beyond what `NewsCard`
   already has.
10. **`bias_label`/`sentiment_label` values map directly** to `NewsCard`'s
    existing `BiasLabel`/`SentimentLabel` unions — both already match the
    DB's `check` constraints exactly, so no translation layer is needed
    beyond importing the types from `lib/supabase/types.ts` instead of
    `lib/mock-articles.ts` for the real data path.

## Files likely to change

- `app/page.tsx` — becomes `async`, fetches real data, drops `TopicFilter`
  usage, renders empty state when no articles.
- `lib/supabase/queries/articles.ts` — add `getPublishedArticlesForHomepage()`
  (public client) and a return type describing the joined shape.
- `components/news-card.tsx` — make `category`/`country` optional in
  `NewsCardProps`; adjust caption rendering when absent; source the
  `SentimentLabel`/`BiasLabel` types from `lib/supabase/types.ts` (re-export
  or import from there instead of `lib/mock-articles.ts`, since the real
  schema's types are now canonical).
- `lib/utils.ts` — add `formatRelativeTime()`.
- No changes to `app/article/[id]/page.tsx`, `lib/mock-articles.ts`,
  `components/topic-filter.tsx`, or `components/ui/*` (out of scope; kept
  working as-is on mock data).

## Implementation requirements

- Use `createPublicClient()` (not service role) for the new homepage query
  function — this is a browser-facing read path and must go through the
  same RLS the anon key enforces in production.
- Do not add a new API route; the Server Component calls the query function
  directly (no `fetch()` to `/api/*` from `app/page.tsx`).
- Follow the joined-table gotcha: use Supabase's embedded-resource select
  (e.g. `.select("*, sources(name), article_analyses(*)")`) with no
  `.eq()`/filter on the embedded tables' columns; do any additional
  filtering/sorting in JS after the data returns.
- Order results by `published_at` descending.
- Type the function's return value explicitly (no `any`); derive it from
  `ArticleRow`/`ArticleAnalysisRow`/`SourceRow` (`Pick<SourceRow, "name">`)
  rather than hand-rolling a loose shape.
- `formatRelativeTime` takes an ISO timestamp string and returns a short
  human string; keep it pure and dependency-free.
- Keep the Website/Database layering: `app/page.tsx` only renders what the
  query function returns — no Supabase client construction or query logic
  inlined in the page component.

## Security requirements

- No service-role key on this path — homepage reads must use the anon key
  only, so a mistake here can't over-fetch beyond what RLS already allows
  for anonymous users.
- No secrets, headers, or admin-secret checks needed (this is a public GET
  render path, not an action route per section 15).
- No user input is accepted on this page in this pass (no search/filter
  params wired to the query).

## Acceptance criteria

- With zero rows in `articles`/`article_analyses` (current real state),
  `http://localhost:3000` renders the header, "Top News" heading, and the
  empty-state message — no crash, no mock data visible.
- After manually inserting one active source + one analyzed article +
  analysis row (via SQL Editor, for testing), the homepage renders a real
  `NewsCard` with: title, source name, relative published time, sentiment
  badge, "AI-estimated framing" caption, bias bar (L/C/R summing to 100),
  and confidence — sourced entirely from Supabase, no mock import remaining
  in `app/page.tsx`.
- `app/article/[id]/page.tsx` still compiles and renders unchanged (mock
  data path untouched).
- `npm run typecheck` and `npm run lint` pass with no `any`.
- No inactive source's or unanalyzed article's data can appear (enforced by
  RLS via the anon client, not by application-level filtering alone).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (data-fetching change to a route/page)

## Manual test steps

1. `npm run dev`.
2. Open `http://localhost:3000` — confirm it renders the empty-state message
   (expected, since no articles are analyzed yet) instead of erroring.
3. In the Supabase Dashboard SQL Editor, insert one test row each into
   `sources` (`active = true`), `articles` (`analyzed_at` set to `now()`,
   valid `image_url`/`published_at`), and `article_analyses` (percentages
   summing to 100, valid `sentiment_label`/`bias_label`) referencing that
   source/article.
4. Refresh `http://localhost:3000` — confirm the seeded article now renders
   as a real `NewsCard` with correct title, source name, relative time,
   sentiment badge, and bias bar.
5. Set that source's `active = false` (or the article's `analyzed_at` back to
   `null`) and refresh — confirm the card disappears (RLS is doing its job).
6. Open `http://localhost:3000/article/1` — confirm the mock-data details
   page still renders unaffected.
7. Watch the terminal running `npm run dev` for any Supabase/query errors
   during these steps.
