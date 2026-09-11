# Supabase Database and Data Access

## Goal

Stand up Supabase as LUCENT's persistence layer: the six core tables from
AGENTS.md section 7 (`sources`, `articles`, `article_analyses`, `logs`,
`oxylabs_schedules`, `oxylabs_schedule_runs`) with RLS, plus the server-only
data access layer (`lib/supabase/*`) that scraping, AI analysis, scheduler,
and UI pages will build on in later prompts. This pass does **not** wire the
homepage/details page to real data, does not implement scraping/AI/scheduler
logic, and does not add the pgvector `embedding` column (that's section 20,
after AI analysis exists per section 19).

## Skills read

- `.agents/skills/supabase/SKILL.md` — RLS-everywhere rule, security
  checklist (least-privilege keys, `security_invoker` views, explicit grants
  when exposing tables), CLI/MCP-based migration workflow.

## Existing code inspected

- No Supabase CLI installed (`supabase --version` → not found) and no
  Supabase MCP server configured (`.mcp.json` absent). I cannot run
  `execute_sql`, `db advisors`, or `db pull` against the live project from
  here.
- `.env.local` already has `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set (a
  Supabase project already exists). `.env.example` has none of these yet.
- `package.json` — no `@supabase/supabase-js` dependency yet.
- No `supabase/` directory, no `lib/supabase/` directory.
- `lib/mock-articles.ts`, `app/page.tsx`, `app/article/[id]/page.tsx` — the
  current homepage/details UI runs entirely on typed mock data
  (`MockArticle`) with fields (`country`, `author`, `readTimeMinutes`,
  `category`, `publishedAgo`) that don't exist in the AGENTS.md section 7
  schema. Per `prompts/homepage-ui.md`'s own decision log, this is
  intentional throwaway data pending a future "Supabase-backed homepage"
  prompt — out of scope here.
- `lib/utils.ts` — only `cn()`, no existing Supabase helpers.
- AGENTS.md section 7 (schema fields), section 9 (URL existence check
  chunking ≤15), section 19 (pending-analysis LEFT JOIN rule), section 20
  (embedding deferred), section 21 (env var table + the Supabase joined-table
  filter gotcha: never `.eq('foreignTable.col', v)`, filter joined data in
  JS instead).

## Decisions / assumptions

1. **No CLI/MCP available → SQL-editor workflow**, matching AGENTS.md's own
   instruction ("update `supabase/schema.sql`... and run the corresponding
   ALTER SQL in Supabase Dashboard → SQL Editor before testing"). I'll write
   `supabase/schema.sql` as the source of truth and give you the exact SQL to
   paste into the Dashboard SQL Editor as the manual test step. No CLI
   migration history is created in this pass.
2. **Two server-only Supabase clients, not one**, matching the two keys
   already in `.env.local`:
   - `lib/supabase/service-role.ts` — `SUPABASE_SERVICE_ROLE_KEY`, bypasses
     RLS. Used only by pipeline code and admin API routes (scrape, analyze,
     logs, schedules, cron) added in later prompts.
   - `lib/supabase/public.ts` — `NEXT_PUBLIC_SUPABASE_ANON_KEY`, subject to
     RLS. Used by Server Components for public reads (home page, article
     detail, related articles) once those are wired up.
   Both files start with `import "server-only"` so a client-component import
   fails the build instead of leaking either key into the browser bundle,
   even though the anon key alone would be tolerable client-side — the
   architecture (section 5) says UI never queries Supabase directly, only
   Server Components/route handlers do, so there's no legitimate client-side
   import to support.
3. **RLS: public `SELECT` only on `sources`, `articles`, `article_analyses`;
   fully locked on `logs`, `oxylabs_schedules`, `oxylabs_schedule_runs`.**
   - `sources`: `select` policy `using (active = true)` for `anon`,
     `authenticated`.
   - `articles`: `select` policy `using (analyzed_at is not null)` — matches
     section 18 ("Articles only appear on the homepage after `analyzed_at` is
     set"), enforced at the DB layer too, not just in query code.
   - `article_analyses`: `select` policy `using (true)` for `anon`,
     `authenticated` — a row only exists once analysis is complete, so
     unconditional read is safe and simple.
   - No `insert`/`update`/`delete` policies anywhere — only the service-role
     key (which bypasses RLS) can write. This satisfies "UI must display
     stored data only... must not mutate pipeline state" (section 5).
   - `logs`, `oxylabs_schedules`, `oxylabs_schedule_runs`: RLS enabled, zero
     policies (default-deny), explicit `revoke all ... from anon,
     authenticated` for defense in depth. Only the service-role key reads or
     writes these (admin routes gated by `x-LUCENT-admin-secret`).
4. **Explicit `GRANT`/`REVOKE`** rather than relying on Supabase's default
   public-schema privileges, per the skill's "explicitly grant when exposing
   a table" guidance — makes the intended exposure surface readable directly
   from `schema.sql` instead of implicit dashboard defaults.
5. **Column types**: `sentiment_score`/`bias_score`/`confidence` as `double
   precision` (simple JS-number round-trip, no `numeric`-as-string surprises
   over PostgREST); `left_percentage`/`center_percentage`/`right_percentage`
   as `integer` 0–100 with a `CHECK` that they sum to 100; `bias_label`/
   `sentiment_label` as `text` with `CHECK ... IN (...)` (no Postgres enums,
   easier to alter later); `loaded_terms` as `text[]`.
   `oxylabs_schedules.oxylabs_schedule_id` and
   `oxylabs_schedule_runs.oxylabs_run_id` are Postgres `bigint` — per section
   18's large-integer-precision warning, PostgREST serializes `bigint` as a
   JSON **string**, so `lib/supabase/types.ts` types these columns as
   `string`, never `number`.
6. **`oxylabs_schedules`/`oxylabs_schedule_runs` get table + type definitions
   only, no query-helper functions yet.** Their exact read/write shape
   depends on the Oxylabs `/runs` response fields (section 18), which is
   scoped to the not-yet-written `oxylabs-scheduler.md` prompt. Building
   CRUD helpers now would mean guessing at fields I'd likely have to redo.
   The tables exist (fulfilling section 7's "core tables" list) and can be
   `ALTER`ed when that prompt lands, per AGENTS.md's own stated pattern for
   schema evolution.
7. **Query functions built now**: `sources`, `articles`, `article_analyses`,
   `logs` — the four tables with fully-specified shapes today, needed by the
   next prompts in the queue (scraping, AI analysis) and by the future
   Supabase-backed homepage/details pages. `getRelatedArticles` is
   explicitly deferred to section 20 per its own text ("Add a
   `getRelatedArticles`... function... in section 20 after pgvector is
   enabled") — not added here.
8. **Pending-analysis query follows the AGENTS.md joined-table-filter
   gotcha literally**: fetch `articles` with embedded `article_analyses(id)`
   with no filter on the foreign table, then filter in JS for rows where the
   embedded array is empty — not a `!inner`/negation trick.
9. **IDs**: all primary keys `uuid default gen_random_uuid()` (via
   `pgcrypto`'s `gen_random_uuid()`, available by default on Supabase
   Postgres).
10. **No `updated_at` triggers.** `sources.updated_at` and
    `oxylabs_schedules.updated_at` are plain columns the application sets
    explicitly on write — a trigger function would be the only piece of
    procedural SQL in the schema for one minor convenience, which is more
    machinery than the two call sites justify.

## Files likely to change

- `supabase/schema.sql` — new. Full DDL: 6 tables, constraints, indexes, RLS
  enable + policies, explicit grants/revokes.
- `lib/supabase/types.ts` — new. Hand-written `Database` type (`Row`/
  `Insert`/`Update` per table) matching `schema.sql` exactly.
- `lib/supabase/service-role.ts` — new. `server-only` guarded service-role
  client factory.
- `lib/supabase/public.ts` — new. `server-only` guarded anon-key client
  factory.
- `lib/supabase/queries/sources.ts` — new. `getActiveSources()`.
- `lib/supabase/queries/articles.ts` — new. `findExistingUrls(urls)`
  (chunked ≤15 per section 9), `insertArticle(data)`, `getPendingArticles()`
  (LEFT JOIN pattern per section 19).
- `lib/supabase/queries/article-analyses.ts` — new.
  `insertArticleAnalysis(articleId, analysis)` (inserts the analysis row,
  then sets `articles.analyzed_at`).
- `lib/supabase/queries/logs.ts` — new. `insertLog(entry)`,
  `getRecentLogs(limit)`.
- `package.json` / `package-lock.json` — add `@supabase/supabase-js` and
  `server-only`.
- `.env.example` — add `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (blank
  placeholders, matching the section 21 table).

