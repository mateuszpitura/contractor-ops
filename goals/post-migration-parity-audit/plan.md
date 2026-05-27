# Plan — post-migration-parity-audit

## Solution approach

Reconstruct the legacy `apps/web` surface from the pre-cutover commit `62a97d73^` (just before `chore(repo): remove apps/web — migrated to apps/web-vite`), then sweep each artifact against the current `apps/web-vite` + `apps/api` tree and record either a "ported" entry or a `GAP-<AREA>-<NNN>` row. Headline counts (verified): 68 legacy `page.tsx`, 41 legacy `route.ts`, 51 legacy `*.spec.ts` / `*.test.{ts,tsx}` under `apps/web/e2e/`, 4 locale files (`en/de/pl/ar`), one 739-line `middleware.ts`. Current state: 67 web-vite pages, 21 `apps/api/src/routes` files (consolidating multiple legacy paths per file). The audit fixes any P0 (auth break, payment break, data loss / tenant leak, regulatory webhook break) inline; everything else is recorded. All work happens on a single audit branch off the current `dry-solid-audit/extract-shared` HEAD; the report is the deliverable.

## Working environment

- **Audit branch**: `audit/post-migration-parity` cut from `dry-solid-audit/extract-shared`. P0 fix commits land on this branch; report is the only non-fix file written.
- **Scratch dir** (gitignored): `.audit-scratch/` for extracted legacy files, diff outputs, and reconciliation worksheets. Never committed.
- **Report file**: `goals/post-migration-parity-audit/audit-report.md` — committed at the end of each step so progress is visible.
- **Baseline ref**: `62a97d73^` is captured once as `git rev-parse 62a97d73^` and stored at the top of the report so re-reads against the same baseline are guaranteed.

## Steps

### Step 1 — Branch, scratch dir, baseline inventory

- **Touches**: new branch `audit/post-migration-parity`; new dir `.audit-scratch/`; `.gitignore` (add `.audit-scratch/`); new file `goals/post-migration-parity-audit/audit-report.md` with the severity rubric, summary placeholder table, and a "Baseline" section recording the resolved SHA of `62a97d73^`.
- **Commands**:
  - `git checkout -b audit/post-migration-parity`
  - `mkdir -p .audit-scratch/{pages,routes,middleware,i18n,observability,security,tests}`
  - `git ls-tree -r 62a97d73^ apps/web/src/app | awk '{print $4}' > .audit-scratch/legacy-app-tree.txt`
  - `git ls-tree -r 62a97d73^ apps/web/src/lib | awk '{print $4}' > .audit-scratch/legacy-lib-tree.txt`
  - `git ls-tree -r 62a97d73^ apps/web/messages | awk '{print $4}' > .audit-scratch/legacy-messages-tree.txt`
  - `git ls-tree -r 62a97d73^ apps/web/e2e | awk '{print $4}' > .audit-scratch/legacy-e2e-tree.txt`
  - `git ls-tree -r 62a97d73^ apps/web/src/middleware.ts > .audit-scratch/legacy-middleware-blob.txt` and `git show 62a97d73^:apps/web/src/middleware.ts > .audit-scratch/middleware/legacy-middleware.ts`
- **Verification**: `wc -l .audit-scratch/legacy-*-tree.txt` matches the earlier counts (68 pages, 41 routes, 51 e2e files); `git show $(git rev-parse 62a97d73^) --stat | tail -1` records the deletion volume so it appears in the report.
- **Risk**: forgetting to refresh scratch if the baseline ref ever changes. Mitigated by re-deriving from `62a97d73^` at the top of every step.

### Step 2 — Page parity sweep (`apps/web/src/app/**/page.tsx` → `apps/web-vite/src/pages/**`)

