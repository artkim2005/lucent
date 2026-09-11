# Fix: Reuters articles save with no real body text

## Goal

Fix `lib/parsing/validate-article.ts` so Reuters (and any other Arc-Publishing-style
source) detail pages extract their real article paragraphs instead of silently
saving only byline/legal boilerplate as `raw_text`.

## Root cause (confirmed by inspecting live data + live HTML)

- Queried Supabase directly: existing Reuters `articles` rows have non-empty
  `raw_text`, but it is entirely footer boilerplate, e.g. `"Reporting by Akriti
  Shah and Jaspreet Singh in Bengaluru; Editing by Devika Syamnath\n\nOur
  Standards: The Thomson Reuters Trust Principles., opens new tab\n\n<author bio>"`.
  No real story content is present.
- Fetched a live Reuters detail page through the existing Oxylabs `universal`
  source (no JS rendering needed — content is present in static HTML) and
  inspected it directly. Reuters (Arc Publishing) renders each real paragraph as:
  ```html
  <div data-testid="paragraph-0" class="... article-body-module__paragraph__...">
    Aug 12 (Reuters) - Shares of CoreWeave ...
  </div>
  ```
  i.e. a `<div data-testid="paragraph-N">`, **not** a `<p>` tag. The page's
  `<article>` container has 13 of these real paragraph divs but only 5 `<p>`
  tags, and all 5 of those `<p>` tags are the trailing byline line
  ("Reporting by ..."), the "Our Standards: The Thomson Reuters Trust
  Principles..." legal line, a bare "Thomson Reuters" link, an author-bio
  paragraph, and a "Sign up here." CTA.
- `extractParagraphs()` in `lib/parsing/validate-article.ts` only selects
  `.find("p")` inside a container. For Reuters this returns zero real
  paragraphs. After boilerplate/length filtering, exactly 3 fake "paragraphs"
  remain (byline line, "Our Standards" line, author bio) — which is exactly
  `MIN_MEANINGFUL_PARAGRAPHS`, so the `article` container check
  (`meaningfulCount >= MIN_MEANINGFUL_PARAGRAPHS`) passes on garbage and
  returns early before the fallback selectors are ever tried. The article
  content gate then accepts the article and saves the boilerplate as
  `raw_text`.
- Verified this is Reuters-specific: sampled recent BBC, NPR, and Guardian
  articles in Supabase — all have real, substantial `raw_text` (their pages
  use real `<p>` tags), so no other active source is affected.

## Skills read

None of `.agents/skills/{clerk,supabase,oxylabs-web-scraper,ai-sdk}` apply —
this is a pure HTML-parsing fix inside `lib/parsing/validate-article.ts`
operating on HTML already fetched via the existing Oxylabs client. No schema
changes, no new Oxylabs calls/params, no AI/embedding changes.

## Existing code inspected

- `lib/parsing/validate-article.ts` — the article content gate and cleanup
  (AGENTS.md section 13); root cause lives here.
- `lib/pipeline/process-homepage.ts` — confirms `validateAndCleanArticle(html,
  url)` output is inserted as-is via `insertArticle`; no other transform step
  exists.
- `lib/pipeline/types.ts` — `ArticleValidationResult` / `CleanedArticle` shape,
  unaffected by this fix.
- `lib/oxylabs/client.ts` — confirms `fetchPage` uses `source: "universal"`
  with no JS rendering; not needed for Reuters since the real paragraphs are
  present in the static HTML already returned.
- Live Supabase `sources` table — all 4 active sources (BBC News, NPR, Reuters,
  The Guardian) currently have `parser_strategy: null`; nothing in code reads
  that column yet.

## Decisions / assumptions

- Fix generically, not by hardcoding a Reuters domain check: broaden the
  paragraph selector to also match `div[data-testid^="paragraph-"]` anywhere
  the existing container selectors already look. This is the standard Arc
  Publishing markup pattern (used by Reuters and other Arc-based outlets), so
  it's a safe, low-risk generic addition rather than a one-off hack, and it
  requires no change to the `validateAndCleanArticle(html, url)` signature or
  the `sources.parser_strategy` column (left unused, as it already is for all
  4 current sources).
