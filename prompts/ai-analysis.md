# AI Article Analysis Pipeline

## Goal

Build the AI analysis backend pipeline (AGENTS.md section 19): a
`POST /api/analyze` route that finds articles with no `article_analyses`
row, sends each through an LLM with a Zod-validated structured output
schema, saves valid results, marks `analyzed_at`, retries once on invalid
output, and logs progress the same way the scrape pipeline does. This pass
is backend-only — the homepage and article detail page keep rendering
`lib/mock-articles.ts` for now; wiring them to live Supabase data (including
the "article cards must show..." / "details page must show..." UI bullets
in section 19) is a separate follow-up prompt, confirmed with the user.

Embeddings and pgvector (section 20) are explicitly out of scope for this
pass — no `embedding` column, no `text-embedding-3-small` call.

## Skills read

- `.agents/skills/supabase/SKILL.md` — confirmed no new schema/RLS changes
  needed (the `article_analyses` table and its RLS policy already exist per
  `supabase/schema.sql`); this task is pure data-access + route code.
- `.agents/skills/ai-sdk/SKILL.md` — do not trust memory for AI SDK APIs;
  read the bundled version-matched docs at `node_modules/ai/docs/` instead.
  Confirmed installed `ai` version is `7.0.97` (latest). Confirmed
  `generateObject`/`NoObjectGeneratedError` are still exported by the
  installed version, but the only structured-output guide shipped in
  `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`
  for v7 documents `generateText` + `Output.object({ schema })`, so that's
  the pattern this prompt uses (documented, version-matched; not from
  memory).

## Existing code inspected

- **AI provider mismatch, resolved with the user**: `package.json` only has
  `@openrouter/ai-sdk-provider` installed; there is no `@ai-sdk/openai` and
  no `OPENAI_API_KEY` in `.env.example`, even though AGENTS.md section 21's
  env table names `OPENAI_API_KEY` for "AI analysis and
  `text-embedding-3-small`". User confirmed: **use direct OpenAI**, per the
  AGENTS.md table. This means installing `@ai-sdk/openai` (latest `4.0.65`,
  no `ai`-version peer conflict with the installed `ai@7.0.97` /
  `zod@^4.4.3`) and adding `OPENAI_API_KEY` to `.env.example` /
  `.env.local`. The already-installed `@openrouter/ai-sdk-provider` is
  unused by this change and left in place (not this task's concern to
  remove).
- `supabase/schema.sql` — `article_analyses` table, columns, and CHECK
  constraints already match AGENTS.md section 7/19 exactly (sentiment
  score/label, bias score/label, left/center/right percentages summing to
  100, confidence, framing_notes, loaded_terms, disclaimer, model). No
  migration needed.
- `lib/supabase/types.ts` — `ArticleAnalysesTable["Insert"]` already typed
  to match; `SentimentLabel` / `BiasLabel` union types already exported.
- `lib/supabase/queries/articles.ts` — `getPendingArticles(limit?)` **already
  implements** the pending-analysis check (LEFT JOIN via
  `.select("*, article_analyses(id)")`, filtered in JS per the section 21
  joined-table filter gotcha). Reused as-is, no changes needed.
- `lib/supabase/queries/article-analyses.ts` — `insertArticleAnalysis()`
  **already implements** insert-then-mark-`analyzed_at`. Reused as-is.
- `lib/auth/admin-secret.ts` — `requireAdminSecret()` checks header
  `x-LUCENT-admin-secret` against `LUCENT_ADMIN_SECRET`. Note this is the
  project's actual naming (not the `SKEW`-prefixed names AGENTS.md's prose
  uses in a few places) — following the existing code, not the doc typo.
  Reused as-is for `/api/analyze`.
- `lib/pipeline/logger.ts` — `logRun(level, source, message, metadata?)`
  writes to console + best-effort `logs` table insert. Reused for analysis
  run logging.
- `lib/pipeline/types.ts` — scrape-pipeline result/summary shape
  (`ScrapeSummary`, `SourceScrapeResult`). No analysis-specific types exist
  yet; this task adds parallel types rather than overloading the scrape ones.
- `app/api/scrape/route.ts` — the house pattern for an admin-secret-gated
  `POST` route: `requireAdminSecret`, manual JSON body parse +
  `z.safeParse`, delegate to a `lib/pipeline/*` orchestrator, return the
  summary as JSON, catch-all 500. `/api/analyze` follows the same shape.
- `lib/pipeline/manual-scrape.ts` — the house pattern for a pipeline
  orchestrator: per-item try/catch that never aborts the whole run,
  `logRun` calls bracketing each step, summary aggregated with small `sum`/
  merge helpers at the end. The analysis orchestrator mirrors this.
- `app/api/analyze/` — **directory already exists but is empty**, no route
  file yet.
- `.env.example` — no `OPENAI_API_KEY`, no `ANALYSIS_BATCH_SIZE` yet, needs
  both added per AGENTS.md section 21's table.

## Decisions and assumptions

