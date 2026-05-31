---
status: passed
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
verified: 2026-06-01
requirements: [COMPL-01, COMPL-04, COMPL-11]
plans_verified: 8
plans_total: 8
---

# Phase 73 Verification — F1 Compliance: Admin Dashboard + Portal Self-Service + i18n

**Verdict: PASSED.** All 8 plans shipped with SUMMARY.md; every requirement traced; all Phase-73 test suites GREEN; typecheck + i18n:parity + every web-vite gate clean. Two LOCAL-ONLY deferred items recorded (multi-region migrate, legal sign-offs).

## Goal achievement

Goal: *Admins see at-a-glance who is at risk and which payments are blocked; contractors can self-serve doc replacement from the portal in one click; every COMPL surface is available in en/pl/de (+ ar parity).*

- **Admin at-a-glance (COMPL-01):** `/compliance/dashboard` route — 3 KPI cards (at-risk / upcoming-renewals / blocked-payments) driving 3 canonical-DataTable tabs, server-filtered + indexed (73-05 helpers over the 73-02 composite index), 60s blocked-payments polling, deep-link drilldown to the Compliance tab. Manual override modal + audit-log History timeline + WAIVED badge on the Compliance tab and the dashboard rows. ✓
- **Contractor one-click self-serve (COMPL-04):** `/portal/compliance` list + `/portal/compliance/upload-replacement` (DropZone -> R2 -> `portal.submitUploadReplacement` -> Document PENDING_REVIEW, item stays MISSING/EXPIRED), auto-filled editable expiry, portal-home attention banner. Admin approve (-> SATISFIED + Document ACTIVE) / reject (-> Document ARCHIVED, closed-enum reason) with best-effort notification + re-upload deep link. ✓
- **i18n parity (COMPL-11):** `Compliance.dashboard.*`, `Compliance.override/uploadReview/history/notifications.*`, `Portal.compliance.*`, COMPL doc-name catalog + locked-phrase registry (validators `legal/compliance-{uk,de,pl,ksa,uae,us}.ts`) — all at en/de/pl/ar parity; `pnpm i18n:parity` exits 0. ✓

## Requirement traceability

| Req | Where delivered | Status |
|-----|-----------------|--------|
| COMPL-01 | 73-02 schema + 73-03 auth/override + 73-05 dashboard data + 73-06 dashboard UI + 73-08 override/history | Complete |
| COMPL-04 | 73-02 PENDING_REVIEW + 73-05 expiry helper + 73-07 portal self-service + 73-08 admin review | Complete |
| COMPL-11 | 73-04 locked-phrase registry + parity guard + 73-06/07/08 i18n at 4-locale parity | Complete |

## Must-haves checked (sample)

- additive-only schema migration (1 CREATE TYPE + 1 ALTER TYPE ADD VALUE + 2 ADD COLUMN + 2 CREATE INDEX), enum UPPER_SNAKE_CASE (db:audit-enum-casing clean for the new enum) — 73-02 ✓
- compliance:read/override permission with per-role grants; override + itemAuditTrail mutations atomic with writeAuditLog; i18n-key error constants — 73-03 ✓
- D-17 data-driven parity guard GREEN over the full registry — 73-04 ✓
- 5 indexed dashboard helpers, no N+1; live+historical blocked-payments merge deduped; defaultExpiryFromUploadDate + 19-rule expirySemantic backfill — 73-05 ✓
- Page->Container->Hook->Component, loading/empty/error, WCAG keyboard-activatable cards, canonical DataTable, deep-link drilldown — 73-06 ✓
- portal mutation on portalRouter (reachable by the portal client), DocumentLink ownership scoping, R2 chain — 73-07 ✓
- shared override modal in two places, DialogBody/DialogFooter, History disclosure, approve/reject + notification types + PENDING flag — 73-08 ✓

## Test summary

| Package | Phase-73 tests | Result |
|---------|----------------|--------|
| api (dashboard / override / portal-upload / upload-review / audit-trail) | 32 | PASS |
| compliance-policy (expiry + coverage) | 8 | PASS |
| validators (compl-doc-names-parity) | 22 | PASS |
| auth (compliance-permission) | 6 | PASS |
| feature-flags (portal-self-service-entry) | 2 | PASS |
| db (4 schema tests) | 6 | PASS |
| web-vite (dashboard-container 8, portal form/banner 7, override-dialog 4, history 3) | 22 | PASS |

Gates: `pnpm typecheck` (api/web-vite/validators/feature-flags/compliance-policy/auth/db) exits 0; `i18n:parity` 0; `check:web-vite-{data-layer,page-shells,presentational,table-pattern,dialog-pattern}` all OK; `db:audit-enum-casing` clean for the new enum.

Note: running the api suites with `--testNamePattern` reports unrelated suite-collection failures (pre-existing incomplete-mock test-infra) — the Phase-73 api files all pass when run by path (32/32).

## Deferred items (LOCAL-ONLY Standing Constraint — recorded in STATE.md)

- **migration_apply (73-02):** `pnpm db:migrate:all` (EU + ME) post-deploy. Local `prisma db push` is blocked by the pre-existing `Contractor.search_vector` generated column; `prisma generate` was used for type resolution.
- **legal_signoff (73-04 / 73-08):** COMPL_DOCNAME_* + compliance-portal-self-service signoff entries stay PENDING until per-jurisdiction legal review; Arabic doc-name review = Phase 79; `Document.rejectionReason` column deferred (reason in audit log).
- **UAT (all UI plans):** manual post-deploy walkthroughs (dashboard tabs/drilldown, portal renew flow, admin review).

## Human verification (deferred, non-blocking)

1. Navigate `/<locale>/compliance/dashboard` — 3 cards, card-click tab switch, drilldown, ~60s blocked-payments refresh.
2. Portal: EXPIRED item -> home banner -> /portal/compliance -> Renew now -> upload PDF -> auto-filled expiry -> submit -> Document PENDING_REVIEW + item unchanged.
3. Admin: override a BLOCKING item (-> WAIVED + history entry); review a PENDING_REVIEW upload (approve -> SATISFIED + notify; reject -> ARCHIVED + notify with re-upload link).
4. Confirm en/de/pl render fully; ar renders structurally (Gulf terminology refinement = Phase 79).
