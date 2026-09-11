# Design System Implementation

## Goal

Implement the LUCENT design system (colors, typography, spacing, icons, grid,
shadows, radii, and core UI element primitives) as reusable Tailwind v4
tokens + React components, based on the attached design-system reference
image, so the home page and news-details page (built later) can be styled
consistently. This is foundation work only — no home/details page content is
being built in this pass.

## Skills read

None of the approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`,
`ai-sdk`) apply to this task. Per AGENTS.md section 3, Tailwind/shadcn work
uses existing project patterns and package docs instead.

## Existing code inspected

- `package.json` — Next 16.2.11, React 19.2.4, Tailwind v4 (`@tailwindcss/postcss`),
  no icon library, no `class-variance-authority`/`clsx`/`tailwind-merge`, no shadcn setup yet.
- `app/globals.css` — default `create-next-app` scaffold: `--background`/`--foreground`
  only, Geist fonts, light/dark via `prefers-color-scheme`.
- `app/layout.tsx` — loads `Geist`/`Geist_Mono` via `next/font/google`, sets them as
  CSS vars on `<html>`.
- `app/page.tsx` — placeholder `Home` component, no styling.
- `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` — confirms
  `next/font/google` API is unchanged in this Next version (no breaking changes to
  account for here).
- No `components/` directory exists yet.

## Reference image interpretation

**Brand**: Wordmark "Lucent" (bold) + "NEWS" pill badge. Tagline: "Balanced
news coverage, powered by AI."

**Colors** (dark theme only — the reference shows no light variant):

- Neutrals: Base `#08090F`, Surface `#0F1219`, Elevated `#161C2E`, Subtle `#3A4468`, Text `#E8ECF8`
- Primary: Violet `#7B6EFA`, Violet/15 (15% opacity tint for subtle backgrounds)
- Accent: Cyan `#22D3EE`, Red `#EF4444`

**Typography**: Bricolage Grotesque (variable grotesque, Google Font).

- H1 Display Title — 700 / 22px
- H2 Section Heading — 600 / 18px
- H3 Subsection Title — 600 / 15px
- H4 Card Label — 600 / 13px
- Body L — long-form paragraph text (regular weight, larger body)
- Body S — supporting/secondary copy (regular weight, smaller body)
- Caption — metadata, labels, timestamps (smallest, muted)

**Icons**: line style, 1.6px stroke, rounded caps (grid, bell, bookmark, gear, heart, bar-chart shown).

**Grid**: 12 columns, 16px gutter, 24px margin.

**Spacing**: 8px base scale — 8, 16, 24, 32, 40, 48.

**Shadows**: small / medium / large (dark-theme appropriate — subtle black elevation, since flat black shadows are invisible on `#08090F`; will use soft dark shadows with a faint violet-tinted ambient glow to read as elevation, matching the swatch look).

**Radius**: none / small / medium / large / full.

**UI elements**:

- Buttons: Primary (solid violet), Secondary (outline/light), Ghost (text-only), Destructive (solid red)
- Link: underlined violet, e.g. "Read full article →"
- Checkbox: checked (violet fill + check) / unchecked (outline)
- Tags/labels: pill badges — neutral (Politics, violet), accent (Business & Markets ★, cyan), destructive (Breaking, red)
- Bias indicator: three-segment pill row — "← Left 34%" (blue-ish), "Center 50%" (violet), "Right 16% →" (red)
- Card example: source line over image ("Reuters · United States"), image placeholder, tag + timestamp row, H3-style title (2-line clamp), Body S description (2-line clamp, muted), footer row with Primary "Read now" button, Secondary "Save" button, and a Ghost bookmark icon button

## Decisions / assumptions

1. **Dark-only theme.** The reference has no light-mode spec; implementing a
   light theme would be inventing colors not in the source. `globals.css`
   will drop the `prefers-color-scheme` light/dark split and ship the dark
   palette as the only theme.
2. **Font**: use `Bricolage_Grotesque` from `next/font/google` (variable font,
   confirmed available), replacing Geist Sans/Mono entirely per the reference.
3. **Icons**: add `lucide-react` (line icons, rounded caps by default, stroke
   width configurable to 1.6) since no icon library exists yet and the
   reference's icon set (grid/bell/bookmark/gear/heart/bar-chart) maps
   directly to Lucide icon names.
4. **Component conventions**: hand-build primitives in shadcn/ui's own style
   (`class-variance-authority` + `clsx` + `tailwind-merge`, a `cn()` helper in
   `lib/utils.ts`) rather than running the interactive `shadcn` CLI, so future
   `npx shadcn add <component>` calls stay compatible. Add those three
   packages as dependencies.
5. **Tokens live in `app/globals.css`** using Tailwind v4's `@theme` (CSS-first
   config, no `tailwind.config.ts`), matching how the project is already set
   up.
