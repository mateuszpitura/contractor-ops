# Business Logic Shield — Verify Commands

Run the **smallest set** that covers your diff. Use `--force` on typecheck when validating ship readiness.

---

## T11 — touched-module test gate (mandatory before Shield Verdict)

Adversarial round 2 (2026-07-10): **16 red tests** shipped because fixer never ran colocated suites.

For **every production file** you edit, run its test file before claiming done:

```bash
pnpm exec vitest run path/to/module.test.ts
```

| If you touched… | Run at minimum |
|-----------------|----------------|
| `routers/core/import.ts` | `routers/__tests__/import.test.ts` |
| `services/economic-dependency-scan.ts` | `services/__tests__/economic-dependency-scan.test.ts` |
| `services/compliance-reminder-scan.ts` | `services/__tests__/compliance-reminder-scan.test.ts` |
| `packages/einvoice/**/ksef/*` | `packages/einvoice/**/__tests__/ksef*.test.ts` |
| Any other logic file | Glob `**/__tests__/*<basename>*` or `routers/__tests__/<domain>.test.ts` |

List executed paths in `shield-scope.json` → `testsToRun` and in Shield Verdict.

**Mock sync rule:** new tx APIs (`$executeRawUnsafe`, `prismaRaw.contractor`, regional client) → update mocks in the **same PR** as production change.

---

## Always (any shielded logic change)

```bash
# Error codes — all 4 locales if you added/changed TRPCError codes
pnpm exec vitest run packages/api/src/__tests__/errors-i18n-parity.test.ts
```

If you added/changed product behavior in `apps/` or `packages/`:

```bash
pnpm check:wiki-brain
```

---

## By touched package

### `packages/api` (routers, services, middleware)

```bash
pnpm typecheck --force --filter=@contractor-ops/api
```

Targeted tests (prefer over full suite during iteration):

```bash
pnpm exec vitest run packages/api/src/routers/__tests__/<domain>.test.ts
pnpm exec vitest run packages/api/src/__tests__/<topic>.test.ts
```

Full suite (pre-merge / CI parity):

```bash
pnpm -F @contractor-ops/api test
```

### `packages/einvoice`, `packages/classification`, `packages/validators`

```bash
pnpm typecheck --force --filter=@contractor-ops/einvoice --filter=@contractor-ops/classification --filter=@contractor-ops/validators
pnpm exec vitest run packages/einvoice packages/validators
```

### `apps/cron-worker`

```bash
pnpm typecheck --force --filter=@contractor-ops/cron-worker
pnpm exec vitest run apps/cron-worker
```

### `apps/public-api`

```bash
pnpm typecheck --force --filter=@contractor-ops/public-api
pnpm exec vitest run apps/public-api
```

### `apps/web-vite` (hooks calling changed tRPC input)

```bash
cd apps/web-vite && pnpm typecheck
pnpm -F @contractor-ops/web-vite test -- <related-path>
```

web-vite typecheck uses `NODE_OPTIONS=--max-old-space-size=8192` via package script.

---

## By domain (copy-paste clusters)

**Payments / finance**

```bash
pnpm exec vitest run \
  packages/api/src/routers/__tests__/payment.test.ts \
  packages/api/src/routers/__tests__/bacs.test.ts \
  packages/api/src/__tests__/payment-ach-return.test.ts \
  packages/api/src/__tests__/invoice-matching.test.ts
```

**Approvals / workflow**

```bash
pnpm exec vitest run \
  packages/api/src/routers/__tests__/approval.test.ts \
  packages/api/src/__tests__/approval-workflow-fixes.test.ts \
  packages/api/src/routers/__tests__/workflow-templates.test.ts
```

**Classification / compliance**

```bash
pnpm exec vitest run \
  packages/api/src/routers/__tests__/classification.test.ts \
  packages/api/src/__tests__/classification-supersession.test.ts \
  packages/api/src/__tests__/classification-submit-us-workstate.test.ts \
  packages/api/src/__tests__/compliance-upload-review.test.ts \
  packages/api/src/__tests__/economic-dependency-scan.test.ts
```

**Workforce / HRIS / leave**

```bash
pnpm exec vitest run \
  packages/api/src/__tests__/employee-registry.test.ts \
  packages/api/src/__tests__/leave-approval.test.ts \
  packages/api/src/__tests__/workforce-time-router.test.ts
```

**Tax / ZATCA / e-invoicing**

```bash
pnpm exec vitest run \
  packages/api/src/routers/__tests__/zatca.test.ts \
  packages/api/src/routers/compliance \
  packages/einvoice
```

**Security / tenant isolation**

```bash
pnpm exec vitest run packages/api/src/__tests__/security/
pnpm exec vitest run packages/api/src/__tests__/tenant-isolation.test.ts
```

---

## Full monorepo ship gate

From handoff Fable gate (run before merge of large change sets):

```bash
pnpm typecheck --force
pnpm -F @contractor-ops/api test
pnpm -F @contractor-ops/web-vite test
pnpm exec vitest run packages/api/src/__tests__/errors-i18n-parity.test.ts
pnpm check:wiki-brain
```

---

## Post-deploy ops (not code verify)

When PersonnelFile or WHT dedup migration shipped:

```bash
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-personnel-file.ts --dry-run
# Apply migration 20260710120000_wht_certificate_payment_item_unique per env
```

---

## Interpreting failures

| Failure | Likely pattern class | Action |
|---------|---------------------|--------|
| Touched-module test red | T11 | Run vitest on that file; fix mocks/assertions |
| i18n parity | Missing locale strings | Add to en/de/pl/ar messages |
| TS2353 unknown prop | UI/API contract (S2) | Update all callers |
| Prisma enum error | S2 casing | Role/status mapping helper |
| Test mock stale | S2 | Update mock or add unmocked seam test |
| ENOTDIR import | Package export path | Fix package.json `exports` + vitest alias |
| count === 0 on update | T2 race | Add guarded updateMany |
| ME org wrong data | S6/T7 | Regional ctx.db |

Do **not** mark Shield Verdict PASS until listed commands for touched areas succeed.