- Also tighten `BOILERPLATE_PATTERN` to strip the two fixed-prefix boilerplate
  lines observed verbatim on every sampled Reuters page: lines starting with
  "reporting by" / "additional reporting by" and "our standards:". These are
  cheap, safe, anchored-prefix additions.
- Out of scope: generically stripping the trailing author-bio paragraph. It
  has no fixed prefix and a content-based heuristic risks false-positives on
  legitimate paragraphs of other sources. Once real paragraphs dominate the
  extracted text (13 real vs. 1 bio paragraph), the bio is a minor tail-end
  imperfection, not a correctness bug — acceptable per "do not overbuild".
- No dedupe risk: the paragraph divs are leaf nodes (no nested `<p>` or nested
  paragraph divs found in the sampled page), so combining `p,
  div[data-testid^="paragraph-"]` into one selector in document order will not
  double-count text.
- No backfill of existing bad Reuters rows in this prompt — out of scope
  unless requested separately. (Existing boilerplate-only Reuters rows will
  remain until re-scraped or manually deleted/re-run.)

## Files likely to change

- `lib/parsing/validate-article.ts` — update `CONTAINER_SELECTORS`-driven
  paragraph extraction (`extractParagraphs`) to select `p,
  div[data-testid^="paragraph-"]` instead of `p`; extend
  `BOILERPLATE_PATTERN` with the two new prefixes.

No other files change. No schema, API, or UI changes.

## Implementation requirements

1. In `extractParagraphs`, change the paragraph query from `.find("p")` to a
   combined selector that also matches `div[data-testid^="paragraph-"]`,
   keeping existing per-paragraph length/boilerplate filtering unchanged.
2. Extend `BOILERPLATE_PATTERN` to also match (case-insensitive, anchored at
   start of trimmed paragraph text):
   - `reporting by`
   - `additional reporting by`
   - `our standards:`
3. Do not change `MIN_PARAGRAPH_CHARS`, `MEANINGFUL_PARAGRAPH_CHARS`,
   `MIN_MEANINGFUL_PARAGRAPHS`, `MIN_BODY_CHARS`, `CONTAINER_SELECTORS`, or any
   other gate thresholds.
4. Do not touch `extractTitle`, `extractImage`, `extractPublishedAt`, or the
   canonical-URL / reject-list checks — unaffected by this bug.

## Security requirements

None — no new inputs, no new external calls, no secrets involved. Continues
to parse already-fetched HTML with `cheerio` only.

## Acceptance criteria

- Re-scraping the same Reuters URL used for investigation
  (`https://www.reuters.com/business/coreweave-super-micro-climb-signs-sustained-ai-buildout-2026-08-12`)
  produces `raw_text` that contains the real story paragraphs (e.g. starts
  with "Aug 12 (Reuters) - Shares of CoreWeave...") and is materially longer
  than today's ~600-char boilerplate-only text.
- `raw_text` for that article no longer consists solely of "Reporting by..."
  / "Our Standards: The Thomson Reuters Trust Principles..." lines.
- BBC, NPR, and Guardian extraction behavior is unchanged (still real `<p>`
  based content, same as today).
- `npm run typecheck` and `npm run lint` pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- (`npm run build` not needed — no routes/config/server-module surface
  changed.)

## Manual test steps

1. Start the dev server: `npm run dev`.
2. Trigger a manual scrape scoped to Reuters only:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "Content-Type: application/json" \
     -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET" \
     -d '{"sourceNames": ["Reuters"], "limitPerSource": 3}'
   ```
   (Adjust the body to match whatever `POST /api/scrape` currently accepts —
   confirm the request shape in `app/api/scrape` before running.)
3. Watch the terminal running `npm run dev` for the run log — confirm
   `articlesInserted` > 0 and no unexpected `body_too_short` rejections for
   Reuters.
4. Spot-check the newly inserted Reuters rows' `raw_text` in Supabase (Table
   Editor or SQL Editor) and confirm it reads like real article prose, not
   byline/legal boilerplate.
