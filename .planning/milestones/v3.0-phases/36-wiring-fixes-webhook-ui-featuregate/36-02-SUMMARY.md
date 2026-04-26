---
phase: 36-wiring-fixes-webhook-ui-featuregate
plan: 02
subsystem: ui
tags: [react, next-intl, trpc, shadcn, carrier, dpd, ups]

requires:
  - phase: 35
    provides: CarrierCredentialForm, CarrierShipmentForm, getCourierConfigs tRPC endpoint
provides:
  - DPD provider section card in Settings > Integrations
  - UPS provider section card in Settings > Integrations
  - CarrierShipmentForm mounted on equipment detail page
  - Ship via Carrier button with carrier-configured visibility gate
affects: [equipment-detail, settings-integrations]

tech-stack:
  added: []
  patterns: [simple Card for non-OAuth providers instead of ProviderConnectionCard]

key-files:
  created:
    - apps/web/src/components/settings/dpd-provider-section.tsx
    - apps/web/src/components/settings/ups-provider-section.tsx
  modified:
    - apps/web/src/components/settings/integrations-tab.tsx
    - apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Used simple Card with Badge status instead of ProviderConnectionCard for DPD/UPS (courier configs are not OAuth integrations)"

patterns-established:
  - "Courier provider cards: use Card+Badge+Dialog pattern for non-OAuth credential configuration"

requirements-completed: [EQUIP-06, EQUIP-07]

duration: 3min
completed: 2026-04-05
---

# Phase 36 Plan 02: Carrier UI Wiring Summary

**DPD and UPS integration cards mounted in Settings with credential dialogs, and CarrierShipmentForm wired to equipment detail page with carrier-configured visibility gate**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T13:11:28Z
- **Completed:** 2026-04-05T13:14:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- DPD and UPS provider section cards render in Settings > Integrations with Configure button opening CarrierCredentialForm in a Dialog
- Equipment detail page shows "Ship via Carrier" button only when carriers are configured, opening CarrierShipmentForm dialog
- All i18n keys added for both EN and PL locales

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DPD and UPS provider sections and mount in integrations tab** - `ed33ce9` (feat)
2. **Task 2: Mount CarrierShipmentForm on equipment detail page** - `526e04f` (feat)

## Files Created/Modified
- `apps/web/src/components/settings/dpd-provider-section.tsx` - DPD integration card with credential form dialog
- `apps/web/src/components/settings/ups-provider-section.tsx` - UPS integration card with credential form dialog
- `apps/web/src/components/settings/integrations-tab.tsx` - Imports and mounts DPD/UPS provider sections in grid
- `apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx` - Ship via Carrier button and CarrierShipmentForm dialog
- `apps/web/messages/en.json` - Added carrier description, configure, and shipment i18n keys
- `apps/web/messages/pl.json` - Polish translations for same keys

## Decisions Made
- Used simple Card with Badge status instead of ProviderConnectionCard for DPD/UPS because courier configs use getCourierConfigs (not OAuth integration.getHealth), and ProviderConnectionCard would show misleading Connect/Disconnect OAuth buttons
- Used `Settings.carriers` namespace for connected/notConfigured status labels (reusing existing keys from CarrierCredentialForm) and `Equipment.carrier` namespace for new description/configure/shipment keys

## Deviations from Plan

None - plan executed exactly as written (used the alternative Card approach as suggested by the plan after evaluating ProviderConnectionCard behavior).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DPD and UPS credential UI and carrier shipment form are fully wired
- Ready for end-to-end testing with actual carrier API credentials

---
*Phase: 36-wiring-fixes-webhook-ui-featuregate*
*Completed: 2026-04-05*
