---
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
plan: 06
subsystem: ui
tags: [react, web-vite, trpc, i18next, ssn, usps, rbac, contractor-compliance]

# Dependency graph
requires:
  - phase: 84-05
    provides: contractor.updateUsProfile + contractor.revealSsn (staff router, RBAC + audit) + getCountryFieldsConfig US fields
  - phase: 84-03
    provides: contractorPii:read permission (owner/admin/finance_admin) + ssnEncrypted/ssnLast4 columns
  - phase: 84-02
    provides: en-US fallback-aware i18n peer (fallbackLng en-US → en → pl)
  - phase: 84-00
    provides: RED component scaffolds (ssn-masked-reveal.test.tsx, country-compliance-us.test.tsx)
provides:
  - UsComplianceFields (US-FIELD-04) dispatched from CountryFieldsDispatch case 'US' (place 3 of 3)
  - SsnMaskedReveal — masked last-4 default, role-gated absent-without-permission audit-logged reveal (US-FIELD-02, UI-SPEC §B)
  - UspsAddressStatusPill — advisory verified/unverified/validating/unavailable/not-validated (US-FIELD-03, never blocks save)
  - use-reveal-ssn hook — the single tRPC boundary for contractor.revealSsn
  - US compliance copy in en + de/pl/ar parity + en-US divergent overrides (US-LOC-01)
