# News Details Page UI

## Goal

Build the LUCENT news details page (`app/article/[id]/page.tsx`) — full article
view with headline, hero image, body, and complete AI analysis (summary,
sentiment, framing percentages, confidence, framing notes, loaded terms,
disclaimer) plus a Related Articles section — using the attached Biasly-style
screenshot as a reference for *what elements exist and where*, but restyled
entirely to the LUCENT dark design system built in the previous two passes.
This is UI-only: static mock data, no Supabase/Clerk/pipeline wiring (same
posture as `prompts/homepage-ui.md`).

## Skills read

None of the approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`,
`ai-sdk`) apply — pure Next.js/Tailwind UI work. Per AGENTS.md section 3,
Next.js routing conventions come from `node_modules/next/dist/docs/` instead.

## Existing code inspected

- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  — confirms this Next version's dynamic route contract: `params` is a
  `Promise<{ id: string }>` that must be `await`ed in an async page component
  (breaking change from older Next versions per AGENTS.md's warning banner).
  The generated `PageProps<'/article/[id]'>` helper type is available.
- `app/page.tsx` — current homepage composition (`SiteHeader`, `TopicFilter`,
  "Top News" `h2`, `NewsCard` grid, `SiteFooter`), `max-w-[1400px]` container,
  `px-6 py-8` page padding.
- `lib/mock-articles.ts` — current `MockArticle` type/data: `id`, `title`,
  `sourceName`, `country`, `category`, `publishedAgo`, `sentimentLabel`,
  `biasLabel`, `leftPercentage`/`centerPercentage`/`rightPercentage`,
  `confidence?`. No body text, summary, framing notes, loaded terms,
  disclaimer, image, or author fields yet — all needed for the details page
  per AGENTS.md section 19's required analysis fields.
- `components/news-card.tsx` — homepage card; currently **not** a link (per
  `homepage-ui.md` decision #8, click-through was deferred to this prompt).
  Composed from `Card`, `Badge`, `BiasIndicator`.
- `components/article-card.tsx` — design-system demo card; establishes the
  image-placeholder treatment (`aspect-video` gradient + `source · country`
  overlay badge) reused everywhere images are needed.
- `components/ui/{card,badge,button,bias-indicator}.tsx` — primitives to
  reuse as-is (no new variants needed).
- `components/site-header.tsx` / `site-footer.tsx` — reused unchanged, wrap
  every page.
- `app/globals.css` — token set: colors (`base/surface/elevated/subtle/text`,
  `violet`, `cyan`, `red`, `bias-left`), type scale (`text-h1`–`h4`,
  `body-l/s`, `caption`), radii, shadows. H1 (22px/700) is the largest
  available display size — there is no bigger "hero headline" token.
- `lib/utils.ts` — `cn()` helper.
- Confirmed no `app/article/` route, no Supabase/Clerk packages exist yet.

## Screenshot interpretation

Layout, top to bottom: utility bar + header (already superseded by our own
`SiteHeader`) → breadcrumb ("Politics · United States") → headline → byline
(author, date, read time, save/share/more icons) → hero image with caption →
a "Bias Distribution" bar repeating the sidebar's bias bar → body paragraphs
→ "Related Stories" 2×3 card grid → newsletter signup band. Sidebar (right,
sticky-feeling): "Bias Analysis" panel (overall label, L/C/R bars, blurb,
"How We Analyze Bias" button), "AI Summary" panel (bullet list, disclaimer,
feedback button), "Source Breakdown" panel (12 total sources, L/C/R counts,
a per-source "Top Sources" bias table).

## Decisions / assumptions

1. **Static mock data**, extending `lib/mock-articles.ts` in place — same
   posture as the homepage pass. `MockArticle` gains: `author`,
   `readTimeMinutes`, `imageUrl?`, `summary`, `framingNotes`,
   `loadedTerms: string[]`, `disclaimer`, `bodyParagraphs: string[]`. All 9
   existing mock articles get these fields populated (not just article 1)
   so every homepage card and every related-articles link resolves to a
   working details page.
2. **Route**: `app/article/[id]/page.tsx`, async server component,
   `params: Promise<{ id: string }>` per the confirmed Next docs. Unknown
   `id` calls `notFound()` (`next/navigation`) → default Next 404.
3. **Homepage cards become links now.** `NewsCard` gains a required `href`
   prop and wraps its `Card` in `next/link`'s `Link` (block-level, with a
   focus-visible ring and a subtle hover border/elevation change) instead of
   duplicating link-wrapping in both `app/page.tsx` and the new related-
   articles grid. `app/page.tsx` passes `href={`/article/${article.id}`}`.
4. **Drop the duplicate "Bias Distribution" bar in the body.** The
   screenshot shows the same L/C/R data twice (inline + sidebar). One
   `BiasIndicator`-based "Bias Analysis" panel in the sidebar is the single
   source of truth — more cohesive than repeating a data viz twice on one
   page.
5. **Drop "Source Breakdown" / "Top Sources" entirely.** LUCENT's schema
   (section 7) is one row per article per source — there is no cross-source
   story clustering, so "12 total sources" / a per-outlet bias table has no
   backing data. This mirrors `homepage-ui.md` decision #7, which already
   dropped "N sources" from cards for the same reason.
6. **Drop the newsletter signup band and "How We Analyze Bias" /
   "Provide Feedback" buttons.** None are in section 1's feature list;
   they're unrequested chrome with no route to link to (`homepage-ui.md`
   dropped "Subscribe" for the same reason).
7. **Add an explicit sentiment badge**, placed in the "AI Summary" panel
   header. The screenshot has no sentiment field at all (Biasly's product
   doesn't track it), but AGENTS.md section 19 requires the details page to
   show sentiment — reuses the exact `Badge` variant mapping already
   established in `news-card.tsx`.
8. **Headline uses `text-h1`** (the largest existing type token) rather than
   introducing a new larger display size — keeps the page inside the
   established type scale instead of inventing one-off pixel values.
9. **Hero image reuses the established placeholder pattern** (`aspect-video`
   gradient + `source · country` overlay badge from `ArticleCard`/`NewsCard`)
   instead of inventing a new image treatment or a separate photo-credit
   caption field.
10. **Save/Share icon buttons are decorative-only** (`Button variant="ghost"
    size="icon"`, `Bookmark`/`Share2` from `lucide-react`), matching the
    existing non-functional bookmark button precedent on `ArticleCard`. No
    new onClick wiring, no modals.
11. **Back-to-home affordance**: a small underlined violet link ("← Back to
    Home") above the breadcrumb, since there's no breadcrumb navigation
    elsewhere on the page — matches the design system's documented "Link:
    underlined violet" style.
12. **Related Articles**: heading + `NewsCard` grid (reusing the same
    component, `href` into other mock articles), capped at 5 to mirror
    section 20's future pgvector "up to 5 similar articles" spec, excluding
    the current article. Static "other articles" selection now; swapped for
    a real `getRelatedArticles()` cosine-similarity query in the section 20
    prompt. Section is always shown in this mock pass (the "hide when no
    embedding" rule from section 20 applies once real embeddings exist).
13. **Two-column layout** on `lg+` (`grid-cols-1 lg:grid-cols-3`, main
    content spans 2 columns, sidebar spans 1), stacking to a single column
    on mobile with the sidebar rendering below the article body.

## Files likely to change

- `app/article/[id]/page.tsx` — new, the details page.
- `lib/mock-articles.ts` — extend `MockArticle` type + all 9 records with
  `author`, `readTimeMinutes`, `imageUrl?`, `summary`, `framingNotes`,
  `loadedTerms`, `disclaimer`, `bodyParagraphs`.
- `components/news-card.tsx` — add required `href` prop, wrap `Card` in
  `next/link`'s `Link`, add hover/focus affordance.
- `app/page.tsx` — pass `href` to each `NewsCard`.
- No changes to `components/ui/*`, `app/globals.css`, `app/layout.tsx`,
  `site-header.tsx`, `site-footer.tsx`, `app/design/page.tsx`.

## Implementation requirements

- Use only existing tokens/utilities — no new hex values or ad hoc pixel
  sizes.
- Reuse `Card`, `Badge`, `Button`, `BiasIndicator`, `SiteHeader`,
  `SiteFooter` as-is; no new `components/ui/*` primitives needed.
- Details page must render, per AGENTS.md section 19: article title, source,
  image, published date, sentiment label, AI-estimated framing label,
  left/center/right percentages, confidence, full summary, framing notes,
  loaded terms, and disclaimer — plus a "Related Articles" section.
- `app/article/[id]/page.tsx` is an async Server Component; `params` is
  awaited (`const { id } = await params`); unmatched `id` calls `notFound()`.
- `NewsCard`'s new `href` prop is required and typed `string`; the whole
  card surface is clickable with a visible `focus-visible` ring (keyboard
  accessible) and a hover state (e.g. border/elevation shift) using existing
  tokens only.
- Loaded terms render as a wrapped row of `Badge` chips (reuse existing
  variant, e.g. `neutral`), not a new pill component.
- Political framing must read as AI-estimated (reuse the "AI-estimated
  framing" caption convention already established on `NewsCard`).
- All new/edited components are Server Components; no `"use client"` needed
  (no interactivity beyond native `<Link>` navigation and hover/focus CSS).
- Responsive: single column with sidebar content stacked below the article
  body on mobile (~375px), two-column with sidebar on the right at `lg+`,
  no horizontal scroll at any width up to ~1440px.

## Security requirements

None — static mock data, no data fetching, no secrets, no user input.

## Acceptance criteria

- Clicking any homepage card navigates to `/article/[id]` and renders a full
  details page: back-to-home link, breadcrumb (category · country), H1
  title, byline (author · published-ago · read time · decorative
  bookmark/share buttons), hero image placeholder, body paragraphs, "Bias
  Analysis" sidebar panel (label + `BiasIndicator` + confidence), "AI
  Summary" sidebar panel (sentiment badge + summary + framing notes + loaded
  terms chips + disclaimer), and a "Related Articles" grid of up to 5 other
  `NewsCard`s that are themselves clickable.
- Visiting `/article/does-not-exist` renders Next's default not-found page.
- No hardcoded hex colors or arbitrary pixel values outside existing tokens.
- No "Source Breakdown"/multi-source table, no duplicate inline bias bar, no
  newsletter band, no dead "How We Analyze Bias"/"Provide Feedback" buttons.
- Responsive from ~375px to ~1440px with no horizontal scroll or overlap.
- `app/design/page.tsx` and the homepage still render unaffected.
- No Supabase/Clerk/API code introduced.

## Checks to run

- `npx tsc --noEmit` (no `typecheck` script exists in `package.json` yet;
  same effective check AGENTS.md section 22 calls for)
- `npm run lint`
- `npm run build` (new route + edited shared component)

## Manual test steps

1. `npm run dev`
2. Open `http://localhost:3000`, confirm cards are now clickable (hover/focus
   affordance visible) and each links to a distinct `/article/[id]`.
3. Click a card; confirm the details page renders all required sections
   listed in Acceptance Criteria, with L/C/R percentages summing to 100 and
   the sentiment/framing badges visibly marked as AI-estimated.
4. Click 2–3 more homepage cards (different mock articles) to confirm every
   article has full body/summary/loaded-terms content, not just the first.
5. From a details page, click into a "Related Articles" card and confirm it
   navigates to that article's own details page correctly.
6. Manually visit `http://localhost:3000/article/does-not-exist` and confirm
   the not-found page renders.
7. Resize from ~375px to ~1440px on a details page and confirm: sidebar
   stacks below the body on mobile, sits to the right at `lg+`, no
   horizontal scroll anywhere.
8. Confirm `http://localhost:3000/design` still renders unaffected.
