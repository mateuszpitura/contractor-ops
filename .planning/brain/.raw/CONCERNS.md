---
last_mapped_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
last_mapped_at: 2026-06-08
---

# contractor-ops — Concerns, Tech Debt & Risks

Known gaps, security findings, test holes, and agent-specific risks. Primary source: `.planning/reports/CODE-OPTIMIZATION-AUDIT-2026-05-31.md` (static audit, post–`apps/web` → `apps/web-vite` migration). Severity labels match that report: **Critical / High / Medium / Low**. Effort: **S** ≤ half-day, **M** ~1–3 days, **L** ~1–2 weeks, **XL** multi-week.

**Health snapshot (audit date 2026-05-31):** Architecture Good, Code Quality Fair, Performance Good, Testing Fair, Tooling/DX Needs work, Security Good, i18n Fair, Dependencies Good, Dead Code Fair. Underlying tenant isolation, tRPC discipline, Page→Container→Hook layering, and guard suite are sound; debt clusters at enforcement seams and post-migration residue.

---

## 1. CI, tooling & agent risks

### High — No typecheck gate on largest app (Tooling/DX)

`apps/web-vite` (~217k LOC) builds via `vite build` (esbuild, no type checking). Audit noted no `pnpm typecheck` in GitHub CI workflows — `strict: true` TS is unenforced on the app under heaviest churn. Regressions can merge green.

- **Paths:** `apps/web-vite/package.json` (`build` script), root `package.json` (`typecheck`), `.github/workflows/` (verify locally)
- **Mitigation:** Add `pnpm typecheck --filter=@contractor-ops/web-vite` to CI after fixing `i18n:types` orphan (below)
- **Agent risk:** Agents editing `apps/web-vite/**` without running `pnpm typecheck --filter=@contractor-ops/web-vite` can ship type errors invisible to CI

### High — `i18n:types` turbo dependency (Tooling/DX)

`turbo.json` declares `i18n:types` with outputs `src/generated/i18n/**`, but audit reported fresh-clone `pnpm typecheck` could fail when the task was orphaned. **Current tree:** `apps/web-vite/package.json` now defines `i18n:types` → `tsx ../../scripts/generate-i18n-types.ts`. Verify CI still runs it before trusting typecheck.

- **Paths:** `turbo.json`, `scripts/generate-i18n-types.ts`, `apps/web-vite/src/generated/i18n/`
- **Agent risk:** Deleting or stale-generating i18n types breaks typed `t()` keys across hundreds of components

### Medium — Security guards historically pre-push only (Tooling/DX)

Audit found five guards (`lint:raw-sql`, `lint:audit-log`, `lint:raw-fetch`, `lint:idempotency`, `lint:silent-catch`) and `lint:no-next` ran only in bypassable pre-push. **Current tree:** root `package.json` `lint:ci` now includes these guards — confirm `.github/workflows` invokes `pnpm lint:ci` on PRs.

- **Paths:** `package.json` `lint:ci`, `scripts/check-raw-sql-tenant-scoped.ts`, `scripts/lint-audit-log.mjs`, `scripts/lint-no-next-imports.mjs`
- **Agent risk:** Introducing unscoped raw SQL or missing `writeAuditLog` on sensitive mutations if guards not run locally

### Medium — `lint-silent-catch` scope gaps (Observability)

Guard scan roots exclude `packages/integrations/src`, `packages/einvoice/src`, `apps/cron-worker/src` — highest-risk silent-failure surfaces.

- **Paths:** `scripts/lint-silent-catch.mjs:65-70`, `packages/integrations/src/adapters/resend-adapter.ts`, `packages/einvoice/src/profiles/zatca/signer.ts`
- **Agent risk:** Adding empty `catch {}` in integration adapters without `safe-swallow:` annotation or logging

### Low — No package cycle guard (Architecture)

Fifteen custom guards in `scripts/`; no madge/dependency-cruiser cycle check despite documented near-miss.

