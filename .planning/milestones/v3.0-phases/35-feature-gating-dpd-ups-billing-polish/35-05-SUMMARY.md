---
phase: 35-feature-gating-dpd-ups-billing-polish
plan: 05
subsystem: ui
tags: [react, next-intl, trpc, shadcn, carrier-ui, dpd, ups, inpost]

requires:
  - phase: 35-02
    provides: DPD/UPS courier client implementations
  - phase: 35-03
    provides: tRPC procedures for createDpdShipment, createUpsShipment, saveCourierConfig, getCourierConfigs
  - phase: 33
    provides: InPostShipmentForm and PaczkomatPicker components
provides:
  - CarrierShipmentForm with unified carrier dropdown and dynamic fieldsets
  - DpdFieldset and UpsFieldset carrier-specific form components
  - CarrierCredentialForm for DPD/UPS credential management in settings
  - DefaultReturnCarrierSelect for org-level default return carrier
  - Complete en/pl i18n keys for carrier shipment and credential setup flows
affects: [equipment-detail-page, settings-integrations-tab]

tech-stack:
  added: []
  patterns: [carrier-fieldset-swap, carrier-credential-card, tRPC-proxy-workaround]

key-files:
  created:
    - apps/web/src/components/equipment/carrier-shipment-form.tsx
    - apps/web/src/components/equipment/dpd-fieldset.tsx
    - apps/web/src/components/equipment/ups-fieldset.tsx
    - apps/web/src/components/settings/carrier-credential-form.tsx
    - apps/web/src/components/settings/default-return-carrier-select.tsx
  modified:
    - apps/web/src/components/equipment/inpost-shipment-form.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "CarrierShipmentForm uses tRPC proxy pattern for stale dist types, consistent with InPostShipmentForm"
  - "UPS service code uses string literals matching API codes (11/65/07) for direct passthrough"
  - "CarrierCredentialForm uses testCourierConnection proxy for connection testing"

patterns-established:
  - "Carrier fieldset swap: Select dropdown conditionally renders carrier-specific fieldset components"
  - "Carrier credential card: Card with password fields, show/hide toggle, test/save action pattern"

requirements-completed: [EQUIP-06, EQUIP-07]

duration: 7min
completed: 2026-04-05
---

# Phase 35 Plan 05: DPD/UPS Carrier Shipment & Credential UI Summary

**Unified carrier shipment form with dynamic DPD/UPS/InPost fieldsets, credential setup cards with test/save, and default return carrier selector**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-05T10:48:21Z
- **Completed:** 2026-04-05T10:55:31Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- CarrierShipmentForm shows carrier dropdown with only configured carriers, swapping between InPost/DPD/UPS fieldsets dynamically
- DpdFieldset collects delivery address + parcel size, UpsFieldset adds service type selection (Standard/Express Saver/Express)
- CarrierCredentialForm renders DPD and UPS credential cards with password show/hide, test connection, and save credentials
- DefaultReturnCarrierSelect saves org-level preferred return carrier to settingsJson
- Complete en/pl i18n keys under Equipment.carrier, Equipment.dpd, Equipment.ups, Settings.carriers, Settings.returnCarrier

## Task Commits

Each task was committed atomically:

1. **Task 1: Carrier shipment form with dynamic fieldsets** - `3c0f61f` (feat)
2. **Task 2: Carrier credential setup + default return carrier + i18n** - `6861253` (feat)

## Files Created/Modified
- `apps/web/src/components/equipment/carrier-shipment-form.tsx` - Unified carrier shipment dialog with Select dropdown, dynamic fieldset rendering, and tRPC mutation dispatch
- `apps/web/src/components/equipment/dpd-fieldset.tsx` - DPD address + parcel size fields
- `apps/web/src/components/equipment/ups-fieldset.tsx` - UPS address + parcel size + service type fields
- `apps/web/src/components/settings/carrier-credential-form.tsx` - Per-carrier credential card with DPD/UPS field variants, test/save actions
- `apps/web/src/components/settings/default-return-carrier-select.tsx` - Org-level default return carrier dropdown
- `apps/web/src/components/equipment/inpost-shipment-form.tsx` - Added backward-compatibility comment
- `apps/web/messages/en.json` - Added Equipment.carrier, Equipment.dpd, Equipment.ups, Settings.carriers, Settings.returnCarrier keys
- `apps/web/messages/pl.json` - Polish translations for all new keys

## Decisions Made
- Used tRPC proxy workaround pattern (consistent with InPostShipmentForm) for createDpdShipment/createUpsShipment/saveCourierConfig/getCourierConfigs procedures
- UPS service code stored as string literal ("11"/"65"/"07") matching actual UPS API service codes for direct passthrough
- Added testCourierConnection proxy call for the "Test connection" button (procedure expected from Plan 03)
- Country code defaults to "PL" as hidden field (Polish-first product)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added createError i18n key for shipment form error toast**
- **Found during:** Task 1 (CarrierShipmentForm)
- **Issue:** Plan specified error toast "Could not create shipment. Please try again." but did not include a dedicated i18n key for it in the listed keys
- **Fix:** Added `createError` key to Equipment.carrier namespace in both en.json and pl.json
- **Files modified:** apps/web/messages/en.json, apps/web/messages/pl.json
- **Committed in:** 6861253 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor i18n key addition for error handling. No scope creep.

## Known Stubs

None. All components are fully wired to tRPC proxy calls. The backend procedures (createDpdShipment, createUpsShipment, saveCourierConfig, getCourierConfigs, testCourierConnection) are expected from Plan 03 -- the UI will function once those procedures are deployed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Carrier shipment UI complete, ready for integration with equipment detail page
- CarrierCredentialForm ready for integration with Settings > Integrations tab
- Backend procedures from Plan 03 required for end-to-end functionality

---
*Phase: 35-feature-gating-dpd-ups-billing-polish*
*Completed: 2026-04-05*
