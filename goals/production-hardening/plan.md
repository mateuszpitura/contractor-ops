# Production Hardening — Execution Plan

**Goal:** `production-hardening`
**Facts:** `goals/production-hardening/facts.md`
**Branch model:** New branch `feat/production-hardening` cut from current `main` HEAD (`27e909c2`). Working-tree changes (~145 modified files from the in-flight typed-i18n migration) are NOT touched; they ride along uncommitted on the new branch until the user finalises them.
**Commit style:** One atomic commit per fact, conventional commits (`fix:`, `feat:`, `refactor:`, `docs:`, `chore:`), Co-Authored-By the assistant.
**Verification:** Every step lists the concrete check. CI commands run from repo root unless noted: `pnpm run typecheck`, `pnpm run lint:ci`, `pnpm run test --filter=<scope>`, `pnpm run build --filter=<scope>`.

---

## Solution approach

Three phases land in dependency order. Phase A is doc-only and cheap; doing it first means Phase B/C commits can cite a single up-to-date checklist instead of re-justifying status. Phase B groups the procedural fixes that need no design discussion. Phase C adds the hardening that touches infrastructure boundaries (CSP, headers, a11y gate, perf budget). Phase D is a single doc that captures recommendations the maintainer must approve before any `render.yaml` edit.

Each phase ends with a green CI run on the branch and a manual checkpoint with the maintainer before the next phase starts.

### Sequencing rationale

- Phase A first — reconciling the docs surfaces "already done" rows that would otherwise generate duplicate work in B/C.
- B.5 (advisory-lock shim removal) is the only Phase B item with a runtime prerequisite (env var unset in prod for one deploy cycle); it sits at the end of B.
- C.1 (CSP nonces) is risk-heaviest — ships in `Content-Security-Policy-Report-Only` first, observes 48h, then flips. This is the only fact that takes calendar time the assistant cannot compress.
- C.4 axe-core gate ships AFTER C.5 boundary coverage — gating before the boundaries exist is noise.
- Phase D writes the infra recommendation doc; nothing in this goal mutates `render.yaml`.

### Out-of-band prerequisites (user holds)

- **B.5** waits on the user confirming `ADVISORY_LOCK_TRANSITION_DUAL_HOLD` has been unset in every Render service for ≥1 deploy cycle.
- **C.1** waits on the user observing the report-only CSP for 48h and confirming zero unexpected reports before flipping to enforce.
- **Phase D** outputs a doc only; if the user accepts any recommendation, infra commits land in a follow-up goal.

---

## Phase A — Doc reconciliation (1 commit, ~1h)

### Step A.1 — Reconcile `docs/PRODUCTION-CHECKLIST.md` + write `docs/AUDIT-INDEX.md`

**Touches:** `docs/PRODUCTION-CHECKLIST.md`, `SECURITY-AUDIT.md`, `docs/AUDIT-INDEX.md` (new), `.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md` (one-line reconciliation footnote only).

**Procedure:**
1. Read `.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md` end-to-end and the latest `STATE.md` in `.planning/`.
2. For every `[ ]`/🟡 row in `PRODUCTION-CHECKLIST.md`, grep the cited file/path. Flip to `[x]` only when the source clearly satisfies the row; otherwise leave but append a one-line `→ evidence: <path>:<line> — <reason still open>` pointer.
3. Recount the Summary table. Update the header `Last reviewed` date and add a `Reconciled-against` line citing closure doc.
4. Re-date `SECURITY-AUDIT.md`. Add a top-of-file pointer: "For the canonical post-launch state, see `docs/PRODUCTION-CHECKLIST.md`. This file is preserved as a 2026-04-11 snapshot."
5. Create `docs/AUDIT-INDEX.md` listing every audit doc with date + status (`historical` / `current` / `superseded-by`).
6. Append a one-line "Reconciled into PRODUCTION-CHECKLIST on YYYY-MM-DD" note to the closure doc.