- **Recommendation:** ~40-line graph guard in `lint:ci` (graph acyclic today)

---

## 2. Security

### High — InPost webhook fails open on empty secret (Security)

`verifyInPostSignature` returns `true` when secret is empty — unauthenticated event injection for misconfigured orgs in production.

- **Paths:** `packages/api/src/services/courier/inpost-webhook-handler.ts:36`, `apps/api/src/routes/webhooks/inpost.ts`
- **Fix:** Fail closed in production when secret empty; skip empty-secret configs in `matchOrgBySignature`
- **Agent risk:** Copy-pasting webhook verify patterns without fail-closed default

### High — Payment mutations lack audit trail (Security / Architecture)

Nine money-moving mutations in payment router write zero `writeAuditLog` — no forensic trail on lock/export/cancel/mark-paid/import-statement.

- **Paths:** `packages/api/src/routers/finance/payment.ts` (and split modules `payment-core.ts`, `payment-run-ops.ts`, `payment-import.ts` if migrated), `packages/api/src/middleware/sensitive.ts`, `scripts/lint-audit-log.mjs`
- **Fix:** tx-scoped `writeAuditLog` on all money-moving mutations; `sensitiveActionProcedure` for destructive/export ops
- **Agent risk:** Adding payment procedures without `writeAuditLog` — guard may not catch if model not in lint list

### Medium — Secret store stub (Security)

`packages/secrets/src/index.ts` hardwired to in-memory stub; HMRC gov-API credential lookup not wired to Infisical.

- **Paths:** `packages/secrets/src/index.ts`, `packages/api/src/gov-api-clients.ts`, `packages/gov-api/`
- **Agent risk:** Assuming production secrets work because dev tests pass with MemoryStore

### Medium — Org bank metadata cast without Zod (Security / Code Quality)

IBAN/BIC read from JSON metadata via field-by-field `as` cast in payment flow.

- **Paths:** `packages/api/src/routers/finance/payment.ts:380,383,391`
- **Fix:** `safeParse` org bankAccount shape before money movement

### Medium — Stale security baseline docs (Security)

`SECURITY-AUDIT.md`, `docs/PRODUCTION-CHECKLIST.md` describe deleted `apps/web` Next.js surface, not Fastify + Vite SPA.

- **Paths:** `SECURITY-AUDIT.md`, `docs/PRODUCTION-CHECKLIST.md`, `apps/api/src/plugins/csrf-origin.ts`, `apps/api/src/server.ts`
- **Open question:** Whether CSP/HSTS/X-Frame-Options are emitted for SPA host — needs explicit verification post-migration

### Low — Raw SQL guard misses `$executeRaw` (Security)

`scripts/check-raw-sql-tenant-scoped.ts` patterns omit `$executeRaw` / `$executeRawUnsafe`.

- **Paths:** `packages/api/src/services/outbox/index.ts:214-239` (current sites pass manually)

---

## 3. Observability & error handling

### High — Frontend errors invisible to on-call (Observability)

Route error boundary logs to `console` only; no `Sentry.captureException`. No top-level boundary around provider tree — bootstrap errors white-screen unreported.

- **Paths:** `apps/web-vite/src/components/error/route-error-boundary.tsx`, `apps/web-vite/src/main.tsx`, `apps/web-vite/src/sentry.ts`
- **Fix:** Capture in boundary effect; wrap providers in `Sentry.ErrorBoundary`

### Medium — Notification dispatch failures swallowed (Observability)

Email / Slack-Teams dispatch errors have empty catch bodies — silent delivery outages.

- **Paths:** `packages/api/src/services/notification-service.ts:408-413,449-457`, `packages/api/src/routers/workflow/workflow-execution.ts` (side-effect catches)

### Medium — `lint-silent-catch` accepts `pre-existing` reasons (Observability)

