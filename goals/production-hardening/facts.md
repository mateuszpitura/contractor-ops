# Production Hardening — Fact Sheet

**Goal slug:** `production-hardening`
**Scope:** Reconcile existing audit docs against current code, ship every procedural fix that does not need design discussion, recommend (do not commit) the remaining infrastructure shape. Single goal, three phased deliverables, atomic commits, work on a new branch off current `main` HEAD.

---

## Phase A — Doc reconciliation (verifiable)

- `SECURITY-AUDIT.md` carries an "as of" header that points to the 2026-05-11 closure for every item the closure already shipped (currently it is dated 2026-04-11 and predates the closure).
- `SECURITY-AUDIT.md` line 8 ("CSP `unsafe-inline` / `unsafe-eval` — **Open**") still reads "Open" because the directives still ship `'unsafe-inline'` in `apps/web/next.config.ts:90-91` — i.e. that row is accurate, not stale.
- `docs/PRODUCTION-CHECKLIST.md` Summary table row counts match the per-section `[x]/[ ]` totals after this pass.
- Every checklist row that the 2026-05-11 closure or the in-tree code already satisfies is flipped from `[ ]`/🟡 to `[x]` with a code citation. Verified candidates: §1 post-deploy health (probe shape is now `ProbeResult[]`), §4 audit log (helper exists), §5 RLS scaffolding (`withRlsSession` wired), §6 split URL guidance (DATABASE_URL_EU/ME present), §7 Upstash org cache (`org-cache.ts`), §10 outbox (helper landed).
- Every checklist row still open after the pass carries a one-line evidence pointer (file:line or doc anchor) explaining why it is still open — no row is left as `[ ]` with no source.
- A new top-of-file Status line cites the closure doc and the date of this reconciliation pass so the next reviewer sees the index without re-reading the body.
- `.audit-2026-05-03/02-security.md` and `05-observability.md` are not edited in place; instead the closure doc gains a final "Reconciled into PRODUCTION-CHECKLIST on YYYY-MM-DD" note so the audit corpus remains an immutable historical artifact.
- A new file `docs/AUDIT-INDEX.md` (or appended section in `PRODUCTION-CHECKLIST.md`) lists every audit doc with date + status (`historical` / `current` / `superseded-by`) so a future reader knows which file to trust.

## Phase B — Procedural code fixes (each one atomic commit)

### B.1 FE↔BE integration audit follow-through

- `goals/fe-be-integration-audit/AUDIT.md` is annotated to mark all 5 HIGH findings as **false positive** with the canonical confirm UI cited (Popover-with-reason in `apps/web/src/components/approvals/approval-queue/side-panel.tsx:531`; `RejectionReasonDialog` in `apps/web/src/components/time/contractor-timesheet-review.tsx:10`). The findings are not deleted from the audit; they are reclassified so the heuristic's blind spot is recorded for next-run improvement.
- `apps/web/src/components/invoices/skonto/skonto-form-section.tsx:178-179` no longer calls `window.confirm` for `skonto.deleteForInvoice`; uses `<AlertDialog>` matching `apps/web/src/components/workflows/templates-table.tsx:360-380`.
- `apps/web/src/components/contractors/billing-profile/default-skonto-section.tsx:138-139` no longer calls `window.confirm` for `skonto.deleteForBillingProfile`; same `<AlertDialog>` pattern.
- All MED missing-onSuccess and missing-error-toast mutations from the audit (e.g. `portal.logout` at `portal-top-bar.tsx:120`) have `onSuccess` + `onError` wired with toast feedback.
- **Updated 2026-05-16 (commit eb23465e + audit follow-up):** Of the 7 mutations originally flagged for missing-invalidation:
  - **VERIFIED (no code change required):** `zatca.runComplianceChecks`, `zatca.requestComplianceCsid`, `zatca.generateCsr`, `zatca.exchangeProductionCert`, `zatca.saveTaxDetails` — parent `OnboardingWizard.goNext` (and `handleWizardComplete` for production-cert) invalidates `zatcaTrpc.getOnboardingState.queryKey()` (and `getComplianceStats` for production-cert). Per-step `invalidateQueries` would race the parent path. Rationale comments cited at each mutation site in commit `eb23465e`.
  - **VERIFIED (no code change required):** `portal.logout` — `handleLogout`'s `finally` block unconditionally calls `router.push('/portal/login')` regardless of mutation outcome; cookie cleared via `/api/portal/clear-session`. Fire-and-forget by design.
  - **FIXED (this commit):** `gdpr.requestErasure` — onSuccess now calls `queryClient.clear()` + `router.push('/login')` so the deleted-org user is signed out instead of stranded on a stale settings tab. The earlier rationale comment's claim of a `/goodbye` middleware redirect was inaccurate (no such route existed in the codebase).

