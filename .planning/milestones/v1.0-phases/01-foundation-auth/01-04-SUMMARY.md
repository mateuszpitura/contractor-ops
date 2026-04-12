---
phase: 01-foundation-auth
plan: 04
subsystem: ui
tags: [next-intl, i18n, localization, polish, english, locale-routing]

# Dependency graph
requires:
  - phase: 01-foundation-auth/01-03
    provides: "Auth screens, app shell, settings, user management components"
provides:
  - "Complete Polish and English translation files for Phase 1 UI"
  - "next-intl infrastructure with locale-based routing ([locale] segment)"
  - "Date, number, and currency formatters configured for PLN / Europe/Warsaw"
  - "Language switcher in user menu"
  - "Locale-aware navigation helpers (Link, useRouter, usePathname)"
affects: [all-future-ui-phases, contractor-management, invoice-pipeline]

# Tech tracking
tech-stack:
  added: [next-intl@4.8.3]
  patterns: [useTranslations-hook, getTranslations-server, ICU-message-format, locale-segment-routing, next-intl-middleware]

key-files:
  created:
    - apps/web/src/i18n/routing.ts
    - apps/web/src/i18n/request.ts
    - apps/web/src/i18n/navigation.ts
    - apps/web/src/middleware.ts
    - apps/web/messages/en.json
    - apps/web/messages/pl.json
  modified:
    - apps/web/next.config.ts
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/components/auth/register-form.tsx
    - apps/web/src/components/auth/login-form.tsx
    - apps/web/src/components/auth/invite-accept-form.tsx
    - apps/web/src/components/auth/social-buttons.tsx
    - apps/web/src/components/layout/nav-items.tsx
    - apps/web/src/components/layout/top-bar.tsx
    - apps/web/src/components/layout/user-menu.tsx
    - apps/web/src/components/settings/org-settings-form.tsx
    - apps/web/src/components/settings/users-table.tsx
    - apps/web/src/components/settings/invite-dialog.tsx
    - apps/web/src/components/settings/deactivate-dialog.tsx
    - apps/web/src/app/[locale]/(auth)/verify-email/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/page.tsx
    - apps/web/src/app/[locale]/not-found.tsx
    - apps/web/src/app/[locale]/error.tsx
    - apps/web/src/app/[locale]/(dashboard)/unauthorized/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/members/page.tsx

key-decisions:
  - "Polish (pl) set as default locale -- matches primary user base"
  - "next-intl middleware added for locale detection/redirection despite Next.js 16 proxy pattern -- next-intl 4.x requires middleware"
  - "Language switcher placed in user menu sidebar footer for easy access"
  - "Navigation labels resolved via translation keys, not hardcoded label field"

patterns-established:
  - "i18n pattern: Client components use useTranslations('Namespace'), server components use getTranslations('Namespace')"
  - "i18n navigation: Use @/i18n/navigation exports (Link, useRouter, usePathname) instead of next/navigation for locale-aware routing"
  - "Translation structure: 9 top-level namespaces (Auth, Navigation, TopBar, Dashboard, Settings, Users, Errors, Validation, Common)"
  - "ICU interpolation: Use {variableName} in translation strings, pass values via t('key', { variableName: value })"

requirements-completed: [I18N-01, I18N-02]

# Metrics
duration: 10min
completed: 2026-03-18
---

# Phase 1 Plan 4: i18n Integration Summary

**next-intl with Polish/English localization across all Phase 1 UI -- 9 translation namespaces, locale routing, PLN currency/date formatters, and language switcher**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-18T21:50:17Z
- **Completed:** 2026-03-18T22:00:42Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments
- Complete next-intl infrastructure with [locale] routing, Polish as default locale, and Europe/Warsaw timezone
- All Phase 1 UI strings externalized into en.json (English) and pl.json (Polish) with 9 namespaces
- Zero hardcoded English strings remaining in any component -- all use useTranslations hooks
- Language switcher added to user menu for instant locale switching
- Date, number, and currency formatters configured for PLN with Polish formatting

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up next-intl infrastructure** - `c3efe03` (feat)
2. **Task 2: Create translations and replace hardcoded strings** - `76b91e2` (feat)

## Files Created/Modified
- `apps/web/src/i18n/routing.ts` - Locale routing config (en, pl with pl default)
- `apps/web/src/i18n/request.ts` - Server request config with date/number/currency formatters
- `apps/web/src/i18n/navigation.ts` - Locale-aware Link, useRouter, usePathname exports
- `apps/web/src/middleware.ts` - next-intl middleware for locale detection/redirection
- `apps/web/next.config.ts` - Added createNextIntlPlugin wrapper
- `apps/web/src/app/[locale]/layout.tsx` - Wrapped with NextIntlClientProvider and setRequestLocale
- `apps/web/messages/en.json` - Complete English translations (9 namespaces)
- `apps/web/messages/pl.json` - Complete Polish translations (9 namespaces)
- `apps/web/src/components/auth/*.tsx` - All auth forms use useTranslations
- `apps/web/src/components/layout/*.tsx` - Nav, top bar, user menu use useTranslations
- `apps/web/src/components/settings/*.tsx` - Settings forms and dialogs use useTranslations
- `apps/web/src/app/[locale]/**/*.tsx` - All pages use useTranslations

## Decisions Made
- Polish (pl) set as default locale -- primary user base is Polish organizations
- next-intl middleware added despite Next.js 16 proxy pattern -- next-intl 4.x requires it for locale routing
- Language switcher placed in user menu (sidebar footer) as a simple EN/PL toggle button
- Navigation item labels resolved from translation keys at render time rather than from hardcoded label field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added next-intl middleware for locale routing**
- **Found during:** Task 1 (infrastructure setup)
- **Issue:** Plan did not include middleware.ts but next-intl 4.x requires middleware for locale detection and redirection
- **Fix:** Created `apps/web/src/middleware.ts` with `createMiddleware(routing)` and appropriate matcher config
- **Files modified:** apps/web/src/middleware.ts
- **Verification:** Build succeeds, routes generate for both /en/* and /pl/* paths
- **Committed in:** c3efe03 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for routing to function. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 (Foundation & Auth) is complete -- all 4 plans executed
- Full i18n framework ready for future phases to add translation keys
- All new UI components should use `useTranslations` pattern and add keys to both en.json and pl.json
- Future phases can add new namespaces or extend existing ones in the message files

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-18*
