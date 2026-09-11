# Clerk Authentication

## Goal

Add Clerk authentication to LUCENT: install the SDK, enable Clerk across the app via `proxy.ts` (Next.js 16's renamed `middleware.ts`), wrap the app in `ClerkProvider`, and replace the static "Login" button in the site header with real sign-in/sign-up/user controls using Clerk's prebuilt **modal** flow (confirmed with user — no dedicated `/sign-in` or `/sign-up` pages). No routes are gated behind auth; this is a public news-reading site and Clerk is being added for account/session capability only, per the "Build only" list in AGENTS.md (no protected dashboard exists to guard).

## Skills read

- `.agents/skills/clerk/SKILL.md` (router) → routed to `clerk-setup`
- `clerk-setup` skill (fetched via Skill tool): CLI-first provisioning flow, `ClerkProvider` placement rules, shadcn theme guidance, common pitfalls table
- Fetched live quickstart at `https://clerk.com/docs/nextjs/getting-started/quickstart` for current `@clerk/nextjs` snippets — **its middleware step is stale/wrong for this project** (see Decisions below)

## Existing code inspected

- `package.json` — Next.js `16.2.11`, React `19.2.4`, no `@clerk/nextjs` installed yet, no shadcn `components.json`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` and `.../01-getting-started/16-proxy.md` — confirm Next.js **v16.0.0 deprecated and renamed `middleware.ts` to `proxy.ts`**; behavior is identical, file must be named `proxy.ts`, function can be a default export
- `.env.local` — already contains `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (a Clerk app already exists for this project; no new app needs provisioning)
- No `.env.example` exists yet
- `app/layout.tsx` — root layout, `<html>` → `<body>` (currently no provider wrapping)
- `components/site-header.tsx` — has a static `<Button variant="secondary">Login</Button>` with no auth wiring; this is the integration point
- `components/ui/button.tsx` — custom `cva`-based Button (not shadcn CLI-managed, no `components.json`), variants: `primary`, `secondary`, `ghost`, `destructive`
- `app/globals.css` — custom dark theme design tokens (`--color-violet`, `--color-surface`, `--color-elevated`, `--color-text`, `--color-subtle`, etc.), not shadcn's `--background`/`--foreground` convention
- No existing auth code, no protected routes, no `middleware.ts`/`proxy.ts` file

## Decisions / assumptions

1. **File is `proxy.ts`, not `middleware.ts`.** The fetched Clerk quickstart said to create `middleware.ts` for Next.js 16+, but the local Next.js docs explicitly say `middleware` was renamed to `proxy` starting in v16.0.0 and the old name is deprecated. AGENTS.md instructs treating `node_modules/next/dist/docs/` as the source of truth over training-data assumptions, so this prompt follows the local docs: create `proxy.ts` with `clerkMiddleware()` as the default export.
2. **No route protection.** AGENTS.md's "Build only" list has no admin/dashboard page behind Clerk auth. `clerkMiddleware()` is added with no `.protect()` calls — it only makes auth state available app-wide (needed for `<SignedIn>`/`<SignedOut>`/`<UserButton>` and future `auth()` calls). If a protected area is added later, protection logic goes in `proxy.ts`.
3. **Modal auth, no dedicated pages** (per user's answer). `SignInButton`/`SignUpButton` with `mode="modal"` render Clerk's prebuilt modal over the current page. `NEXT_PUBLIC_CLERK_SIGN_IN_URL`/`NEXT_PUBLIC_CLERK_SIGN_UP_URL` are not needed (no page to route to). `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` and `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` are still set to `/` so Clerk knows where to land the user after the modal completes.
4. **No shadcn theme import.** `clerk-setup` says to apply the shadcn theme when `components.json` exists. It doesn't exist here — this project's `components/ui/*` is a hand-rolled component set with fully custom design tokens, not shadcn CLI output. Importing `@clerk/ui/themes/shadcn.css` would pull in shadcn's own CSS variable names (`--background`, `--primary`, etc.) that this project doesn't define, and would visually clash. Instead, style Clerk's modal via the `appearance.variables` prop on `ClerkProvider`, mapped to this project's existing tokens (`--color-violet`, `--color-surface`, `--color-elevated`, `--color-text`, `--color-subtle`).
5. **`.env.example` created for the first time**, scoped to only the Clerk variables introduced by this task (not the full AGENTS.md §21 table, since Supabase/Oxylabs/AI SDK env vars don't apply to anything built yet). Future feature prompts add their own vars to it.
6. Package to install: `@clerk/nextjs` (current major, matches "Current" row in the clerk skill's version table since this is a fresh install).

## Files likely to change

- `package.json` / `package-lock.json` — add `@clerk/nextjs`
- `proxy.ts` (new, project root) — `clerkMiddleware()`
- `app/layout.tsx` — wrap `{children}` in `<ClerkProvider>` inside `<body>`, with `appearance.variables` matching the dark theme
- `components/site-header.tsx` — replace the static Login button with `<SignedOut>` (Log in + Sign up buttons, modal mode) / `<SignedIn>` (`<UserButton />`)
- `.env.local` — add `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/` and `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/`
- `.env.example` (new) — Clerk vars with placeholder values, no real secrets

## Implementation requirements

1. `npm install @clerk/nextjs`
2. Create `proxy.ts` at the project root:
   ```ts
   import { clerkMiddleware } from '@clerk/nextjs/server'

   export default clerkMiddleware()

   export const config = {
     matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
   }
   ```
3. Update `app/layout.tsx`: wrap `{children}` in `<ClerkProvider>` inside `<body>` (not wrapping `<html>`). Pass `appearance.variables` mapped from `app/globals.css` tokens (violet primary, surface background, elevated inputs, text/subtle for copy) so the modal matches the dark theme instead of Clerk's default light widget.
4. Update `components/site-header.tsx`:
   - Import `SignedIn`, `SignedOut`, `SignInButton`, `SignUpButton`, `UserButton` from `@clerk/nextjs`.
   - Replace the current `<Button variant="secondary">Login</Button>` with:
     - `<SignedOut>`: a `secondary` "Log in" button wrapped in `<SignInButton mode="modal">` and a `primary` "Sign up" button wrapped in `<SignUpButton mode="modal">`.
     - `<SignedIn>`: `<UserButton />`.
5. Add to `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
   ```
6. Create `.env.example` documenting (placeholder values only, no real keys):
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
   ```
7. Do not create `/sign-in` or `/sign-up` pages, a middleware.ts file, or any protected route — out of scope per Decisions above.

## Security requirements

- `CLERK_SECRET_KEY` is never imported into a Client Component or exposed to the browser; only used inside `@clerk/nextjs/server` internals.
- No secrets committed to `.env.example` — placeholders only.
- `proxy.ts` runs at the project root (Node.js runtime by default in Next.js 16), consistent with AGENTS.md's rule against exposing server-only logic to the browser.

## Acceptance criteria

- `npm run dev` starts without Clerk configuration errors.
- Signed-out state: header shows "Log in" and "Sign up" buttons; clicking either opens Clerk's modal (no navigation/page change).
- Completing sign-in or sign-up in the modal closes it and lands back on `/` with `<UserButton />` now visible in the header.
- Signed-in state persists across a full page reload.
- Clicking `<UserButton />` opens Clerk's account menu, and "Sign out" returns to the signed-out header state.
- No visual regression to the rest of the header (logo, nav tabs) or to any other page.
- Modal appearance is legibly styled against the dark theme (not default light Clerk widget on a dark backdrop).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes/root-level config changed — `proxy.ts`, `layout.tsx`)

## Manual test steps

1. Run `npm run dev` and open `http://localhost:3000`.
2. Confirm the header shows "Log in" and "Sign up" buttons (no user avatar).
3. Click "Sign up" → complete Clerk's modal signup flow (email/OAuth per your Clerk app config) → confirm the modal closes and `<UserButton />` appears in the header without a page navigation.
4. Click `<UserButton />` → confirm the account menu opens → click "Sign out" → confirm the header reverts to "Log in"/"Sign up".
5. Click "Log in" → sign back in with the same account → confirm `<UserButton />` reappears.
6. Reload the page while signed in → confirm `<UserButton />` still shows (session persisted).
7. Watch the terminal running `npm run dev` for any Clerk warnings (e.g. missing keys, proxy/middleware misconfiguration).
