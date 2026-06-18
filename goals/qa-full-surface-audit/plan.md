# Plan — QA Full Surface Audit

## Solution approach

Two deliverables, in order: **(A) a test matrix doc** that instantiates every fact in `facts.md` per concrete surface (forms, modals, wizards, routers, adapters, webhooks, flags, uploads, roles), then **(B) an automated suite** that fills the highest-risk gaps the matrix surfaces, risk-ordered: security/auth/IDOR → money/data integrity → integration correctness → input/UX.

We extend the existing harness, we do not invent one:
- **Runner**: vitest per package via `turbo test`; scoped `pnpm --filter` runs only.
- **tRPC**: `createCallerFactory(appRouter)(ctx)` with `sessionCtx(role)` / `apiKeyCtx(scopes)` / `cronCtx` / portal ctx factories.
- **External HTTP**: `@contractor-ops/test-utils` MSW handlers (all 18 adapters) + `vi.stubGlobal('fetch')` for adapter units. No live calls; webhook signature tests use `invalidSignaturePayloads` / `webhook-replay` fixtures.
- **DB**: `vi.fn()` Prisma mocks + manual state arrays (existing pattern); no real Postgres in unit tests.
- **Security baseline**: 6 `*.security.test.ts` in `packages/api/src/__tests__/security/` + `rate-limit.security.test.ts` in public-api. New security tests extend, never duplicate.

**Honest scope note:** "every single input/combination" is unbounded. The matrix doc captures intent exhaustively (every surface × happy/reject/role case as rows); the automated suite covers the highest-risk subset and explicitly marks what stays manual (RTL visual, real-OCR, live-sandbox). No silent truncation — the matrix flags each row as `auto`, `manual`, or `out-of-scope (mock-only)`.

## Ordered steps

### Step 0 — Establish the real baseline (never trust the Apr handoff)
- **Touches**: `packages/api`, `apps/api`, `packages/integrations`, `apps/public-api`, `packages/db`, `packages/feature-flags`.
- Run each suite scoped, capture current green/red truth, and diff against the 16-file debt list to separate pre-existing failures from anything we introduce.
- **Verify**:
  - `pnpm --filter @contractor-ops/api test 2>&1 | tail -40`
  - `pnpm --filter @contractor-ops/api test src/__tests__/security`
  - `pnpm --filter @contractor-ops/integrations test 2>&1 | tail -40`
  - `pnpm --filter @contractor-ops/api... typecheck` (CI tool = tsc, not tsgo)
- **Output**: a "baseline.md" red/green snapshot appended to the matrix doc; quarantine list of debt files that block a clean run.

### Step 1 — Write the test matrix doc (deliverable A)
- **Touches**: `goals/qa-full-surface-audit/test-matrix.md` (new).
- One table per surface area mapping each `facts.md` fact → concrete instances from the inventory: 24 forms, 52 dialogs, 4 wizards, 12 upload entry points, 45 flags, 9 roles × 16 resources, 60+ tRPC namespaces, 18 adapters, 8 webhook providers, 10 QStash jobs. Each row: `surface | case (happy/reject/role/edge) | expected | auto|manual|mock-only | target test file`.
- **Verify**: every fact in `facts.md` appears in ≥1 row; every inventory surface appears in ≥1 row (cross-check counts). Gate `test-matrix.md` with Plannotator before building the suite.

### Step 2 — Tier 1 suite: security / auth / IDOR
- **Touches**: `packages/api/src/__tests__/security/`, `apps/api/src/__tests__/`, `packages/auth`.
- **2a Portal IDOR cross-read** — `portal-idor.security.test.ts`: each portal procedure (invoices, contracts, equipment, profile, tax-form) rejects a foreign `contractorId`; assert no row leaks across two seeded contractors.
- **2b Role × resource matrix** — extend `authz-permission-matrix.security.test.ts` to all 9 roles × each gated resource; assert FORBIDDEN where the role lacks the permission, OK where it has it (session + api-key paths).
- **2c Webhook signature rejection** — `webhook-signature.security.test.ts`: each HMAC provider (Slack, Jira, Linear, Autenti, InPost, Storecove, Stripe, DocuSign) rejects missing/invalid signature using `invalidSignaturePayloads`; Notion/Confluence reject schema-invalid bodies.
- **2d Flag-gated namespace gating** — assert `taxForm` (us-expansion), classification namespaces, and public-api/outbound-webhooks return NOT_FOUND when the flag is off and resolve when on.
- **2e Session invariants** — disabled-member lockout, sensitive-action ≤5min freshness, api-key tier/scope rejection, SUSPENDED/ARCHIVED org rejection.
- **Verify**: `pnpm --filter @contractor-ops/api test src/__tests__/security` green; new files included; no regression in the 6 baseline files.

