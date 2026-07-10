# Business Logic Full Review — packages/api

Date: 2026-07-08
Scope: all backend business logic in `packages/api` — staff `appRouter` (50 always-on + gated classification/us-expansion/workforce/hr-dashboard namespaces), `portalAppRouter`, `public-api`, and the 217 service modules under `packages/api/src/services`.
Lens: correctness + data integrity + validation/security combined.
Method: 7 parallel domain-pack reviews reading actual source (Read/Grep/Glob), traced against the shared procedure/middleware/audit invariants. Read-only — no source modified.

Per-pack raw tables (full MEDIUM/LOW detail) live in `.planning/reviews/raw/pack{1..7}-*.md`. This report consolidates counts, the systemic themes, and reproduces every BLOCKER and HIGH.

---

## Executive summary

| Pack | Domain | BLOCKER | HIGH | MEDIUM | LOW | Total | Raw file |
|------|--------|:------:|:---:|:-----:|:---:|:-----:|----------|
| 1 | Finance & Payments | 0 | 3 | 15 | 7 | 25 | [pack1-finance.md](.planning/reviews/raw/pack1-finance.md) |
| 2 | Tax & US/EU e-filing | 0 | 5 | 6 | 4 | 15 | [pack2-tax.md](.planning/reviews/raw/pack2-tax.md) |
| 3 | Contractors/Contracts/Classification/Compliance/Consent | 1 | 6 | 7 | 3 | 17 | [pack3-classification.md](.planning/reviews/raw/pack3-classification.md) |
| 4 | Workforce & HR | 1 | 4 | 5 | 6 | 16 | [pack4-workforce.md](.planning/reviews/raw/pack4-workforce.md) |
| 5 | Workflow/Approvals/Time/Equipment | 1 | 4 | 8 | 4 | 17 | [pack5-workflow.md](.planning/reviews/raw/pack5-workflow.md) |
| 6 | Documents/OCR/e-sign/Notif/Search/Reports/Audit | 1 | 6 | 4 | 3 | 14 | [pack6-docs.md](.planning/reviews/raw/pack6-docs.md) |
| 7 | Integrations/Webhooks/PublicAPI/Gulf/Import/Billing/Org/Portal | 0 | 1 | 15 | 5 | 21 | [pack7-integrations.md](.planning/reviews/raw/pack7-integrations.md) |
| **Total** | | **4** | **29** | **60** | **32** | **125** | |

**Headline (at review time):** No auth-bypass, SSRF, or plaintext-secret holes were found — the platform-security spine (tenant extension, SSRF guard, HMAC signing, API-key hashing, Stripe idempotency, inbound webhook signature verification, PII crypto) is solid. The risk is concentrated in **business-logic integrity**: two dominant systemic defects — (1) sensitive mutations that skip or de-atomize the audit trail, and (2) check-then-act state transitions with no atomic guard — recur in nearly every domain. The 4 BLOCKERs are a cross-tenant document-exfiltration path and three unaudited/under-audited legally-significant write paths.

**Implementation (2026-07-08 — 2026-07-10):** All 4 BLOCKERs ✅; all 29 pack HIGH rows ✅; **all 92 pack MEDIUM/LOW rows ✅ in code** (wave 3, 2026-07-10 — seven parallel pack executors). Full cross-domain status → [handoff](../handoffs/business-logic-review-2026-07-08.md) **END sections** (wave 2 + wave 3 + Fable ship gate). Raw `pack*.md` tables are the original audit; closure detail lives in handoff wave 3.

| Severity | Count at review | Status (2026-07-10) |
|----------|----------------:|---------------------|
| BLOCKER | 4 | ✅ closed wave 1 |
| HIGH | 29 | ✅ closed wave 1 |
| MEDIUM | 60 | ✅ closed wave 3 (code + targeted tests per pack) |
| LOW | 32 | ✅ closed wave 3 |
| **Deferred (not in pack tables)** | 2 | ⏸ contract auto-EXPIRING cron; `isExpired` US TZ off-by-one (TIER 2 handoff) |

---

## Systemic themes (fix these as patterns, not one-offs)