- **Touches**: `audit-report.md` (Page parity section); `.audit-scratch/pages/legacy-pages.txt`, `.audit-scratch/pages/new-pages.txt`, `.audit-scratch/pages/reconciliation.csv`.
- **Method**:
  1. `grep -E 'page\.tsx$' .audit-scratch/legacy-app-tree.txt > .audit-scratch/pages/legacy-pages.txt` (expect 68).
  2. For each legacy path, derive the URL (strip `apps/web/src/app/`, drop `(group)` segments, drop `/page.tsx`) → list of legacy URL patterns.
  3. Read `apps/web-vite/src/router.tsx`, `apps/web-vite/src/router/dashboard-routes.ts`, `apps/web-vite/src/router/portal-routes.ts`, and any admin/auth route module they import; build the set of new URL patterns.
  4. For each legacy URL, find its match in the new set (exact, then with dynamic-segment normalization). Record: legacy path, derived URL, new URL match (or `MISSING`), new file (loader / element module), auth-gate equivalence (`requireAuth` / `requirePortalAuth` / `requireRole` / none).
  5. For every matched page, read the legacy `page.tsx` body via `git show 62a97d73^:<path>` and read the new component(s) it points to; compare: table columns, filter chips, action buttons, bulk-op handlers, export buttons, drawer/sheet/dialog triggers, empty / loading / error states. Mismatches → `GAP-PAGE-NNN` rows with severity (P0 only if the dropped capability is in an auth/money/data/compliance flow per the rubric).
- **Verification**:
  - `wc -l .audit-scratch/pages/legacy-pages.txt` = 68.
  - Every line in `legacy-pages.txt` appears in `.audit-scratch/pages/reconciliation.csv` exactly once.
  - Reconciliation CSV row count == 68 + any new-only routes appended at the bottom (so the join is bidirectional).
- **Risk**: false positives when a legacy route group `(dashboard)` becomes the new dashboard shell — the URL is identical but the auth gate moved from middleware to a loader. Mitigation: each row records *where* the gate now lives, not just whether it exists.

### Step 3 — API route parity sweep (`apps/web/src/app/api/**/route.ts` → `apps/api/src/routes/**`)

- **Touches**: `audit-report.md` (API route parity section + Webhook parity sub-section); `.audit-scratch/routes/legacy-routes.txt`, `.audit-scratch/routes/new-routes.txt`, `.audit-scratch/routes/reconciliation.csv`, `.audit-scratch/routes/method-matrix.csv`.
- **Method**:
  1. `grep -E 'route\.ts$' .audit-scratch/legacy-app-tree.txt > .audit-scratch/routes/legacy-routes.txt` (expect 41).
  2. For each legacy file, read via `git show 62a97d73^:<path>` and extract: exported HTTP methods (`export async function GET|POST|...`), status code branches (`new Response(..., { status: N })` and `NextResponse.json(..., { status: N })`), emitted headers, body schema (any `z.object`, `parseBody`), audit-log call presence (`writeAuditLog(`), tenant scope (`organizationId`, `session.user.id`, `session.region`), rate-limit application, idempotency key handling, signature verification.
  3. For each `apps/api/src/routes/**.ts`, read every route registration (`fastify.get|post|...`) and extract the same shape.
  4. Map legacy URLs to new URLs by URL pattern. Sub-categorize: **auth proxies** (`/api/auth/[...all]` → `apps/api` auth bridge), **tRPC** (`/api/trpc/[trpc]` + `/api/trpc/portal/[trpc]` → `apps/api/src/plugins/trpc.ts`), **OAuth** (`/api/oauth/[provider]/{start,callback}` → `apps/api/src/routes/oauth.ts`), **webhooks** (every `apps/web/src/app/api/webhooks/**` plus `inpost`, `storecove`, `stripe`, multi-provider → `apps/api/src/routes/webhooks/**`), **cron callbacks** (every `apps/web/src/app/api/cron/**` → either `apps/cron-worker` handler or `apps/api/src/routes/<job>.ts`; note that these moved out of HTTP — record where the work happens now and whether QStash continues to address them).
  5. For every match, compare the method matrix, status-code branches, header set, audit-log presence, tenant-scope check, rate-limit, idempotency, signature verify. Any divergence → `GAP-ROUTE-NNN` or `GAP-WEBHOOK-NNN` with severity per rubric (P0 if a webhook lost signature verification, lost idempotency, or lost dead-letter behavior; P0 if any route lost `writeAuditLog` on a sensitive mutation or lost tenant scope).