## Implementation requirements

- `npm install @supabase/supabase-js server-only` (pin exact versions in
  `package-lock.json`, per the skill's supply-chain guidance).
- `supabase/schema.sql` must be a single idempotent-ish file (safe to review
  top to bottom) containing, in order: extensions (`pgcrypto` if not already
  available), `sources`, `articles`, `article_analyses`, `logs`,
  `oxylabs_schedules`, `oxylabs_schedule_runs`, then RLS enable + policies +
  grants/revokes for all six.
- Foreign keys: `articles.source_id → sources.id`,
  `article_analyses.article_id → articles.id` (unique, one-to-one),
  `oxylabs_schedules.source_id → sources.id`,
  `oxylabs_schedule_runs.schedule_id → oxylabs_schedules.id`.
- Dedupe: `articles.original_url` `unique not null`.
- Required-before-save fields are `not null` at the DB level too:
  `articles.image_url`, `articles.published_at`, `articles.title`,
  `articles.raw_text`.
- `article_analyses` CHECK constraints: `sentiment_score between -1 and 1`,
  `bias_score between -1 and 1`, `confidence between 0 and 1`,
  `left_percentage + center_percentage + right_percentage = 100`,
  `sentiment_label in ('positive','neutral','negative')`,
  `bias_label in ('left','center','right','mixed','unclear')`.
- Indexes: `articles(source_id)`, `articles(published_at desc)`,
  `article_analyses(article_id)` (unique), `oxylabs_schedules(source_id)`,
  `oxylabs_schedules(oxylabs_schedule_id)` (unique),
  `oxylabs_schedule_runs(schedule_id)`, `logs(created_at desc)`.
- `lib/supabase/types.ts` exports a `Database` type usable as
  `createClient<Database>(...)`, plus convenience row aliases (`SourceRow`,
  `ArticleRow`, `ArticleAnalysisRow`, `LogRow`, `OxylabsScheduleRow`,
  `OxylabsScheduleRunRow`).
- `lib/supabase/service-role.ts` and `lib/supabase/public.ts`: each throws a
  clear error at call time (not import time) if its required env var is
  missing; no top-level singleton client (avoids sharing state across
  requests in a way that surprises Next.js's execution model) — export a
  factory function instead.
- Query functions: explicit return types, no `any`, small single-purpose
  functions per AGENTS.md section 21 code standards.
- `findExistingUrls`: batch input `urls` into chunks of ≤15, run one `.in()`
  query per chunk, union the results into a single `Set<string>`.
- `getPendingArticles`: select articles with embedded
  `article_analyses(id)`, no filter on the foreign table, filter client-side
  in JS for `article_analyses.length === 0` — per the AGENTS.md joined-table
  gotcha.
- `insertArticleAnalysis`: insert into `article_analyses` first; only after
  that succeeds, update `articles.analyzed_at = now()` for the given
  `article_id`. If the second call fails, don't roll back — pending-analysis
  detection is defined by `article_analyses` row existence (section 19), not
  `analyzed_at`, so the article is still correctly excluded from future
  pending scans.

## Security requirements

- No service-role key or Oxylabs/OpenAI/admin secrets in any file reachable
  from client components. `lib/supabase/service-role.ts` guarded by `import
  "server-only"`.
- RLS enabled on all six tables with no exceptions; verify via the SQL
  editor after applying (`select relname, relrowsecurity from pg_class where
  relnamespace = 'public'::regnamespace and relkind = 'r';`).
- No `SECURITY DEFINER` functions, no views in this pass.
- `.env.example` gets placeholder keys only, never real values.

## Acceptance criteria

- `supabase/schema.sql` exists and, when run once in the Supabase SQL
  Editor, creates all six tables with the constraints/indexes/RLS/grants
  above with no errors.
- `lib/supabase/types.ts` compiles and matches `schema.sql` field-for-field.
- `lib/supabase/service-role.ts` / `lib/supabase/public.ts` each export a
  working client factory; importing `service-role.ts` from a `"use client"`
  file fails the build (server-only guard works).
- Query functions in `lib/supabase/queries/*.ts` compile, are typed
  end-to-end (no `any`), and follow the joined-table-filter gotcha where
  applicable.
- `npm run typecheck` and `npm run lint` pass.
- No changes to `app/page.tsx`, `app/article/[id]/page.tsx`,
  `lib/mock-articles.ts`, or any `components/*` — this pass is DB/data-access
  only, UI stays on mock data until a future prompt.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` is skipped unless a route/server module import breaks —
  no routes change in this pass, but I'll run it if anything under `app/`
  or `lib/` touches a shared import path in a way that could affect the
  build.

## Manual test steps

1. Open the Supabase Dashboard → SQL Editor for the project referenced by
   `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`, paste the full contents of
   `supabase/schema.sql`, and run it once. Confirm no errors and that
   `sources`, `articles`, `article_analyses`, `logs`, `oxylabs_schedules`,
   `oxylabs_schedule_runs` all appear under Table Editor.
2. In the SQL Editor, run
   `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';`
   and confirm all six show `relrowsecurity = true`.
3. Insert one test row into `sources` directly in the SQL Editor (e.g. a
   fake source with `active = true`), then in a scratch Node/TSX script (or
   the SQL Editor via the anon key isn't directly testable there — use a
   quick `curl` against the REST endpoint instead) confirm:
   - `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sources?select=*" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"` returns the active source (public read works).
   - The same request with `Prefer: return=representation` on a `POST`
     against `/rest/v1/sources` is rejected (no insert policy for anon).
4. Delete the test row.
5. `npm run typecheck` and `npm run lint`; report output.
