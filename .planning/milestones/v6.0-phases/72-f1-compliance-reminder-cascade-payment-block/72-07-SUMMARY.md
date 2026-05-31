---
phase: 72-f1-compliance-reminder-cascade-payment-block
plan: 07
subsystem: ui
tags: [web-vite, react, shadcn, dialog, collapsible, i18n, accessibility, payments, compliance]

requires:
  - phase: 72-04
    provides: PRECONDITION_FAILED.cause.contractorReasons (D-10) payload shape
provides:
  - PaymentBlockModal presentational component (collapsible per-contractor reasons + deep links)
  - Wizard hook block-state detection + container modal wiring
  - Compliance i18n namespace (4 locales)
affects: []

tech-stack:
  added: []
  patterns:
    - "Page→Container→Hook→Component: hook owns the tRPC boundary + block-state, container renders the modal"
    - "shadcn Dialog body/footer convention + Collapsible disclosure for structured-error display"
    - "i18next nested-key resolution for server-emitted documentTypeLabelKey (strip leading compliance. + pass tail)"

key-files:
  created:
    - apps/web-vite/src/components/payments/payment-block-modal.tsx
  modified:
    - apps/web-vite/src/components/payments/__tests__/payment-block-modal.test.tsx
    - apps/web-vite/src/components/payments/hooks/use-payment-run-step-review.ts
    - apps/web-vite/src/components/payments/new-payment-run-dialog/step-review-container.tsx
    - apps/web-vite/messages/{en,de,pl,ar}.json

key-decisions:
  - "Used the in-tree Collapsible (Base UI) instead of the plan's Accordion — there is no Accordion component in packages/ui and adding @radix/@base-ui accordion + a new shadcn wrapper would be a needless new surface. Collapsible (already used in web-vite) gives the same accessible per-contractor disclosure with zero new deps."
  - "documentTypeLabelKey resolution: the server emits `compliance.documentType.<...>`; the modal strips the leading `compliance.` and passes the remaining `documentType.<...>` tail to t() under the Compliance namespace. The documentType keys are nested objects (compliance-policy-engine.<jur>.<rule>) so i18next's default `.` key separator resolves them. (First attempt double-prefixed `documentType.` — fixed.)"
  - "useId for the dialog title id + hoisted onOpenChange via useCallback to satisfy the repo's useUniqueElementIds + no-jsx-props-bind goals."
  - "Skipped the optional full web-vite build verification (RAM-heavy per project memory); typecheck + i18n-parity + the branded i18n type regeneration cover compile-time key resolution."

patterns-established:
  - "Structured tRPC-error → modal display: hook type-guards PRECONDITION_FAILED with cause.contractorReasons, container renders PaymentBlockModal"

requirements-completed: [COMPL-05]

duration: ~55 min
completed: 2026-05-31
---

# Phase 72 Plan 07: Payment-Block Modal + Wizard Wiring Summary

**Accessible web-vite modal that surfaces the D-10 PRECONDITION_FAILED.cause.contractorReasons payload — one collapsible section per blocked contractor with locale-aware deep links into each expired compliance document — wired into the new-payment-run wizard via the Page→Container→Hook→Component boundary (the hook catches the block, the container renders the modal).**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-05-31
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments
- `PaymentBlockModal` — shadcn Dialog (scroll body + sticky footer), Collapsible per contractor, deep Link per item, destructive empty-state Alert, useId aria-labelledby, keyboard-navigable
- Hook detects PRECONDITION_FAILED + cause.contractorReasons from both create and lockAndExport, exposes `paymentBlock` + `dismissPaymentBlock`
- Container renders the modal from hook state
- Compliance i18n namespace (paymentBlockModal.* + nested documentType labels) across en/de/pl/ar with parity held (de/pl/ar carry [xx]-prefixed copy for Phase 73)
- 6 GREEN tests (render, deep links, empty-state, truncation, close, error-handling guard); web-vite typecheck + i18n-parity clean; biome clean

## Task Commits
1. **Modal + i18n + hook/container wiring + GREEN tests (Tasks 72-07-01..04)** - `79d11f96` (feat)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Accordion component not available**
- Plan specified shadcn Accordion; packages/ui has no Accordion. Used the existing Collapsible (Base UI) — already used elsewhere in web-vite, same accessible disclosure, no new dependency.

**2. [Rule 1 - Bug] documentType label key double-prefix**
- First implementation built `documentType.${tail}` where the tail already contained `documentType.` (after stripping `compliance.`), producing `documentType.documentType.…` and an unresolved raw key. Fixed to pass the tail directly to t().

**3. [Rule 2 - Missing critical] no-jsx-props-bind + useUniqueElementIds goals**
- Hoisted the inline onOpenChange arrow into a useCallback and replaced the hardcoded title id with useId() to satisfy the repo's biome goals.

---

**Total deviations:** 3 auto-fixed (1 blocking-substitution, 1 bug, 1 missing-critical).
**Impact:** COMPL-05 admin UX delivered exactly as intended (clear, accessible, deep-linked block modal). No scope creep.

## Issues Encountered
None new. (Web-vite test suite scoped per file per project memory — never run unscoped.)

## User Setup Required
None. The block modal renders when the backend throws the compliance block (hard-block in dev via FLAG_SIGNOFF_BYPASS=local; PENDING in production until legal sign-off — deferred per Standing Constraint).

## Next Phase Readiness
- Wave 3 complete. Wave 4: Plan 72-06 (export atomicity / PaymentRunComplianceCheck) — reuses the gate inside the export tx and writes the audit rows.

---
*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Completed: 2026-05-31*