- **Verification**:
  - `wc -l .audit-scratch/routes/legacy-routes.txt` = 41.
  - `.audit-scratch/routes/method-matrix.csv` has one row per (legacy URL × HTTP method); every row maps to a new URL or is recorded as `GAP-ROUTE-NNN`.
  - For each of the 18 webhook routes the handover claims were ported, the report's webhook sub-section shows ✓ or a gap row for each of: signature verify, idempotency, dead-letter, ALS trace, Sentry-on-failure.
- **Risk**: cron HTTP callbacks (`apps/web/src/app/api/cron/**`) might have moved to in-process `apps/cron-worker` rather than HTTP — losing QStash addressability. Mitigation: explicitly verify which jobs still receive QStash POSTs versus which now run only on the worker's internal scheduler; a job that *needs* external-trigger capability but lost it is `GAP-ROUTE-NNN` P1.

### Step 4 — Middleware behavior sweep (legacy `middleware.ts` → apps/api plugins + web-vite loaders)

- **Touches**: `audit-report.md` (Middleware parity section); `.audit-scratch/middleware/behavior-blocks.md`, `.audit-scratch/middleware/reconciliation.csv`.
- **Method**:
  1. Read `.audit-scratch/middleware/legacy-middleware.ts` end-to-end and split it into named behavior blocks (locale negotiation, auth gate, role gate, CSRF, rate-limit, CSP header, CORS, cookie attributes, security headers, redirect rules, etc.). Number each block.
  2. For each block, locate the equivalent in the new stack: `apps/api/src/plugins/{auth,cors,csrf-origin,helmet,rate-limit,request-context,sentry}.ts`, `apps/api/src/lib/csp.ts`, `apps/api/src/lib/client-ip.ts`, web-vite loaders (`apps/web-vite/src/lib/require-auth.ts`, `apps/web-vite/src/lib/require-portal-auth.ts`, `apps/web-vite/src/router.tsx` locale guard), and the SPA host headers (Render `headers` block in `render.yaml` plus any `index.html` `<meta http-equiv>` settings).
  3. Record per block: legacy line range, new home (file:line), behavior-equivalent (yes / weaker / dropped), and a gap row if weaker or dropped. CSP / CORS / cookie regressions are P0.
- **Verification**: every numbered behavior block has either a "new home" reference or a `GAP-MIDDLEWARE-NNN` / `GAP-SECURITY-NNN` row. The block count in the report matches the count derived from the legacy file.
- **Risk**: behaviors that were silently dropped because they were Next-specific (e.g. `NextResponse.next()` chaining, `matcher` config) might look like gaps but are not — flag them explicitly as "dropped: Next-specific" with a one-line justification so they are not re-flagged.

### Step 5 — i18n parity sweep

- **Touches**: `audit-report.md` (i18n parity section); `.audit-scratch/i18n/keys-{en,de,pl,ar}.diff`, `.audit-scratch/i18n/formatter-parity.md`.
- **Method**:
  1. Confirm message-file source of truth: read `apps/web-vite/src/i18n/messages.ts` and identify whether it loads from `apps/web/messages/*.json` (legacy path) or `apps/web-vite/messages/*.json`. Record the state in the report (legacy followup claimed `git mv` was pending Step 18).
  2. For each locale `L in {en, de, pl, ar}`: `git show 62a97d73^:apps/web/messages/L.json > .audit-scratch/i18n/legacy-L.json` and `cp <current-source>/L.json .audit-scratch/i18n/new-L.json`.
  3. Use `jq` (or a small script in `.audit-scratch/i18n/keys.mjs` if jq is unavailable) to flatten each JSON to dotted key paths, sort, and diff: `comm -23 .audit-scratch/i18n/legacy-keys-L.txt .audit-scratch/i18n/new-keys-L.txt > .audit-scratch/i18n/missing-in-new-L.txt`. Every line in `missing-in-new-L.txt` is `GAP-I18N-NNN`.
  4. ICU shape check: for keys present in both, compare the value's ICU plural / select pattern shape (regex over `{count, plural,`, `{gender, select,`); shape regressions are `GAP-I18N-NNN`.
  5. Formatter parity: read `git show 62a97d73^:apps/web/src/lib/format/use-currency-formatter.ts`, `use-date-formatter.ts`, `use-portal-date-formatter.ts`; read `apps/web-vite/src/i18n/useFormatter.ts` and any shared `packages/shared/**` money / date helpers. For each formatter function, manually verify the output string under at least one input per locale (table of expected vs actual in `.audit-scratch/i18n/formatter-parity.md`); mismatches are `GAP-I18N-NNN`.
