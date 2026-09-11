# Oxylabs Scraping Pipeline (Manual)

## Goal

Implement the manual scrape-to-insert pipeline (AGENTS.md section 9) end to
end: `POST /api/scrape` loads active sources from Supabase, fetches each
source's homepage live through Oxylabs, extracts candidate article links,
filters out non-article pages, dedupes against existing articles, scrapes
and validates each detail page, cleans the body text, and appends valid
articles to `articles`. Returns a run summary and logs progress to the
terminal and the `logs` table.

Out of scope for this pass (separate prompt files per AGENTS.md section 4):
Oxylabs Scheduler / `/api/cron/pipeline` (section 18), AI analysis (section
19), pgvector (section 20). The pipeline is structured so the scheduler pass
can reuse the homepage-processing step later, per section 9's note that
manual and scheduler flows "differ only in ... where the homepage HTML comes
from."

## Skills read

- `.agents/skills/oxylabs-web-scraper/SKILL.md` + `examples.md` — Basic
  Auth, `POST https://realtime.oxylabs.io/v1/queries`, `source: "universal"`
  for arbitrary URLs, `render: "html"` for JS-heavy pages, response shape
  `{ results: [{ content, status_code, url }] }`, 180s client timeout
  guidance for rendered requests.
- `.agents/skills/supabase/SKILL.md` — RLS/security checklist (already
  applied when the schema was created), joined-table filter gotcha (already
  reflected in `getPendingArticles`).

## Existing code inspected

- `supabase/schema.sql`, `lib/supabase/types.ts` — `sources`, `articles`
  tables already match AGENTS.md section 7 exactly. No schema changes
  needed.
- `lib/supabase/service-role.ts` — server-only service-role client, already
  correct.
- `lib/supabase/queries/sources.ts` — `getActiveSources()` exists, no
  ID-filtered variant yet.
- `lib/supabase/queries/articles.ts` — `findExistingUrls()` (chunks of 15,
  matches the URL existence check) and `insertArticle()` already exist and
  are correct as-is; will be reused unmodified.
- `lib/supabase/queries/logs.ts` — `insertLog()` exists, unused so far.
- No `app/api/` directory exists yet — this is the first API route in the
  project.
- `package.json` — no `cheerio` dependency yet; `zod` is present only as a
  transitive dependency (not in `package.json` directly).
- `.env.local` / `.env.example` — `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD`
  are already set locally. No `LUCENT_ADMIN_SECRET` yet in either file.
  `.env.local` has a leftover `x-SKEW-admin-secret=wjowijfaoi89982` line
  from a different project template.
- Checked the live `sources` table via a read-only REST call (anon key,
  respects RLS `active = true` policy) — it is currently empty.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  — confirmed this Next.js version's Route Handler conventions (`route.ts`
  exporting `GET`/`POST`, native `Request`/`Response`, no special changes
  needed here).

## Decisions / assumptions (confirmed with you)

1. **Admin secret**: reuse the stray value under the correct name. I'll set
   `LUCENT_ADMIN_SECRET=wjowijfaoi89982` in `.env.local`, remove the old
   `x-SKEW-admin-secret` line, and add `LUCENT_ADMIN_SECRET=` (blank) to
   `.env.example`.
2. **Seed sources**: since `sources` is empty and AGENTS.md forbids
   inventing scraper-internal URLs, I'll give you SQL to seed four real,
   well-known news homepages so the pipeline has something to scrape:
   - Reuters — `https://www.reuters.com/`
   - NPR — `https://www.npr.org/`
   - BBC News — `https://www.bbc.com/news`
   - The Guardian (US edition) — `https://www.theguardian.com/us`
   You run this yourself in the Supabase SQL Editor (matching the project's
   existing "paste into SQL Editor" workflow) before testing. I'm not
   executing writes against your database directly.
3. **Only a generic `default` extraction strategy this pass.** `sources.parser_strategy`
   is read but not branched on yet — AGENTS.md section 11 only asks for
   source-specific strategies "when generic homepage extraction is not
   enough," which I can't evaluate until the generic version is running
   against real sites. Building four bespoke per-site parsers now would be
   speculative/unrequested (section 21). The extraction/validation code is
   written as a single pluggable module so a source-specific override can be
   added later without restructuring.