**Verification:**
- `grep -c "^- \[ \]" docs/PRODUCTION-CHECKLIST.md` matches the new Summary table Pending column.
- `grep -c "^- \[x\]" docs/PRODUCTION-CHECKLIST.md` matches the new Done column.
- Every `[ ]` row has either `evidence:` text or a `🔴/🟠/🟢/⚪` priority badge.
- `docs/AUDIT-INDEX.md` lists at least these files: `SECURITY-AUDIT.md`, `docs/PRODUCTION-CHECKLIST.md`, `contractor-ops-launch-checklist.md`, `.audit-2026-05-03/*.md`, `goals/fe-be-integration-audit/AUDIT.md`.

**Risk:** LOW. Doc-only. Reversible.

**Commit:** `docs(audit): reconcile production checklist with post-launch state + add audit index`

---

## Phase B — Procedural code fixes

### Step B.1 — FE↔BE follow-through (3 commits)

**B.1.a Reclassify HIGH findings**

- **Touches:** `goals/fe-be-integration-audit/AUDIT.md` (add reclassification table; do NOT delete original findings).
- **Verification:** All 5 HIGH IDs (`F-HIGH-001..005`) carry a "reclassified: false-positive (heuristic limitation)" line + citation of the actual confirm UI.
- **Risk:** LOW. Doc edit.
- **Commit:** `docs(audit): reclassify FE↔BE HIGH findings as heuristic false-positives`

**B.1.b Replace `window.confirm` with `<AlertDialog>` on 2 skonto deletes**

- **Touches:** `apps/web/src/components/invoices/skonto/skonto-form-section.tsx`, `apps/web/src/components/contractors/billing-profile/default-skonto-section.tsx`.
- **Reference pattern:** `apps/web/src/components/workflows/templates-table.tsx:360-380` (canonical `<AlertDialog>` + `<AlertDialogAction>` wiring).
- **Verification:**
  - `grep -n "window.confirm" apps/web/src/components/invoices/skonto/ apps/web/src/components/contractors/billing-profile/` returns no matches.
  - `pnpm run test --filter=@contractor-ops/web -- skonto` passes (component tests for both files exist or are added).
  - Manual: open `/invoices/<id>` → trigger skonto delete → AlertDialog appears with destructive variant + cancel + confirm.
- **Risk:** LOW. Self-contained UI swap.
- **Commit:** `fix(skonto): replace window.confirm with AlertDialog on destructive deletes`

**B.1.c Wire missing `invalidateQueries` / `onSuccess` / `onError` toast on 7 mutations**

- **Touches:**
  - `apps/web/src/components/settings/gdpr-data-rights-section.tsx`
  - `apps/web/src/components/zatca/compliance-checks.tsx`
  - `apps/web/src/components/zatca/compliance-csid.tsx`
  - `apps/web/src/components/zatca/csr-generation.tsx`
  - `apps/web/src/components/zatca/production-certificate.tsx`
  - `apps/web/src/components/zatca/tax-details-form.tsx`
  - `apps/web/src/components/portal/portal-top-bar.tsx`
- **For each:** locate the related query key via `trpc.<scope>.<query>.queryOptions(...)`, call `queryClient.invalidateQueries({ queryKey })` in `onSuccess`. Where `onSuccess` is missing entirely, add it plus `toast.success`. Where `onError` is missing, add `toast.error(err.message)` with i18n-keyed fallback.
- **Verification:**
  - Each mutation's `onSuccess` body contains `invalidateQueries`. Audit by running the existing FE↔BE auditor: `node goals/fe-be-integration-audit/...` (re-run script that produced the audit) — expected: 0 missing-invalidation findings on these 6 files.
  - `pnpm run typecheck` + `pnpm run test --filter=@contractor-ops/web -- zatca portal gdpr` pass.
  - Manual: trigger each mutation, confirm UI updates without full reload.
- **Risk:** LOW. Additive handlers.
- **Commit:** `fix(mutations): invalidate queries + toast feedback on ZATCA, GDPR, portal logout`

### Step B.2 — Audit-log helper enforcement (3 commits)

**B.2.a Migrate 13 `equipment/*` callsites to `writeAuditLog`/`writeAuditLogMany`**