### Step 3 — Tier 2 suite: money / data integrity
- **Touches**: `packages/api/src/__tests__/` (finance + bank-statement), `packages/api/src/services/`.
- **3a Payment export formats** — `payment-export-formats.test.ts`: CSV, Elixir/Plux (PL), SEPA_XML, SWIFT_XML, BACS_STD18 each validate against format spec; assert atomic DRAFT/LOCKED→EXPORTED once and idempotency-key dedupe (complements existing `payment-export-race.security.test.ts`, no overlap).
- **3b Bank-statement parser** — `bank-statement.test.ts` (gap): CSV/OFX/MT940/PDF extract expected transactions; malformed input yields a typed parse error, not a crash.
- **3c Money rounding** — assert `patterns/money-rounding` invariants on invoice/payment totals, skonto, late-interest.
- **3d Idempotency** — `deriveIdempotencyKey(orgId,operation,businessKey)` stability + per-provider header mapping; outbox drain dedupes a redrained event id; deprovisioning `(orgId, idempotencyKey)` dedupe.
- **Verify**: `pnpm --filter @contractor-ops/api test src/__tests__/finance src/__tests__/bank-statement.test.ts` green.

### Step 4 — Tier 3 suite: integration correctness
- **Touches**: `packages/integrations/src/__tests__/`, `apps/api/src/__tests__/webhooks/`.
- **4a Adapter outbound shape + resilience** — per adapter, assert request shape and behavior under MSW scenarios (degraded, rate-limited, token-expired, partial-failure, webhook-replay); calendar adapters assert deterministic event-id upsert.
- **4b Inbound webhook drain** — QStash drain atomically claims `WebhookDelivery` (RECEIVED→PROCESSING→PROCESSED/FAILED); replayed delivery not processed twice; Stripe `processedAt` dedupe; handler-throw → FAILED + retry count.
- **4c E-sign lifecycle** — DocuSign/Autenti create→embedded-url→signed-doc→void/resend map to adapter methods and surface errors.
- **Verify**: `pnpm --filter @contractor-ops/integrations test` and `pnpm --filter @contractor-ops/api test src/__tests__/webhooks` green.

### Step 5 — Tier 4 suite: input validation / UX
- **Touches**: `packages/feature-flags/src/__tests__/`, `packages/api` (Zod boundary), `apps/web-vite` (scoped RTL), Playwright (optional).
- **5a Feature-flags evaluator** — `evaluator.test.ts` (gap): `jurisdiction: 'EU'` flag → false for ME org and vice-versa regardless of Unleash; `killswitch.ai-invoice-parser` forces OFF on unknown; module flags default false.
- **5b Zod boundary table** — table-driven rejection per representative procedure: negative/zero amounts, bad NIP/VAT/IBAN, over-long strings, unicode/RTL, XSS/SQL payloads neutralized → typed validation error, no 500.
- **5c web-vite form + states (scoped RTL)** — for top surfaces (contractor wizard, contract wizard, import wizard, payment-run dialog, tax-form wizard): required-field block, step-gating, destructive-dialog confirm, loading/empty/error render. **Always scoped**: `pnpm --filter @contractor-ops/web-vite test <path>` — never unscoped (RAM).
- **5d Playwright functional smoke (optional)** — critical flows (login, create contractor, submit portal invoice, tax-form submit) via `playwright.functional.config.ts`; RTL config for ar layout.
- **Verify**: `pnpm --filter @contractor-ops/feature-flags test`; scoped web-vite path runs; `pnpm check:web-vite-data-layer && pnpm check:web-vite-page-shells && pnpm check:web-vite-presentational`.

### Step 6 — Close out
- **Touches**: quarantined debt files, `goals/qa-full-surface-audit/`.
- Fix-or-quarantine only the debt files that block a clean tier run (document each as bug vs mock-drift); file remaining as a findings list in the matrix doc.
- **Doc-drift**: new files are test-only (`__tests__`, `*.test.ts`) → wiki-exempt per CLAUDE.md. If any product code is touched to fix a real bug, update the matching wiki page + `pnpm check:wiki-brain` in the same change set.
- **Verify**: `pnpm check:wiki-brain`; final scoped suite pass per tier; matrix doc marks every row resolved (auto-pass / manual-pending / documented-gap).

## Risks & open questions

- **Test debt masks signal** — 16 files (~51 fails) from Apr 2026 may be partially fixed or worse; Step 0 must establish ground truth before we attribute any red to new work.
- **RLS not DB-enforced** — `SET LOCAL app.org_id` is issued but no `CREATE POLICY` is deployed; tenant-isolation is testable only at the app/Prisma-extension layer. We assert app-layer scoping and flag DB-policy enforcement as untestable here.
- **Mock-only blind spot** — MSW can't catch real provider contract drift; `RUN_LIVE_SMOKE=1` sandbox round-trips are explicitly out of scope and marked as such in the matrix.
- **web-vite RAM** — unscoped suite kills the machine; every web-vite run is path-scoped. CI runs the full suite, not local.
- **Manual-only facts** — RTL visual correctness, real-OCR extraction, and some UX edge cases stay manual; the matrix marks them, they do not become silent gaps.
- **Audit coverage unknowns** — Step 2/matrix must confirm (or document as gap) audit writes on member-deactivate, org update, payment-export/lock, settings, api-key — inventory flagged these as unverified.
- **Open question for user**: should Step 6 *fix* the 16 debt files as part of this goal, or only quarantine them and report? (Recommendation: quarantine + report; fixing test debt is a separate goal unless it blocks a tier.)
