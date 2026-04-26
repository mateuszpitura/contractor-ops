---
phase: 17-ksef-integration
plan: 03
subsystem: ui
tags: [ksef, react, shadcn, i18n, clipboard-api, collapsible, dialog, trpc]

requires:
  - phase: 17-ksef-integration
    provides: "KSeF tRPC router (connect, disconnect, triggerSync, syncHistory, connectionStatus)"
  - phase: 12-integration-foundation
    provides: "ProviderConnectionCard, IntegrationsTab, integration health polling"
provides:
  - "KsefSetupDialog for credential entry (token/certificate auth)"
  - "KsefSyncHistory collapsible sync log section"
  - "KsefSourceBadge for invoice table source column"
  - "KsefMetadataSection with copyable KSeF reference and UPO"
  - "KsefDuplicateBanner for cross-source duplicate detection UI"
  - "CopyableField shared utility component"
  - "EN and PL translations for all KSeF UI strings"
affects: [invoices, settings, portal]

tech-stack:
  added: []
  patterns:
    - "CopyableField pattern: monospace + clipboard API + copy confirmation icon swap"
    - "Provider-specific section pattern: custom connect dialog + controls outside standard card"

key-files:
  created:
    - apps/web/src/components/shared/copyable-field.tsx
    - apps/web/src/components/settings/ksef-setup-dialog.tsx
    - apps/web/src/components/settings/ksef-sync-history.tsx
    - apps/web/src/components/invoices/ksef-badge.tsx
    - apps/web/src/components/invoices/ksef-metadata-section.tsx
    - apps/web/src/components/invoices/ksef-duplicate-banner.tsx
  modified:
    - apps/web/src/components/settings/integrations-tab.tsx
    - apps/web/src/components/invoices/invoice-table/columns.tsx
    - apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Single Save Credentials button instead of separate Verify + Save (connect mutation verifies per D-04)"
  - "KSeF provider rendered as separate section with custom controls instead of extending ProviderConnectionCard props"
  - "Type assertions for tRPC query results due to API package build unavailability in worktree"

patterns-established:
  - "CopyableField: monospace text + click-to-copy with 2s checkmark confirmation"
  - "Provider custom section: separate component wrapping standard card + provider-specific controls"

requirements-completed: [KSEF-03, KSEF-04]

duration: 9min
completed: 2026-03-27
---

# Phase 17 Plan 03: KSeF UI Components Summary

**6 KSeF UI components: setup dialog with token/cert auth, provider card with sync controls, invoice table badge, detail metadata section with copyable fields, and cross-source duplicate banner**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-27T17:32:17Z
- **Completed:** 2026-03-27T17:41:20Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- KSeF provider card in Settings > Integrations with setup dialog for token/certificate auth and Sync Now button
- KsefSourceBadge renders on invoice table rows for KSEF-sourced invoices with tooltip
- Invoice detail page shows KSeF metadata section (copyable reference/UPO) and duplicate banner with void confirmation
- Full EN and PL translations for all KSeF UI copy
- CopyableField reusable utility component with clipboard API integration

## Task Commits

Each task was committed atomically:

1. **Task 1: KSeF setup dialog, provider card, sync history, and i18n** - `c73685a` (feat)
2. **Task 2: KSeF invoice badge, metadata section, and duplicate banner** - `c9fed91` (feat)

## Files Created/Modified
- `apps/web/src/components/shared/copyable-field.tsx` - Monospace text with copy-to-clipboard icon button
- `apps/web/src/components/settings/ksef-setup-dialog.tsx` - KSeF credential entry dialog with token/cert tabs
- `apps/web/src/components/settings/ksef-sync-history.tsx` - Collapsible sync history with status badges
- `apps/web/src/components/invoices/ksef-badge.tsx` - Compact KSeF source badge with tooltip
- `apps/web/src/components/invoices/ksef-metadata-section.tsx` - KSeF data card with copyable reference/UPO
- `apps/web/src/components/invoices/ksef-duplicate-banner.tsx` - Warning banner with void confirmation
- `apps/web/src/components/settings/integrations-tab.tsx` - Added KSeF provider section with custom controls
- `apps/web/src/components/invoices/invoice-table/columns.tsx` - KSEF source renders KsefSourceBadge
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` - KSeF metadata section + duplicate banner
- `apps/web/messages/en.json` - 45+ KSeF translation keys
- `apps/web/messages/pl.json` - 45+ KSeF translation keys (Polish)

## Decisions Made
- Single "Save Credentials" button (no separate verify step) since `ksef.connect` mutation verifies credentials internally per D-04
- KSeF rendered as separate KsefProviderSection component wrapping standard ProviderConnectionCard plus custom sync controls, rather than extending the card's props
- Used explicit type assertions for tRPC query results because the API package couldn't be compiled in the worktree (pre-existing build issue)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing build errors in worktree (parallel portal routes, API package compilation failures) prevented full `pnpm build` verification; used targeted `tsc --noEmit` to confirm our component files are TypeScript-clean

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 KSeF UI components created per UI-SPEC visual contract
- KSeF integration fully visible in Settings > Integrations and Invoice list/detail pages
- Ready for end-to-end verification of KSeF flow

## Self-Check: PASSED

All 9 created/modified files verified on disk. Both task commits (c73685a, c9fed91) found in git log.

---
*Phase: 17-ksef-integration*
*Completed: 2026-03-27*