- **Touches:**
  - `packages/api/src/routers/equipment/equipment.ts:190, :245, :306, :387, :461`
  - `packages/api/src/routers/equipment/equipment-returns.ts:194, :297`
  - `packages/api/src/routers/equipment/equipment-shipments.ts:96, :183`
  - `packages/api/src/routers/equipment/equipment-couriers.ts:192, :361, :536, :604`
- **Procedure:** For each call, replace `tx.auditLog.create({ data: {...} })` with `writeAuditLog({ tx, ...fields })`. Preserve transaction scope. If a callsite is outside a `tx`, use the non-tx form.
- **Verification:**
  - `grep -rn "auditLog\.create" packages/api/src/routers/equipment` returns no matches.
  - `pnpm run test --filter=@contractor-ops/api -- equipment` passes (or maintains pre-edit state where tests already fail per known debt; record any new failures introduced).
  - `pnpm run typecheck` passes.
- **Risk:** LOW-MEDIUM. Helper signature must match `before`/`after` JSON discipline — verify each call's data shape.
- **Commit:** `refactor(audit-log): route equipment router audit writes through writeAuditLog helper`

**B.2.b Migrate `compliance/gdpr.ts:244` and `finance/invoice.ts:424`**

- Same pattern as B.2.a, separate commit because these touch different domains.
- **Commit:** `refactor(audit-log): route gdpr + invoice audit writes through writeAuditLog helper`

**B.2.c Add pre-push lint guard**

- **Touches:** `scripts/lint-audit-log.mjs` (new), `package.json` (script entry), `.husky/pre-push`.
- **Procedure:** Mirror the `scripts/check-raw-sql-tenant-scoped.ts` pattern. Grep for `auditLog\.create(Many)?\b` outside `packages/api/src/services/audit-writer.ts`. Fail with the offending file:line list.
- **Verification:**
  - `pnpm run lint:audit-log` exits 0 from a clean tree.
  - Manually re-introduce a violation in a scratch file → script exits non-0 → revert.
- **Risk:** LOW.
- **Commit:** `chore(lint): forbid direct auditLog.create calls outside writeAuditLog helper`

### Step B.3 — Resilience rollout (4 commits)

**B.3.a Opt 11 adapters into `withResilience`**

- **Touches:** Each of the 11 "Class B" adapters under `packages/integrations/src/adapters/` + `packages/integrations/src/services/ksef-api-client.ts`. Also `packages/integrations/src/services/resilience-config.ts` (per-provider tuning).
- **Procedure:** For each adapter, wrap the per-method outbound calls in `withResilience('<provider>', () => fetchWithTimeout(...))`. Verify config entry exists for the provider; add with conservative defaults (10s timeout, 5-failure breaker, 50% rolling 60s) if missing.
- **Verification:**
  - Existing adapter tests pass: `pnpm run test --filter=@contractor-ops/integrations`.
  - Sample a breaker trip in test: deliberately fail 6 calls, expect 7th to short-circuit.
- **Risk:** MEDIUM. Wrong threshold can produce false-positive breaker trips in prod. Land with conservative config; tune via observability later.
- **Commit:** `feat(resilience): wrap 11 integration adapters in withResilience`

**B.3.b Apply `fetchWithTimeout` to courier clients**

- **Touches:** `packages/api/src/services/courier/inpost-client.ts`, `dpd-client.ts`, `ups-client.ts`.
- **Verification:** All raw `fetch(` calls inside these files are gone; replaced with `fetchWithTimeout`. Courier integration tests pass.
- **Risk:** LOW. Drop-in.
- **Commit:** `feat(courier): apply fetchWithTimeout to InPost/DPD/UPS clients`

**B.3.c Apply `fetchWithTimeout` to remaining raw-fetch services**