- **Provider**: `@ai-sdk/openai`, called via `generateText` +
  `Output.object({ schema })` (ai-sdk skill: documented v7 pattern, not
  `generateObject` directly, since the bundled docs only show the
  `Output.object` path for this version).
- **Model**: use a current OpenAI chat model available via the API — model
  IDs will be verified against `https://platform.openai.com/docs/models` (or
  equivalent current listing) at implementation time rather than assumed
  from memory, per the ai-sdk skill's "never use model IDs from memory"
  rule. Default batch size env var `ANALYSIS_BATCH_SIZE` (default `5`, per
  the section 21 table) controls how many articles are analyzed
  concurrently/sequentially per batch — implementation will process batches
  sequentially (one `Promise.all` per batch of `ANALYSIS_BATCH_SIZE`) to
  bound concurrency and avoid rate-limit bursts.
- **Retry-once semantics**: on `NoObjectGeneratedError` (schema validation
  or parse failure) or a Zod parse failure on the returned output, retry the
  same article once with the same prompt. If the retry also fails, mark the
  article `failed` in the batch/summary counts and move on — do not save a
  partial/invalid row, do not throw and abort the whole run.
- **Model output vs. DB row**: the LLM is asked to return
  `leftPercentage` / `centerPercentage` / `rightPercentage` (0–100, summing
  to 100), `biasLabel`, `sentimentScore` / `sentimentLabel`, `summary`,
  `confidence`, `framingNotes`, `loadedTerms`. `bias_score` is **not** asked
  of the model — it's derived server-side as
  `(rightPercentage - leftPercentage) / 100` per AGENTS.md section 7/19,
  after the model output is validated. `disclaimer` is a fixed server-side
  string (mirroring `lib/mock-articles.ts`'s `STANDARD_DISCLAIMER`), not
  model-generated — keeps the disclaimer consistent and un-hallucinatable.
  `model` is set server-side from the actual model id used.
- **Percentage-sum validation**: the DB has a CHECK constraint that the three
  percentages sum to exactly 100. The Zod schema will validate this via
  `.refine()` before insert, so a bad sum is treated as an invalid-output
  case (counts toward the retry-once path) rather than surfacing as a raw
  Postgres constraint error.
- **Batching stops when no pending articles remain**, per section 19's
  "Required behavior" #3 — the route loops over `getPendingArticles` in
  batches of `ANALYSIS_BATCH_SIZE` until a batch returns 0 pending articles,
  not a single fixed batch.
- **Request body**: mirrors `/api/scrape`'s shape — optional `articleIds`
  (explicit selection) and optional `limit` (cap total articles processed
  this run); if neither is given, process all pending articles to
  exhaustion. This matches section 19: "If the user gives a limit or
  selected article IDs, respect that request... Do not hardcode analysis
  to... a fixed one-time batch."
- **`maxDuration`**: set `export const maxDuration = 300` on the route,
  matching `/api/scrape/route.ts`, since analysis of many articles can be
  slow.

## Files expected to change

- `app/api/analyze/route.ts` — new, the `POST` route handler.
- `lib/pipeline/analyze.ts` — new, orchestrator (batching, retry-once,
  summary aggregation), mirroring `lib/pipeline/manual-scrape.ts`'s shape.
- `lib/ai/analyze-article.ts` — new, single-article analysis: build prompt,
  call `generateText` + `Output.object`, Zod-validate/refine, return a typed
  result or a typed failure.
- `lib/ai/schema.ts` — new, the Zod schema for the model's structured output
  (distinct from `ArticleAnalysesTable["Insert"]`, since the model doesn't
  produce every DB column).
- `lib/pipeline/types.ts` — add `AnalysisSummary` / `ArticleAnalysisResult`
  types alongside the existing scrape types (or a new
  `lib/pipeline/analyze-types.ts` if that reads cleaner — decide during
  implementation based on how much mirrors the scrape types vs. diverges).
- `.env.example` — add `OPENAI_API_KEY` and `ANALYSIS_BATCH_SIZE`.
- `.env.local` — add real `OPENAI_API_KEY` (user must supply the key value)
  and `ANALYSIS_BATCH_SIZE`.
- `package.json` / `package-lock.json` — add `@ai-sdk/openai`.
- AGENTS.md is not edited by this task.

## Requirements

- `POST /api/analyze`, gated by `requireAdminSecret` (`x-LUCENT-admin-secret`
  header), returns `401` on missing/invalid secret — matching `/api/scrape`.
- Body: `{ articleIds?: string[]; limit?: number }`, validated with Zod;
  invalid JSON or shape returns `400` (mirroring `/api/scrape/route.ts`'s
  manual `request.text()` + `JSON.parse` + `safeParse` pattern).
- Pending detection: reuse `getPendingArticles` as-is (already correct per
  section 19's LEFT JOIN rule). When `articleIds` is given, fetch/filter to
  just those IDs that are still pending (an already-analyzed explicit ID is
  skipped, not re-analyzed — analyses are not currently deletable/re-runnable
  in this pass).
- Batch loop: pull up to `ANALYSIS_BATCH_SIZE` pending articles at a time
  (capped by `limit` if given), process the batch, log per-batch counts via
  `logRun`, repeat until either no pending articles remain or `limit` is
  reached.
- Per article: build a prompt from `title` + `raw_text` (+ `source` name for
  context, but instruct the model not to infer bias from source identity per
  section 19: "Use article text evidence only. Do not infer based on source
  name alone."), call the model, validate with Zod including the
  percentage-sum `.refine()`, compute `bias_score` server-side, attach fixed
  `disclaimer` and the real `model` id, insert via `insertArticleAnalysis`.
- On invalid/unparseable output: retry once (same article, same prompt). If
  the retry also fails, count as `failed`, log via `logRun("error", ...)`,
  continue to the next article — never let one article's failure abort the
  run.
- Response body: a summary object mirroring `ScrapeSummary`'s shape —
  `status`, counts (`articlesChecked`, `articlesAnalyzed`, `articlesFailed`,
  `articlesSkipped` if any), `totalDurationMs`, and enough detail to see
  what happened per batch — returned with `200`.
- Console + `logs` table logging via `logRun` at: run started (with pending
  count/limit), each batch start, each article analyzed/failed, run
  completed with the final summary — matching the "Run logging" style
  already used by the scrape pipeline.
- Do not send whole-article `raw_text` blindly if it's extremely long enough
  to be a token/cost concern — cap prompt input length sensibly (e.g. first
  N characters of `raw_text`) if `raw_text` can be very large; check typical
  sizes in the `articles` table during implementation to decide if a cap is
  actually needed, don't add one speculatively if rows are already short.

## Security considerations

- `OPENAI_API_KEY` is server-only, never referenced in client code, only
  read inside `lib/ai/analyze-article.ts` (server-only module, add
  `import "server-only"` per the existing file convention).
- `x-LUCENT-admin-secret` required on `/api/analyze`, same as `/api/scrape`
  (section 15) — no unauthenticated way to trigger paid LLM calls.
- No user-supplied text (article title/body) is ever interpolated into a
  system prompt in a way that could redefine the output schema/instructions
  — the Zod schema enforces structure independent of what the model returns
  as free text, and `Output.object` validates before anything touches the
  DB insert.
- Service-role Supabase client stays server-only (already the case via
  `lib/supabase/service-role.ts`), not touched by this task.

## Acceptance criteria

- `POST /api/analyze` without the admin secret header returns `401`.
- `POST /api/analyze` with the header and an empty body analyzes all
  currently-pending articles in `ANALYSIS_BATCH_SIZE`-sized batches, saves a
  valid `article_analyses` row for each, sets `analyzed_at`, and returns a
  summary whose `articlesAnalyzed` count matches the number of new
  `article_analyses` rows created.
- A deliberately-forced invalid-output case (e.g. temporarily point the
  schema/prompt mismatch during manual testing, or rely on a real model
  hiccup) is retried once and, if still invalid, shows up as `articlesFailed`
  in the summary with no partial row written.
- `left_percentage + center_percentage + right_percentage = 100` on every
  saved row (enforced by both the Zod refine and the DB CHECK constraint —
  neither should ever be the one catching this in practice if the other
  works).
- `bias_score` on every saved row equals
  `(right_percentage - left_percentage) / 100`.
- Passing `articleIds` analyzes only those (skipping any already analyzed);
  passing `limit` caps the total analyzed this run without needing all
  pending articles processed.
- Re-running `/api/analyze` with no pending articles left returns a summary
  with `articlesAnalyzed: 0` and does not error.
- `npm run typecheck` and `npm run lint` pass from `lucent/`.
- `npm run build` succeeds (new route + server modules affect the build).

## Checks to run

From `lucent/`:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run dev`, then the manual `curl` test steps below.

## Manual test steps

1. Ensure `.env.local` has a real `OPENAI_API_KEY` and `LUCENT_ADMIN_SECRET`
   set, and that at least one row exists in `articles` with no matching
   `article_analyses` row (run `/api/scrape` first if the table is empty).
2. Start the dev server: `npm run dev`. Watch this terminal for `[analyze]`
   run logs.
3. Trigger analysis of everything pending:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Confirm the JSON response's `articlesAnalyzed` count and check Supabase
   (`article_analyses` table) for the new rows, and `articles.analyzed_at`
   set on each.
4. Confirm the admin-secret gate:
   ```bash
   curl -X POST http://localhost:3000/api/analyze -d '{}'
   ```
   Expect `401`.
5. Test `limit`:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-LUCENT-admin-secret: $LUCENT_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"limit": 1}'
   ```
   Confirm only one article was analyzed even if more are pending.
6. Re-run step 3's command again with no pending articles left; confirm
   `articlesAnalyzed: 0` and no error.
7. Spot-check one saved row in Supabase: percentages sum to 100,
   `bias_score` matches the formula, `disclaimer` is the fixed string,
   `model` reflects the real model id used.
