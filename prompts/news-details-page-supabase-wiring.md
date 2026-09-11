# Wire News Details Page to Supabase Data

## Goal

Replace `app/article/[id]/page.tsx`'s mock data (`lib/mock-articles.ts`) with
a real, server-rendered read from Supabase: a single published (analyzed)
article joined to its source and analysis, respecting RLS. This mirrors
`prompts/homepage-supabase-wiring.md`, which already did the same for
`app/page.tsx` and left this page on mock data as an explicit follow-up.

Related Articles is dropped from this page in this pass (confirmed with
user) — pgvector/embeddings (AGENTS.md section 20) aren't implemented yet
(no `embedding` column exists), so there's no real similarity data to back
it. It comes back as its own feature once section 20 is implemented.

## Skills read

- `.agents/skills/supabase/SKILL.md` — RLS/security checklist, public vs.
  service-role client usage, joined-table query patterns, the
  `.eq('foreignTable.col', v)` gotcha (already documented in AGENTS.md
  section 21 and applied in the homepage query).

## Existing code inspected

- `app/article/[id]/page.tsx` — current async Server Component,
  `params: Promise<{ id }>`, `getMockArticleById` / `getRelatedMockArticles`,
  renders breadcrumb (`category · country`), H1 title, byline
  (`author · publishedAgo · readTimeMinutes`), hero image, body paragraphs,
  "Bias Analysis" sidebar card, "AI Summary" sidebar card, and a Related
  Articles grid.
- `lib/mock-articles.ts` — `MockArticle` fields that don't exist in the real
  schema: `category`, `country`, `author`, `readTimeMinutes`,
  `publishedAgo` (pre-formatted string), `bodyParagraphs` (string array,
  pre-split).
- `app/page.tsx` + `prompts/homepage-supabase-wiring.md` — the precedent this
  pass follows: `category`/`country`/`author`/`readTimeMinutes` were already
  dropped from the homepage cards for the same reason (no backing column).
  `NewsCardProps.category`/`.country` are already optional there.
- `lib/supabase/queries/articles.ts` — `getPublishedArticlesForHomepage()`
  is the existing public-client, joined-select pattern to mirror (embedded
  `sources(name)` + `article_analyses(*)`, no `.eq()` on the embedded
  tables, filter nulls in JS). No single-article-by-id query exists yet.
- `lib/parsing/validate-article.ts:247-248` — confirms `raw_text` is stored
  as cleaned paragraphs joined with `"\n\n"` (`paragraphs.join("\n\n")`), so
  splitting on `\n\n` at render time recovers the original paragraph
  breaks — no new body-formatting logic needed at scrape/analysis time.
- `supabase/schema.sql` / `lib/supabase/types.ts` — real columns:
  `articles.title/image_url/published_at/raw_text/analyzed_at`,
  `sources.name`, and every `article_analyses` column (`summary`,
  `sentiment_score/label`, `bias_score/label`, `left/center/right_percentage`,
  `confidence`, `framing_notes`, `loaded_terms`, `disclaimer`, `model`) —
  these already match the UI's field names 1:1 (section 19), no translation
  layer needed beyond typing.
- RLS (`supabase/schema.sql:133-146`): `articles` readable only when
  `analyzed_at is not null`; `article_analyses` readable unconditionally.
  So an anon-client fetch of an unanalyzed or nonexistent article id
  naturally returns no row — that's the `notFound()` signal, no extra
  application-level check needed.
- `components/news-card.tsx` — `category`/`country` already optional; no
  changes needed for this pass since Related Articles (the only other
  `NewsCard` usage on this page) is being removed.
- `lib/utils.ts` — `formatRelativeTime(iso)` already exists, reused as-is.

## Decisions / assumptions (confirmed with user)

1. **Related Articles section is removed entirely in this pass** (see
   Goal). `getMockArticleById`/`getRelatedMockArticles` imports and the
   `NewsCard` grid at the bottom of the page are deleted, not stubbed out
   with an empty-state placeholder — there is nothing to show yet, and an
   empty "Related Articles" heading with no cards would be confusing chrome.
2. **Drop `category`, `country`, `author`, `readTimeMinutes`** from the real
   details page — none exist in the schema, matching the homepage's
   precedent exactly. The breadcrumb line and byline segment for these are
   removed; the byline keeps `publishedAgo` (via `formatRelativeTime`) as
   its only text content besides the bookmark/share buttons.
3. **Body paragraphs**: split `articles.raw_text` on `/\n\n+/` at render
   time (a pure display transform of stored data, not analysis/mutation)
   to recover the paragraph array `bodyParagraphs.map` already expects.
