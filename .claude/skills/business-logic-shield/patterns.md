# Business Logic Shield — Pattern Classes

14 systemic defect classes from the 2026-07-08 review. For each change, mark **PASS / FAIL / N/A**. FAIL requires fix or explicit documented exception before merge.

---

## Composition patterns (S1–S7)

### S1 — Built-but-unwired

**Symptom:** Function, cron, listener, middleware, or gate exists; zero production importers. Flow dead at load-bearing hop.

**Detect:**
- `semble find-related` / graphify: exported symbol has no inbound edge from routers, cron registry, or webhooks
- Feature flag or `requireAddOn` / `workforceProcedure` defined but grep shows zero `.use()` consumers
- Service method only called from tests or seeds

**Fix:** Wire caller in same change set (router mutation, cron registry, outbox consumer, UI hook). If intentionally deferred, add `throw new Error('not wired')` at entry — never silent no-op.

**Review examples:** leave accrual (no ACCRUAL writer), HRIS ExternalLink (never created), ZATCA/Peppol producers, Slack webhook stub, `resumeFromCompliance` without UI, IP_VERIFICATION not in template builder.

---

### S2 — Mock-masked contract seam

**Symptom:** Unit tests pass; production fails because router and engine use different data shapes, both sides mocked in tests.

**Detect:**
- Router persists shape A; engine reads `entry.value` envelope shape B
- Test mocks `@contractor-ops/classification` entirely while router test uses hand-built answers
- Prisma enum UPPERCASE vs lowercase string in fixtures
- Test asserts `INVALID` acceptable or uses fixture generated from code under test

**Fix:** One **unmocked round-trip test** per seam: real Zod parse → real engine → assert persisted + returned shape. Import production schema — never duplicate Zod in test file.

**Review examples:** classification answer envelope, DE billing-ratio triple conflict, `'IR35'` vs `'IR35-INSIDE'`, role casing family, dashboard band lowercase, Teams `z.uuid()` vs cuid, masked IBAN in settlement fixture.

---

### S3 — Dual rail never reconciled

**Symptom:** Two pipelines compute or record the same fact differently; downstream reads the wrong rail.

**Detect:**
- Payment path writes `whtAmountMinor`; filing path sums `amountMinor`
- Withholding applied live; wiki/docs say "later phase"
- Box 7 recomputed from rate × box2 instead of Σ recorded WHT

**Fix:** Single source of truth column; document in code which field is authoritative; filing/export reads recorded amounts, not recomputation from stale inputs.

**Review examples:** US withholding rail vs 1099/1042-S aggregation; skonto basis `totalMinor` vs `amountToPayMinor`.

---

### S4 — Unpropagated sibling guards

**Symptom:** Staff path safe; portal, public-api, bulk, or import path missing the same validation.