- **Touches:** `clockify-sync.ts`, `doc-link-service.ts`, `jira-issue-sync.ts`, `jira-webhook-handler.ts`, `jira-worklog-sync.ts`, `linear-issue-sync.ts`, `esign-orchestrator.ts`, `onboarding-import-service.ts`, `ocr-extraction.ts`, `resend-email-intake.ts`.
- **Procedure:** Same as B.3.b. Annotate `boe-base-rate-poller.ts`, `health-service.ts`, `exchange-rate.ts`, `cron-monitor.ts` with `// resilience: raw-fetch-OK reason=<why>` instead of wrapping.
- **Verification:** `pnpm run lint:raw-fetch` (next step) reports no unannotated raw fetch in adapter/service paths.
- **Risk:** LOW.
- **Commit:** `feat(resilience): apply fetchWithTimeout to service-layer outbound calls`

**B.3.d Add `scripts/lint-raw-fetch.mjs` pre-push guard**

- Same pattern as B.2.c.
- **Commit:** `chore(lint): forbid unannotated raw fetch in adapter/service paths`

### Step B.4 — Idempotency unification (2 commits)

**B.4.a Migrate Stripe/InPost/Slack/Teams/Resend to `deriveIdempotencyKey` or annotate**

- **Touches:** `packages/api/src/services/billing-service.ts`, `packages/integrations/src/services/messaging/slack-messaging-provider.ts`, `packages/integrations/src/services/messaging/teams-messaging-provider.ts`, `packages/integrations/src/adapters/resend-adapter.ts`, `packages/api/src/services/courier/inpost-client.ts`.
- **Procedure:** Replace local hash inventions with `deriveIdempotencyKey({ orgId, operation, businessKey })`. For Slack/Teams (no provider-side support), add a code-doc comment citing the closure doc §6 explanation and link the `Notification.dedupKey` DB-level dedup pattern.
- **Verification:** All Stripe mutations that retry produce the same idempotency key on retry. `pnpm run test --filter=@contractor-ops/api -- billing` passes.
- **Risk:** MEDIUM. Wrong key shape could mask retries as new operations. Test coverage on retry semantics is the gate.
- **Commit:** `refactor(idempotency): unify Stripe/InPost/Resend on deriveIdempotencyKey`

**B.4.b Add lint guard**

- Mirror B.2.c / B.3.d pattern. Flag `createHash('sha256')` used as an idempotency key outside `idempotency.ts`.
- **Commit:** `chore(lint): forbid hand-rolled idempotency keys outside deriveIdempotencyKey`

### Step B.5 — Advisory-lock shim cleanup (1 commit, gated)

**Touches:** `packages/api/src/lib/advisory-lock.ts` (remove `TRANSITION_DUAL_HOLD` branch + 5 TODOs), `packages/api/src/lib/__tests__/advisory-lock.test.ts` (collapse dual-mode tests), `docs/PRODUCTION-CHECKLIST.md` + `AUDIT-CLOSURE-2026-05-11.md` §2.2 / §3.2 (mark removed).

**Prerequisite (out-of-band):** User confirms `ADVISORY_LOCK_TRANSITION_DUAL_HOLD` has been unset in every Render service for at least one full deploy cycle. The PR body asks for this confirmation explicitly; if the user has not confirmed by the time the rest of Phase B is green, the shim cleanup defers to a follow-up PR.

**Verification:** All 5 `TODO(advisory-lock-transition)` markers gone. `grep "ADVISORY_LOCK_TRANSITION_DUAL_HOLD" packages/` returns no matches. Tests pass.

**Risk:** MEDIUM. If the prerequisite is not actually met, removing the shim risks rolling deploys with stale instances holding old-form locks. Mitigated by the explicit user-confirmation gate.

**Commit:** `refactor(advisory-lock): remove dual-hold transition shim`

### Step B.6 — requestId propagation through tRPC HTTP boundary (1 commit)

**Touches:** `apps/web/src/app/api/trpc/[trpc]/route.ts`, `apps/web/src/middleware.ts`.

**Procedure:**
1. In `apps/web/src/middleware.ts`, mint `x-request-id` (UUID v4) if the incoming request lacks one. Forward via `NextResponse.next({ request: { headers: ... } })`.
2. In `apps/web/src/app/api/trpc/[trpc]/route.ts`, mirror the auth route pattern (`apps/web/src/app/api/auth/[...all]/route.ts:41`): call `buildContextFromHeaders(request.headers)` and wrap the handler in `runWithRequestContext(ctx, () => fetchRequestHandler(...))`.
3. Inside `Sentry.withIsolationScope`, call `scope.setTag('requestId', ctx.requestId)`.