6. **Scope**: build only the primitives shown in the reference — Button,
   Badge/Tag, BiasIndicator, Checkbox, Card (as a generic surface) — plus an
   `ArticleCard` composed example matching the "Card Example" panel, since
   that's a concrete, spec'd component. Not building unrelated components
   (inputs, modals, nav bar, etc.) that aren't in the reference — per AGENTS.md
   "do not overbuild."
7. **Verification page**: add a temporary, dev-only style-guide route at
   `app/design/page.tsx` rendering every token/component so the system can be
   visually diffed against the reference image. This is scaffolding to prove
   the system was implemented correctly, not a product page; can be deleted
   once the real home page exists, or left as an internal reference — your call
   at review time.

## Files likely to change

- `app/globals.css` — full rewrite of tokens (`@theme` block): colors, font
  vars, radius vars, shadow vars; remove light/dark scaffold.
- `app/layout.tsx` — swap `Geist`/`Geist_Mono` for `Bricolage_Grotesque`.
- `app/page.tsx` — unchanged, or minimal placeholder tweak if it visually
  clashes with new theme (kept minimal either way).
- `app/design/page.tsx` — new style-guide/demo page.
- `lib/utils.ts` — new `cn()` helper (clsx + tailwind-merge).
- `components/ui/button.tsx` — new, cva variants: primary/secondary/ghost/destructive.
- `components/ui/badge.tsx` — new, cva variants: neutral/accent/destructive (tag pills).
- `components/ui/bias-indicator.tsx` — new, left/center/right segmented pill.
- `components/ui/checkbox.tsx` — new, checked/unchecked states.
- `components/ui/card.tsx` — new, generic surface container (elevated bg, radius, padding).
- `components/article-card.tsx` — new, composed example matching the reference's "Card Example."
- `package.json` — add `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`.

## Implementation requirements

- Define all color tokens as CSS custom properties in `@theme` so they're
  usable as Tailwind utilities (e.g. `bg-surface`, `text-subtle`, `bg-violet`,
  `bg-violet/15`, `text-cyan`, `bg-red`).
- Define spacing as confirmation-only (Tailwind's default 8px-based scale
  already yields 8/16/24/32/40/48 at `2/4/6/8/10/12` — no override needed;
  note this in code comments only if non-obvious).
- Define radius tokens (`--radius-sm/md/lg`, `none`/`full` already covered by
  Tailwind defaults) tuned to the reference's visual roundness.
- Define shadow tokens (`--shadow-sm/md/lg`) as custom `@theme` shadows suited
  to the dark palette.
- Typography: expose H1–H4, Body L/S, and Caption as either Tailwind
  `@theme` font-size tokens (`text-h1`, `text-body-l`, etc.) with paired
  weight/line-height, or small text-style utility classes in `globals.css` —
  pick whichever keeps `app/design/page.tsx` closest to 1:1 with the reference
  labels.
- Buttons/badges/checkbox must be keyboard-accessible (native `<button>`,
  native `<input type="checkbox">` under the hood) and have visible focus
  states.
- `ArticleCard` must match the reference layout: source line over image,
  image placeholder, category tag + relative timestamp, 2-line clamped title,
  2-line clamped muted description, footer button row (Read now / Save /
  bookmark icon).

## Security requirements

None — this is client-rendered static UI, no secrets, no data fetching, no
new environment variables.

## Acceptance criteria

- `app/design/page.tsx` renders, in dark theme, sections for: brand mark,
  color swatches (all 9 listed colors with hex labels), typography scale
  (H1–H4, Body L/S, Caption), icon set, grid indicator, spacing scale,
  shadows, border radii, buttons (4 variants), link, checkbox (2 states),
  tags (3 examples), bias indicator, and the article card example — visually
  matching the reference image's layout and values.
- All new components are typed, have no `any`, and are reusable (props-driven
  variants, not one-off hardcoded markup) so the home/details pages can
  consume them later.
- No unrelated files touched; no home/details page content built.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (styling/font/config changes can affect the build)

## Manual test steps

1. `npm run dev`
2. Open `http://localhost:3000/design`
3. Compare each section against the reference image: colors, type scale,
   icon strokes, spacing swatches, shadow swatches, radius swatches, button
   variants, checkbox states, tag pills, bias indicator percentages/colors,
   and the article card (image placeholder, tag, title clamp, description
   clamp, button row).
4. Resize the viewport down to mobile width and confirm the article card and
   swatch grids reflow without overflow (reference doesn't spec breakpoints,
   so "no horizontal scroll, no overlap" is the bar).
5. Open `http://localhost:3000` and confirm it still renders (unaffected
   placeholder) under the new global styles.
