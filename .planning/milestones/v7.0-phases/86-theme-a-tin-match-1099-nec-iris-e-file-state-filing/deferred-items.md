# Phase 86 — Deferred Items (out of scope, discovered during execution)

## Plan 86-02

- **Pre-existing enum-casing audit failure in `packages/db/prisma/schema/idp-deprovisioning.prisma`**
  - `db:audit-enum-casing` flags `enum ManualOverrideCategory` values `transient_provider_issue_resolved` and `other` (lower_snake, not UPPER_SNAKE).
  - This file is clean (not modified by plan 86-02) and was last touched in Phase 76 (`6afe07244`). The five new enums added by this plan (`Form1099Status`, `IrisAckStatus`) all pass the audit.
  - Out of scope per the SCOPE BOUNDARY rule — only auto-fix issues directly caused by the current task's changes.

- **Pre-existing `pnpm lint:no-breadcrumbs` failures in Plan 86-01 Wave-0 RED test scaffolds**
  - 23 breadcrumb comments flagged across `packages/api/src/services/__tests__/{iris-ack-parser,tax-filing-transmitter,tin-match.service}.test.ts` (decision/wave/req IDs in comments).
  - These files were committed in `93431e58c test(86-01)` — not touched by plan 86-02. None of plan 86-02's files are flagged.
  - Out of scope; should be cleaned up under plan 86-01's follow-up or a code-review pass.

## Plan 86-05

- **Remaining `pnpm lint:no-breadcrumbs` failures in other plans' Wave-0 RED scaffolds**
  - After plan 86-05 cleaned its own two scaffolds (`form-1099-nec.service.test.ts`, `form-1099-nec-copy-b.test.tsx`), the guard still flags breadcrumbs in scaffolds that belong to plans 86-05-IRIS / 86-06: `packages/api/src/services/__tests__/{iris-ack-parser,tax-filing-transmitter}.test.ts` and `packages/api/src/__tests__/security/tax-filing-tenant-isolation.security.test.ts` (decision/wave/req IDs in comments).
  - These RED scaffolds were committed in Plan 86-01 and are turned GREEN by the IRIS-generator / transmitter / router plans. Each owning plan should strip its own breadcrumbs when it turns its scaffold GREEN.
  - Out of scope per the SCOPE BOUNDARY rule — plan 86-05 only owns the `form-1099-nec.service` + `form-1099-nec-copy-b` scaffolds, both now clean.
  - **Resolved in 86-04/06:** the `iris-ack-parser`, `tax-filing-transmitter`, and `tax-filing-tenant-isolation` scaffolds were rewritten GREEN with no breadcrumbs; `lint:no-breadcrumbs` is clean tree-wide.

## Plan 86-07 (UI — human visual-verify checkpoint deferred)

- **Human visual QA of the new US 1099-NEC surfaces** — status-pill colours
  (Accepted=green, Rejected=red, Partial/Accepted-with-Errors=amber,
  Processing=blue), the amber-advisory (never red) TIN-mismatch list, the portal
  consent gate (unchecked-by-default checkbox → affirm disabled; no-consent →
  paper-copy message; TIN last-4 only), and ar RTL rendering. Deferred to
  US-enablement under the flag-defer model (the surface is dark behind
  `module.us-expansion`); consistent with the standing de/pl/ar native-review
  deferral. Built + i18n-parity green; only the eyeball confirmation defers.
- **Route mounting** — the `tax-filing/` staff components + portal consent/download
  components are built and typecheck-clean but not yet mounted on a route (mirrors
  P87, where 1042-S mounting landed in a separate plan). A follow-up mounts them
  behind the `module.us-expansion` gate.
- **de/pl/ar copy is machine-translated** — flagged for native review before US/EU
  GA (en / en-US are canonical).