4. **"Visible story card" links approximated via URL-shape heuristics, not
   DOM visibility.** True visibility detection needs a rendered browser per
   page (expensive, and `render: "html"` output is still raw HTML, not a
   layout tree). Instead: collect all same-origin `<a href>` links from the
   homepage, normalize them, reject anything matching the non-article reject
   list (section 9) by path keyword, then keep only URLs matching an
   article-shape heuristic (dated path segment, or a long multi-hyphen slug,
   or a trailing numeric article ID). This is the same signal a human uses
   to tell a story link from a nav link, and keeps nav/footer/category noise
   out without a headless browser.
5. **No `render: "html"` by default.** News homepages are typically
   server-rendered with anchors present in the initial HTML. Adding
   `render: "html"` to every request would raise cost/latency for all
   sources to accommodate the rare JS-only case. If a seeded source turns
   out to need it, we can flip it per-source later (not blocking this pass).
6. **Detail pages fetched sequentially per source, not in parallel.** Keeps
   Oxylabs concurrency and logging order predictable. Stops early once
   `limitPerSource` valid articles are inserted for that source.
7. **Run logging goes to both the terminal (`console.log`, per section 17)
   and the `logs` table** (via the existing `insertLog()`, best-effort —
   a logging failure never aborts the scrape). The table and query function
   already exist for exactly this purpose and a future `GET /api/logs`
   route (not built in this pass) will read it back.
8. **`GET /api/logs` is not built in this pass** — out of scope; this
   prompt only needs the pipeline to *write* logs, not a route to read them.

## Files likely to change

New:
- `lib/oxylabs/client.ts` — Oxylabs Realtime `universal` fetch wrapper.
- `lib/parsing/normalize-url.ts` — URL normalization (strip tracking
  params/fragment/trailing slash) shared by extraction, dedupe, and
  existence checks.
- `lib/parsing/reject-patterns.ts` — the non-article reject list (section 9)
  as testable path-matching logic, single source of truth.
- `lib/parsing/extract-candidate-links.ts` — homepage HTML → filtered,
  deduped candidate URLs (sections 11–12).
- `lib/parsing/validate-article.ts` — detail-page HTML → cleaned article
  fields + accept/reject decision (section 13).
- `lib/pipeline/types.ts` — `SourceScrapeResult`, `ScrapeSummary`,
  rejection-reason types.
- `lib/pipeline/logger.ts` — run-logging helper (console + best-effort
  `logs` table writes).
- `lib/pipeline/process-homepage.ts` — steps 3–8 of the pipeline for one
  source, given its homepage HTML (reusable by the future scheduler pass).
- `lib/pipeline/manual-scrape.ts` — orchestrates the full manual run: live
  homepage fetch per source (step 2) + `process-homepage` + summary
  aggregation.
- `lib/auth/admin-secret.ts` — `x-LUCENT-admin-secret` header check.
- `app/api/scrape/route.ts` — thin `POST` handler.

Modified:
- `lib/supabase/queries/sources.ts` — add `getActiveSourcesByIds(ids)`.
- `package.json` — add `cheerio` and `zod` as direct dependencies.
- `.env.local`, `.env.example` — `LUCENT_ADMIN_SECRET` (see decision 1).

## Implementation requirements

**`lib/oxylabs/client.ts`**
- `fetchPage(url: string): Promise<{ html: string; statusCode: number }>`
  — `POST https://realtime.oxylabs.io/v1/queries` with Basic Auth from
  `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD`, `{ source: "universal", url }`.
- Abort via `AbortController` at 90s. Throw a typed error including the URL
  and status/reason on non-2xx HTTP, missing `results[0]`, or timeout —
  callers treat this as a per-URL failure, not a crash.

**`lib/parsing/normalize-url.ts`**
- `normalizeUrl(rawUrl: string, baseUrl: string): string | null` — resolve
  relative URLs against `baseUrl`, lowercase scheme+host, drop the fragment,
  strip known tracking params (`utm_*`, `fbclid`, `gclid`, `ref`, `cmpid`,
  `icid`), drop a trailing slash (except root). Return `null` for
  unparseable or non-`http(s)` URLs (e.g. `mailto:`, `javascript:`).

**`lib/parsing/reject-patterns.ts`**
- `isRejectedPath(pathname: string): boolean` matching the section 9
  non-article reject list by path keyword (category/section, topic/tag,
  author, search, show/program/podcast, live, game, product/review/shop,
  corporate/support, newsletter/subscribe). Export the pattern list so both
  candidate extraction and the pre-detail-scrape re-check (pipeline step 4)
  call the same function.