Blanket `pre-existing` reasons defeat paper-trail intent across ~28 sites.

- **Paths:** `scripts/lint-silent-catch.mjs:113-121`, `packages/api/src/services/idempotency.ts:95`

### Low — public-api 500 responses may leak `error.message` (Observability)

- **Paths:** `apps/public-api/src/lib/error-handler.ts`, `apps/api/src/plugins/sentry.ts`

---

## 4. Performance

### High — Doubled auth DB round-trips (Performance)

Better Auth `cookieCache` disabled → `getSession` hits DB every request; `requirePermission` adds second lookup. Tax on ~372 gated procedures.

- **Paths:** `packages/auth/src/config.ts:227-230`, `packages/api/src/context.ts`, `packages/api/src/middleware/rbac.ts`

### High — `time.reconciliation` N+1 (~60 queries/page) (Performance)

Per-row org/contract reads inside loop despite prior includes.

- **Paths:** `packages/api/src/routers/core/time.ts:445-464`, `packages/api/src/services/time-reconciliation.ts`

### Medium — Bundle weight on cold boot (Performance)

`posthog-js` in entry chunk despite consent gate (~50–60KB gzip); recharts on first authenticated paint via dashboard.

- **Paths:** `apps/web-vite/src/lib/posthog.ts`, `apps/web-vite/src/main.tsx`, `apps/web-vite/src/components/dashboard/spend-chart.tsx`

### Medium — Unbounded portal lists & uncapped counts (Performance)

`portal.listInvoices` / `portal.listPayments` without pagination; `count()` uncapped on invoice/contractor/document lists.

- **Paths:** `packages/api/src/routers/portal/portal.ts`, `packages/api/src/routers/core/invoice.ts`, `packages/api/src/routers/core/contractor.ts`

### Medium — Soft-delete indexes missing partial `deletedAt IS NULL` (Performance)

- **Paths:** `packages/db/src/soft-delete.ts`, `packages/db/prisma/schema/contractor.prisma`, `invoice.prisma`

---

## 5. Code quality & type safety

### High — Integration adapters trust external JSON via bare `as` (~40 sites) (Code Quality)

Asymmetric with gov-API clients that use Zod `.parse()`. OAuth token exchange paths especially risky.

- **Paths:** `packages/integrations/src/adapters/linear.ts`, `jira.ts`, `google-workspace.ts`, `slack.ts`, `docusign.ts`, `outlook-calendar.ts`, `notion.ts`, `confluence.ts`; helper exists: `packages/integrations/src/services/parse-json-response.ts`
- **Agent risk:** Adding `response.json() as Foo` in new adapters — violates `CLAUDE.md` no-unsafe-`as` on external payloads

### Medium — Currency formatting reinlined ~20+ times — JPY 100x bug (Architecture)

Hardcoded `/100` bypasses `packages/shared/src/money.ts` and `apps/web-vite/src/lib/money.ts`.

- **Paths:** `apps/web-vite/src/lib/format-currency.ts`, audit cites widespread reinlines
- **Agent risk:** Copy-pasting `amount / 100` in new UI tables

### Medium — Divergent reverse-charge paths (Architecture)

Create vs update use different resolution — same invoice can classify differently.

- **Paths:** `packages/api/src/routers/finance/invoice.ts`, `packages/api/src/services/reverse-charge.service.ts`

### Medium — Raw `throw new Error` bypasses TRPCError contract (Architecture)

- **Paths:** `packages/api/src/routers/core/ocr.ts`, `approval.ts`, `compliance/zatca.ts`, `packages/api/src/init.ts`

### Medium — `packages/api` raw `src/*.ts` entrypoint + dead dist (Architecture)

Prod relies on Node type-stripping; latent non-erasable construct could crash at runtime.

- **Paths:** `packages/api/package.json`, `apps/api/Dockerfile`, `tsconfig.base.json`

### Medium — `einvoice.ts` god-router non-conformant (Architecture)