### T1 — Audit not committed in the same transaction as the mutation (pervasive)
The shared helper `writeAuditLog`/`writeAuditLogMany` accepts a `tx` precisely so the audit row commits/rolls back atomically with the business write, and it **re-throws on failure** ([audit-writer.ts:149](packages/api/src/services/audit-writer.ts)). Two failure modes recur:
- **Audit entirely missing** on a sensitive mutation (classification `submit`, timesheet approve/reject, bulk approvals, SDS delivery, BACS export, LPC waive/claim, invoice create/update/void, WHT + ZATCA cert issuance, personnel-file erasure of data, audit-log export, reminder toggle, delegate/clarify).
- **Audit written outside the `$transaction`** (no `tx`, post-commit) — HRIS connect/disconnect, employee lifecycle, DRV clearance, GDPR erasure event, reminder delete/toggle, and ~13 Pack-7 mutations (api-key create/update/revoke, all webhook-subscription writes, jira disconnect, deprovisioning enable, gulf config/headcount/assignment, marketplace update). Failure → committed-but-unlogged mutation + 500.

Recommendation: a lint/codemod that forces every mutation named in the sensitive-mutation list through `auditedMutation` / `writeAuditLog({tx})`.

### T2 — Check-then-act state transitions with no atomic guard (race / double-effect)
State is read + validated outside the mutating `where`, then written unconditionally, so two concurrent calls both pass. Instances: approval `approve`/`reject`/`delegate` (double-approve + double `advanceFlow`), equipment `assign`/`retire`/`approveReturnRequest` (duplicate courier shipments), contract `transitionStatus`, classification `saveAnswer`, reassessment `acknowledge`/`dismiss`, leave-balance double-spend, invoice duplicate-hash, LPC waive/claim, skonto apply, several count+1 sequence allocators (amendment number, WHT cert number, ewidencja version). Fix pattern: conditional `updateMany({ where:{ id, status: expected } })` + assert `count === 1`, or a DB unique/partial index as the backstop.

### T3 — Money aggregation and math correctness
- `SUM(*Minor)::int` overflows at ~21.4M major units (report/export/spend-trend); `fetchKpis` correctly uses `::bigint`. Standardize on `::bigint`.
- Skonto discount basis (`totalMinor` vs `amountToPayMinor`) disagrees between evaluate and apply paths → wrong payout on reverse-charge/withholding invoices.
- WHT treaty lookup `orderBy contractorResidency asc` lets the `'XX'` fallback beat real residencies sorting after XX — the exact bug the sibling `treaty-rate.service` was rewritten to avoid.
- 1042-S box-2 silently drops non-USD payouts (no FX conversion) while the 1099 path converts.
- Unbounded FX staleness in `exchange-rate.getRate` (fallback has no max-age) → settlement/tax convert at arbitrarily old rates instead of failing.

### T4 — Non-atomic "generate" of immutable filing rows → duplicate government filings (HIGH)
Both year-end engines (`form-1099-nec.service`, `form-1042s.service`) persist a batch of ACTIVE filing rows + audit **outside** a `$transaction`, with no ACTIVE-row uniqueness and a `clear()`-on-failure idempotency key. Partial failure or post-TTL re-run duplicates ACTIVE returns → duplicate IRS/Pub-1187 records. The correction paths get it right (supersede-before-insert in one tx); the generate paths must adopt the same discipline. Related: ZATCA `resubmit`/retry always tries to create a new chain row against a `@unique(invoiceId)` → P2002 → a rejected invoice can never be re-cleared.

### T5 — Missing / uneven RBAC on reads and legally-significant writes
`tenantProcedure` (tenant scope) is applied broadly, but `requirePermission` is missing on: IR35 chain + attestation mutations (read-only roles can mark SDS delivered / write signed attestations), OCR result reads (invoice PII), e-sign reads + staff `getSigningUrl` (mints a live signing capability), workflow role-template reads. Payroll-export egress sits behind plain `employee:read`. `forceCompleteRunWithPendingCredentials` uses the ordinary execute permission instead of the override permission its sibling requires.

### T6 — Per-request feature-flag re-assertion is inconsistent
US-expansion is exemplary (every procedure calls `assertUsExpansionEnabled`). Gaps: personnel-file `classifyApprove`/`classifyReject` skip `assertWorkforceEnabled`; the HR dashboard re-asserts only `module.hr-dashboard`, not its `module.workforce-employees` data prerequisite; webhook-subscription `create` doesn't re-assert `module.outbound-webhooks`.

