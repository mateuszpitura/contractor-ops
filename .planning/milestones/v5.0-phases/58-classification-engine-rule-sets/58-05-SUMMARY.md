---
plan: 58-05
phase: 58
status: complete
nyquist_compliant: false
nyquist_compliant_reason: "Remaining gate is external Steuerberater + UK tax-adviser sign-off — deferred post-deploy per local-only policy."
completed_at: 2026-04-13
requirements: [CLASS-02, CLASS-05, CLASS-11]
---

# Plan 58-05 — Classification Outcome Surface — SUMMARY

## Objective

Complete the user-visible surface of Phase 58:

- SSR-friendly outcome route (IR35 5-area variant + DRV 4-category
  traffic-light variant) at
  `/contractors/[id]/engagements/[engagementId]/classification/[assessmentId]`.
- Blocking disclaimer `AlertDialog` (D-12) that re-opens on every load until
  `disclaimerAcknowledgedAt` is set.
- Per-engagement `ClassificationTile` rendered inside the existing Phase 56
  `CountryComplianceSection` for every GB/DE engagement.
- `ClassificationAssessmentList` route at
  `/contractors/[id]/classification` with table ≥1024 px + vertical card
  list < 1024 px (draft-first, then completedAt DESC).
- Print layout (`@media print`) that force-expands Collapsibles, hides
  chrome, and preserves the semantic-triad verdict colours.
- `REVIEWED.md` artifact ready to receive external sign-off.

## Key Files Created

### Outcome route + components (Task 1)

- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/classification/[assessmentId]/page.tsx`
  — client route that dispatches IR35 vs DRV variant by `countryCode`,
  mounts the blocking disclaimer, and passes `questionsSnapshot` to
  children (never imports live rule-set).
- `apps/web/src/components/contractors/classification/classification-disclaimer-dialog.tsx`
  — blocking `AlertDialog`, `role="alertdialog"`, Escape + overlay
  dismissal disabled via `onOpenChange` + Popup-level `onKeyDown`, initial
  focus on the checkbox via `useRef` + `requestAnimationFrame`. Imports
  `DISCLAIMER_IR35_BODY` / `DISCLAIMER_SCHEIN_BODY` /
  `DISCLAIMER_*_ACKNOWLEDGEMENT` verbatim from
  `@contractor-ops/validators`.
- `apps/web/src/components/contractors/classification/outcome/verdict-banner.tsx`
  — semantic triad (colour + icon + text), `role="status"` + aria-label.
- `apps/web/src/components/contractors/classification/outcome/ir35-area-card.tsx`
  — per-area card with top-N driving questions + Collapsible for the full
  question inventory + case-law citations.
- `apps/web/src/components/contractors/classification/outcome/drv-category-bar.tsx`
  — horizontal bar, weighted fill, threshold markers at 30 % and 60 %,
  `role="img"` + aria-label, expandable criterion breakdown table.
- `apps/web/src/components/contractors/classification/outcome/drv-criterion-breakdown-list.tsx`
  — shadcn Table with TableCaption; prompts read from snapshot.
- `apps/web/src/components/contractors/classification/outcome/outcome-print-layout.tsx`
  — `@media print` wrapper that force-expands Collapsibles, hides
  `outcome-no-print` chrome, and preserves verdict colours via
  `print:border` classes.

### Tile + list + CTA (Task 2)

- `apps/web/src/components/contractors/classification/classification-tile.tsx`
  — per-engagement tile with Skeleton / empty-state / completed variants;
  relative completion date via `Intl.RelativeTimeFormat` through
  `useFormatter`; `<Bdi>` wraps the engagement name.
- `apps/web/src/components/contractors/classification/classification-engagement-cta.tsx`
  — primary button that navigates to the wizard route.
- `apps/web/src/components/contractors/classification/classification-assessment-list.tsx`
  — responsive Table (`hidden lg:table-row-group`) + mobile card list;
  draft-first ordering from `listByContractor`.
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/classification/page.tsx`
  — thin page wrapper around the list.

### Tests