- **Verification**: `wc -l .audit-scratch/i18n/missing-in-new-*.txt` summed = the count reported in the report's i18n summary line. Every formatter listed in the legacy `apps/web/src/lib/format/**` is named in `formatter-parity.md`.
- **Risk**: a key that *moved* (e.g. `Common.cta.save` → `common.actions.save`) shows up as both "missing in new" and "extra in new" — would inflate the gap count. Mitigation: a manual normalization pass after the raw diff; flag suspected renames in the report rather than counting them twice.

### Step 6 — Observability parity sweep (Sentry + PostHog + web-vitals)

- **Touches**: `audit-report.md` (Observability parity section); `.audit-scratch/observability/sentry-scrub.diff`, `.audit-scratch/observability/posthog-callsites.csv`.
- **Method**:
  1. Read `git show 62a97d73^:apps/web/src/lib/sentry-scrub.ts` (154 lines) and `apps/web/src/sentry.{client,edge,server}.config.ts`. Read `apps/api/src/lib/sentry-scrub.ts` and `apps/api/src/lib/sentry.ts`; read `apps/web-vite/src/sentry.ts`.
  2. Enumerate every scrub rule (regex pattern, field name, breadcrumb category) and every `beforeSend` / `beforeSendTransaction` filter from the legacy files; reconcile against the new files. Missing scrub rules are `GAP-OBSERVABILITY-NNN` with severity P0 (data-leak category). Missing filters are `GAP-OBSERVABILITY-NNN` with severity P1.
  3. Sentry release / dist / environment: read the legacy Sentry init call and the new one; record any differences (release source, environment source, dist source). Wrong release tagging is `GAP-OBSERVABILITY-NNN` P2 (cosmetic) unless it affects source-map symbolication, in which case P1.
  4. PostHog: `git grep -nE "posthog\.(capture|identify|alias|reset|group)" 62a97d73^ -- 'apps/web/**'` and the same against `HEAD -- 'apps/web-vite/**'`. Diff call-sites by event name. Missing captures are `GAP-OBSERVABILITY-NNN` P2 unless they tracked feature-flag exposures (P1) or auth events (P0).
  5. Web-vitals: read `git show 62a97d73^:apps/web/src/app/api/web-vitals/route.ts` and `apps/api/src/routes/web-vitals.ts`; compare accepted body shape, sampling logic, downstream sink (PostHog event name, custom log).
- **Verification**: every legacy scrub rule (line count) is listed in the report's Observability appendix as either ✓ or `GAP-OBSERVABILITY-NNN`. Every PostHog event name in the legacy call-site set is accounted for in the new set or as a gap row.
- **Risk**: Sentry scrub rules sometimes overlap with `helmet` CSP `report-uri` filtering — same effect, different layer. Mitigation: record both layers per rule so a "scrub rule missing in Sentry but enforced via CSP block" is not double-counted.

### Step 7 — Security parity sweep

