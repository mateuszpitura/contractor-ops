---
phase: 73
slug: f1-compliance-admin-dashboard-portal-self-service-i18n
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-27
---

# Phase 73 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (workspace-level pnpm/turbo) |
| **Config files** | `packages/api/vitest.config.ts` (existing); `apps/web/vitest.config.ts` for RTL; `packages/validators/vitest.config.ts`; `packages/auth/vitest.config.ts`; `packages/compliance-policy/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-dashboard\|compliance-override\|compliance-portal-upload\|compliance-upload-review'` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | Quick: ~45s · Full: ~6min |

---

## Sampling Rate

- **After every task commit:** Run quick command (filtered tests for affected service).
- **After every plan wave:** Run quick command for ALL Phase 73 services + the schema validation: `pnpm --filter @contractor-ops/db test --run; pnpm --filter @contractor-ops/api test --run; pnpm --filter @contractor-ops/web test --run --testNamePattern='compliance|portal-compliance|override-compliance'`.
- **Before `/gsd-verify-work`:** Full suite must be green plus `pnpm typecheck` and `pnpm lint`.
- **Max feedback latency:** 30s for unit, 90s for integration.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 73-01-01 | 01 | 0 | COMPL-01 | T-73-01-01 | Failing tests scaffolded for compliance-dashboard helpers | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-dashboard'` | ❌ W0 | ⬜ pending |
| 73-01-02 | 01 | 0 | COMPL-01 | T-73-01-02 | Failing tests scaffolded for compliance.overrideItem mutation | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-override-mutation'` | ❌ W0 | ⬜ pending |
| 73-01-03 | 01 | 0 | COMPL-04 | T-73-01-03 | Failing tests scaffolded for compliance.submitUploadReplacement | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-portal-upload'` | ❌ W0 | ⬜ pending |
| 73-01-04 | 01 | 0 | COMPL-04 | T-73-01-04 | Failing tests scaffolded for compliance.approve/reject mutations | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-upload-review'` | ❌ W0 | ⬜ pending |
| 73-01-05 | 01 | 0 | COMPL-04 | T-73-01-05 | Failing tests scaffolded for defaultExpiryFromUploadDate | unit | `pnpm --filter @contractor-ops/compliance-policy test --run --testNamePattern='expiry-from-upload-date'` | ❌ W0 | ⬜ pending |
| 73-01-06 | 01 | 0 | COMPL-11 | T-73-01-06 | Failing test scaffold for compl-doc-names-parity guard | unit | `pnpm --filter @contractor-ops/validators test --run --testNamePattern='compl-doc-names-parity'` | ❌ W0 | ⬜ pending |
| 73-01-07 | 01 | 0 | COMPL-01 | T-73-01-07 | Failing RTL scaffold for OverrideComplianceItemDialog | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='override-compliance-item-dialog'` | ❌ W0 | ⬜ pending |
| 73-01-08 | 01 | 0 | COMPL-01 | T-73-01-08 | Failing RTL scaffold for /compliance/dashboard page | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='compliance-dashboard-page'` | ❌ W0 | ⬜ pending |
| 73-01-09 | 01 | 0 | COMPL-04 | T-73-01-09 | Failing RTL scaffold for /portal/compliance/upload-replacement page | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='portal-compliance-upload-replacement'` | ❌ W0 | ⬜ pending |
| 73-01-10 | 01 | 0 | COMPL-01 | T-73-01-10 | Failing scaffold for compliance permission registration | unit | `pnpm --filter @contractor-ops/auth test --run --testNamePattern='compliance-permission'` | ❌ W0 | ⬜ pending |
| 73-02-01 | 02 | 1 | COMPL-01 | T-73-02-01 | Migration A creates `WaivedReasonCategory` enum + 2 nullable columns | integration | `pnpm --filter @contractor-ops/db prisma:validate && pnpm --filter @contractor-ops/db test --run` | ✅ | ⬜ pending |
| 73-02-02 | 02 | 1 | COMPL-04 | T-73-02-02 | Migration B adds `PENDING_REVIEW` to `DocumentStatus` enum (raw SQL) | integration | `pnpm --filter @contractor-ops/db test --run --testNamePattern='document-status-pending-review'` | ✅ | ⬜ pending |
| 73-02-03 | 02 | 1 | COMPL-01 | T-73-02-03 | Migration C adds `@@index([organizationId, severity, status, expiresAt])` on ContractorComplianceItem | integration | `pnpm --filter @contractor-ops/db test --run --testNamePattern='compliance-dashboard-index'` | ✅ | ⬜ pending |
| 73-02-04 | 02 | 1 | COMPL-01 | T-73-02-04 | Migration D adds partial GIN index on AuditLog.metadataJson WHERE resourceType=CONTRACTOR | integration | `pnpm --filter @contractor-ops/db test --run --testNamePattern='audit-log-itemid-index'` | ✅ | ⬜ pending |
| 73-03-01 | 03 | 2 | COMPL-01 | T-73-03-01 | `compliance:read` + `compliance:override` permissions registered + granted to expected roles | unit | `pnpm --filter @contractor-ops/auth test --run --testNamePattern='compliance-permission'` | ✅ | ⬜ pending |
| 73-03-02 | 03 | 2 | COMPL-01 | T-73-03-02 | `compliance.overrideItem(itemId, reasonCategory, reasonNote)` flips status to WAIVED + writes audit | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-override-mutation'` | ✅ | ⬜ pending |
| 73-03-03 | 03 | 2 | COMPL-01 | T-73-03-03 | Override mutation rejects callers without compliance:override permission | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-override-mutation permission'` | ✅ | ⬜ pending |
| 73-03-04 | 03 | 2 | COMPL-01 | T-73-03-04 | Override mutation rejects reasonNote shorter than 20 chars | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-override-mutation freetext-min'` | ✅ | ⬜ pending |
| 73-03-05 | 03 | 2 | COMPL-01 | T-73-03-05 | `compliance.itemAuditTrail(itemId)` returns audit-log entries filtered by metadata.itemId | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-item-audit-trail'` | ✅ | ⬜ pending |
| 73-04-01 | 04 | 2 | COMPL-11 | T-73-04-01 | Five new locked-phrase modules under `legal/compliance-{jx}.ts` exist with valid shape | unit | `pnpm --filter @contractor-ops/validators test --run --testNamePattern='compl-doc-names-parity'` | ✅ | ⬜ pending |
| 73-04-02 | 04 | 2 | COMPL-11 | T-73-04-02 | Every Phase 71 policyRuleId has a matching locked-name entry | unit | `pnpm --filter @contractor-ops/validators test --run --testNamePattern='compl-doc-names-parity policyRuleId'` | ✅ | ⬜ pending |
| 73-04-03 | 04 | 2 | COMPL-11 | T-73-04-03 | Every locked-name entry has en + pl + de keys | unit | `pnpm --filter @contractor-ops/validators test --run --testNamePattern='compl-doc-names-parity en\\+pl\\+de'` | ✅ | ⬜ pending |
| 73-04-04 | 04 | 2 | COMPL-11 | T-73-04-04 | Every policyRuleId has a `COMPL_DOCNAME_*` PENDING entry in signoff-registry.json | unit | `pnpm --filter @contractor-ops/validators test --run --testNamePattern='compl-doc-names-parity signoff'` | ✅ | ⬜ pending |
| 73-05-01 | 05 | 2 | COMPL-01 | T-73-05-01 | `countAtRiskContractors` filter matches D-02 SQL exactly (BLOCKING + !WAIVED + (MISSING\|EXPIRED OR (SATISFIED + 30d))) | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-dashboard countAtRiskContractors'` | ✅ | ⬜ pending |
| 73-05-02 | 05 | 2 | COMPL-01 | T-73-05-02 | `listUpcomingRenewals` filter uses 90-day forward window + ORDER BY expiresAt ASC | unit | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-dashboard listUpcomingRenewals'` | ✅ | ⬜ pending |
| 73-05-03 | 05 | 2 | COMPL-01 | T-73-05-03 | `listBlockedPayments` merges live + 7-day historical sources, dedups by contractorId | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-dashboard listBlockedPayments'` | ✅ | ⬜ pending |
| 73-05-04 | 05 | 2 | COMPL-04 | T-73-05-04 | `defaultExpiryFromUploadDate` returns correct expiry for `fixed_days`, `fixed_months`, `no_expiry` rules | unit | `pnpm --filter @contractor-ops/compliance-policy test --run --testNamePattern='expiry-from-upload-date'` | ✅ | ⬜ pending |
| 73-05-05 | 05 | 2 | COMPL-04 | T-73-05-05 | Every existing PolicyRule has a non-null `expirySemantic` field | unit | `pnpm --filter @contractor-ops/compliance-policy test --run --testNamePattern='expiry-semantic-coverage'` | ✅ | ⬜ pending |
| 73-06-01 | 06 | 3 | COMPL-01 | T-73-06-01 | `/compliance/dashboard` route renders 3 KPI cards + tabbed table | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='compliance-dashboard-page'` | ✅ | ⬜ pending |
| 73-06-02 | 06 | 3 | COMPL-01 | T-73-06-02 | Card click switches active tab in table region | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='compliance-dashboard-page card-click-switches-tab'` | ✅ | ⬜ pending |
| 73-06-03 | 06 | 3 | COMPL-01 | T-73-06-03 | Default landing tab is "At risk" | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='compliance-dashboard-page default-tab-at-risk'` | ✅ | ⬜ pending |
| 73-06-04 | 06 | 3 | COMPL-01 | T-73-06-04 | "Blocked payments" tab polls every 60s | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='compliance-dashboard-page blocked-payments-poll'` | ✅ | ⬜ pending |
| 73-06-05 | 06 | 3 | COMPL-01 | T-73-06-05 | Row click navigates to `/contractors/{id}/compliance#item-{itemId}` | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='compliance-dashboard-page row-click-drilldown'` | ✅ | ⬜ pending |
| 73-07-01 | 07 | 3 | COMPL-04 | T-73-07-01 | Portal `/portal/compliance` page renders banner + per-item cards when items have MISSING/EXPIRED status | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='portal-compliance-page'` | ✅ | ⬜ pending |
| 73-07-02 | 07 | 3 | COMPL-04 | T-73-07-02 | Portal `/portal/compliance/upload-replacement` page auto-derives documentType + auto-computes expiresAt | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='portal-compliance-upload-replacement'` | ✅ | ⬜ pending |
| 73-07-03 | 07 | 3 | COMPL-04 | T-73-07-03 | `compliance.submitUploadReplacement` portal mutation accepts itemId + documentId, asserts contractor scope | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-portal-upload submitUploadReplacement'` | ✅ | ⬜ pending |
| 73-07-04 | 07 | 3 | COMPL-04 | T-73-07-04 | Cross-contractor isolation: portal upload mutation rejects itemId belonging to a different contractor | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-portal-upload cross-contractor-isolation'` | ✅ | ⬜ pending |
| 73-07-05 | 07 | 3 | COMPL-04 | T-73-07-05 | Portal home banner appears when contractor has any MISSING/EXPIRED/30-day-band item | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='portal-home-compliance-banner'` | ✅ | ⬜ pending |
| 73-08-01 | 08 | 3 | COMPL-01 | T-73-08-01 | OverrideComplianceItemDialog renders Select + Textarea + disabled submit until valid | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='override-compliance-item-dialog'` | ✅ | ⬜ pending |
| 73-08-02 | 08 | 3 | COMPL-01 | T-73-08-02 | OverrideComplianceItemButton appears only when `compliance:override` permission + item BLOCKING + (MISSING\|EXPIRED) | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='override-compliance-item-button visibility'` | ✅ | ⬜ pending |
| 73-08-03 | 08 | 3 | COMPL-01 | T-73-08-03 | ComplianceItemHistoryDrawer renders timeline of audit-log entries for the item | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='compliance-item-history'` | ✅ | ⬜ pending |
| 73-08-04 | 08 | 3 | COMPL-01 | T-73-08-04 | WAIVED badge with category icon + tooltip renders on Compliance tab when status=WAIVED | unit | `pnpm --filter @contractor-ops/web test --run --testNamePattern='tab-compliance waived-badge'` | ✅ | ⬜ pending |
| 73-08-05 | 08 | 3 | COMPL-04 | T-73-08-05 | `compliance.approveUploadReplacement` flips item to SATISFIED + sets satisfiedByDocumentId + expiresAt | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-upload-review approve'` | ✅ | ⬜ pending |
| 73-08-06 | 08 | 3 | COMPL-04 | T-73-08-06 | `compliance.rejectUploadReplacement` writes Document.status=ARCHIVED + audit `compliance.upload.rejected` + dispatches notification to contractor | integration | `pnpm --filter @contractor-ops/api test --run --testNamePattern='compliance-upload-review reject'` | ✅ | ⬜ pending |
| 73-08-07 | 08 | 3 | COMPL-04 | T-73-08-07 | `compliance-portal-self-service` flag entry exists in signoff-registry-flags.json (PENDING) | unit | `pnpm --filter @contractor-ops/feature-flags test --run --testNamePattern='compliance-portal-self-service-entry'` | ✅ | ⬜ pending |
| 73-08-08 | 08 | 3 | COMPL-11 | T-73-08-08 | en/pl/de message-key parity for new `compliance.*` and `Portal.compliance.*` namespaces | unit | `pnpm --filter @contractor-ops/lint-guards test --run --testNamePattern='i18n-parity compliance-namespaces'` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/compliance-dashboard.test.ts` — failing stubs for D-02..D-04 query helpers
- [ ] `packages/api/src/__tests__/compliance-override-mutation.test.ts` — failing stubs for `compliance.overrideItem`
- [ ] `packages/api/src/__tests__/compliance-portal-upload.test.ts` — failing stubs for `compliance.submitUploadReplacement`
- [ ] `packages/api/src/__tests__/compliance-upload-review.test.ts` — failing stubs for `compliance.approve/rejectUploadReplacement`
- [ ] `packages/compliance-policy/src/__tests__/expiry-from-upload-date.test.ts` — failing stub for `defaultExpiryFromUploadDate`
- [ ] `packages/validators/src/__tests__/compl-doc-names-parity.test.ts` — failing stub for the parity guard
- [ ] `apps/web/src/components/contractors/compliance/__tests__/override-compliance-item-dialog.test.tsx` — failing RTL stub
- [ ] `apps/web/src/app/[locale]/(dashboard)/compliance/dashboard/__tests__/page.test.tsx` — failing RTL stub
- [ ] `apps/web/src/app/[locale]/(portal)/portal/compliance/__tests__/upload-replacement-page.test.tsx` — failing RTL stub
- [ ] `packages/auth/src/__tests__/compliance-permission.test.ts` — failing stub for compliance permission registration

Vitest configs already exist in all targeted packages — no framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-region migration apply | COMPL-01 | Standing Constraint — manual ops post-deploy step | `npx tsx packages/db/scripts/push-all-regions.ts` after Plan 73-02 PR merges to main; verify each region's schema diff matches the migration |
| Production legal review of 13 locked-phrase additions | COMPL-11 | Standing Project Constraint — DEFERRED post-deploy | Track in STATE.md as legal-review checkpoint per jurisdiction (UK adviser, Steuerberater, KSA adviser, UAE adviser, PL adviser); flips PENDING→APPROVED in `signoff-registry.json` via per-jurisdiction PRs each carrying `legalTicketRef` |
| Real notification dispatch end-to-end (rejection + approval emails) | COMPL-04 | Production email infra (Resend) is mocked in unit tests | Trigger upload/approve/reject flow against staging; observe email delivery via Resend dashboard |
| Real R2 upload pipeline against staging bucket | COMPL-04 | R2 + virus-scan infra is mocked in unit tests | Upload a real PDF via `/portal/compliance/upload-replacement` against staging; observe `Document.status = PENDING_REVIEW` row + admin sees it on Compliance tab |
| `compliance-portal-self-service` flag flip from PENDING→APPROVED | COMPL-04 | Boot-time signoff registry behaviour | In dev: set `FLAG_SIGNOFF_BYPASS=local`; verify portal route renders. For production: flip to APPROVED in `signoff-registry-flags.json` via dedicated PR with `legalTicketRef` |
| Dashboard polling cadence (60s) on "Blocked payments" tab | COMPL-01 | Real-time polling behaviour cannot be perfectly simulated in JSDOM | Open `/compliance/dashboard`, switch to "Blocked payments" tab, observe network panel for 60s polling cycle |
| Compliance tab History timeline with real audit-log data | COMPL-01 | Audit-log query depends on Phase 73 D-13 partial GIN index — runtime behaviour visible only with Postgres data | Trigger override + recompute + reject flows against staging; expand the History drawer; verify chronological ordering matches expected sequence |

---

## Verification Closure

Phase 73 passes verification when:

1. All Wave 0 tests turn from RED to GREEN as Plans 73-02..08 land.
2. `pnpm test` exits 0 across the affected workspaces (`@contractor-ops/api`, `@contractor-ops/web`, `@contractor-ops/db`, `@contractor-ops/validators`, `@contractor-ops/compliance-policy`, `@contractor-ops/auth`, `@contractor-ops/feature-flags`, `@contractor-ops/lint-guards`).
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0 (including the new `compl-doc-names-parity` test in CI and the existing `i18n:parity` guard).
5. Manual UAT verifications recorded in STATE.md as deferred / completed.