**`lib/parsing/extract-candidate-links.ts`**
- `extractCandidateLinks(homepageHtml: string, sourceUrl: string): string[]`
  — load with `cheerio`, collect all `<a href>`, normalize via
  `normalizeUrl`, keep only same-origin links, drop anything
  `isRejectedPath`, keep only links matching an article-shape heuristic
  (dated path segment `/\d{4}\/\d{1,2}(\/\d{1,2})?\//`, or last path segment
  with length ≥ 20 and ≥ 3 hyphens, or a trailing numeric ID ≥ 6 digits),
  dedupe, return in document order.

**`lib/parsing/validate-article.ts`**
- `validateAndCleanArticle(html: string, url: string): ArticleValidationResult`
  where the result is a discriminated union: `{ ok: true, article: { title,
  imageUrl, publishedAt (ISO string), canonicalUrl, rawText } } | { ok:
  false, reason: RejectionReason }`.
- Strip `script, style, noscript, nav, footer, header, aside, iframe, form`
  and elements whose `class`/`id` matches noise keywords (ad, newsletter,
  subscri, social-share, related, most-viewed/most-popular, recommend,
  comments, promo, cookie) before extracting anything.
- Pick an article container by trying selectors in priority order (`article`,
  `[itemprop="articleBody"]`, `[class*="article-body"]`,
  `[class*="story-body"]`, `[class*="post-content"]`,
  `[class*="entry-content"]`, `main`, `body`) and using the first with ≥ 3
  `<p>` of ≥ 40 chars, falling back to whichever has the most total
  paragraph text.
- `rawText` = cleaned paragraphs (≥ 40 chars each, boilerplate lines like
  "Sign up", "Subscribe", "Advertisement", "Share this article" filtered)
  joined with blank lines.
- **Article content gate**: reject unless title, `imageUrl`, and
  `publishedAt` are all present, and (`meaningfulParagraphs >= 3` OR
  `rawText.length >= 900`).
- `title`: `meta[property="og:title"]` → `<title>` (strip `" | Site"` /
  `" - Site"` suffix) → first `<h1>`. Reject if empty or < 10 chars.
- `imageUrl`: `meta[property="og:image"]` → `meta[name="twitter:image"]`.
  Reject if missing.
- `publishedAt`: try `meta[property="article:published_time"]`,
  `meta[name="date"]`, `meta[itemprop="datePublished"]`, `time[datetime]`,
  then `datePublished` inside any `application/ld+json` block (including
  `@graph` arrays). Parse with `new Date(...)`; reject if missing/invalid.
- `canonicalUrl`: `link[rel="canonical"]` href, normalized; `null` if
  absent. Reject if its path `isRejectedPath`.

**`lib/pipeline/process-homepage.ts`**
- `processSourceHomepage(source: SourceRow, homepageHtml: string, limit: number): Promise<SourceScrapeResult>`
  implementing pipeline steps 3–8 for one source:
  1. `extractCandidateLinks`.
  2. Re-check `isRejectedPath` (defensive, cheap).
  3. Dedupe candidates against each other, then against Supabase via
     `findExistingUrls` (existing chunked-15 helper) — skip duplicates.
  4. For each remaining candidate, in order, until `limit` valid articles
     are inserted or candidates are exhausted: `fetchPage`, then
     `validateAndCleanArticle`. On success, `insertArticle({ source_id,
     original_url: normalizedUrl, canonical_url, title, image_url,
     published_at, raw_text })`. On failure, record the rejection reason.
  5. Return counts (candidatesFound, candidatesRejectedBeforeDetail,
     duplicatesSkipped, detailPagesScraped, articlesInserted,
     articlesRejected, articlesFailed) + rejection reasons.
  - Log per-source lifecycle events via `lib/pipeline/logger.ts`.

**`lib/pipeline/manual-scrape.ts`**
- `scrapeSourcesManually(sources: SourceRow[], limitPerSource: number): Promise<ScrapeSummary>`
  — for each source: log "source start", `fetchPage(source.listing_url)`
  (catch and log a source-level error, continue to the next source on
  failure — never abort the whole run for one bad source), then
  `processSourceHomepage`. Aggregate into the final summary object (status,
  sourcesChecked, candidatesFound, candidatesRejected, duplicatesSkipped,
  detailPagesScraped, articlesInserted, articlesRejected, articlesFailed,
  totalDurationMs, rejectionReasons grouped by count). Log "scrape started"
  at the top and "scrape completed" with the summary at the end.