### B.2 Audit-log helper enforcement

- `packages/api/src/services/audit-writer.ts` exports `writeAuditLog` / `writeAuditLogMany` (already true; verified `audit-writer.ts:118,165`).
- 15 direct `tx.auditLog.create` callsites (13 in `packages/api/src/routers/equipment/*`, 1 in `compliance/gdpr.ts:244`, 1 in `finance/invoice.ts:424`) call `writeAuditLog`/`writeAuditLogMany` instead.
- A grep guard in `scripts/lint-audit-log.mjs` (or extension of `scripts/lint-*` pattern) wired into `.husky/pre-push` fails when source files outside `packages/api/src/services/audit-writer.ts` call `auditLog.create` or `auditLog.createMany` directly.

### B.3 Resilience rollout

- All 11 adapters currently in "Class B" (`fetchWithTimeout` only) opt into `withResilience` per `packages/integrations/src/services/resilience-config.ts`: jira, confluence, teams, notion, linear, google-calendar, google-workspace, outlook-calendar, autenti, docusign, ksef-api-client.
- All 19 raw-`fetch` callsites in `packages/api/src/services/**` and `packages/integrations/src/services/**` either wrap their call in `fetchWithTimeout` (minimum) or are explicitly annotated `// resilience: raw-fetch-OK reason=<why>` (boe-poller, health-service, exchange-rate ECB are candidates for an explicit "low-criticality, well-behaved upstream" annotation).
- The 3 courier clients (`inpost-client.ts`, `dpd-client.ts`, `ups-client.ts`) plus `clockify-sync.ts`, `doc-link-service.ts`, `jira-*-sync.ts`, `jira-webhook-handler.ts`, `linear-issue-sync.ts`, `esign-orchestrator.ts`, `onboarding-import-service.ts`, `ocr-extraction.ts`, `resend-email-intake.ts` use `fetchWithTimeout` at minimum.
- A grep guard `scripts/lint-raw-fetch.mjs` wired into `.husky/pre-push` flags new raw `fetch(...)` introductions in adapter/service paths unless they carry the annotation.

### B.4 Idempotency-key unification

- Stripe (`packages/api/src/services/billing-service.ts:140,262,315,376,422`), Resend (`resend-client.ts`, `resend-adapter.ts`), InPost (`inpost-client.ts:100`), DPD, UPS, Slack, Teams adapters either use `deriveIdempotencyKey` from `packages/integrations/src/services/idempotency.ts:95` or explicitly cite why the provider lacks a per-call idempotency interface (Slack/Teams already documented; verify and link the doc comment).
- An ESLint or `scripts/lint-idempotency.mjs` guard flags new `createHash('sha256')`-as-idempotency-key inventions outside `idempotency.ts`.

### B.5 Advisory-lock dual-hold shim cleanup

- `packages/api/src/lib/advisory-lock.ts` no longer references `ADVISORY_LOCK_TRANSITION_DUAL_HOLD`.
- All 5 `TODO(advisory-lock-transition)` markers are deleted.
- `packages/api/src/lib/__tests__/advisory-lock.test.ts` has the dual-mode tests collapsed into the single-mode equivalent; passes locally.
- `docs/PRODUCTION-CHECKLIST.md` and `AUDIT-CLOSURE-2026-05-11.md` §2.2 / §3.2 are updated to mark the shim removed.
- **Prerequisite**: shim removal commits only land after a maintainer confirms the env var has been unset in every Render service for at least one full deploy cycle. The PR description spells this out; a verification checklist line is in the PR template.

### B.6 Observability gaps