**Verification:**
- Hit `/api/trpc/healthcheck` with `x-request-id: test-123`; tail logs and confirm `requestId: test-123` appears on every log line emitted by the handler chain.
- Batched tRPC call producing two procedures: both log lines share the same requestId.
- Sentry event from a triggered error includes the requestId tag.

**Risk:** LOW. Same pattern already in production for auth.

**Commit:** `feat(observability): propagate requestId through tRPC HTTP boundary via ALS`

### Step B.7 — Webhook silent-error fixes + silent-catch lint (2 commits)

**B.7.a Fix `_process` + `[provider]` webhook handlers**

- **Touches:** `apps/web/src/app/api/webhooks/_process/route.ts`, `apps/web/src/app/api/webhooks/[provider]/route.ts`.
- **Procedure:** Every `catch` either logs structured `{ provider, eventId, requestId, err }` and rethrows, or explicitly chooses to swallow with a `// safe-swallow:` annotation.
- **Verification:** Trigger a synthetic webhook failure in dev; confirm log shipped to Axiom with full context; confirm response is non-2xx for retryable errors.
- **Risk:** LOW.
- **Commit:** `fix(webhooks): log + propagate errors instead of silent catch`

**B.7.b Add `scripts/lint-silent-catch.mjs` pre-push guard**

- Same pattern as prior lint guards. Flag `} catch (e) {}` and `.catch(() => {})` in `packages/api/src` + `apps/*/src` without `logger.error` or annotation.
- **Commit:** `chore(lint): forbid silent catch blocks without annotation`

---

## Phase C — Hardening adds

### Step C.1 — CSP nonces (3 commits + 48h observation)

**C.1.a Replace inline theme bootstrap with Server Component**

- **Touches:** `apps/web/src/app/layout.tsx`, `apps/landing/src/app/layout.tsx`. Possibly a new `apps/web/src/lib/get-theme-attributes.ts` Server Component helper.
- **Procedure:** Move the theme/density resolution to a Server Component that reads cookies/headers at render time and emits `<html data-theme={resolved} data-density={resolved}>`. Eliminate the inline `<script dangerouslySetInnerHTML>`.
- **Verification:** `grep -rn "dangerouslySetInnerHTML" apps/web/src/app/layout.tsx apps/landing/src/app/layout.tsx` returns no matches. `next dev` renders correct theme on first paint with no FOUC; CSP can already drop `'unsafe-inline'` from script-src in dev with no console errors.
- **Risk:** MEDIUM. Wrong order = theme flash. Test in dark mode + RTL + density combinations.
- **Commit:** `refactor(layout): replace inline theme bootstrap with Server Component cookie read`

**C.1.b Land CSP in report-only mode**

- **Touches:** `apps/web/next.config.ts`, `apps/landing/next.config.ts`, `apps/web/src/app/api/csp-report/route.ts` (new).
- **Procedure:** Add `Content-Security-Policy-Report-Only` header with the nonce-based directives (drop `'unsafe-inline'` from script-src + style-src). Keep existing `Content-Security-Policy` enforce header unchanged. Wire `/api/csp-report` to log structured Pino + Sentry breadcrumb.
- **Verification:**
  - `curl -I https://staging/...` shows both headers.
  - Synthetic violation produces a log entry and a Sentry breadcrumb.
- **Risk:** LOW. Report-only does not block.
- **Commit:** `feat(csp): ship report-only nonce-based CSP alongside enforce header`

**C.1.c Flip enforce + remove report-only**