**`lib/pipeline/logger.ts`**
- `logRun(level: LogLevel, source: string, message: string, metadata?: Record<string, unknown>): void`
  — `console.log`/`warn`/`error` with a `[scrape]` prefix, formatted neatly,
  and fires `insertLog({ level, source, message, metadata })` without
  awaiting (`.catch(() => {})` so a DB hiccup never breaks the run).

**`lib/auth/admin-secret.ts`**
- `requireAdminSecret(request: Request): NextResponse | null` — reads
  `x-LUCENT-admin-secret`, compares to `process.env.LUCENT_ADMIN_SECRET`
  (constant-time not required at this scale, but must not short-circuit on
  first mismatched char in an obviously timing-sensitive way — a simple
  `===` is acceptable here since this guards a low-value internal
  endpoint, not a login). Returns a `401` `NextResponse.json(...)` on
  missing/invalid, `null` when valid.

**`app/api/scrape/route.ts`**
- `POST` only. Calls `requireAdminSecret`; returns its response if not
  `null`.
- Parses an optional JSON body with `zod`: `{ sourceIds?: string[],
  limitPerSource?: number }`. Missing/invalid body → treat as `{}` (all
  active sources, default limit), except a body that fails to parse as JSON
  when a body was actually sent → `400`.
- Loads sources: `getActiveSourcesByIds(sourceIds)` if provided, else
  `getActiveSources()`. `limitPerSource` defaults to `5`.
- Calls `scrapeSourcesManually` and returns the summary as JSON with `200`.
- Wrap in try/catch → `500` with a generic error message on unexpected
  failure (the pipeline itself already isolates per-source errors, so this
  only catches truly unexpected bugs).

**`lib/supabase/queries/sources.ts`**
- Add `getActiveSourcesByIds(ids: string[]): Promise<SourceRow[]>` —
  `.eq("active", true).in("id", ids)`, same error-handling style as
  `getActiveSources`.

## Security requirements

- `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD` and `LUCENT_ADMIN_SECRET` are read
  only in server-only modules (`lib/oxylabs/client.ts`,
  `lib/auth/admin-secret.ts`) — never imported by client components.
- `POST /api/scrape` rejects requests missing/mismatching
  `x-LUCENT-admin-secret` with `401` before doing any work.
- No Oxylabs credentials or the admin secret appear in logs (metadata
  objects passed to `logRun` must not include request headers wholesale).
- No secrets in the URL query string.

## Acceptance criteria

- Sources are loaded from Supabase, never hardcoded.
- Only same-origin, non-reject-list, article-shaped candidate URLs are
  detail-scraped.
- Duplicate URLs (already in `articles`) are never re-scraped or
  re-inserted.
- Articles are inserted only when they pass the full content gate (title,
  image, published date, and paragraph/char-count body threshold).
- A source-level failure (e.g. homepage fetch fails) does not stop other
  sources from being processed.
- The route returns the run summary object described in section 9.
- `npm run typecheck` and `npm run lint` pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- (`npm run build` only if something suggests a build-breaking issue;
  route handlers alone don't usually require it, but I'll run it since this
  is the first API route in the project and worth confirming it builds.)

## Manual test steps (after your approval and after you seed sources)

1. Run this once in the Supabase Dashboard → SQL Editor to seed sources:

   ```sql
   insert into public.sources (name, listing_url, active) values
     ('Reuters', 'https://www.reuters.com/', true),
     ('NPR', 'https://www.npr.org/', true),
     ('BBC News', 'https://www.bbc.com/news', true),
     ('The Guardian', 'https://www.theguardian.com/us', true);
   ```

2. Start the dev server and watch its terminal for `[scrape]` log lines:
   ```bash
   npm run dev
   ```

3. In another terminal, trigger a scrape of all active sources (default
   limit 5 per source):
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET" \
     -H "Content-Type: application/json"
   ```

4. Or scrape specific sources with a custom limit (replace the UUIDs with
   real `sources.id` values from your seed):
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"sourceIds": ["<source-uuid-1>"], "limitPerSource": 3}'
   ```

5. Confirm the `401` path:
   ```bash
   curl -i -X POST http://localhost:3000/api/scrape
   ```

6. Check inserted rows in Supabase Dashboard → Table Editor → `articles`,
   or via SQL: `select title, image_url, published_at, source_id from public.articles order by scraped_at desc limit 20;`