### T7 — Client-trusted handles / tenant-service bypass
OCR `trigger`/`portalTrigger` accept a raw client `storageKey` (BLOCKER, below). CSV import `commit` re-accepts raw client rows and skips validate-step checks. Several tenant-data services (`wht-certificate`, `zatca-onboarding`/`submission`, `import-processor`) use the global `prisma` singleton instead of the regional/RLS `ctx.db` — correct today (org id server-derived) but bypasses defense-in-depth and risks wrong-region reads/writes for ME orgs.

---

## BLOCKERS (4) — fix before further release

| # | File:Line | Problem | Fix | Status |
|---|-----------|---------|-----|--------|
| B1 | [ocr.ts:56/174](packages/api/src/routers/core/ocr.ts) + [ocr-extraction.ts:29](packages/api/src/services/ocr-extraction.ts) | `ocr.trigger` / `portalTrigger` trust a client-supplied `storageKey`+`documentId` with no org-ownership check, fetch that R2 object and store the extracted content in the caller's org → cross-tenant document exfiltration, portal-reachable. Regresses the `pending-upload.ts` mitigation. | Drop `storageKey` from input; resolve `Document` by `documentId` scoped to `ctx.organizationId` via `ctx.db` and derive the key from the persisted row. | ✅ Fixed 2026-07-08 |
| B2 | [classification-submit.ts:99](packages/api/src/routers/compliance/classification-submit.ts) | The classification `submit`/outcome mutation flips DRAFT→COMPLETED, materialises compliance rows, resolves reassessment triggers and pushes to HRIS inside its `$transaction` with **no** audit log — a legally significant employment-status determination is unauditable. | Add `writeAuditLog({tx, action:'classification.submit', ...})` inside the existing `$transaction`. | ✅ Fixed 2026-07-08 |
| B3 | [personnel-file/erasure.ts:192-204](packages/api/src/routers/core/personnel-file/erasure.ts) | RODO Art.17 erasure soft-deletes documents but writes **no** audit row; only the *retained/blocked* branch is audited — the actual data-deletion branch (higher risk) is unauditable/repudiable. | Emit `personnel_file.erased` audit (erased section codes + counts) inside the same `$transaction`, regardless of retention. | ✅ Fixed 2026-07-08 |
| B4 | [time-entry.ts:226,263,302,326](packages/api/src/services/time-entry.ts) | The entire timesheet `approve`/`reject`/`bulkApprove`/`bulkReject` surface writes **zero** audit log; these records feed reconciliation → invoice → payment, so approvals of billable time have no trail. | Wrap the `updateMany` in `$transaction` and `writeAuditLog`/`writeAuditLogMany({tx})` actor, timesheet id(s), old→new status, reason. | ✅ Fixed 2026-07-08 |

---

## HIGH (29)

> **Status key:** ✅ = fixed 2026-07-08/09 (see handoff). All 29 HIGH rows closed.

### Pack 1 — Finance & Payments
| File:Line | Problem | Fix | Status |
|-----------|---------|-----|--------|
| [payment-skonto.ts:67](packages/api/src/routers/finance/payment-skonto.ts) | Skonto discount computed on `invoice.totalMinor` while `evaluateForInvoice` uses `amountToPayMinor` → wrong payout on reverse-charge/withholding/intake invoices. | Use `amountToPayMinor` as the basis; add reverse-charge regression test. | ✅ |
| [payment-skonto.ts:90-125](packages/api/src/routers/finance/payment-skonto.ts) | `applySkontoToItem` overwrites the withholding-adjusted item amount, has no LOCKED/EXPORTED guard, no idempotency → discount re-applies after file generated. | Compute delta from current `amountMinor`; guard `run=DRAFT`/`item=PENDING`; one application per item (unique constraint). | ✅ |
| [payment-import.ts:74-147](packages/api/src/routers/finance/payment-import.ts) | `confirmStatementMatches` marks items/invoices PAID from client-supplied match list with no server re-match, amount check, or status guard. | Re-run `matchStatementToRun` server-side; only flip when matched amount == item amount and `run=EXPORTED`. | ✅ |