affects: [85-w-form-intake, 86-1099-iris, 87-1042-s, us-contractor-profile, us-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gated-reveal control: presentational component + a dedicated reveal hook (use-reveal-ssn); server gate is the real boundary, client canReveal is UX-only"
    - "Advisory status pill mirroring VatValidationStatusPill (Badge + variant map + Tooltip), i18n labelKey/tooltipKey indirection"
    - "Country dispatch place-3 registration: case 'US' + COUNTRY_LABELS.US, US-specific props (ssnLast4/canRevealSsn/uspsVerified) read in the view and threaded through the dispatch"

key-files:
  created:
    - apps/web-vite/src/components/contractors/compliance/ssn-masked-reveal.tsx
    - apps/web-vite/src/components/contractors/compliance/hooks/use-reveal-ssn.ts
    - apps/web-vite/src/components/contractors/usps-address-status-pill.tsx
    - apps/web-vite/src/components/contractors/compliance/us-compliance-fields.tsx
  modified:
    - apps/web-vite/src/components/contractors/country-compliance-section.tsx
    - apps/web-vite/src/hooks/use-permissions.ts
    - apps/web-vite/messages/en.json
    - apps/web-vite/messages/de.json
    - apps/web-vite/messages/pl.json
    - apps/web-vite/messages/ar.json
    - apps/web-vite/messages/en-US.json

key-decisions:
  - "Reveal-button accessible name = visible text 'Reveal SSN'/'Hide SSN' (no divergent aria-label) — satisfies the Plan-00 RED test AND WCAG 2.5.3 Label-in-Name; aria-pressed carries toggle state"
  - "use-reveal-ssn lives in compliance/hooks/ (the test mocks ../hooks/use-reveal-ssn.js); revealed SSN held in local state only, never the query cache — leaves the DOM on hide/unmount (T-84-06-01)"
  - "Frontend permission matrix gains contractorPii:read for owner/admin/finance_admin ONLY, mirroring server roles.ts; the server revealSsn gate stays authoritative (T-84-06-02)"
  - "en base uses American terms for this US-only surface; en-US is a thin override naming the §E divergence keys (ZIP code / Social Security Number / United States); identical-to-en keys omitted per D-04"
  - "USPS pill + suggestion box are advisory; status derives from contractorQuery.data.uspsVerified and never gates Save (T-84-06-03, D-03)"

patterns-established:
  - "SSN surface switches between SsnMaskedReveal (stored last4) and a plain numeric Input (new entry) within UsComplianceFields"
  - "Inline EIN/SSN validation reuses isValidEin/isValidSsn from @contractor-ops/validators, surfaced via FieldError, never blocking typing"

requirements-completed: [US-FIELD-01, US-FIELD-02, US-FIELD-03, US-FIELD-04, US-LOC-01]

# Metrics
duration: 17min
completed: 2026-06-08
---

# Phase 84 Plan 06: US Contractor Profile UI + en-US Locale Summary

**US compliance section (UsComplianceFields) dispatched as place 3 of 3, with a role-gated audit-logged SSN masked-reveal, an advisory USPS address-status pill, and full en/de/pl/ar i18n parity plus en-US divergent overrides.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-06-08T16:43:00Z
- **Completed:** 2026-06-08T17:00:00Z
- **Tasks:** 3
- **Files modified:** 11 (4 created, 7 modified)

## Accomplishments
- `SsnMaskedReveal` implements all five UI-SPEC §B states: masked `•••-••-1234` default (last-4 aria-label, NO full SSN in DOM), reveal control ABSENT (not disabled) without `contractorPii:read`, "Reveal SSN" → Loader2 → full value + "Hide SSN", and an inline `role="alert"` error that falls back to masked.
- `UspsAddressStatusPill` maps verified/unverified/validating/unavailable/not-validated (text labels, not color-only) and is advisory — it never blocks Save.
- `UsComplianceFields` mirrors `UkComplianceFields` in UI-SPEC §A order (entity type → EIN → SSN → US address + USPS), with inline EIN/SSN `FieldError` and the advisory normalized-suggestion affordance.
- Registered `case 'US'` (place 3 of 3) in `CountryFieldsDispatch` + `COUNTRY_LABELS.US`; `revealSsn` flows through the dedicated `use-reveal-ssn` hook (data-layer clean).
- US copy added to `en.json`, translated into `de/pl/ar` (strict parity peers), with thin `en-US.json` divergent overrides — `i18n:parity` green.

## Task Commits

Each task was committed atomically (TDD plan — RED scaffolds from Plan 00 turned GREEN):

1. **Task 1: SsnMaskedReveal + UspsAddressStatusPill + reveal hook** - `d3fd0ff8` (feat)
2. **Task 2: UsComplianceFields + CountryFieldsDispatch case 'US'** - `6734af51` (feat)
3. **Task 3: US i18n copy (en + de/pl/ar parity + en-US overrides)** - `1ef7a610` (feat)

## Files Created/Modified
- `compliance/ssn-masked-reveal.tsx` - Masked-by-default SSN with gated audit-logged reveal (UI-SPEC §B)
- `compliance/hooks/use-reveal-ssn.ts` - Single tRPC boundary for `contractor.revealSsn`; revealed value in local state only
- `usps-address-status-pill.tsx` - Advisory USPS status pill mirroring `VatValidationStatusPill`
- `compliance/us-compliance-fields.tsx` - US fields (entity type, EIN, SSN, US address + USPS) mirroring `UkComplianceFields`
- `country-compliance-section.tsx` - `case 'US'` + `COUNTRY_LABELS.US`; US props threaded from `contractorQuery` + `usePermissions`
- `hooks/use-permissions.ts` - `contractorPii:read` added to owner/admin/finance_admin (mirrors server roles.ts)
- `messages/en.json` - `Contractors.compliance.us.*` (49 keys) + `countries.US`
- `messages/{de,pl,ar}.json` - Translated US block + `countries.US` (i18n:parity peers)
- `messages/en-US.json` - Thin divergent overrides (ZIP code / Social Security Number / United States)

## Decisions Made
See `key-decisions` frontmatter. Most load-bearing: the reveal button's accessible name is its visible text (no divergent `aria-label`) to satisfy both the RED test and WCAG Label-in-Name; the revealed SSN never enters the query cache.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed divergent reveal-button aria-label**
- **Found during:** Task 1 (SsnMaskedReveal)
- **Issue:** Initial implementation set `aria-label="Reveal Social Security Number"` per a literal reading of UI-SPEC §B, but this overrode the accessible name so the Plan-00 RED test (`getByRole('button', { name: /Reveal SSN/i })`) failed; it also violated WCAG 2.5.3 (Label in Name — accessible name must contain the visible text).
- **Fix:** Dropped the redundant aria-label; the visible text "Reveal SSN"/"Hide SSN" is the accessible name. `aria-pressed` still conveys toggle state. Removed the now-orphaned `ssnRevealAriaLabel`/`ssnHideAriaLabel` keys from en.json.
- **Files modified:** ssn-masked-reveal.tsx, messages/en.json
- **Verification:** ssn-masked-reveal.test.tsx 5/5 GREEN
- **Committed in:** `d3fd0ff8` (Task 1 commit)

**2. [Rule 2 - Missing Critical] en.json US copy added during Task 1 (not deferred to Task 3)**
- **Found during:** Task 1 (TDD GREEN)
- **Issue:** The §B masked aria-label assertion (`/last four digits 1234/i`) requires the `ssnMaskedAriaLabel` en key to resolve; the components could not go GREEN with the copy deferred to Task 3.
- **Fix:** Added the full `Contractors.compliance.us.*` en block in Task 1 so the components render real copy; de/pl/ar parity + en-US overrides followed in Task 3.
- **Files modified:** messages/en.json
- **Verification:** Both component tests GREEN; i18n:parity GREEN after Task 3.
- **Committed in:** `d3fd0ff8` (Task 1), `1ef7a610` (Task 3)

**3. [Rule 2 - Missing Critical] Frontend contractorPii:read permission grant**
- **Found during:** Task 2 (CountryFieldsDispatch case 'US')
- **Issue:** `usePermissions` had no `contractorPii` resource, so `can('contractorPii', ['read'])` always returned false — the reveal control would have been absent for every role, including the permitted ones.
- **Fix:** Added `contractorPii: ['read']` to owner/admin/finance_admin in the frontend matrix, mirroring server `roles.ts` (all 7 other roles denied per D-09). The server `revealSsn` gate remains the authoritative boundary.
- **Files modified:** hooks/use-permissions.ts
- **Verification:** typecheck 0 errors; data-layer clean.
- **Committed in:** `6734af51` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing-critical)
**Impact on plan:** All three necessary for correctness/a11y/RBAC parity. No scope creep — every change stays within the plan's stated file set and intent.

