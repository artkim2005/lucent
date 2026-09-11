# Homepage UI Implementation

## Goal

Build the LUCENT home page (`app/page.tsx`) — header, topic filter row, "Top
News" card grid, footer — matching the attached Biasly-style screenshot's
layout and features, but fully restyled to the LUCENT dark design system
(colors, type scale, radii, shadows, `Bricolage_Grotesque`) built in the
previous pass. This is UI-only: no Supabase, Clerk, or pipeline wiring in
this pass (confirmed with user — static mock data now, real queries in a
later prompt).

## Skills read

None of the approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`,
`ai-sdk`) apply — this is pure Next.js/Tailwind UI work. Per AGENTS.md
section 3, Next.js routing/UI patterns come from `node_modules/next/dist/docs/`
and existing project conventions instead.

## Existing code inspected

- `app/page.tsx` — placeholder `Home` component (`<div>Home</div>`), no styling.
- `app/layout.tsx` — loads `Bricolage_Grotesque`, sets `min-h-full flex flex-col` on `<body>`.
- `app/globals.css` — dark-only token set (`--color-base/surface/elevated/subtle/text`,
  `--color-violet`, `--color-cyan`, `--color-red`, `--color-bias-left`), type scale
  tokens (`text-h1`–`text-h4`, `text-body-l/s`, `text-caption`), radius/shadow tokens.
- `app/design/page.tsx` — style-guide page; confirms component usage patterns (`Panel`
  wrapper convention, `cn()` for conditional classes).
- `components/ui/card.tsx` — generic `Card` surface (`rounded-lg border border-elevated
  bg-surface shadow-md`).
- `components/ui/badge.tsx` — `neutral`/`accent`/`destructive` pill variants.
- `components/ui/button.tsx` — `primary`/`secondary`/`ghost`/`destructive` variants,
  `default`/`icon` sizes.
- `components/ui/bias-indicator.tsx` — three-segment L/Center/R pill row, already wired
  to `bias-left` (blue), `violet` (center), `red` (right) tokens — this is the
  canonical bias visualization and must be reused as-is on the homepage cards.
- `components/article-card.tsx` — existing demo card built for the design-system style
  guide (source overlay, category badge, 2-line title/description clamp, Read now/Save/
  bookmark footer). Its content shape (description + action buttons, no bias data, no
  published date) doesn't match what AGENTS.md section 19 requires on real homepage
  cards, so it is **not** reused directly for the homepage — see decisions below.
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge).
- No `lib/supabase`, no `supabase/`, no Clerk packages in `package.json` — confirmed no
  backend exists yet.

## Screenshot interpretation

Layout, top to bottom:

1. **Utility bar** (top-most strip): "Browser Extension" link, theme toggle
   (Light/Dark/Auto), date, "Set Location", "International Edition" selector.
2. **Header**: wordmark + "News" sub-label, primary nav tabs (Home / For You /
   Local / Blindspot, Home active/underlined), Subscribe (solid) + Login
   (outline) buttons on the right.
3. **Topic filter pill row**: horizontally laid out rounded pill chips (e.g.
   "World Cup +", "IPL", "Social Media +", "Business & Markets +", ...),
   scrollable/overflowing on smaller widths.
4. **"Top News" H2** section label.
5. **Card grid**: 3 columns × 4 rows (12 cards) on desktop. Each card: image
   (16:9-ish), small info icon top-right of image, category · country caption,
   bold 2-line title, three-segment bias bar with L/Center/Right percentages,
   "N sources" caption below the bar.
6. **Footer**: dark bar, four columns (brand + tagline, Company links, Help
   links, Connect social icons), copyright line.

## Decisions / assumptions

1. **Static mock data.** No Supabase yet, so `app/page.tsx` (or a co-located
   `lib/mock-articles.ts`) exports a local typed array of ~9–12 sample
   articles shaped like the future `articles` + `article_analyses` schema
   (section 7/19 fields: title, source name, category, published date,
   sentiment label, bias label, left/center/right %, confidence). This is
   throwaway data to prove the layout; it is replaced wholesale when the
   Supabase-backed homepage prompt runs. No `imageUrl` values — cards use the
   same gradient placeholder treatment already established in
   `components/article-card.tsx`, so no external image hosts are introduced.
2. **New `NewsCard` component**, not a reuse of `ArticleCard`. The existing
   `ArticleCard` was purpose-built for the design-system style guide (Read
   now/Save/bookmark actions, description text, no bias data). AGENTS.md
   section 19 requires homepage cards to show title, source, image, published
   date, sentiment label, AI-estimated framing label, L/C/R percentages, and
   confidence — a different shape. Building `components/news-card.tsx`
   composed from the existing `Card`, `Badge`, and `BiasIndicator` primitives
   keeps each component honest to its actual spec instead of overloading
   `ArticleCard` with two unrelated layouts.
3. **Drop the utility bar** (browser extension link, theme toggle, location
   picker, international edition). None of these are LUCENT features (section
   1's build list has no theme toggle, geolocation, or edition switching, and
   the design system is dark-only by decision in `prompts/design-system.md`).
   Keeping it would add unrequested, non-functional chrome.
4. **Drop "Subscribe."** Not in LUCENT's feature list (section 1). "Login"
   stays as a visual placeholder (`secondary` Button, non-functional) because
   Clerk auth is an explicitly planned LUCENT feature — this is scaffolding
   for that future prompt, not new unrequested functionality.
5. **Nav tabs are visual-only.** "For You", "Local", and "Blindspot" map to
   features outside LUCENT's scope (personalization, geo-editions, and a
   cross-source bias-comparison feature LUCENT's single-article-per-source
   schema doesn't support). Render them as static, muted, non-interactive
   labels (not links) so the header layout matches the screenshot without
   implying working routes. "Home" is the only active/styled tab.
6. **Topic pills are static and non-functional** — visual chips only, no
   filtering logic, no active/selected state persisted. Generic categories
   drawn from the mock articles' own categories (not Biasly's specific
   trending-topic taxonomy, since LUCENT doesn't track real trending topics).
7. **"N sources" is dropped from cards.** LUCENT's schema is one row per
   article per source (no cross-source story clustering — that's a Biasly-
   specific feature not in section 1's scope). It's replaced with the
   section-19-required fields the screenshot has no room for: a relative
   published date/time and a sentiment + confidence caption line.
8. **Cards are non-interactive (no links)** in this pass — the news details
   page doesn't exist yet. Cards render as static `Card` surfaces; click-
   through to `/article/[id]` is added when `news-details-page-ui` is built.
9. **Footer is static/decorative**, matching the screenshot's 4-column shape
   (brand+tagline, Company, Help, Connect) with placeholder link labels and
   `lucide-react` social icons; links have no real hrefs (`href="#"`) since
   none of those pages exist.
10. **AI-estimated disclaimer**: per section 19 ("Political framing must be
    shown as AI-estimated, not objective truth"), each card's bias row is
    preceded by a small caption "AI-estimated framing" so the requirement is
    visible at the card level, not just the future details page.

## Files likely to change

- `app/page.tsx` — full homepage implementation (header, topic pills, card
  grid, footer), or thin composition importing new section components.
- `lib/mock-articles.ts` — new, typed mock article data + shared
  `MockArticle` type mirroring the section 7/19 schema fields needed by the
  card.
- `components/news-card.tsx` — new, homepage card composed from `Card`,
  `Badge`, `BiasIndicator`.
- `components/site-header.tsx` — new, wordmark + nav tabs + Login button.
- `components/topic-filter.tsx` — new, static pill row (or inlined in
  `app/page.tsx` if small enough — implementer's call).
- `components/site-footer.tsx` — new, 4-column footer.
- No changes expected to `app/globals.css`, `app/layout.tsx`, or the existing
  `components/ui/*` primitives — this pass consumes them, doesn't extend them.

## Implementation requirements

- Use only existing design tokens/utilities (`bg-base`, `bg-surface`,
  `bg-elevated`, `text-text`, `text-subtle`, `text-violet`, `bg-violet/15`,
  `text-h1`–`text-h4`, `text-body-l/s`, `text-caption`, `rounded-*`,
  `shadow-*`) — no new hex values or ad hoc sizes introduced in this pass.
- Reuse `Card`, `Badge`, `Button`, `BiasIndicator` from `components/ui/*` for
  every applicable piece; do not re-implement their styles inline.
- `NewsCard` props: `title`, `sourceName`, `category`, `country`,
  `publishedAgo`, `sentimentLabel` (`positive | neutral | negative`),
  `biasLabel` (`left | center | right | mixed | unclear`), `leftPercentage`,
  `centerPercentage`, `rightPercentage`, `confidence?`, `imageUrl?` — typed,
  no `any`.
- Sentiment label styling: map `positive`/`neutral`/`negative` to a `Badge`
  variant (`accent` for positive, `neutral` for neutral, `destructive` for
  negative) — reuse existing variants, don't add new ones.
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (or 4 at `xl` if the mock
  count supports it cleanly) with consistent gap (`gap-6`), matching the
  8px-based spacing scale.
- Topic pill row must scroll horizontally on narrow viewports without
  wrapping awkwardly (`overflow-x-auto` + `flex` + hidden scrollbar is
  acceptable) rather than breaking layout.
- Header must collapse sensibly on mobile (nav tabs and Login remain
  reachable; acceptable to stack or hide overflow tabs behind a simpler
  mobile treatment — no hamburger menu required unless it's trivial, per
  "do not overbuild").
- All new components are server components by default; add `"use client"`
  only if genuinely needed (none of the planned pieces need client
  interactivity, since pills/tabs are static in this pass).
- Footer social icons: reuse `lucide-react` (already a dependency) — e.g.
  `Twitter`/`X`-style, `Linkedin`, `Instagram`, `Youtube` icons at consistent
  size/stroke matching the design system's icon spec (1.6px stroke, rounded
  caps).

## Security requirements

None — static mock data, no secrets, no data fetching, no new environment
variables, no user input.

## Acceptance criteria

- `app/page.tsx` renders a full homepage: header (wordmark, muted nav tabs,
  Login button), topic pill row, "Top News" H2, responsive card grid of
  mock `NewsCard`s, and a 4-column footer — in the LUCENT dark theme only.
- Every card shows: image placeholder, source · country line, category,
  published-ago, title (2-line clamp), sentiment badge, "AI-estimated
  framing" caption, `BiasIndicator` with L/C/R percentages that sum to 100,
  and confidence when present.
- No hardcoded hex colors or arbitrary pixel values outside the existing
  token set; everything traces back to `app/globals.css` tokens.
- No dead functional claims: nav tabs/pills/footer links that don't go
  anywhere are visually muted/static, not styled as if they work.
- Responsive: no horizontal scroll or overlap from mobile (~375px) through
  desktop (~1440px) widths.
- No Supabase/Clerk/API code introduced; `app/page.tsx` has no `"use server"`
  fetches or route handlers.
- No unrelated files touched (`components/ui/*`, `components/article-card.tsx`,
  `app/design/page.tsx`, `app/globals.css`, `app/layout.tsx` stay as-is).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new routes/components — build should be run per AGENTS.md
  section 22)

## Manual test steps

1. `npm run dev`
2. Open `http://localhost:3000` and confirm the homepage renders: header,
   topic pills, "Top News" heading, full card grid, footer.
3. Confirm every card shows a title, source/country/category line,
   published-ago, sentiment badge, "AI-estimated framing" caption, and a
   bias bar whose three percentages read clearly and sum to 100.
4. Resize the viewport from ~375px to ~1440px and confirm: no horizontal
   scroll, the card grid reflows (1 → 2 → 3 columns), the topic pill row
   scrolls horizontally instead of wrapping/breaking, and the header/footer
   stay usable.
5. Confirm `http://localhost:3000/design` still renders unaffected (no
   shared component regressions).