### Pack 2 — Tax & US/EU e-filing
| File:Line | Problem | Fix | Status |
|-----------|---------|-----|--------|
| [form-1099-nec.service.ts:504](packages/api/src/services/form-1099-nec.service.ts) | Batch generate non-atomic + no ACTIVE-row uniqueness → retry/post-TTL re-run duplicates ACTIVE 1099s → double IRS filing. | Wrap batch (create + audit + idempotency complete) in one `$transaction`; supersede-before-insert or partial unique index. | ✅ |
| [form-1042s.service.ts:601](packages/api/src/services/form-1042s.service.ts) | Same defect for 1042-S generate → duplicate Pub-1187 recipient records. | Same atomic + supersede discipline. | ✅ |
| [zatca-submission.ts:143](packages/api/src/services/zatca-submission.ts) + [zatca.ts:168](packages/api/src/routers/compliance/zatca.ts) | Retry/`resubmit` always creates a new chain row but `invoiceId` is `@unique` → P2002 → rejected ZATCA invoices can never be re-cleared. | Re-use existing chain row on retry; only re-run generate/sign/submit + status update. | ✅ |
| [wht-certificate.service.ts:53](packages/api/src/services/wht-certificate.service.ts) | WHT certificate issuance writes no audit log. | Add `writeAuditLog` (cert id, item, amount) inside the create tx. | ✅ |
| [zatca-onboarding.ts:267/414](packages/api/src/services/zatca-onboarding.ts) + [zatca.ts:59](packages/api/src/routers/compliance/zatca.ts) | Compliance-CSID and production-cert exchange (cert issuance for a regulated device) have zero audit trail. | Emit audit on `requestComplianceCsid` / `exchangeProductionCertificate`. | ✅ |

### Pack 3 — Classification / Compliance
| File:Line | Problem | Fix | Status |
|-----------|---------|-----|--------|
| [classification-dashboard.ts:606](packages/api/src/routers/compliance/classification-dashboard.ts) | DE `activeAlertsByMarket` filters lowercase `warning`/`critical` vs uppercase `EconomicDependencyBand` enum → Prisma rejects, tile throws. | Use `'WARNING'`/`'CRITICAL'`; import enum constants from `@contractor-ops/db`. | ✅ |
| [ir35-chain.ts:242/255](packages/api/src/routers/compliance/ir35-chain.ts) | SDS `markDelivered`/`markAcknowledged` (legal proof-of-delivery) write no audit. | Wrap in `$transaction` + `writeAuditLog`. | ✅ |
| [ir35-chain.ts](packages/api/src/routers/compliance/ir35-chain.ts) + [ir35-other-client-attestation.ts:57](packages/api/src/routers/compliance/ir35-other-client-attestation.ts) | Chain + attestation mutations lack `requirePermission`; read-only roles can mark SDS delivered / write signed attestations. | Add `.use(requirePermission({ contractor:['update'] }))`. | ✅ |
| [statusfeststellungsverfahren.ts:101-211](packages/api/src/routers/compliance/statusfeststellungsverfahren.ts) | DRV §7a clearance create/update/delete call `writeAuditLog` without `tx`, on base `prisma` not `ctx.db` → non-atomic + wrong region. | Wrap each in `ctx.db.$transaction` with `tx`. | ✅ |
| [reassessment-trigger-scan.ts:373](packages/api/src/services/reassessment-trigger-scan.ts) | On the 10k audit-row cap the cursor jumps to `now`, permanently skipping unread rows → silently missed IR35 reassessment triggers. | Advance cursor to last processed row's `createdAt`; re-run until drained. | ✅ |
| (6th HIGH is B2 — classification submit audit, listed as BLOCKER) | | | ✅ |

### Pack 4 — Workforce & HR
| File:Line | Problem | Fix | Status |
|-----------|---------|-----|--------|
| [leave.ts:155-166](packages/api/src/routers/workforce/leave.ts) + [approval-shared.ts:337-355](packages/api/src/routers/core/approval-shared.ts) | Leave-balance double-spend: submit checks but never reserves; approval deducts with no re-check → negative balance. | Re-verify balance in `finalizeApprovedLeave`, or write a PENDING reservation ledger row at submit. | ✅ |
| [employee-lifecycle-router.ts:259-275](packages/api/src/routers/employee/employee-lifecycle-router.ts) | On/offboarding audit written outside the `$transaction` (no `tx`) → non-atomic. | Move `writeAuditLog({tx})` inside the tx. | ✅ |
| [hris-sync-router.ts:121-147](packages/api/src/routers/workforce/hris-sync-router.ts) | HRIS `connect` create + audit non-atomic → live credential row with no audit event on audit failure. | Wrap create + `writeAuditLog({tx})` in one `$transaction`. | ✅ |
| [hris-sync-router.ts:171-183](packages/api/src/routers/workforce/hris-sync-router.ts) | HRIS `disconnect` update + audit non-atomic. | Wrap in one `$transaction` with `tx`. | ✅ |