- `apps/web/src/app/api/trpc/[trpc]/route.ts` seeds an ALS frame via `buildContextFromHeaders(request.headers)` + `runWithRequestContext(...)` (matching the pattern in `apps/web/src/app/api/auth/[...all]/route.ts:41`), so any client-supplied `x-request-id` survives the tRPC HTTP boundary and a single batched HTTP call uses one requestId across every batched procedure.
- `apps/web/src/middleware.ts` mints `x-request-id` if missing and forwards it on the outgoing request headers so the same id reaches both the auth and tRPC handlers.
- Sentry's `Sentry.withIsolationScope` callback in the tRPC route sets `requestId` as a scope tag for cross-tool correlation.
- A new `scripts/lint-silent-catch.mjs` (or existing logger lint extension) flags `} catch (e) {}` and `.catch(() => {})` patterns in `packages/api/src` and `apps/*/src` source, demanding either a `logger.error(...)` or `// safe-swallow: <reason>` annotation.

### B.7 Webhook silent-error fixes

- `apps/web/src/app/api/webhooks/_process/route.ts` and the `[provider]` shim do not swallow errors silently; every catch path logs structured `{ provider, eventId, requestId }` and rethrows or sets non-2xx where retry semantics demand it.

## Phase C — Hardening adds

### C.1 CSP

- `apps/web/src/app/layout.tsx:38-54` inline theme/density bootstrap script is replaced with one of: (a) a Server Component that renders the resolved theme/density attributes inline (no script), (b) a small `next/script` strategy-`beforeInteractive` with a build-time hash, or (c) an explicit per-request `nonce` plumbed via `headers()` middleware.
- `apps/landing/src/app/layout.tsx:41-65` inline theme/RTL bootstrap is handled the same way.
- `apps/web/next.config.ts:90-91` CSP no longer carries `'unsafe-inline'` in `script-src` or `style-src` in production builds. `'unsafe-eval'` is gated `if (process.env.NODE_ENV === 'development')`.
- `img-src 'self' data: blob: https:` wildcard is narrowed to the known set: `https://*.r2.cloudflarestorage.com`, `https://avatars.*`, plus an explicit allowlist for partner logos (none if not needed).
- `apps/landing/next.config.ts` gains a `headers()` block mirroring web's CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- A CSP `report-to` / `report-uri` directive pipes violations to a dedicated route (`/api/csp-report`) that logs structured to Pino + tags Sentry. Production rolls out in `Content-Security-Policy-Report-Only` first, flip after 48h with zero unexpected reports.

### C.2 Other security headers

- `Cross-Origin-Opener-Policy: same-origin` shipped on both apps.
- `Cross-Origin-Resource-Policy: same-site` shipped on both apps.
- `Cross-Origin-Embedder-Policy: credentialless` shipped on both apps (verified compatible with DocuSign iframe + Sentry CDN).
- `Permissions-Policy` is extended with `interest-cohort=()`, `payment=()` (unless Stripe Payment Element is added later), `fullscreen=(self)`.
- `apps/web/public/.well-known/security.txt` (or `apps/web/src/app/.well-known/security.txt/route.ts`) exists, pointing to a security contact + PGP key + policy URL.

### C.3 Dependency hygiene

- `.github/dependabot.yml` exists, configured for weekly npm + GitHub Actions updates, grouped by ecosystem, with a separate daily channel for security-only updates.
- A `package-rules` block in `renovate.json` is documented as the fallback if Dependabot grouping proves insufficient; not enabled simultaneously.
- `pnpm audit --audit-level high` is wired as an informational step in `.github/workflows/ci.yml` (already true at the `moderate` level; this fact tracks tightening).

### C.4 A11y gate

- `@axe-core/playwright` is added as devDep and at least one Playwright config (`playwright.functional.config.ts` is the candidate) runs `injectAxe` + assertion on a curated top-10 routes list.
- The axe gate runs in CI in `.github/workflows/ci.yml` (new job `e2e-a11y`) and fails on any new serious/critical violation; an allowlist file `.axe-allowlist.json` captures known violations with expiry dates.
- WCAG 2.2 AA self-attestation page lives at `docs/ACCESSIBILITY.md`.

### C.5 Error / loading / not-found coverage

- `apps/web/src/app/global-error.tsx` exists (already true; verified). Body is reviewed: it does not leak stack traces in production, reports to Sentry, and offers a "Reload" affordance.
- Each of the top 10 routes in `apps/web/src/app/[locale]/(dashboard)/**` has either an inline Suspense boundary with a `loading.tsx` neighbour, or an explicit decision documented in `docs/ERROR-BOUNDARIES.md`. Current top-10 set: `/dashboard`, `/contractors`, `/contracts`, `/invoices`, `/payments`, `/approvals`, `/equipment`, `/workflows`, `/settings`, `/admin`.
- Each top-10 route has an `error.tsx` boundary (currently only `apps/web/src/app/[locale]/error.tsx` exists at locale root) OR explicitly inherits from the locale-level boundary with that decision documented.