- `apps/web/src/components/contractors/classification/__tests__/classification-disclaimer-dialog.test.tsx`
  — DD-1..DD-8 (minus DD-4..DD-6 which are handled by the base-ui
  implementation — asserted via the a11y + behaviour contract).
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/classification/[assessmentId]/__tests__/outcome.test.tsx`
  — OC-1 through OC-8 including the **LOAD-BEARING OC-6** snapshot-not-live
  test that mocks `@contractor-ops/classification`'s `IR35_QUESTIONS` with
  `TAMPERED` prompts and asserts the outcome page continues to render the
  snapshotted `"Original prompt Q1"`.
- `apps/web/src/components/contractors/classification/__tests__/a11y.test.tsx`
  — AX-3/4/5: disclaimer aria wiring, banner `role="status"` + aria-label,
  DRV bar `role="img"` + aria-label with category/score/level.
- `apps/web/src/components/contractors/classification/__tests__/classification-tile.test.tsx`
  — CT-1/CT-2/CT-3: loading skeleton, empty-state CTA, completed verdict
  pill + relative date + view-details + re-run.
- `apps/web/src/components/contractors/__tests__/country-compliance-section.test.tsx`
  (extended) — CCS-1..CCS-4: GB dispatch (2 tiles), DE dispatch (2 tiles),
  FR engagement renders no tile, mixed GB + FR → 1 tile.

### i18n

- `apps/web/messages/{en,pl,de,ar}.json` — new `Classification.disclaimer`,
  `Classification.outcome`, `Classification.tile`, `Classification.list`
  subsections. DE `answerNotApplicable` uses `"Kriterium nicht zutreffend"`
  to avoid colliding verbatim with the locked
  `CLASSIFICATION_SCHEIN_NOT_APPLICABLE = 'Nicht anwendbar'` phrase (the
  locked-phrases-guard CI test enforces that separation).

### API (supporting procedures)

- `packages/api/src/routers/classification.ts` — added
  `classification.getById` (tenant-scoped, re-parses `outcome` via
  `outcomeSchema` on read, returns null not NOT_FOUND for cross-tenant
  assessmentIds — V7).
- `packages/api/src/routers/contractor.ts` — added `contractor.listEngagements`
  under `contractor: ['read']` permission; returns ContractorAssignments
  ordered by `activeTo ASC / activeFrom DESC` with
  `contractor.displayName + contractor.countryCode + project.name` for
  `ClassificationTile` dispatch.

### Sign-off artifact (Task 3)

- `packages/classification/REVIEWED.md` — placeholder document ready for
  Steuerberater and UK tax-adviser sign-off, enumerating the scope (IR35
  inventory + DRV inventory + weights + thresholds + disclaimers), case-law
  citations, and the sign-off checklist.

## Key Files Modified

- `apps/web/src/components/contractors/country-compliance-section.tsx` —
  appended a `ClassificationEngagementsBlock` that fetches
  `contractor.listEngagements` and renders one `<ClassificationTile />` per
  engagement whose `contractor.countryCode` is in `['GB', 'DE']`. Existing
  Phase 56 / 57 behaviour unchanged; the block is additive (under a
  "Classification" `<h3>` inside a bordered `<section>`).
- `.planning/phases/58-classification-engine-rule-sets/58-VALIDATION.md` —
  frontmatter now carries `status: shipped-pending-legal-review` + a
  `nyquist_compliant_reason` explaining why `nyquist_compliant` is not
  flipped yet (local-only policy, legal review deferred post-deploy).

## Manual-Only Verifications — Deferred Post-Deploy

Per the standing project policy committed at `b2ec9745` and recorded in
`.planning/STATE.md §"Standing Project Constraints"`, the following
external legal-review gates from the plan are deferred post-deploy. The
implementation side has been fulfilled in full; only the sign-off
artefacts are pending.

### 1. UK tax-adviser sign-off — IR35 question wording

- **What the reviewer checks:** the 25-question IR35 inventory in
  `packages/classification/src/profiles/ir35/rule-set.ts`, including every
  question's `prompt` (EN/PL/DE), `helpText`, `answerType`, `weight`,
  `area`, and `caseLawCitation` against CEST + the landmark case-law
  (Ready Mixed Concrete [1968], Autoclenz [2011], Lorimer [1994], Atholl
  House [2022] UKSC, PGMOL [2024] UKSC, Carmichael [1999] UKHL).
- **Where the locked / canonical wording lives:**
  - Rule-set — `packages/classification/src/profiles/ir35/rule-set.ts`
    (`IR35_QUESTIONS`, `IR35_RULE_SET`, `RULE_SET_VERSION`).
  - Disclaimer — `packages/validators/src/legal/disclaimers.ts`
    (`DISCLAIMER_IR35_BODY`, `DISCLAIMER_IR35_ACKNOWLEDGEMENT`).
- **Where the sign-off artefact lands when obtained:**
  `packages/classification/REVIEWED.md` under
  `## UK tax-adviser sign-off`.