- **Out-of-band gate:** User confirms 48h of report-only with zero unexpected reports (DocuSign embed, Sentry tunnel, Turnstile all working). If reports appear, return to C.1.b adjusting allowlist before this step.
- **Touches:** `apps/web/next.config.ts`, `apps/landing/next.config.ts`.
- **Procedure:** Move the report-only directives into the enforce header; remove the legacy `'unsafe-inline'` entirely. Keep `report-to` directive.
- **Verification:** `curl -I https://prod/...` shows nonce-based CSP enforce. Sentry/DocuSign/Turnstile flows still work end-to-end (smoke list documented in `docs/CSP-SMOKE.md`).
- **Risk:** MEDIUM. If C.1.b observation was incomplete, this can break the live app. Mitigated by the 48h gate.
- **Commit:** `feat(csp): drop unsafe-inline in production CSP`

### Step C.2 — Other security headers (2 commits)

**C.2.a Add COOP/COEP/CORP + extend Permissions-Policy + ship to landing**

- **Touches:** `apps/web/next.config.ts:101-120`, `apps/landing/next.config.ts` (new `headers()` block).
- **Procedure:** Add COOP `same-origin`, CORP `same-site`, COEP `credentialless`. Extend Permissions-Policy with `interest-cohort=()`, `payment=()`, `fullscreen=(self)`. Mirror full security header block on landing.
- **Verification:** `curl -I https://staging/...` shows all headers. `https://securityheaders.com` scan rates A+ for both apps.
- **Risk:** MEDIUM. COEP `credentialless` can break iframe embeds; verify DocuSign signing iframe loads.
- **Commit:** `feat(security): add COOP/COEP/CORP + extend Permissions-Policy; mirror to landing`

**C.2.b Add `security.txt`**

- **Touches:** `apps/web/src/app/.well-known/security.txt/route.ts` (new) or `apps/web/public/.well-known/security.txt`.
- **Verification:** `curl https://prod/.well-known/security.txt` returns RFC 9116-compliant content. Validate with `https://securitytxt.org/` validator.
- **Risk:** LOW.
- **Commit:** `feat(security): publish .well-known/security.txt`

### Step C.3 — Dependabot config (1 commit)

**Touches:** `.github/dependabot.yml` (new).

**Procedure:** Configure weekly npm + GitHub Actions ecosystems, grouped by `dev-dependencies` / `production-dependencies` / `security-updates`. Daily channel for security-only. Open-PR limit 10. Assign reviewers via CODEOWNERS.

**Verification:** GitHub UI shows Dependabot enabled. Configuration validates via `gh api repos/:owner/:repo/dependabot/secrets` reachable (or by waiting for first PR within 7d).

**Risk:** LOW.

**Commit:** `chore(deps): enable Dependabot weekly + daily security channel`

### Step C.4 — A11y gate (2 commits)

**C.4.a Wire axe-core into Playwright**

- **Touches:** `apps/web/package.json` (add `@axe-core/playwright`), `apps/web/e2e/a11y/*.test.ts` (new), `apps/web/playwright.functional.config.ts` (project entry).
- **Procedure:** Add `injectAxe` + `checkA11y` against top-10 routes (same set as C.5). `.axe-allowlist.json` captures known violations with `expiresAt` dates.
- **Verification:** `pnpm exec playwright test --project=a11y` runs locally; fails on any new serious/critical violation.
- **Risk:** LOW initially; may surface existing violations — those go in the allowlist with a target fix date.
- **Commit:** `feat(a11y): add axe-core Playwright gate on top-10 routes`

**C.4.b Add CI job + WCAG attestation doc**

- **Touches:** `.github/workflows/ci.yml` (new `e2e-a11y` job), `docs/ACCESSIBILITY.md` (new).
- **Verification:** PR fails CI when a serious violation is introduced.
- **Commit:** `chore(ci): gate PRs on axe-core a11y violations + publish WCAG 2.2 AA attestation`

### Step C.5 — Error / loading / not-found boundary coverage (1 commit)

**Touches:** Each top-10 route folder under `apps/web/src/app/[locale]/(dashboard)/**`. Possibly shared boundary primitives at `apps/web/src/components/boundaries/{route-error,route-loading}.tsx`.