### Pack 5 — Workflow / Approvals / Equipment
| File:Line | Problem | Fix | Status |
|-----------|---------|-----|--------|
| [approval-queue.ts:531,577](packages/api/src/routers/core/approval-queue.ts) | Bulk approve/reject flip invoice→READY with no `writeAuditLog` (single-action path audits, bulk doesn't). | Add same-`tx` audit in each `perStep` callback. | ✅ |
| [approval-queue.ts:208,355,452](packages/api/src/routers/core/approval-queue.ts) | approve/reject/delegate are check-then-act with no atomic guard → concurrent double-approve + double `advanceFlow`. | Guarded `updateMany({where:{id,status:'PENDING'}})`, assert `count===1`. | ✅ |
| [equipment-workflow.ts:455-501](packages/api/src/services/equipment-workflow.ts) | `recomputeWorkflowProgress` auto-completes runs bypassing `assertRunCompletable` (open IP_VERIFICATION + PENDING credentials) and writes no audit. | Route through the gated `unblockDependentsAndRecomputeRun`; add audit. | ✅ |
| [equipment-returns.ts:58,169](packages/api/src/routers/equipment/equipment-returns.ts) | `approveReturnRequest` re-checks status outside the tx → concurrent approvals create duplicate InPost shipments/labels. | Guarded `updateMany` inside tx before creating shipment rows. | ✅ |

### Pack 6 — Documents / e-sign / Reports / Audit
| File:Line | Problem | Fix | Status |
|-----------|---------|-----|--------|
| [esign.ts:138](packages/api/src/routers/core/esign.ts) | `getPortalSigningUrl` signs with client `recipientEmail`, not the verified contractor email → sign on behalf of a co-recipient. | Pass verified `contractorEmail`, or require equality. | ✅ |
| [esign.ts:122](packages/api/src/routers/core/esign.ts) + [esign-orchestrator.ts:255](packages/api/src/services/esign-orchestrator.ts) | Staff `getSigningUrl` has no RBAC + no recipient check → any member mints a live signing URL for any recipient. | Gate `requirePermission({contract:['update']})` + validate recipient membership. | ✅ |
| [report-export.ts:43-128](packages/api/src/services/report-export.ts) | Audit CSV export (ExcelJS) has no formula-injection guard while `lib/csv.ts` does → CSV injection via actorName/resourceName. | Route through `lib/csv.ts` or prefix `'` on `=+-@` cells. | ✅ |
| [report.ts:157](packages/api/src/routers/core/report.ts) + [exports/index.ts:433](packages/api/src/services/exports/index.ts) + [dashboard.ts:169](packages/api/src/routers/core/dashboard.ts) | Money `SUM(*Minor)::int` overflows ~21.4M → 500s / wrong totals; dashboard KPIs already use `::bigint`. | Cast to `::bigint`. | ✅ |
| [ocr.ts:85-104](packages/api/src/routers/core/ocr.ts) | `getResult`/`getByDocument` (invoice PII) ungated — any member incl. readonly. | Add `requirePermission({invoice:['read']})`. | ✅ |
| [audit.ts:222-268](packages/api/src/routers/core/audit.ts) | Audit-log export (bulk PII egress) writes no audit entry. | Emit `AUDIT_LOG_EXPORT` audit with filters + row count. | ✅ |

### Pack 7 — Integrations / Import
| File:Line | Problem | Fix | Status |
|-----------|---------|-----|--------|
| [import.ts:302](packages/api/src/routers/core/import.ts) | `commit` trusts raw client `rows`, skips validate-step field checks (only taxId re-validated) → malformed contractors persisted. | Re-validate every row server-side in `commit` (reuse `import-processor`), skip/reject invalid. | ✅ |

---

## MEDIUM (60) & LOW (32)

Full tables with file:line, problem, and fix are in the raw pack files:
- [pack1-finance.md](.planning/reviews/raw/pack1-finance.md) — 15 MEDIUM / 7 LOW
- [pack2-tax.md](.planning/reviews/raw/pack2-tax.md) — 6 MEDIUM / 4 LOW
- [pack3-classification.md](.planning/reviews/raw/pack3-classification.md) — 7 MEDIUM / 3 LOW
- [pack4-workforce.md](.planning/reviews/raw/pack4-workforce.md) — 5 MEDIUM / 6 LOW
- [pack5-workflow.md](.planning/reviews/raw/pack5-workflow.md) — 8 MEDIUM / 4 LOW
- [pack6-docs.md](.planning/reviews/raw/pack6-docs.md) — 4 MEDIUM / 3 LOW
- [pack7-integrations.md](.planning/reviews/raw/pack7-integrations.md) — 15 MEDIUM / 5 LOW

High-value MEDIUM clusters worth batching:
- **Audit-not-in-tx** (T1): ~13 Pack-7 mutations + reminder delete/toggle + GDPR erasure event + HRIS setMapping + payment `verifyBillingProfilePlaid`/`saveSubmitterConfig`/`ingestAchReturnFile` + Peppol connect/disconnect. Single codemod candidate.
- **Check-then-act** (T2): contract `transitionStatus`, `saveAnswer`, reassessment ack/dismiss, invoice duplicate hash, LPC waive/claim, equipment `assign`/`retire`, InPost transition filter, count+1 sequence allocators.
- **Money/FX** (T3): FX staleness bound, 1042-S non-USD box-2, WHT `orderBy` treaty trap, tax-summary pending mismatch.
- **Region/tenant bypass** (T7): thread `ctx.db` into `wht-certificate`, `zatca-*`, `import-processor`.

---

## Confirmed-solid controls (no action)
- **Platform security spine:** SSRF guard (subscribe + connect-time DNS-rebind, no redirects), outbound HMAC signer (timestamp + timing-safe + replay window), API-key HMAC-SHA256 hashing + sandbox↔org fail-closed, Stripe `constructEvent` + Serializable idempotency + transactional outbox, QStash-verified drain, inbound webhook per-connection secret verification, per-org tier/quota gating, portal auth (enumeration-safe, nonce-gated IDOR, HMAC-session-bound, region-aware).
- **PII crypto:** AES-256-GCM per-class keys, national IDs encrypted + omitted from responses, revealed only via audited `employeePii:read`, masked to last-4 in feeds; HRIS field-partition prevents national-ID/financial write-back and two-way sync loops.
- **Injection:** `search.global` sanitizes + parameterizes tsquery; report/dashboard raw SQL bind `organizationId` + whitelist ORDER BY; `AuditLog` writer is create-only (append-only preserved); IRIS ack parser is XXE-safe.
- **US-expansion flag re-assertion** is consistent per request.

---

## Suggested remediation order

> **2026-07-09:** Steps 1–6 complete. All BLOCKER/HIGH, opportunistic MED/LOW, and raw-pack LOW stragglers closed. HRIS migration apply remains deploy-time only.

1. **BLOCKERs B1–B4** (cross-tenant OCR exfil; classification-submit, personnel-erasure, timesheet-approval audit). ✅
2. **T4** duplicate-filing (1099/1042-S atomic generate; ZATCA resubmit) — regulatory/financial exposure. ✅
3. **T2** approval + equipment + leave race guards — double-effect on money/courier/balances. ✅
4. **T5** missing RBAC on e-sign/OCR/IR35 writes and reads. ✅
5. **T1** audit-in-tx codemod across all remaining sensitive mutations. ✅ (batch)
6. **T3** money/FX correctness; **T6/T7** flag re-assertion + ctx.db threading. ✅ core + opportunistic MED/LOW (2026-07-09).

---

## Residual closure — 2026-07-09 (append-only)

Explicit handoff follow-ups + high-value MED batch shipped:

| Area | Status | Key files |
|------|--------|-----------|
| KSeF inbound H-EINV-8/9 | ✅ | `einvoice/.../ksef/parser.ts`, `schemas.ts` |
| ZATCA OTP UI | ✅ | `web-vite/.../compliance-csid.tsx`, `use-compliance-csid.ts` |
| Peppol 0192→0235 | ✅ | migration `20260709120000_peppol_uae_scheme_0235`, `use-peppol.ts` |
| T6 flags | ✅ | `classify.ts`, `require-hr-dashboard-flag.ts`, `webhook-subscription.ts` |
| T7 ctx.db (import) | ✅ | `import-processor.ts` |
| 1042-S box-2 FX | ✅ | `form-1042s-router.ts` |
| Payment-run item FSM | ✅ | `payment-run-ops.ts` |
| Audit gaps (LPC, import, Peppol, lifecycle) | ✅ | respective routers |
| WHT dedup / 1099 uploadAck / forceComplete perm | ✅ | services + workflow router |

### Opportunistic MED/LOW — 2026-07-09 ✅

| Item | Status | Key files |
|------|--------|-----------|
| InPost HTTP inside `$transaction` | ✅ | `equipment-workflow.ts` |
| InPost courier FSM | ✅ | `equipment-couriers.ts` |
| E-sign read RBAC | ✅ | `esign.ts` |
| Payroll export `employeePii:read` | ✅ | `payroll-export-router.ts` |
| Leave submit year scope | ✅ | `leave.ts` |
| OCR regional bucket | ✅ | `ocr-extraction.ts` |
| Linear webhook FSM | ✅ | `linear-webhook-handler.ts` |
| Deprovisioning / Gulf audit-in-tx | ✅ | `deprovisioning.ts`, `saudization.ts` |
| Classification + reassessment CAS | ✅ | `classification-draft.ts`, `reassessment-trigger.ts` |
| Invoice create audit | ✅ | `invoice-crud.ts` |

### Zero-debt closure — 2026-07-09 ✅

| Item | Status | Notes |
|------|--------|-------|
| Equipment auto-shipment / auto-complete audit | ✅ | SYSTEM audit rows in `equipment-workflow.ts` |
| OCR tier NaN guard | ✅ | `resolveOcrCreditAllowance` denies unknown tier |
| Webhook rate-limit Redis outage | ✅ | In-memory fallback cap (not fail-open) |
| Invoice-intake org pre-filter | ✅ | `findFirst({ id, organizationId })` |
| Prior fixes verified | ✅ | OCR doc-before-credit, ACH audit-in-tx, CSV escape, FX maxAge on settlement |

---

## Pack MEDIUM/LOW closure — wave 3 (2026-07-10)

All **60 MEDIUM + 32 LOW** rows from `raw/pack{1..7}-*.md` closed in product code via seven parallel executors. Detail per pack → [handoff wave 3](../handoffs/business-logic-review-2026-07-08.md#adversarial-remediation-wave-3--mediumlow-closure-2026-07-10-append).

| Pack | MED+LOW | ✅ |
|------|--------:|---|
| 1 Finance | 22 | audit-in-tx, payment guards, FX/bank-file hardening |
| 2 Tax | 10 | WHT dedup migration, ZATCA ctx.db, per-line VAT, tax summary |
| 3 Classification | 10 | gate date-driven, IR35/reassessment CAS, country-fields |
| 4 Workforce | 11 | payroll reauth, ewidencja guards, leave audit |
| 5 Workflow | 12 | shipment tx, bulk approval ordering, RBAC |
| 6 Docs | 7 | reminder whitelist, virus-scan reconcile cron |
| 7 Integrations | 22 | webhook/api-key/gulf audit-in-tx, import validate |

**Verification:** wave 2 full suites were green (~4399P api, ~4394P web-vite). Wave 3 **full api re-run not completed** in-session (RAM/time); use **targeted vitest** or CI before merge — see handoff wave 3 verify block.

**Deferred (not pack rows):** contract auto-EXPIRING cron; `isExpired` US TZ edge case.

---

## Post-wave-3 independent verification — 2026-07-10 (append)

Full gates re-run + 5-agent adversarial audit of 47 sampled fix claims: **typecheck 49/49, api suite 4404P (1 isolated-pass flake), web-vite scoped 2953P/0F, i18n 6/6, wiki-brain 0 errors**. Audit: 40 confirmed / 6 partial / 1 effectively refuted (**H-CLS-1** — cross-org denominator structurally cannot differ from numerator; false-CRITICAL spam still live) + 10 new bugs. Both deferred rows since closed (`contract-expiry-scan` cron; `expiryCalendarBoundary`). Full detail + live merge checklist → [handoff END section "Independent verification + adversarial audit — 2026-07-10"](../handoffs/business-logic-review-2026-07-08.md).