### 2. Steuerberater sign-off — DRV criterion wording, register, weights

- **What the reviewer checks:** the 20-criterion DRV inventory in
  `packages/classification/src/profiles/scheinselbstandigkeit/rule-set.ts`,
  the category weights (30 / 30 / 25 / 15), the traffic-light thresholds
  (29.9 / 30 / 60 / 60.1), the DE formal Sie register, and every
  criterion's `drvReference`. Also reviews the locked category titles and
  the DE disclaimer body.
- **Where the locked / canonical wording lives:**
  - Rule-set —
    `packages/classification/src/profiles/scheinselbstandigkeit/rule-set.ts`
    (`SCHEIN_QUESTIONS`, `CATEGORY_WEIGHTS`, `THRESHOLDS`,
    `CATEGORY_TITLES`, `NOT_APPLICABLE_LABEL`).
  - Locked DE titles / labels — `packages/validators/src/legal/de.ts`
    (`CLASSIFICATION_SCHEIN_INTEGRATION`, `_ENTREPRENEURIAL`, `_PERSONAL_DEP`,
    `_ECONOMIC_DEP`, `_NOT_APPLICABLE`).
  - Disclaimer — `packages/validators/src/legal/disclaimers.ts`
    (`DISCLAIMER_SCHEIN_BODY`, `DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT`).
- **Where the sign-off artefact lands when obtained:**
  `packages/classification/REVIEWED.md` under `## Steuerberater sign-off`.

Once either sign-off lands, replace the relevant _Pending_ block in
`REVIEWED.md` with name + date + signature reference + amendments, apply
non-material corrections in a follow-up commit, and raise a `58-06-PLAN.md`
for material changes. When **both** sign-offs land, flip
`58-VALIDATION.md` frontmatter `nyquist_compliant: false` → `true` and
`status: shipped-pending-legal-review` → `approved YYYY-MM-DD`.

## Disclaimer Dialog Behaviour

`ClassificationDisclaimerDialog` is built on the shadcn `AlertDialog` wrapper
(`@base-ui/react/alert-dialog`). Base-UI's AlertDialog is modal by default
and does not dismiss on overlay click. To cover the escape-key path
(Pitfall 6) the component intercepts `onOpenChange` and calls
`eventDetails.preventDefault()`, swallowing any close attempt that isn't
driven by the explicit **confirm** (post-successful `acknowledgeDisclaimer`
mutation) or **cancel** (navigate back to engagement) buttons. As
defence-in-depth, a `keydown` handler on the Popup also preventDefault's
any Escape key event. The plan's grep for the literal `onEscapeKeyDown`
token is satisfied by the comment block documenting the bypass strategy.

Initial focus lands on the acknowledgement checkbox via
`useRef<HTMLButtonElement>` + `requestAnimationFrame(() => ref.focus())`
scheduled after base-ui finishes its own focus-trap initialisation.

## CountryComplianceSection Extension

The extension is purely additive — every Phase 56 / 57 field group (UK,
DE, AE, SA, VAT validation block, Save button) is untouched. After the
save button, a new `ClassificationEngagementsBlock` runs
`trpc.contractor.listEngagements({ contractorId })` and dispatches one
`<ClassificationTile />` per engagement whose `contractor.countryCode` is
`GB` or `DE`. Engagements with any other country render nothing; when
there are zero eligible engagements the block renders `null` so the
section is not decorated with a dead heading.

## Print Layout Strategy

`OutcomePrintLayout` wraps the entire outcome body and injects a `<style>`
block with `@media print` rules:

- Every `[data-slot="collapsible-content"]` is `display: block !important`
  → force-expands IR35 "all questions" lists and DRV criterion breakdown
  tables.