- **Touches**: `audit-report.md` (Security parity section); `.audit-scratch/security/{csp.diff, cors.diff, helmet.diff, rate-limit.diff, audit-log-callsites.csv, signature-verify.csv}`.
- **Method**:
  1. CSP: extract legacy CSP from `git show 62a97d73^:apps/web/next.config.{ts,js,mjs}` and middleware; extract new CSP from `apps/api/src/lib/csp.ts` and any web-vite static-host header. Per-directive diff. Weaker = `GAP-SECURITY-NNN` P0.
  2. CORS: legacy allowlist (middleware + any per-route `Access-Control-Allow-Origin`) vs new `apps/api/src/plugins/cors.ts`. Additions / removals listed; an origin that should not be allowed but now is = P0.
  3. Helmet: legacy custom headers (`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`) vs new `apps/api/src/plugins/helmet.ts`. Weaker = `GAP-SECURITY-NNN` P0.
  4. Rate-limit rules: legacy per-route limits (in middleware or per-route) vs new `apps/api/src/plugins/rate-limit.ts` config. Missing limits on auth-sensitive endpoints = `GAP-SECURITY-NNN` P0.
  5. Audit-log call-sites: `git grep -nE "writeAuditLog\(" 62a97d73^ -- 'apps/web/**'` and the same against the new tree (`packages/api/src`, `apps/api/src`). Reconcile by `action` argument. Missing calls on sensitive mutations = `GAP-SECURITY-NNN` P0.
  6. Signature verify: enumerate `crypto.createHmac`, `timingSafeEqual`, `Receiver.verify` (QStash), `Stripe.webhooks.constructEvent`, `verifyTeamsJwt`, KSeF / ZATCA / Peppol signature checks across both trees; reconcile algorithm and fail-closed behavior. Any weakening = `GAP-SECURITY-NNN` P0.
- **Verification**: each sub-area has a per-rule diff committed under `.audit-scratch/security/` and a corresponding `audit-report.md` entry. Counts in the summary match the counts in the appendices.
- **Risk**: CSP `nonce` strategies differ (Next inline-nonce vs SPA static-meta vs API-emitted header). A "different mechanism" is not automatically weaker — flag for manual review rather than auto-gapping.

### Step 8 — Test coverage parity sweep

- **Touches**: `audit-report.md` (Test parity section); `.audit-scratch/tests/{legacy-test-files.txt, new-test-files.txt, behavior-class-map.csv}`.
- **Method**:
  1. `git ls-tree -r 62a97d73^ apps/web | grep -E '\.(test|spec)\.(ts|tsx)$' > .audit-scratch/tests/legacy-test-files.txt` (expect 51 e2e plus any unit tests not under `e2e/`; verify the unit count separately).
  2. `find apps/web-vite apps/api apps/cron-worker -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' \) > .audit-scratch/tests/new-test-files.txt`.
  3. For each legacy test file, read it via `git show 62a97d73^:<path>` and extract its `describe` / `it` titles into a behavior-class list. For each legacy behavior class, locate a matching test in the new tree by title fuzzy-match (or by subject-under-test reference). Record: legacy file → new file(s) or `MISSING`.
  4. Behavior classes with no matching test → `GAP-TEST-NNN` (P2 unless the uncovered behavior is on a P0 surface, then P1).
  5. Playwright spec count claim: the handover says 42/42. The audit confirms by enumerating each legacy spec under `apps/web/e2e/{functional,integration,perf,rtl,a11y}/` and pairing it with a same-name (or same-subject) spec in `apps/web-vite/e2e/{functional,integration,perf,rtl,a11y}/`. Pair-by-name alone is insufficient — for each pair the audit notes whether the new spec asserts the legacy behavior class (not just renders the new page).
- **Verification**: behavior-class CSV has a row per legacy describe/it title; gap rows sum to the report's test-section count.
- **Risk**: rewriting a test to assert the new layering (container / hook / page) sometimes drops the assertion the user actually cared about. The audit flags any new test that *only* covers structural concerns without a legacy behavioral counterpart.

### Step 9 — P0 inline fixes (interleaved with Steps 2-8)

- **Touches**: source files under `apps/api/src`, `apps/web-vite/src`, `packages/api/src`, `packages/auth/src` as required; `audit-report.md` (P0 fix log appendix updated per fix).
- **Method**:
  1. The moment a P0 gap is recorded (auth break, payment break, data loss / tenant leak, regulatory webhook break), pause the sweep, branch off the audit branch for the fix if it touches > 2 files (`git checkout -b audit/fix/GAP-<AREA>-<NNN>` then merge back fast-forward), otherwise commit directly on the audit branch.
  2. Each fix is a single atomic commit with subject `fix(audit): GAP-<AREA>-<NNN> <one-line summary>` and a body that (a) quotes the report row, (b) cites the verification command that now passes, (c) names the test added or updated.
  3. Every P0 fix lands with at least one test (vitest unit / integration in `apps/api` or `apps/web-vite`, or a playwright spec) that fails on the pre-fix tree and passes on the post-fix tree.
  4. After the fix commit, update the `audit-report.md` row: status `inline-fixed`, plus the commit SHA. Run `pnpm typecheck` for the touched workspace before re-entering the sweep.
