---
status: partial
phase: 61-xrechnung-e-invoicing
source: [61-01-SUMMARY.md, 61-02-SUMMARY.md, 61-03-SUMMARY.md, 61-04-SUMMARY.md, 61-05-SUMMARY.md, 61-06-SUMMARY.md, 61-07-SUMMARY.md, 61-08-SUMMARY.md]
started: 2026-04-14T15:35:00Z
updated: 2026-04-14T15:40:00Z
---

## Current Test

[testing paused — 12 items outstanding; user deferred for batch UAT across multiple phases]

## Tests

### 1. Cold Start Smoke Test
expected: Kill running dev server, clear `.next`, run `pnpm --filter web dev` — boots clean, Prisma client has new models, home page loads, no saxon-js / libxmljs2 native-binding errors.
result: pass

### 2. Navigate to Settings → E-invoicing
expected: Sign in as an org admin, open sidebar → Settings → "E-invoicing" nav item is visible and active when selected. Page renders with two cards: Peppol participant card + Leitweg-ID list card. H1 uses display font. Accent color restricted to primary CTA.
result: [pending]

### 3. Register Peppol Participant
expected: On E-invoicing page, click "Register Peppol participant". Dialog opens with scheme ID + value fields. Enter valid scheme (e.g. `0088`) + value. Submit → participant status pill flips to "Pending registration" (warning color) then "Active" after the Storecove sync completes. Scheme ID + value render in JetBrains Mono.
result: [pending]

### 4. Create Leitweg-ID (valid)
expected: On E-invoicing page, click "Create Leitweg-ID". Dialog opens. Enter a valid Leitweg-ID (Modulo-11-10 passes), pick a contractor (optional), submit. Row appears in the table with mono-font ID value, semantic-triad status pill, default-flag toggle.
result: [pending]

### 5. Create Leitweg-ID (invalid check digit)
expected: Enter a Leitweg-ID with wrong check digit. Submit. Inline validation error appears referencing the Modulo-11-10 rule. Form does NOT submit. Focus moves to the field.
result: [pending]

### 6. Delete Leitweg-ID (destructive confirmation)
expected: Click delete (trash icon) on a Leitweg-ID row. AlertDialog appears with "Delete Leitweg-ID" title + destructive action button (crimson). Confirm → row removed. Cancel → dialog closes, row remains.
result: [pending]

### 7. Invoice list — compliance filter chips
expected: Navigate to Invoices list. Above the table: 4 filter chips (Compliant / Warnings / Failed / Not generated) + a summary KPI tile showing compliant count (display-font numeral, accent color). Click a chip → table filters. Active chip shows accent color + selected state.
result: [pending]

### 8. Invoice detail — E-invoice tab renders 3 sections
expected: Open an invoice detail page. Tabs include "E-invoice". Click it. Three sections stacked vertically: Generation, Validation, Transmission. Each has clear section header + content block. Empty states (before finalize) show "Not finalised" / "No validation yet" / "Not sent" with contextual CTAs.
result: [pending]

### 9. Finalize invoice (generate + validate)
expected: On E-invoice tab Generation section, click "Finalize + validate". Spinner → Generation section shows SHA-256 + byte count. Validation section shows 3-layer result (XSD / EN 16931 / CIUS) with semantic triad. If VALID: green pills + "Ready to send"; if WARNINGS: amber + issue list; if INVALID: red + SVRL list grouped by layer, mono-font xpath, rule IDs.
result: [pending]

### 10. Send button — disabled state + tooltip
expected: On Transmission section, the "Send via Peppol" button is disabled when (a) validation.status ∉ {VALID, WARNINGS} OR (b) peppolParticipant.status ≠ ACTIVE OR (c) recipient capability unknown. Hover on disabled button → tooltip explains which condition is unmet. Button enables when all conditions satisfied.
result: [pending]

### 11. Download XML / Download report
expected: On a finalized invoice, Generation section "Download XML" button → triggers download of the CII XML (file extension `.xml`, content starts with `<?xml`). Validation section "Download full report" button → triggers download of KoSIT HTML report. Both use R2 signed URLs (300s TTL). Links expire after 5 min.
result: [pending]

### 12. DE locale walk
expected: Switch locale to `de`. Re-visit Settings → E-invoicing + invoice detail E-invoice tab. All copy renders in German (no English leakage), no broken MessageFormat placeholders, date formats use DE locale (DD.MM.YYYY).
result: [pending]

### 13. Accessibility spot-check
expected: On Settings → E-invoicing page: Tab through all interactive elements — focus rings visible (accent color ring-2), tab order logical, no keyboard trap. Destructive confirmation dialogs announce to screen readers (role="alertdialog" + aria-describedby). Status pills have sr-only label text (not color-alone).
result: [pending]

## Summary

total: 13
passed: 1
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

[none yet]