Dynamic logger import, silent noop, inline mock-typed db, missing audit on finalize/send/void.

- **Paths:** `packages/api/src/routers/core/einvoice.ts`

### Medium — Missing `noUncheckedIndexedAccess` (Code Quality)

Four strict flags not enabled — index-access bugs ship without compiler help across ~374k LOC.

- **Paths:** `tsconfig.base.json` — enable as tracked migration starting with `packages/api`

### Medium — Domain enums non-exported → frontend re-declares `z.enum` (Architecture)

Three-way drift risk on contractor/rate vocabulary.

- **Paths:** `packages/validators/src/contractor.ts`, `contract.ts`; `apps/web-vite/src/components/contractors/`

### Medium — VAT-rate defaults hardcoded vs DB `taxRate` authority (Architecture)

- **Paths:** `packages/api/src/services/tax-rate.service.ts`, `packages/einvoice/src/profiles/zatca/generator.ts`, peppol orchestrator paths

---

## 6. Testing gaps

### High — Phase-74 workflow security tests tautological/stubbed (Testing)

Green tests for compliance-gate override without verifying RBAC FORBIDDEN, AuditLog+SKIPPED in one transaction.

- **Paths:** `packages/api/src/__tests__/workflow-execution-template-selection.test.ts`, `workflow-override-blocking-task.test.ts`
- **Agent risk:** Assuming workflow override security is proven because tests pass

### Medium — No coverage thresholds in CI (Testing)

Coverage regressions invisible.

- **Paths:** root `vitest.config.ts`, `package.json` `test:coverage`

### Medium — Stale test-debt handoff (Testing)

`.planning/handoffs/test-cleanup-2026-04-27.md` may be authoritative in agent memory but stale — ~16 failing files unverified at audit time.

- **Agent risk:** Citing handoff failure counts without running `pnpm --filter @contractor-ops/api test`

### Low — Container tests sparse (~4/302) (Testing)

Hooks well-tested (~51% of hooks); containers lack loading/empty/error three-state tests.

- **Paths:** `apps/web-vite/src/components/**/**-container.tsx`
- **Note:** Audit corrected false positive — data layer is not "virtually untested"; hooks are the best-covered layer

### Low — 26 skipped describe blocks in web-vite (Testing)

Obsolete/moved component stubs inflate skip count.

- **Paths:** various `*.test.tsx` under `apps/web-vite/`

**Strong areas (do not regress):** `packages/api` ~245 test files, dedicated tenant-isolation suite, classification scoring tests, MSW provider integration tests in `packages/integrations/`.

---

## 7. i18n & localization

### High — Landing `en-GB` / `ar-SA` blog crash (i18n)

Missing `footer.newsletter` block → 500 on two launch locales.

- **Paths:** `apps/landing/src/i18n/locales/en-GB.json`, `ar-SA.json`, `apps/landing/src/app/blog/[slug]/page.tsx`

### Medium — Landing i18n ungated (i18n)

No parity gate in CI for landing; web-vite only in `i18n-parity.mjs`.

- **Paths:** `scripts/i18n-parity.mjs`, `.github/workflows/ci.yml`

### Medium — 494 baselined missing ar/pl translations (i18n)

Grandfathered in `.i18n-parity-baseline.json` — Admin/Classification clusters still English in EU markets.

- **Paths:** `apps/web-vite/messages/ar.json`, `pl.json`, `.i18n-parity-baseline.json`

### Low — 28 physical-direction Tailwind classes on RTL surfaces (i18n)

- **Paths:** audit cites `late-interest-card.tsx`, `api-keys-tab.tsx` — prefer logical `me-`/`ms-`/`pe-`/`ps-`

---

## 8. Dead code & post-migration residue

### Medium — ~400+ migration breadcrumb comments (Style / Dead Code)

`Phase N · Plan`, `apps/web` references, GAP-IDs violate repo comment rule.

