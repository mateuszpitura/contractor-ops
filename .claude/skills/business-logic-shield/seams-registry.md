# Business Logic Shield — Seams Registry

Known **high-risk seams** in contractor-ops. When you touch a seam (either side), you **must** have or add an **unmocked round-trip test** unless change is docs-only.

Format: **Seam** | **Sides** | **Invariant** | **Existing test anchor** (verify in tree — add if missing)

---

## Money & payments

| Seam | Sides | Invariant | Test anchor |
|------|-------|-----------|-------------|
| Payment export IBAN | `_buildExportItems` → bank file generators | Decrypted IBAN on SEPA/SWIFT; hard-fail masked | `payment-export` / settlement tests |
| Skonto apply | `payment-skonto` → run item amounts | Discount on post-WHT amount; DRAFT/PENDING only | `payment-skonto` tests |
| Invoice resubmit | `approval-submit` → paymentStatus | No double READY from APPROVED/PAID | `approval-workflow-fixes` |
| Public API payment run | `public-api/payment-run` ↔ staff guards | Same compliance, idempotency, currency checks | security public-api tests |
| Reverse charge | `reverse-charge.service` ↔ invoice intake | `buyerHasVatId` = buyer entity | invoice / RC tests |
| WHT apply | `payment-shared` ↔ contractor forms | Treaty only with ACTIVE W-8; route by form-on-file | classification-submit-us-workstate, payment tests |
| ACH return | `ach-return.service` → invoice status | PAID revert + InvoicePayment consistency | `payment-ach-return.test.ts` |

---

## Approvals & workflow

| Seam | Sides | Invariant | Test anchor |
|------|-------|-----------|-------------|
| Role casing | member role strings ↔ Prisma `UserRole` | Single mapping helper at write/compare | `approval-engine`, role enum test |
| Compliance hold | `approval-engine` ↔ `compliance-recovery` ↔ UI | Release re-PENDs step + notify + UI list | `approval-workflow-fixes`, compliance-held UI |
| Slack / Teams | adapters ↔ `approval-shared` finalizer | Same RBAC, audit, status as staff | `teams-bot-handler`, slack adapter tests |
| Portal leave approve | `portal-manager-router` ↔ `approval-shared` | No double DEDUCTION; flow closed in tx | `leave-approval` |
| Workflow deps | `workflow-templates` ↔ instantiation | Dependency ids remap on create/update | `workflow-templates` tests |
| Task transitions | validators ↔ execution router | TODO→IN_PROGRESS→DONE legal; start mutation exists | workflow execution tests |

---

## Classification & compliance

| Seam | Sides | Invariant | Test anchor |
|------|-------|-----------|-------------|
| Answer envelope | `classification-draft` ↔ profile scoring engines | Canonical `{ value }` shape end-to-end | `classification-supersession`, round-trip per profile |
| DE billing ratio | UI wizard ↔ Zod ↔ scheinselbstandigkeit engine | Same shape all three | DE classification tests |
| IR35 kind+verdict | `classification-submit` ↔ UK policy | `'IR35-INSIDE'` triggers SDS materialisation | `classification-submit` / UK policy tests |
| US work state | submit ↔ `withUsWorkState` | ab5Flag injected on normal submit path | `classification-submit-us-workstate` |
| Compliance expiry | SATISFIED → EXPIRED ↔ payment gate | Date-driven block; pre-expiry bands fire | `compliance-upload-review`, expiry tests |
| Materialisation | import/create ↔ `materialiseComplianceIfAbsent` | Non-classification paths get required docs | import / contractor create tests |
| Economic dependency | scan service ↔ dashboard | Cross-org denominator ≠ org-scoped numerator | `economic-dependency-scan` |

---

## Workforce & HRIS

| Seam | Sides | Invariant | Test anchor |
|------|-------|-----------|-------------|
| PersonnelFile | `employee.register` ↔ leave/payroll/HRIS | Row created with hireDate; backfill script for legacy | `employee-registry`, backfill script |
| Termination dates | `EmployeeProfile` ↔ `PersonnelFile` | Both mirrored same tx | `employee-lifecycle`, personnel tests |
| HRIS link | pull ↔ ExternalLink ↔ push | Link before hash; push throws if unlinked | `hris-sync`, worker tests |
| Leave accrual | cron ↔ `leave-balance` ledger | ACCRUAL rows before submit allowed | `leave-accrual-scan`, leave tests |
| Leave balance | submit ↔ finalize approve | No double-spend; reservation or re-check | `leave-approval` |
| Payroll feed | `payroll-feed` ↔ PersonnelFile dates | Termination/hire from PersonnelFile | `payroll-feed` tests |
| DATEV Personalnummer | generator ↔ persistence | Numeric stable id; collision handling | `datev` golden + unit tests |