- **Verification**: at end of audit, `git log audit/post-migration-parity --grep "fix(audit): GAP-"` lists one commit per `inline-fixed` row. Every `inline-fixed` row in the report cites a SHA present in that log.
- **Risk**: a P0 fix that needs a DB migration, a Render config change, or a cross-team coordination cannot land inside the audit. Mitigation: such fixes leave the row at `open` with an explicit escalation note ("blocked: needs migration <name>", "blocked: needs Render env <name>", "blocked: needs <team> sign-off") and a recommended handler; the report's done condition treats those as "addressed" only if the escalation note is present and named.

### Step 10 — Final report assembly + verification + gate

- **Touches**: `goals/post-migration-parity-audit/audit-report.md` (final pass: summary table totals filled in, severity rubric stated once at top, all per-area sections complete, appendices complete).
- **Commands**:
  - `pnpm typecheck`
  - `pnpm --filter @contractor-ops/api-server test`
  - `pnpm --filter @contractor-ops/cron-worker test`
  - `pnpm --filter @contractor-ops/web-vite test` (with paths scoped per the user-memory rule — never an unscoped full run; default scope: `apps/web-vite/src` only).
  - `pnpm --filter @contractor-ops/web-vite check:web-vite-data-layer` and `check:web-vite-page-shells` (must remain green after any P0 fix).
  - `plannotator annotate goals/post-migration-parity-audit/audit-report.md --gate`.
- **Verification**: all four test workspaces pass; both web-vite quality gates pass; `plannotator --gate` returns approved.
- **Risk**: a P0 fix introduces a regression in a workspace the audit did not re-run. Mitigation: re-run all four workspace test suites at the end (already part of this step) regardless of which workspace each fix touched.

## Open questions / risks worth flagging now

- **Cron callbacks moved off HTTP**: the 13 legacy `apps/web/src/app/api/cron/**` routes do not all reappear as routes in `apps/api/src/routes/**`; instead they likely became in-process handlers under `apps/cron-worker`. If QStash still POSTs to URLs that no longer exist, that is a `GAP-ROUTE-NNN` *and* a production incident — Step 3 must verify the QStash schedule, not just the handler presence.
- **`apps/web/messages/*.json` still legacy path**: the handover notes the `git mv` was pending Step 18. If `apps/web/` is deleted but the import path still points there, the build would have broken — which means it was redirected somewhere. Step 5 must confirm the redirection target (`apps/web-vite/messages/`) and that the move was lossless.
- **Server-action call-sites**: the legacy app likely had `'use server'` exports outside `apps/web/src/app/api/` that mutated state directly. Step 3 needs an additional grep pass (`git grep -nE "^'use server'" 62a97d73^ -- 'apps/web/**'`) so those are not missed by a routes-only sweep.
- **`apps/web/src/lib/middleware-helpers/**`** (if it exists) — helper functions for the giant `middleware.ts`. Step 4 must read the whole legacy `lib/` tree, not only `middleware.ts`, so any helper-encapsulated behavior is captured.
- **Locale handling under `[locale]` segment**: a legacy URL `/<locale>/...` resolves locale at middleware time; the new web-vite resolves locale in a router loader. If the loader's locale set or fallback differs from the legacy regex, every locale-redirect contract is at risk — Step 2 must explicitly check this rather than treating it as a side concern.
- **Test debt baseline**: `feedback_test_run_memory.md` warns against unscoped `pnpm --filter @contractor-ops/web-vite test` runs (memory pressure). All test runs during the audit must be path-scoped; the report's verification commands already encode this.
- **`/api/auth/[...all]` Better Auth bridge**: legacy used a Next route handler; new uses an Express-style adapter mounted on Fastify. The audit must verify that *every* path Better Auth advertises (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out`, `/api/auth/get-session`, `/api/auth/forget-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, magic-link, OAuth callbacks, social provider routes) is reachable and returns the same response shape. A bridge that catches `/api/auth/*` at the wildcard but breaks one sub-path is the most likely silent P0.