4. **New query function**: add `getPublishedArticleById(id: string)` to
   `lib/supabase/queries/articles.ts`, using `createPublicClient()` (same
   RLS-respecting anon path as `getPublishedArticlesForHomepage`), selecting
   `*, sources(name), article_analyses(*)` filtered by `.eq("id", id)`,
   `.maybeSingle()`. Returns `null` when no row, when `sources` is null, or
   when `article_analyses` is null (defensive — mirrors the homepage
   function's null-filtering, not a new invariant). Typed off `ArticleRow` /
   `SourceRow` / `ArticleAnalysisRow`, no `any`.
5. **Page changes to a real query call**: `app/article/[id]/page.tsx` calls
   `getPublishedArticleById(id)`; `notFound()` when it returns `null`. No new
   API route — same direct-Server-Component-to-query-function pattern as
   the homepage (no HTTP boundary to cross for a server-rendered read).
6. **Image handling**: `articles.image_url` is `not null` in the schema, so
   the hero image always has a real URL for a real article — no
   placeholder-vs-real branching needed beyond what the existing JSX
   already does.
7. **Loaded terms / framing notes**: rendered as-is from
   `article_analyses.loaded_terms` (already `text[]`) and `.framing_notes`
   (nullable — render the "Framing Notes" block only when non-null, since
   the column is optional in the schema).

## Files likely to change

- `app/article/[id]/page.tsx` — becomes a real Supabase-backed Server
  Component: drop `category`/`country`/`author`/`readTimeMinutes` and the
  entire Related Articles section; derive `bodyParagraphs` from
  `raw_text.split(/\n\n+/)`; render the sidebar panels from the real
  `article_analyses` row.
- `lib/supabase/queries/articles.ts` — add `getPublishedArticleById(id)`
  (public client) with an explicit return type.
- No changes to `lib/mock-articles.ts` (still used by nothing after this
  pass, left in place — not this task's concern to delete), `app/page.tsx`,
  `components/news-card.tsx`, `components/ui/*`, or `lib/utils.ts`.

## Implementation requirements

- Use `createPublicClient()` (anon key), not service role, for the new
  query — same reasoning as the homepage: a browser-facing read path must
  go through the same RLS the anon key enforces in production.
- Do not add a new API route.
- Follow the joined-table gotcha: `.select("*, sources(name), article_analyses(*)")`
  with no `.eq()` on the embedded tables; filter/null-check in JS.
- Type `getPublishedArticleById`'s return value explicitly (no `any`),
  derived from `ArticleRow` / `Pick<SourceRow, "name">` / `ArticleAnalysisRow`.
- `app/article/[id]/page.tsx` stays an async Server Component; `params` is
  awaited exactly as it is today.
- Article body: split `raw_text` on `/\n\n+/`, trim each piece, drop any
  empty strings before mapping to `<p>` elements.
- Keep the Website/Database layering: the page only renders what the query
  function returns — no Supabase client construction or query logic inlined
  in the page component.

## Security requirements

- No service-role key on this path — anon key only.
- No secrets, headers, or admin-secret checks needed (public GET render
  path, not an action route per section 15).
- No user input beyond the route's own `id` param, which is only ever used
  in a parameterized `.eq("id", id)` filter (supabase-js parameterizes this;
  no raw SQL/string interpolation).

## Acceptance criteria

- Visiting `/article/<real analyzed article id>` renders the full details
  page sourced entirely from Supabase: title, source name, published time,
  hero image, body paragraphs (correctly split), sentiment badge, framing
  label, L/C/R percentages summing to 100, confidence, summary, framing
  notes (when present), loaded terms chips, and disclaimer — no mock data
  visible, no Related Articles section.
- Visiting `/article/<nonexistent-or-unanalyzed id>` renders Next's default
  not-found page (no crash).
- `app/page.tsx` still renders unaffected and its cards still link correctly
  into this page.
- `npm run typecheck` and `npm run lint` pass with no `any`.
- No inactive-source or unanalyzed-article data can appear (enforced by RLS
  via the anon client).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (data-fetching change to a route/page)

## Manual test steps

1. `npm run dev`.
2. In the Supabase Dashboard SQL Editor, insert one test row each into
   `sources` (`active = true`), `articles` (`analyzed_at` set to `now()`,
   `raw_text` containing at least two `\n\n`-separated paragraphs), and
   `article_analyses` (percentages summing to 100, valid
   `sentiment_label`/`bias_label`, `loaded_terms` with at least one entry)
   referencing that source/article — or reuse a real scraped+analyzed
   article if one already exists from prior testing.
3. Open `http://localhost:3000` and click that article's card.
4. Confirm the details page renders: real title/source/image/published
   time, correctly split body paragraphs, sentiment badge, AI-estimated
   framing label, bias bar (L/C/R summing to 100), confidence, summary,
   framing notes, loaded terms chips, and disclaimer — and that there is no
   Related Articles section anywhere on the page.
5. Manually visit `http://localhost:3000/article/00000000-0000-0000-0000-000000000000`
   (a well-formed but nonexistent UUID) and confirm the not-found page
   renders instead of an error.
6. Set the test article's `analyzed_at` back to `null` (or its source's
   `active` to `false`) and revisit its `/article/<id>` URL directly —
   confirm it now 404s (RLS hides it).
7. Watch the terminal running `npm run dev` for any Supabase/query errors
   during these steps.
