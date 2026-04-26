# Phase 50 — UI Review

**Audited:** 2026-04-12
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists)
**Screenshots:** Not captured (no dev server detected on ports 3000, 5173, 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | 57.6% of Arabic strings still in English across 3,637 string values; critical namespaces (Time, Zatca, Legal, API) at 0% |
| 2. Visuals | 3/4 | RTL layout infrastructure is solid; locale switcher button lacks aria-label reducing discoverability |
| 3. Color | 3/4 | Color system consistent; hardcoded hex values limited to brand-color-picker (data) and third-party SVG logos (acceptable) |
| 4. Typography | 3/4 | Font scale disciplined at 9 sizes; Arabic font variable declared but never applied via font-family in CSS |
| 5. Spacing | 3/4 | Scale consistent (gap-2/4, space-y-2/4 dominate); 437 arbitrary px/rem values present across codebase |
| 6. Experience Design | 3/4 | Strong state coverage (1099 loading, 77 error, 133 empty); shadcn components.json has rtl: false despite RTL implementation |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **Arabic font (Noto Sans Arabic) never actually renders** — Arabic text falls back to the system sans-serif font because `--font-arabic` CSS variable is declared but no CSS rule applies it. All Arabic users see the wrong typeface. Fix: add `[dir="rtl"] { font-family: var(--font-arabic, var(--font-sans)); }` to `apps/web/src/app/globals.css` and register `--font-arabic` in the `@theme inline` block.

2. **57.6% of Arabic strings are still English** — 2,095 of 3,637 string values display in English to Arabic locale users. Critically, the Time (0%), Zatca (0%), Api (0%), Legal (3%), Billing (3%), Integrations (0%), Peppol (0%), and Portal (29%) namespaces are nearly or entirely untranslated. The app is partially unusable in Arabic. Fix: commission the professional Arabic translator review per decision D-03 and prioritise the Portal, Time, and Errors namespaces.

3. **Locale switcher button has no aria-label** — The button at `apps/web/src/components/layout/user-menu.tsx:213` uses only a visual label (`{nextLocaleLabel[locale]}`) with no `aria-label` attribute. Screen reader users cannot identify the control's purpose. Fix: add `aria-label={t("switchLanguage")}` to the button element and add the translation key to all three locale message files.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

**Arabic translation coverage is 42.4% by string count.** The plan documents this as an intentional first-pass (decision D-03), but the gap is severe enough to affect usability:

| Namespace | Coverage |
|-----------|----------|
| Navigation | 100% |
| Dashboard | 100% |
| EmptyStates | 70% |
| Auth | 89% |
| Users | 90% |
| Portal | 29% |
| Legal | 3% |
| Billing | 3% |
| Time | 0% |
| Zatca | 0% |
| Peppol | 0% |
| Integrations | 0% |
| Api | 0% |
| CookieConsent | 0% |

Critical namespaces for Gulf users (Zatca for Saudi e-invoicing, Peppol for regional compliance, Portal for contractor self-service) are at 0%. The score reflects that the copywriting infrastructure is correct but the content is incomplete.

**Generic "Cancel" label present in 5 files** (`apps/web/src/components/zatca/zatca-status-card.tsx:182`, `environment-toggle.tsx:139`, `ocr/ocr-review-panel.tsx:567`, `time/approval-queue-table.tsx:309`, `contractors/contractor-table/data-table-bulk-actions.tsx:237`) — these use hardcoded English strings inside `AlertDialogCancel` components rather than i18n keys, meaning they will not translate.

**Locale switcher label is correct:** The Arabic label for the "switch to Arabic" button is "عربي" (not "AR") which is best practice — the label is written in the language it switches to.

---

### Pillar 2: Visuals (3/4)

**RTL infrastructure is well-implemented.** The `dir="rtl"` injection via inline script on the `<html>` element is solid and flash-free. The Toaster position flipping (`bottom-left` in RTL vs `bottom-right` in LTR) demonstrates attention to visual detail.

**Chart RTL mirroring is wired correctly.** `useRtlChartConfig` spreads `xAxisProps.reversed`, `yAxisProps.orientation: "right"`, and `chartStyle: { direction: "rtl" }` onto both `spend-chart.tsx` and `report-chart.tsx`. The implementation follows the Recharts `reversed` prop approach per decision D-06.

**Bdi component is applied to user-generated content** in 4 components (user-menu, activity-feed, payment-run-side-panel, notification-item), preventing LTR names and invoice numbers from breaking RTL text flow.

**Finding: Locale switcher is not visually labelled for accessibility.** The button at `apps/web/src/components/layout/user-menu.tsx:213` shows only the next-locale label without an accessible name describing the action. A Globe icon is present beside a "language" text label in the same row, but the button itself has no `aria-label`.

**Finding: `left-1/2` centering patterns remain in UI primitives** — confirmed expected by plan decision ("centering patterns preserved as-is — these are axis-based transforms not affected by reading direction"). Present in `alert-dialog.tsx:47`, `dialog.tsx:55`, `radio-group.tsx:32`. This is architecturally correct.

**Finding: `left-1/2 -translate-x-1/2` in non-UI-primitive components** (`contracts/contract-detail/activity-tab.tsx:127`, `approvals/approval-queue/data-table-toolbar.tsx:198`, `contractors/contractor-profile/right-rail.tsx:100`) — these are decorative timeline connector lines and centered fixed toolbars, not mirrored in RTL. Acceptable for decorative uses but the activity timeline connector would visually appear on the wrong side in RTL.

---

### Pillar 3: Color (3/4)

**No accent overuse detected.** The codebase uses design token classes (`text-primary`, `bg-primary`) rather than hardcoded accent colors.

**Hardcoded hex values are scoped to appropriate use cases:**
- `apps/web/src/components/settings/brand-color-picker.tsx` — hex values are the data (color swatches), not styling
- `apps/web/src/components/auth/social-buttons.tsx` — Google and Microsoft brand colors in SVG paths (correct use of brand hex values)
- `apps/web/src/components/settings/my-calendar-section.tsx` and `org-calendar-section.tsx` — `text-[#0078D4]` for Microsoft Outlook brand color (acceptable)
- `apps/web/src/app/page.tsx:14` — inline `color: "#6b7280"` style on a redirect page (minor violation, low impact)

**No RTL-specific color issues identified.** Color system unchanged in this phase.

---

### Pillar 4: Typography (3/4)

**Font scale distribution (9 distinct sizes):**

| Class | Usage count |
|-------|-------------|
| text-sm | 891 |
| text-xs | 388 |
| text-base | 61 |
| text-xl | 38 |
| text-lg | 33 |
| text-2xl | 10 |
| text-4xl | 2 |
| text-3xl | 1 |
| text-5xl | 1 |

Nine sizes is high but the usage concentrates heavily on `text-sm` and `text-xs` (1,279 of 1,425 usages = 90%), which is appropriate for a data-dense B2B dashboard. The tail sizes (text-3xl through text-5xl) appear minimally and in hero contexts.

**Font weight distribution (4 weights) is acceptable:**
- font-medium: 347, font-semibold: 268, font-bold: 51, font-normal: 26

**Critical finding: Noto Sans Arabic font is declared but never applied.** The implementation in `apps/web/src/app/[locale]/layout.tsx:12-15` loads the font via `next/font/google` with `variable: "--font-arabic"` and sets it as a CSS custom property on a wrapper div when `isArabic` is true. However, no CSS rule in `globals.css` ever reads `var(--font-arabic)`. The `@theme inline` block at line 228 only registers `--font-sans`, `--font-display`, and `--font-mono`. The body's `font-family` rule at line 880 only references `var(--font-sans)`. Arabic text will render in the system fallback sans-serif font, not Noto Sans Arabic.

**Arbitrary text sizes** `text-[13px]` and `text-[20px]` appear in portal pages (`apps/web/src/app/[locale]/(portal)/portal/invoices/[id]/page.tsx:174`, `time/page.tsx:342`) — these escape the design token scale. `text-sm` (14px) or `text-xs` (12px) are the correct tokens for the `text-[13px]` use cases.

---

### Pillar 5: Spacing (3/4)

**Spacing scale is generally consistent.** The dominant spacing values (`gap-2`, `gap-4`, `space-y-2`, `space-y-4`, `p-4`) follow the 4px-base scale and align with shadcn/ui conventions.

**Arbitrary spacing values (437 occurrences) are present across the codebase.** These predate Phase 50 — the phase did not introduce new spacing issues. The most common offenders are `max-w-[600px]`, `text-[13px]`, `w-[400px]`, and `h-[calc(...)]` patterns in portal pages.

**No RTL-specific spacing regressions found.** The CSS logical property conversion is complete — zero `pl-`, `pr-`, `ml-`, `mr-`, `text-left`, `text-right` in application or UI primitive components (confirmed by grep scan).

---

### Pillar 6: Experience Design (3/4)

**State coverage is strong throughout the app:**
- 1,099 loading state references (skeleton/spinner/isLoading patterns)
- 77 error state references (isError/ErrorBoundary/catch patterns)
- 133 empty state references (isEmpty/length === 0/empty patterns)

**RTL experience design is architecturally sound.** The approach (CSS logical properties at the Tailwind class level, `dir` attribute on html element, `useRtlChartConfig` hook for chart mirroring, `Bdi` component for bidi text isolation) follows established best practices. The `ar-SA-u-nu-latn` locale tag correctly forces Western/Latin numerals for Arabic currency formatting per Gulf business software conventions (decision D-04).

**Finding: `components.json` has `"rtl": false`** at line 14. The shadcn configuration does not reflect the RTL implementation. This is a documentation/config mismatch — it does not affect runtime behavior since RTL is implemented at the Tailwind/CSS level — but it could cause confusion for future developers running shadcn commands that respect the `rtl` flag.

**Finding: The "Cancel" button strings in AlertDialog components are hardcoded English** and will not respond to locale changes. Affects: `zatca-status-card.tsx`, `environment-toggle.tsx`, `ocr-review-panel.tsx`, `approval-queue-table.tsx`, `data-table-bulk-actions.tsx`.

**Finding: Missing locale switching aria-label.** The locale cycling button in user-menu provides no programmatic accessible name. Users navigating by screen reader cannot identify the purpose of the button.

---

## Registry Audit

Registry audit: 0 third-party blocks checked (components.json has empty `"registries": {}` — only shadcn official components present). No flags.

---

## Files Audited

**Phase 50 core files:**
- `apps/web/src/i18n/routing.ts`
- `apps/web/src/i18n/request.ts`
- `apps/web/src/app/[locale]/layout.tsx`
- `apps/web/src/app/[locale]/(dashboard)/layout.tsx`
- `apps/web/src/app/[locale]/(portal)/layout.tsx`
- `apps/web/src/components/layout/user-menu.tsx`
- `apps/web/src/components/dashboard/spend-chart.tsx`
- `apps/web/src/components/dashboard/activity-feed.tsx`
- `apps/web/src/components/payments/payment-run-side-panel.tsx`
- `apps/web/src/components/notifications/notification-item.tsx`
- `apps/web/src/hooks/use-rtl-chart-config.ts`
- `apps/web/src/components/ui/bdi.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/components.json`

**Message files:**
- `apps/web/messages/ar.json` (4,613 lines, 3,637 string values, 42.4% Arabic coverage)
- `apps/web/messages/en.json` (4,612 lines, reference)

**Broader scan:**
- All `apps/web/src/components/ui/*.tsx` (CSS logical property verification)
- All `apps/web/src/**/*.tsx` (font size, weight, color, spacing class analysis)