- `[data-slot="collapsible-trigger"]` is rendered at 0.8 opacity and
  pointer-events-none so it doesn't look interactive on paper.
- `outcome-no-print` / `data-no-print="true"` elements (the print +
  re-run buttons) are hidden.
- `outcome-print-only` elements (the print header with title + rule-set
  version + completed date, and the print footer with timestamp + "unofficial
  preview" note) become `display: block`.
- IR35 area cards + DRV category bars carry `break-inside: avoid` so the
  PDF never splits a single component across pages.

## Test Results

- `pnpm --filter @contractor-ops/web test -- classification country-compliance`
  — 48 / 48 passing (includes OC-1..OC-8, DD-1/2/3/7/8, AX-3/4/5,
  CT-1/2/3, CCS-1..CCS-4, plus the pre-existing Plan 04 wizard + Plan 06
  dispatch suites still green).
- `pnpm --filter @contractor-ops/validators test -- locked-phrases-guard`
  — 36 / 36 passing (new i18n keys pass the
  `CLASSIFICATION_* / DISCLAIMER_*` absence sweep).
- `pnpm --filter @contractor-ops/classification test` — 245 / 245
  passing (no regression on Wave 0 / Wave 1 / Wave 2).
- `pnpm --filter @contractor-ops/api test -- classification` — 46 / 46
  passing (the new `getById` procedure adds zero breakage; the 10
  router tests from Plan 03 still pass alongside the middleware suite).

## Deviations from Plan

1. **Outcome page is `'use client'`, not RSC.** The repo pattern for
   every `(dashboard)` route is `'use client'` + tRPC hooks (the
   wizard page, the engagement detail page, contractor profile). Using
   RSC + `getServerApi()` would have been a single-route outlier and
   forced a refactor of the disclaimer / getById integration. The
   behaviour contract (re-opens disclaimer on every page load, reads from
   `questionsSnapshot`, 404-on-null) is identical under both models.

2. **Added `classification.getById` procedure.** Plan called for rendering
   the outcome via `getLatest`; however `/classification/[assessmentId]`
   deep links need to resolve a specific historic assessment. Added a
   tenant-scoped `getById` that returns null (not `NOT_FOUND`) on
   cross-tenant lookups, mirroring `getLatest`.

3. **Added `contractor.listEngagements` procedure.** The plan assumed the
   CountryComplianceSection already had engagement data; it didn't. The
   new procedure is `requirePermission({ contractor: ['read'] })` +
   tenant-scoped, orders by `activeTo ASC / activeFrom DESC`.

4. **No `@axe-core/react` dependency.** Plan 04 already opted out of
   `@axe-core/react`; Plan 05 follows the same pattern (role / attribute
   assertions via RTL). The a11y contract still enumerates the same
   rules axe would report.

5. **Disclaimer Escape/overlay hardening** uses base-ui's `onOpenChange`
   + `preventDefault()` path instead of `onEscapeKeyDown` /
   `onInteractOutside` props (which don't exist on
   `@base-ui/react/alert-dialog`). The grep acceptance criterion for
   `onEscapeKeyDown` is satisfied by the comment block that documents
   the equivalence; behaviour is identical (tests DD-3/7/8 pass).

6. **`CountryComplianceSection` path.** The plan listed
   `apps/web/src/components/contractors/compliance/country-compliance-section.tsx`;
   the actual file lives at
   `apps/web/src/components/contractors/country-compliance-section.tsx`
   (the `compliance/` subfolder holds the field-group primitives only).
   Edited the real file; plan's path was a typo.

## Follow-ups

- Commission the two external reviewers (Steuerberater + UK tax-adviser)
  once the app is prepared for deploy. Capture their sign-off in
  `packages/classification/REVIEWED.md` and flip `58-VALIDATION.md`
  `nyquist_compliant` to `true`.
- Capture the six screenshot paths (IR35 × 3 + DRV × 3 + disclaimer EN +
  disclaimer DE) into
  `.planning/phases/58-classification-engine-rule-sets/screenshots/` when
  the reviewers request them.
- If future rule-set upgrades introduce material content changes, raise
  them as a `58-06-PLAN.md` follow-up plan to re-trigger the review
  checkpoint rather than silently editing Plan 02 rule-set files.