**Procedure:** For each of `/dashboard`, `/contractors`, `/contracts`, `/invoices`, `/payments`, `/approvals`, `/equipment`, `/workflows`, `/settings`, `/admin`:
1. Add `error.tsx` if missing (delegates to shared `<RouteError>` primitive that reports to Sentry + offers reload).
2. Add `loading.tsx` if missing (shared `<RouteLoading>` skeleton matching the route's layout).
3. Verify `not-found.tsx` inheritance from locale-level `apps/web/src/app/[locale]/not-found.tsx` is intentional; document otherwise.

Audit existing `global-error.tsx` for: no stack-trace leak in prod, Sentry report, reload affordance.

**Verification:**
- Manually crash a route via `throw new Error('test')` in the page body — route-level boundary catches, layout chrome survives.
- Manual slow-network test — loading skeleton appears.
- Sentry receives the error with route name.

**Risk:** LOW-MEDIUM. Wrong layout nesting can cause double boundaries or none.

**Commit:** `feat(boundaries): add error/loading boundaries to top-10 dashboard routes`

### Step C.6 — Bundle + Web Vitals (3 commits)

**C.6.a Wire bundle analyzer + budget**

- **Touches:** `apps/web/next.config.ts` (conditional `withBundleAnalyzer`), `apps/web/package.json`, `docs/PERF-BUDGETS.md` (new), `.github/workflows/ci.yml` (new `bundle-size` job using `size-limit` or build-output parse).
- **Verification:** `ANALYZE=true pnpm run build --filter=@contractor-ops/web` produces analyzer report. CI fails if `/dashboard` bundle exceeds 250 KB gz.
- **Risk:** LOW. First budget value may be off; adjust based on baseline + 15% headroom.
- **Commit:** `feat(perf): integrate bundle analyzer + CI budget for top routes`

**C.6.b Web Vitals reporter**

- **Touches:** `apps/web/src/app/layout.tsx` (or a Client child), new `apps/web/src/app/api/web-vitals/route.ts`.
- **Procedure:** `useReportWebVitals` ships LCP/INP/CLS/TTFB/FCP via beacon to `/api/web-vitals`; route logs structured to Pino → Axiom.
- **Verification:** Local: confirm beacons fire in DevTools Network. Axiom: confirm dataset receives entries.
- **Commit:** `feat(perf): report Core Web Vitals to Axiom via /api/web-vitals`

**C.6.c Tighten `images.remotePatterns`**

- **Touches:** `apps/web/next.config.ts`.
- **Procedure:** Enumerate every `<Image src="https://...">` in source; add only matched hosts to `remotePatterns`. Default-deny.
- **Verification:** `pnpm run build` succeeds. Manual: every page that renders external images still works.
- **Commit:** `feat(security): narrow images.remotePatterns to known external hosts`

### Step C.7 — Cache + N+1 (3 commits)

**C.7.a Document explicit cache-control**

- **Touches:** Each `apps/web/src/app/api/**/route.ts` that is a public-readable GET; `docs/CACHE-CONTROL.md` (new).
- **Procedure:** Add explicit `Cache-Control: no-store` (or stricter where appropriate) to every public GET route. Document the per-route decision matrix.
- **Verification:** `curl -I` on each route shows the declared header.
- **Risk:** LOW. Conservative default is no-store.
- **Commit:** `feat(cache): declare cache-control headers explicitly on public API routes`

**C.7.b Route hot-path `findUnique` through `org-cache`**

- **Touches:** Every uncached `prisma.organization.findUnique` site reported by investigator (priority: portal layout `apps/web/src/app/[locale]/(portal)/layout.tsx:32,53`, classification layouts, slack-webhook-context).
- **Procedure:** Replace with `getOrgMeta(orgId)` from `packages/api/src/services/org-cache.ts:65`, falling back to direct read only where the cached fields are insufficient.
- **Verification:** Manually navigate the dashboard with Prisma query log enabled; confirm only the first request per 5min hits Postgres for `Organization`.
- **Risk:** MEDIUM. Cache invalidation on `organization.update` must already work; verify the existing invalidation path covers the new callers.
- **Commit:** `perf(org-cache): route hot-path organization findUnique through 5min cache`

**C.7.c N+1 audit document**

- **Touches:** `docs/N+1-AUDIT.md` (new).
- **Procedure:** Run the existing `perf` Playwright project against staging with Prisma query log on. Capture top 10 procedures by query count per request; document each as `ok`/`to-fix`/`fixed` with a one-line root cause.
- **Verification:** Doc contains all 10 entries with citations.
- **Risk:** LOW. Doc only.
- **Commit:** `docs(perf): N+1 audit of top-10 tRPC procedures`

---

## Phase D — Infra recommendations doc (1 commit)

### Step D.1 — Write `docs/INFRA-RECOMMENDATIONS.md`

**Touches:** `docs/INFRA-RECOMMENDATIONS.md` (new).

**Sections:**
1. **Worker scaling** — current `starter` single-instance for `worker` service (`render.yaml:341-365`); recommend min=2 + scale on queue depth via QStash dead-letter rate; drain protocol.
2. **PDF / export worker shape** — CPU/memory profile vs current `worker`; either split out a dedicated service or co-locate with a backpressure limit.
3. **ClamAV redundancy** — single `pserv` is a SPOF for upload virus scans; recommend either a second instance behind a load-balancer or async ClamAV via QStash with timeout fallback.
4. **Unleash HA per region** — single-instance EU + ME today; recommend min=2 each with shared DB.
5. **Read-replica rollout** — `readReplica` wrapper exists; only `dashboard.kpis` uses it; pickup criteria + next 5 candidate procedures.
6. **Better Auth secondary storage** — current in-memory per-pod rate limit amplifies the cap N× on multi-pod; recommend Upstash secondaryStorage adapter.
7. **OpenTelemetry → Axiom** — `@vercel/otel` or `@opentelemetry/sdk-node` setup snippet, trace surface (HTTP → tRPC → Prisma → fetch → QStash), cost estimate, rollout plan.
8. **CDN in front of Render** — Cloudflare reverse proxy for landing + static asset paths; SSL/edge-cache config.
9. **SLO/SLI starting set** — p95 latency targets per service, error budget, alert thresholds tied to existing Cronitor + Axiom integrations.
10. **Tier-2 follow-ups** — RLS `CREATE POLICY` migration, full circuit-breaker rollout to remaining ~10 raw-fetch sites (any that this goal annotated as `raw-fetch-OK`), advisory-lock-transition cleanup (post B.5).

Each section: current state (file:line citations), recommended state, expected impact, rollout sequencing, observability hooks, rollback path.

**Verification:** Maintainer can read the doc and approve/reject each recommendation independently. No `render.yaml` edits by this goal.

**Risk:** LOW. Doc-only.

**Commit:** `docs(infra): production-readiness infrastructure recommendations`

---

## Open questions / risks worth flagging

1. **Phase C.1.c gate (48h CSP observation)** is the only step that takes calendar time the assistant cannot compress. If the maintainer wants to ship the rest of Phase C first, mark C.1.c as the final follow-up.
2. **B.5 advisory-lock cleanup prerequisite** depends on a user confirmation about Render env state. If the env was never toggled to dual-hold mode in prod (deploy proceeded without it), the shim can be removed immediately — but this needs maintainer confirmation, not assumption.
3. **C.4 axe-core allowlist size** is unknown until first run. If the dashboard surface has many existing violations, the allowlist becomes the gating artifact; recommend a separate "axe cleanup" goal afterwards.
4. **C.6.c image hosts enumeration** assumes the inventory is small. If `<Image src>` uses dynamic URLs from user content, the recommendation flips from default-deny to a more permissive pattern + signed-URL middleware.
5. **Phase D OTel sample rate** must be specified before any code lands — 100% sampling in prod will blow the Axiom bill. Recommend 1% baseline + 100% for errors.
6. **Working tree finalization**: the ~145 modified files from typed-i18n migration are uncommitted at branch creation. If those land mid-goal (user commits to main), the branch may need a rebase — flag at each phase boundary.
7. **Tests known-failing in `packages/api`**: 16 files / ~51 failures per `.planning/handoffs/test-cleanup-2026-04-27.md`. Phase B commits will be careful to record any new failures introduced but will not fix the pre-existing failures (out of scope).