## Issues Encountered
- The runtime read-before-edit guard required a Read of each freshly-written file before the next Edit (file-state tracking resets after Write); resolved by Reading before each subsequent Edit. No functional impact.
- Pre-commit linter reformatted import order + ternary wrapping in two components (idempotent style changes) — tests stayed GREEN.

## Known Stubs

| Stub | File | Reason / Resolution |
|------|------|---------------------|
| USPS normalized-suggestion box + "Re-validate address" trigger render only when `uspsSuggestion`/handlers are passed as props | `us-compliance-fields.tsx`, `usps-address-status-pill.tsx` (`uspsRevalidate`/`uspsRevalidateAriaLabel` keys present) | The section currently derives the pill from `contractorQuery.data.uspsVerified` and does not yet pass a live `uspsSuggestion` or a re-validate mutation. This is an advisory surface (US-FIELD-03, never blocks save); wiring the CASS-normalized suggestion + a USPS re-validate round-trip is a follow-up. The mandatory states (verified/unverified/unavailable/not-validated) are fully wired; the optional advisory-suggestion path is prop-gated and intentionally inert until a future plan supplies the data. |

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. The reveal control is client UX over the server-gated `revealSsn`; no new endpoints, auth paths, or trust-boundary schema changes were introduced.

## User Setup Required
None - no external service configuration required. (Standing Constraint: the EIN-prefix / SSN-range rules and US tax-form copy are LOCAL-ONLY and need jurisdiction-specific legal/tax-adviser verification before production deploy — non-blocking.)

## Next Phase Readiness
- The US contractor profile UI is complete and dispatches alongside UK/DE/AE/SA. Phase 85 (W-Form intake) can compose on the same `CountryComplianceSection` surface.
- Follow-up (non-blocking): wire the live USPS normalized-suggestion + re-validate trigger; complete the en-US manual UAT rows (locale-switcher en-US selectable option + MM/DD/YYYY/$ formatting verification, 84-VALIDATION).

## Self-Check: PASSED

- All 4 created files present on disk.
- All 3 task commits present in git (`d3fd0ff8`, `6734af51`, `1ef7a610`).
- Verification suite green: ssn-masked-reveal.test.tsx + country-compliance-us.test.tsx 8/8, check:web-vite-data-layer OK, i18n:parity OK, web-vite typecheck 0 errors.

---
*Phase: 84-theme-a-us-contractor-profile-fields-en-us-locale*
*Completed: 2026-06-08*