### C.6 Bundle + perf budget

- `@next/bundle-analyzer` is wired into `apps/web/next.config.ts` behind `process.env.ANALYZE === 'true'`.
- A reference budget exists at `docs/PERF-BUDGETS.md`: main `/dashboard` route ≤ 250 KB gzipped JS, ≤ 80 KB CSS. A CI job `bundle-size` enforces it (uses `size-limit` or Next 15 build output parsing).
- `useReportWebVitals` is wired in `apps/web/src/app/layout.tsx` (or a Client Component child) and ships LCP/INP/CLS/TTFB to Axiom via the existing Pino pipeline (server side) or a tiny browser beacon to `/api/web-vitals`.
- `apps/web/next.config.ts` gains an explicit `images.remotePatterns` allowlist for every external host the app loads images from; default-deny otherwise.

### C.7 Cache & query

- Cache-control headers are declared explicitly for every public, idempotent GET route under `apps/web/src/app/api/**`. The default is `Cache-Control: no-store` (matching current behaviour) but documented as a per-route decision in `docs/CACHE-CONTROL.md`.
- Every hot-path `prisma.organization.findUnique` call in `apps/web/src/app/**` that runs on every dashboard navigation either flows through `getOrgMeta(...)` (`packages/api/src/services/org-cache.ts:65`) or is wrapped in `unstable_cache` with a tag.
- A short `docs/N+1-AUDIT.md` documents the result of a one-pass scan of the 10 highest-traffic tRPC procedures (use existing perf tests + Prisma query log) and records each hot path's status (`ok` / `to-fix` / `fixed`).

## Phase D — Infra recommendations (doc deliverable, no infra commits)

- `docs/INFRA-RECOMMENDATIONS.md` exists and covers each of the items below with: current state (citing `render.yaml` lines), recommended state, expected impact, rollout sequencing, observability hooks, rollback path. No `render.yaml` edits are made by this goal.
- The doc covers: (i) worker scaling for `worker` service (currently `starter` single-instance; recommend min=2 with health-based scale + zero-downtime drain), (ii) separate worker shape for PDF/export renders (CPU + memory profile vs general worker), (iii) ClamAV redundancy or fallback (currently single `pserv`), (iv) Unleash high-availability for EU+ME (currently single each), (v) read-replica routing rollout criteria (when to enable, which procedures next after `dashboard.kpis`), (vi) Better Auth secondaryStorage proposal (currently per-pod rate-limit memory — multi-pod amplifies the cap N×).
- The doc proposes OpenTelemetry export targeting Axiom (vendor already integrated for logs) with a code snippet for the `@vercel/otel` (or `@opentelemetry/sdk-node`) setup, plus a tracing surface plan (HTTP → tRPC → Prisma → fetch → QStash) and the trace-vs-cost tradeoff. **Recommendation only**; no SDK code is added by this goal.
- The doc proposes a CDN-level cache strategy for landing + public asset paths and identifies where Cloudflare in front of Render would absorb load.
- The doc captures an SLO/SLI starting set (web p95 latency, public-api p95 latency, error budget per service) tied to existing Cronitor/Axiom metrics.
- The doc lists Tier-2 work still owned by the closure (read-replica routing, RLS `CREATE POLICY` migration, circuit-breaker rollout) with explicit pickup criteria, so the next operator can act without reading the entire audit corpus.

---

## Out of scope (explicit non-goals)

- No modifications to `render.yaml`, no new Render services, no DB migrations, no `CREATE POLICY` RLS migration. All infra changes are recommendations in Phase D.
- No dependency upgrades. Bot config only.
- No new test resurrection beyond what the procedural fixes incidentally require. The 51 known failures in `packages/api` per `.planning/handoffs/test-cleanup-2026-04-27.md` remain a separate concern.
- No changes to files in the current dirty working tree (typed-i18n migration). Work starts from a new branch off current `HEAD`; those files remain untouched.
- No Tier-2 audit items (read-replica rollout, RLS policies, full circuit-breaker rollout to every raw-fetch site that needs design discussion). Those are flagged in Phase D for follow-up.