---

## E-invoicing & tax filing

| Seam | Sides | Invariant | Test anchor |
|------|-------|-----------|-------------|
| XRechnung CII order | generator ↔ KoSIT validator | VALID not tolerated INVALID | `packages/einvoice` profile tests |
| Leitweg-ID | validators ↔ intake | MOD 97-10 check digit | `leitweg-id` / validator tests |
| ZATCA chain | enqueue ↔ submit ↔ hash | PIH updated on resubmit; post-commit enqueue | `zatca-submission`, hash tests |
| ZATCA onboarding | onboarding ↔ API client | Real client signatures, no drifted `as` cast | zatca router tests |
| Peppol UAE ICD | constants ↔ registration | Scheme 0235 not 0192 | peppol tests |
| 1099 / 1042-S generate | service ↔ routers | Atomic tx; gross vs recorded WHT | form-1099 / form-1042s tests |
| KSeF FA(3) parse ↔ generate | parser ↔ generator | `P_11A` = gross; `P_11Vat` = VAT; round-trip | `packages/einvoice` ksef tests |
| Kirchensteuer legacy boolean | employee fields ↔ DATEV/Sage | `true` → blank+warn, never guess `ev`/`rk` | payroll export / datev tests |
| Economic dependency NULL taxId | scan denominator | Skip contractor when taxId null — no 100% share | `economic-dependency-scan` |
| ZATCA enqueue rescue | cron handler ↔ regional fan-out | Same fan-out as `reconcilePendingZatcaChains` | zatca-reconcile tests |
| Shipment status guard | courier webhooks ↔ FSM rank | Allow real FAILED→RETURNED; test all transitions | shipment-processing tests |
| Import SAVEPOINT commit | import router ↔ tx mock | Mock includes `$executeRawUnsafe`; row errors logged | `import.test.ts` |

---

## Portal & auth

| Seam | Sides | Invariant | Test anchor |
|------|-------|-----------|-------------|
| Portal session | login-verify ↔ portal-auth ↔ shell | Employee + contractor union narrow | `use-portal-shell`, org-picker tests |
| Portal invoice submit | portal router ↔ staff intake | Dup hash, notify, transactional | portal invoice tests |
| OCR trigger | ocr router ↔ document row | documentId only; org-scoped storage | ocr-extraction security tests |

---

## Integrations & infra

| Seam | Sides | Invariant | Test anchor |
|------|-------|-----------|-------------|
| Outbox drain | cron ↔ regional DBs | Fan-out all regions | `reminder-region-fanout`, outbox tests |
| Webhook drain | process route ↔ org region | Not EU-pinned for ME | tenant isolation tests |
| Import commit | router ↔ processor | Server re-validate rows; per-row SAVEPOINT | import tests |
| Billing credits | webhook ↔ credit-service gate | TOP_UP in gate + UI balance match | `use-billing`, credit-service tests |
| Equipment shipment | courier webhook ↔ status FSM | No terminal regression | shipment processing tests |

---

## Adding a new seam

When you introduce a new cross-package boundary:

1. Add a row to this file in the same PR.
2. Add one round-trip test file or `describe` block named `{area}-seam` or extend existing integration test.
3. Mention seam id in Shield Verdict.

**Round-trip test template:**

```typescript
// Import REAL router helper or procedure input builder — do NOT mock the engine package.
import { scoreIr35 } from '@contractor-ops/classification/...';
import { normalizeAnswers } from '../classification-draft'; // example

it('round-trip: persisted answers → engine reads envelopes', () => {
  const raw = { /* minimal valid client payload */ };
  const persisted = normalizeAnswers(raw);
  const result = scoreIr35({ answers: persisted, ... });
  expect(result.verdict).not.toBe('indeterminate');
});
```

---

## Cross-reference

Full historical findings: `.planning/handoffs/business-logic-review-2026-07-08.md` (TIER 0–3). This registry is the **living subset** agents must not break again.