- **Paths:** 159+ prod files per audit; guard now exists: `scripts/lint-no-migration-breadcrumbs.mjs` in `lint:ci`
- **Agent risk:** Adding new breadcrumb headers — `lint:no-breadcrumbs` should fail CI

### Medium — ~9 orphaned components (~700 LOC) (Dead Code)

Never imported after port.

- **Paths:** `apps/web-vite/src/components/feature.tsx`, `admin/admin-shell.tsx`, workflow board containers, etc.

### Medium — Dead `eslint-disable` in Biome-only repo (52–178) (Dead Code)

Suppress nothing; some mask real Biome violations.

### Low — Unused icon packages (Dependencies)

`react-icons` (83M) for one Linear icon; `@tabler/icons-react` (91M) zero imports.

- **Paths:** `apps/web-vite/package.json`, `packages/ui/package.json`, `brand-icons.tsx`

### Low — ~14 one-shot codemod scripts (~588KB) (Dead Code)

- **Paths:** `scripts/apply-*-translations*.ts`, `migrate-i18n-*.ts`, etc.

### Low — Dead placeholder `apps/web-vite/src/index.ts` (Dead Code)

---

## 9. Agent workflow checklist

When modifying this repo, agents should:

1. **Read before edit** — runtime rejects unread file overwrites (`CLAUDE.md`)
2. **Never trust `organizationId` from client** — tenant from session in `packages/api/src/context.ts`
3. **Sensitive mutations → `writeAuditLog`** — `packages/api/src/services/audit-writer.ts`
4. **External payloads → Zod `safeParse`** — no bare `as` on webhooks/integration JSON
5. **UI changes → `frontend-design` skill** + `apps/web-vite/ARCHITECTURE.md` layering
6. **Feature flags → `@contractor-ops/feature-flags` only** — keys in `registry.ts`
7. **Verify router counts from `packages/api/src/root.ts`** — 53 always + 8 conditional classification; portal separate at `portal-root.ts`
8. **Run filtered typecheck** after `packages/*` changes: `pnpm typecheck --filter=@contractor-ops/api`
9. **Do not cite stale session facts** — verify counts in-tree; discard cross-repo memory (foreign emails, old "55 routers", April test handoffs)
10. **Never `git stash` / destructive git** without explicit user approval

---

## 10. Prioritized quick wins (from audit §4)

Cheapest high-value fixes — many may already be partially landed; verify before duplicating work:

| # | Item | Primary path |
|---|------|--------------|
| 1 | Ensure `i18n:types` runs in CI typecheck chain | `apps/web-vite/package.json`, `turbo.json` |
| 2 | Confirm security guards in CI (`lint:ci`) | `package.json` |
| 3 | InPost webhook fail-closed | `inpost-webhook-handler.ts` |
| 4 | Sentry in route + top-level boundary | `route-error-boundary.tsx`, `main.tsx` |
| 5 | Enable Better Auth `cookieCache` | `packages/auth/src/config.ts` |
| 6 | Landing `footer.newsletter` for en-GB/ar-SA | `apps/landing/src/i18n/locales/` |
| 7 | Payment `writeAuditLog` on money mutations | `finance/payment*.ts` |
| 8 | Integration response Zod schemas | `packages/integrations/src/adapters/` |
| 9 | Delete orphan components + dead `src/index.ts` | `apps/web-vite/src/` |
| 10 | Consolidate currency formatting via `money.ts` | `packages/shared/src/money.ts` |

Full phased execution plan: audit §5 (Phases A–F).

---

## Related docs

- Audit source: `.planning/reports/CODE-OPTIMIZATION-AUDIT-2026-05-31.md`
- Stack: `.planning/codebase/STACK.md`
- Integrations: `.planning/codebase/INTEGRATIONS.md`
- Testing patterns: `.planning/codebase/TESTING.md`
- Engineering contract: `CLAUDE.md`