**Detect:** After adding guard in staff router, grep for alternate entry points (portal-*, public-api/*, bulk*, import commit, cron replay).

**Fix:** Extract shared guard to service; call from every entry point. Add test per surface or one parameterized integration test.

**Review examples:** public-api payment-run skips compliance lock; portal invoice skips dup hash; bulkArchive skips single-archive guards; BACS currency guard not on SEPA.

---

### S5 — Dual-source status rot

**Symptom:** Multiple columns or enums represent overlapping state; writers update one, readers use another.

**Detect:**
- `Invoice.status`, `paymentStatus`, `approvalStatus` updated independently
- `EmployeeProfile.terminatedAt` vs `PersonnelFile.terminatedAt`
- Teams bot sets different terminal status than staff finalizer

**Fix:** One writer function per transition; all readers use same column; or explicit sync in one transaction with comment on invariant.

**Review examples:** invoice PAID writers missing while paymentStatus moves; approval portal shows NOT_STARTED for approved invoices.

---

### S6 — Multi-region EU-pinning

**Symptom:** Code outside request context uses EU `DATABASE_URL` or global prisma while producers enqueue per-region.

**Detect:**
- `prisma.` or `prismaRaw` in cron drain, webhook processor, outbox consumer without region loop
- `apps/api/src/routes/outbox.ts` single region
- Public API key resolve without org region

**Fix:** Iterate `SUPPORTED_REGIONS`; pass regional client into services; match `compliance-reminder-scan` fan-out pattern.

**Review examples:** outbox drain, webhook `_process`, ZATCA job, e-sign orchestrator, 1099 crons, key-leak alarm.

---

### S7 — Hollow notification system

**Symptom:** Event dispatched; email silently dropped or wrong channel.

**Detect:**
- `notification-service` catch swallows template missing errors
- New `NotificationType` added without email template + renderer case
- Critical money events (PAID/FAILED) with no dispatch call

**Fix:** Add template + renderer branch; test dispatch invoked; fallback log at error level, not silent in-app only.

**Review examples:** 6 email templates for 32 types; payment paid/failed nobody notified; clarification request no notify.

---

### S8 — Same-file stale reference (fix locality blindness)

**Symptom:** Query/filter fixed in one place; another line in the **same file** still uses old field, non-null assertion, or removed filter → runtime throw or burned state after partial write.

**Detect:** After expiry/TZ/jurisdiction fix, grep file for old `field!` and removed filters; tests asserting old behavior.

**Fix:** Update all readers in file + tests same PR.

**Review examples (round 2):** `compliance-reminder-scan.ts:374` — `resolveExpiryJurisdictionTz()` added but band path still used `item.expiryJurisdictionTz!` → RangeError after `persistBandFire`.

---

### S9 — Seed-only / no backfill (existing orgs stay dark)

**Symptom:** Fix only on seed/first-create; orgs with existing templates/rows never updated.

**Detect:** Early return when templates already exist; no backfill script or idempotent patch.

**Fix:** Backfill script, upsert patch, or documented ops — test fixture with pre-existing org data.

**Review examples (round 2):** IP_VERIFICATION seed no-ops when org already has offboarding template.

---

### S10 — Same-handler sibling pattern not copied

**Symptom:** Correct regional fan-out in function A; new function B in **same handler file** uses EU global `prisma`.

**Detect:** Read full cron/route handler before adding reconcile/enqueue; compare with sibling in file.

**Fix:** Shared regional iterator used by all paths in handler.

**Review examples (round 2):** `reconcilePendingZatcaChains` fans out; `reconcileMissingZatcaSubmissionEnqueues` EU-pinned in same cron.

---

## Integrity patterns (T1–T11)

### T1 — Audit not in same transaction

**Symptom:** Mutation commits; audit fails or never runs → unauditable legally significant action.

**Detect:**
- `writeAuditLog({ ... })` without `tx` inside or after `$transaction`
- Sensitive mutation with no audit at all (classification submit, timesheet approve, bulk approve)

**Fix:** `await writeAuditLog({ tx, ... })` inside same `$transaction`. Audit throw rolls back business write.

**Review examples:** B1–B4 blockers; HRIS connect/disconnect; employee lifecycle; Pack-7 ~13 mutations.

---

### T2 — Check-then-act (race / double effect)

**Symptom:** Two concurrent requests both pass validation; double payment, double shipment, negative balance.

**Detect:**
- Read status → if ok → unconditional `update`
- No `count === 1` assert after conditional update
- Bulk path without per-row guard

**Fix:**
```typescript
const { count } = await tx.approvalStep.updateMany({
  where: { id, status: 'PENDING' },
  data: { status: 'APPROVED', ... },
});
if (count !== 1) throw new TRPCError({ code: 'CONFLICT', ... });
```

**Review examples:** approval approve/delegate; equipment return duplicate shipment; leave double deduct; skonto re-apply on EXPORTED run.

---

### T3 — Money aggregation / math correctness

**Symptom:** Wrong totals, overflow, wrong currency exponent, gross vs net mismatch.

**Detect:**
- `SUM(*Minor)::int` instead of `::bigint`
- Compare `totalMinor` (gross) to contract net rate
- FX rate with no max staleness
- `minorToDecimalStr` throws on 3-dp currency

**Fix:** Standardize on `::bigint`; name basis in variable; use `amountToPayMinor` for payout comparisons; extend CURRENCY_MAP; bound FX age.

**Review examples:** dashboard spend gross vs reports net; invoice matching +23% PL VAT; 1042-S box-2 drops non-USD.

---

### T4 — Non-atomic immutable filing rows

**Symptom:** Partial batch write → duplicate ACTIVE government filings on retry.

**Detect:**
- 1099/1042-S generate creates rows + audit outside single tx
- No supersede-before-insert on retry
- ZATCA chain `@unique(invoiceId)` with always-insert retry

**Fix:** Wrap batch in `$transaction`; supersede ACTIVE before new ACTIVE; reuse chain row on resubmit.

---

### T5 — Missing / uneven RBAC

**Symptom:** `tenantProcedure` only — any org member can perform legally significant mutation or read PII.

**Detect:**
- Mutation without `.use(requirePermission(...))`
- Read of invoice OCR, e-sign URL, payroll export with plain `employee:read`
- IR35 SDS mark delivered without `contractor:update`

**Fix:** Match sibling procedure permissions; least privilege on reads that mint capabilities (signing URL).

---

### T6 — Inconsistent feature-flag re-assertion

**Symptom:** Module enabled globally; specific procedures skip gate → paid SKU or disabled module still reachable.

**Detect:**
- `assertUsExpansionEnabled` pattern exists in US router but not on one procedure in same namespace
- `workforceProcedure` / `requireAddOn` not on classify approve, HR dashboard data, webhook create

**Fix:** Every procedure in gated namespace calls assert at start; copy US-expansion pattern.

---

### T7 — Client-trusted handle / ctx.db bypass

**Symptom:** Client supplies storage key, row id, or raw import rows; server skips ownership check. Or service uses global prisma.

**Detect:**
- Input includes `storageKey`, `organizationId` from client, raw `rows[]` on commit
- `wht-certificate`, `zatca-*`, `import-processor` import global prisma

**Fix:** Resolve entity by id scoped to `ctx.organizationId`; derive secrets from DB row. Thread `ctx.db` through services.

**Review examples:** OCR trigger BLOCKER B1; import commit trusts client rows.

---

### T8 — Batch / collision non-determinism

**Symptom:** Stable IDs or collision resolution depend on query order; different export batches assign different identities to same employee.

**Detect:**
- `findMany` without `orderBy` feeds collision bump / Personalnummer assignment
- Triangular or order-dependent probe without fixed iteration order

**Fix:** Explicit `orderBy` on identity keys; linear deterministic probe; collision regression test (not golden-only).

**Review examples (round 2):** DATEV Personalnummer bump depends on batch order; probe can false "space exhausted".

---

### T9 — Nullable input → silent wrong path

**Symptom:** NULL optional field falls through to math that assumes presence → wrong but silent result (no throw, no skip).

**Detect:**
- Nullable `taxId` used in denominator → fallback `denominator = numerator` → 100% share
- Nullable `countryCode` → skip holiday logic with no log
- Nullable TZ → row enters band path then throws mid-flight

**Fix:** Fail-closed: skip row, exclude from alert, or require field — never fabricate equal numerator/denominator.

**Review examples (round 2):** H-CLS-1 NULL taxId false CRITICAL; ewidencja null org country silently skips holidays.

---

### T10 — Boolean → legal enum fabrication

**Symptom:** Legacy boolean column mapped to a specific legal/tax enum value by guessing (`true → 'rk'` or `true → 'ev'`).

**Detect:**
- `if (value === true) return 'ev'` on confession / tax / filing codes
- No test for boolean legacy rows

**Fix:** Unknown/truthy-without-code → blank + structured warn; never pick a confession at random.

**Review examples (round 2):** kirchensteuer wave-1 `true→'rk'`, round-2 `true→'ev'` — same regression class, opposite wrong label.

---

### T11 — Fix without running touched tests

**Symptom:** Production fix lands; colocated test file red because mocks stale, assertions assert removed behavior, or suite never run.

**Detect:**
- Agent claims done without `vitest run` on touched `*.test.ts`
- New tx API (`$executeRawUnsafe`) but mock `tx` unchanged
- Test asserts old filter that production removed

**Fix:** Mandatory: run vitest on every touched module test file before Shield Verdict; fix mocks in same PR.

**Review examples (round 2):** 16 red across import, economic-dependency-scan, compliance-reminder-scan, ksef round-trip — fixer never ran suites.

---

## Fix-with-new-bug anti-patterns (post-remediation lessons)

| Anti-pattern | Lesson |
|--------------|--------|
| Fix callee, not caller | Branch unreachable (MAINLAND waive) |
| Fix backend only | UI/hook still broken; trap invisible |
| Schema change without callers | TS2353 in web-vite |
| Regenerate golden before fixing algo | Golden blesses bug (DATEV Personalnummer) |
| Permissive mapping | `boolean true → 'rk'` / `true → 'ev'` mislabels confession |
| Idempotency before eligibility | 24h poisoned key on throw |
| Enqueue inside approval tx | Pre-commit race |
| Delete tests to go green | Restore behavioral coverage |
| Local Zod copy in test | Tautological — import real schema |
| String concat instead of numeric ops | `String(hash % 99999) + 1` bug |
| Fix one line, stale ref same file | TZ resolver added; `field!` left on band path |
| Seed without backfill | Existing orgs stay broken |
| Sibling correct, new fn wrong region | Same cron handler, mixed fan-out |
| CONFIRMED fix, zero tests | Shipment guard, ewidencja holidays — no guard tests |
| FSM rank too strict | Real FAILED→RETURNED courier flow dropped |
| Generator/parser field mismatch | KSeF `P_11A` gross vs VAT written to gross column |
| SAVEPOINT loop no RELEASE | Stack leak; swallow row errors with no log |
| Ship without vitest on touched files | 16 red tests undetected (T11) |

---

## Quick PASS criteria summary

| Class | One-line PASS |
|-------|----------------|
| S1 | Production caller exists |
| S2 | Unmocked round-trip test at seam |
| S3 | Single authoritative money/tax field |
| S4 | All entry points call shared guard |
| S5 | One transition writer per status |
| S6 | Regional client in all drains/jobs |
| S7 | Template + dispatch for new notify types |
| T1 | `writeAuditLog({ tx })` in tx |
| T2 | Conditional updateMany + count check |
| T3 | bigint sums, named gross/net basis |
| T4 | Filing generate in one tx |
| T5 | requirePermission on sensitive ops |
| T6 | Flag assert on every gated procedure |
| T7 | Server-derived ids; ctx.db only |
| S8 | Grep same file for stale field/`!` after query fix |
| S9 | Backfill or ops path for existing org rows |
| S10 | Copy regional/sibling pattern within same handler |
| T8 | orderBy + deterministic collision probe + test |
| T9 | NULL → skip/fail-closed, not wrong math |
| T10 | Boolean legacy → blank+warn, not guessed enum |
| T11 | vitest run on every touched `*.test.ts` before done |
