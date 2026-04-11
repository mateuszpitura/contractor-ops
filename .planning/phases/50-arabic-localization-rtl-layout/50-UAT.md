---
status: complete
phase: 50-arabic-localization-rtl-layout
source: [50-01-SUMMARY.md, 50-02-SUMMARY.md, 50-03-SUMMARY.md, 50-04-SUMMARY.md, 50-05-SUMMARY.md]
started: 2026-04-11T14:00:00Z
updated: 2026-04-11T14:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Arabic Locale Route Accessible
expected: Navigate to /ar (or switch locale to Arabic). The page loads without errors. The URL contains the "ar" locale segment.
result: pass

### 2. RTL Direction on HTML Element
expected: When viewing any page under the /ar locale, the HTML element has dir="rtl" and lang="ar". Text flows from right to left. The browser's scrollbar appears on the left side.
result: pass

### 3. Arabic Font Rendering
expected: Under /ar locale, Arabic text renders in Noto Sans Arabic font (visually distinct from the default Latin font). The font loads without FOUT (flash of unstyled text) or falls back gracefully with swap display.
result: pass

### 4. Arabic Translation Coverage
expected: Key UI strings appear in Arabic under /ar locale. Navigation labels, form fields (Auth register/login), and financial terms (invoices, payments, contracts) show Arabic text, not English placeholders. Some secondary strings may still be in English (expected ~45% coverage).
result: pass

### 5. RTL Layout — Sidebar Navigation
expected: Under /ar locale, the sidebar navigation appears on the right side of the screen (mirrored from LTR). Menu items and icons are right-aligned. Expand/collapse behavior works correctly.
result: pass

### 6. RTL Layout — Form Inputs
expected: Under /ar locale, form labels appear right-aligned. Text inputs have right-aligned placeholder text and cursor starts from the right. Input groups (icon + input) show the icon on the correct (right) side.
result: pass

### 7. RTL Layout — Tables
expected: Under /ar locale, table headers and cells are right-aligned. Column order is visually mirrored (first column appears on the right). Sort indicators and action buttons appear on the correct side.
result: pass

### 8. RTL Layout — Dropdowns and Dialogs
expected: Under /ar locale, dropdown menus open toward the left (mirrored). Dialog content is right-aligned. Select components show the chevron on the left side and text on the right.
result: pass

### 9. Toast Notification Position
expected: Under /ar locale, toast notifications (Sonner) appear at the bottom-left of the screen instead of the default bottom-right. Under /en or /pl, toasts remain at bottom-right.
result: pass

### 10. Locale-Aware Number and Currency Formatting
expected: Under /ar locale, currency values display in AED (Arab Emirates Dirham). Numbers use Western (Latin) numerals (0-9), not Eastern Arabic numerals. Date formatting follows the configured timezone (Asia/Dubai).
result: pass

### 11. Bidirectional Text Handling
expected: When a page contains mixed Arabic and English/Latin text (e.g., Arabic label with an English brand name or email), the text renders correctly with proper bidirectional flow — Arabic segments RTL, embedded Latin segments LTR, without garbled ordering.
result: pass

### 12. CSS Logical Property Conversion — Application Components
expected: Under /ar locale, application components (not just UI primitives) render with correct RTL spacing and alignment. Specifically: padding, margins, and text alignment in invoice tables, contractor profiles, payment forms, and report charts should mirror correctly. No elements should appear with visually broken left/right spacing.
result: issue
reported: "Code analysis found 125 physical CSS property occurrences (pl-/pr-/ml-/mr-/text-left/text-right) across 66 application component files that were not converted to logical equivalents. Also, the UI primitive alert.tsx still has pl-7 and left-4 instead of ps-7 and start-4. Plans 03-05 claimed to convert all application components but the conversions are incomplete."
severity: major

### 13. Locale Switcher Round-Trip
expected: Switch from English/Polish to Arabic and back. The layout direction changes correctly each way. No state is lost during locale switching. The page does not require a full reload to reflect the new direction.
result: pass

## Summary

total: 13
passed: 12
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Application components render with correct RTL spacing and alignment using CSS logical properties"
  status: failed
  reason: "Code analysis found 125 physical CSS property occurrences (pl-/pr-/ml-/mr-/text-left/text-right) across 66 application component files that were not converted to logical equivalents. Also alert.tsx UI primitive still has pl-7 and left-4."
  severity: major
  test: 12
  root_cause: "Plans 03-05 claimed bulk conversion but left 125 physical CSS properties unconverted across 66 files. The alert.tsx UI primitive was missed in plan 01."
  artifacts:
    - path: "apps/web/src/components/ui/alert.tsx"
      issue: "pl-7 and left-4 not converted to ps-7 and start-4"
    - path: "apps/web/src/components (66 files)"
      issue: "125 remaining pl-/pr-/ml-/mr-/text-left/text-right occurrences"
  missing:
    - "Convert remaining 125 physical CSS properties to logical equivalents across 66 application component files"
    - "Fix alert.tsx: pl-7 -> ps-7, left-4 -> start-4"
  debug_session: ""
