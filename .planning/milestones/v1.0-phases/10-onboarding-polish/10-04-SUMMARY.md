---
phase: 10-onboarding-polish
plan: 04
subsystem: ui
tags: [cmdk, command-palette, search, empty-states, smart-sequencing, localStorage]

requires:
  - phase: 10-01
    provides: search.global tRPC router for entity search
  - phase: 10-02
    provides: EmptyState component with prerequisite action support

provides:
  - CommandPalette with Cmd+K global search, recent items, pinned favorites, quick actions, page navigation
  - SearchProvider context with localStorage recent/pinned item tracking
  - Top bar search bar trigger with keyboard shortcut badge
  - Empty states on all 7 major list views with smart sequencing

affects: [10-05-i18n]

tech-stack:
  added: []
  patterns: [localStorage state for recent/pinned items, debounced tRPC search, smart prerequisite sequencing]

key-files:
  created:
    - apps/web/src/components/search/command-palette.tsx
    - apps/web/src/components/search/search-provider.tsx
  modified:
    - apps/web/src/components/layout/top-bar.tsx
    - apps/web/src/app/[locale]/(dashboard)/layout.tsx
    - apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/payments/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx
    - apps/web/src/components/notifications/notification-center.tsx

key-decisions:
  - "localStorage for recent/pinned items (LIFO 8 items max, client-side only)"
  - "Lightweight count queries (page:1, pageSize:1) at page level for empty state detection"
  - "Flat search results with type badges per UI-SPEC, not grouped by entity type"

patterns-established:
  - "SearchProvider context pattern: global keyboard listener + localStorage state"
  - "Empty state prerequisite check: contractorCount === 0 triggers smart sequencing"

requirements-completed: [SRCH-01, SRCH-02, ONBD-02]

duration: 10min
completed: 2026-03-23
---

# Phase 10 Plan 04: Command Palette & Empty States Summary

**Cmd+K command palette with tRPC global search, recent/pinned items, quick actions, and contextual empty states with smart sequencing across all 7 major list views**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-23T09:09:16Z
- **Completed:** 2026-03-23T09:18:59Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Command palette opens via Cmd+K or search bar click, showing recent items, pinned favorites, quick actions, and page navigation
- tRPC search.global integration with 200ms debounce, flat results with colored type badges, pin/unpin support
- All 7 major list views (contractors, contracts, invoices, workflows, payments, approvals, notifications) show contextual empty states
- Smart sequencing: downstream views (contracts, invoices, workflows, payments) suggest adding contractor first when none exist

## Task Commits

Each task was committed atomically:

1. **Task 1: Command palette and search provider with global keyboard listener** - `3f84733` (feat)
2. **Task 2: Empty state integration across all major list views** - `271d326` (feat)

## Files Created/Modified
- `apps/web/src/components/search/search-provider.tsx` - Global search context with Cmd+K listener and localStorage recent items
- `apps/web/src/components/search/command-palette.tsx` - CommandDialog with search, recent, pinned, actions, pages sections
- `apps/web/src/components/layout/top-bar.tsx` - Search bar trigger (240px) with Cmd+K badge, CommandPalette render
- `apps/web/src/app/[locale]/(dashboard)/layout.tsx` - SearchProvider wrapping dashboard layout
- `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx` - EmptyState with add/import CTAs
- `apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx` - EmptyState with contractor prerequisite
- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx` - EmptyState with upload CTA and contractor prerequisite
- `apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx` - EmptyState with template CTA and contractor prerequisite
- `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx` - EmptyState replacing inline empty state
- `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` - EmptyState replacing inline empty state
- `apps/web/src/components/notifications/notification-center.tsx` - EmptyState replacing inline empty state

## Decisions Made
- Used localStorage for recent/pinned items (max 8 recent, LIFO dedup by type+id) -- simple client-side persistence without backend storage
- Lightweight count queries (page:1, pageSize:1) at page level for empty state detection -- avoids duplicate data fetching vs data table
- Flat search results per UI-SPEC design decision D-16, not grouped by entity type
- Empty state strings hardcoded in English for now -- Plan 05 will add i18n

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
- Empty state strings are hardcoded English (intentional per plan -- Plan 05 will add i18n translations)
- Quick action hrefs use query params (?action=new) that may not be wired to actual wizard triggers yet (existing wizard open logic is via local state, not URL params)

## Next Phase Readiness
- Command palette and empty states ready for i18n in Plan 05
- All search and empty state user-facing strings need translation keys

## Self-Check: PASSED

All 11 files verified present. Both task commits (3f84733, 271d326) verified in git history.

---
*Phase: 10-onboarding-polish*
*Completed: 2026-03-23*
