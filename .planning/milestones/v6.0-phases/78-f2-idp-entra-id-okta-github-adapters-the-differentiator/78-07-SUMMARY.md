---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
plan: 07
subsystem: ui
tags: [web-vite, settings, integrations, idp, deprovisioning, i18n, a11y, react]

requires:
  - phase: 77-f2-idp-gws-slack-adapters-the-wedge
    provides: GWS provider-section pattern, idp-deprovisioning toggle table + hook, Idp.toggleTable i18n
  - phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
    provides: entra/okta/github.getStatus + setEnabled tRPC routers, widened getProviderToggleState (78-06)
provides:
  - "Three Entra/Okta/GitHub deprovisioning provider sections (container→view→hook) in Settings > Integrations"
  - "Entra/Okta/GitHub brand icons"
  - "i18n strings (en/de/pl/ar) for the three providers + the toggle-table provider labels"
affects: []

tech-stack:
  added: []
  patterns: ["Page→Container→Hook→Component provider section", "flag-gated enable Switch with disabled tooltip", "shadcn Card/Switch/Badge/Alert/Tooltip"]

key-files:
  created:
    - apps/web-vite/src/components/integrations/entra-provider-section.tsx
    - apps/web-vite/src/components/integrations/entra-provider-section-container.tsx
    - apps/web-vite/src/components/integrations/hooks/use-entra-provider-section.ts
    - apps/web-vite/src/components/integrations/okta-provider-section.tsx
    - apps/web-vite/src/components/integrations/okta-provider-section-container.tsx
    - apps/web-vite/src/components/integrations/hooks/use-okta-provider-section.ts
    - apps/web-vite/src/components/integrations/github-provider-section.tsx
    - apps/web-vite/src/components/integrations/github-provider-section-container.tsx
    - apps/web-vite/src/components/integrations/hooks/use-github-provider-section.ts
    - apps/web-vite/src/components/integrations/__tests__/{entra,okta,github}-provider-section.test.tsx
  modified:
    - apps/web-vite/src/components/integrations/brand-icons.tsx
    - apps/web-vite/src/components/settings/integrations-tab.tsx
    - apps/web-vite/src/components/settings/__tests__/integrations-tab.test.tsx
    - apps/web-vite/messages/{en,de,pl,ar}.json

key-decisions:
  - "Compliance toggle table (task 78-07-05) was ALREADY satisfied — the Phase-77 idp-deprovisioning-toggle-table renders all rows generically, and 78-06 widened the server getProviderToggleState to 5 providers + the ToggleProvider union. Only the 3 provider i18n labels were needed (not a new table component); EXTENDED per the plan's instruction"
  - "Provider sections are deprovisioning-enablement cards (getStatus + flag-gated setEnabled), NOT OAuth connect/disconnect cards — ENTRA/OKTA are absent from the IntegrationProvider Prisma enum so the shared ProviderConnectionCardContainer (which calls integration.getHealth/getOAuthUrlGeneric) is not usable for them; credential connect is schema-blocked (see 78-06 deviation 4)"
  - "Base-ui Switch reflects disabled via aria-disabled and fires onCheckedChange(checked, eventDetails) — views wrap as `onCheckedChange={checked => onToggle(checked)}` and tests assert via aria-disabled (matching the 77 toggle-table test)"
  - "i18n lives in messages/{locale}.json (flat-dotted for Idp.toggleTable, nested for Settings.integrations); generated/i18n typed keys are gitignored and regenerated at build via i18n:types"

patterns-established:
  - "Provider deprovisioning-enablement card: brand icon + flag-status pill + flag-gated enable Switch + provider-specific informational banners"

requirements-completed: [IDP-05, IDP-06, IDP-07]

duration: 38min
completed: 2026-05-31
---

# Phase 78 Plan 07: web-vite IdP-Deprovisioning UI Summary

**Three Entra/Okta/GitHub deprovisioning provider sections (Page→Container→Hook→Component) in Settings > Integrations — flag-gated enable cards with brand icons, Entra hybrid-AD/CA banners, the GitHub outside-collaborator note, full loading/error/empty states, WCAG-compliant switches, and en/de/pl/ar i18n. The 5-provider compliance toggle table was already delivered by Phase 77 + 78-06; only the new provider labels were added.**

## Performance
- **Duration:** ~38 min
- **Tasks:** 6
- **Files:** 17 (13 created + 4 modified, plus 4 i18n JSONs)

## Accomplishments
- Three provider-section trios mirroring GWS: hook = sole tRPC boundary (entra/okta/github.getStatus + setEnabled), presentational view + skeleton, decisive container (loading/error branches)
- Entra view: hybrid-AD destructive block banner ("On-prem AD authoritative — revoke at source") + Conditional Access non-blocking warning. GitHub view: outside-collaborator back-door note
- Flag-gated enable Switch: disabled + tooltip ("Awaiting compliance sign-off") until the provider flag is APPROVED; the server (78-06) is the authoritative gate
- Three brand icons (inline SVG). Wired into the IdP-deprovisioning section of integrations-tab
- i18n for all four locales (en/de/pl/ar) + 3 toggle-table provider labels; i18n:parity green
- 11 view tests pass; toggle-table (4) + integrations-tab (3) regressions pass
- typecheck + check:data-layer + check:page-shells + check:web-vite-presentational all green

## Task Commits
1. **78-07-01..04: provider sections + brand icons + tab wiring** — provider-sections commit (feat)
2. **78-07-06: i18n (en/de/pl/ar)** — i18n commit
3. **78-07 tests** — test commit
(78-07-05 compliance table required no new code — already delivered by 77 + 78-06; only i18n labels.)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 - Scope] Compliance toggle table already exists — extended via i18n only**
- Task 78-07-05 specified creating `idp-deprovisioning-compliance-table-*` files. But Phase 77's `idp-deprovisioning-toggle-table` already renders all providers generically, and 78-06 widened the server response + ToggleProvider union to 5 providers. The plan said "if Phase 77 created the table, EXTEND it." Extension = the 3 provider i18n labels (done). No duplicate table component created.

**2. [Rule 1 - Bug] Provider sections are enablement cards, not OAuth connect cards**
- The plan's connection-card vision (connect/disconnect/health via ProviderConnectionCardContainer) is not viable for ENTRA/OKTA — they're absent from the IntegrationProvider Prisma enum, and ProviderConnectionCardContainer calls integration.getHealth/getOAuthUrlGeneric on that enum. Built deprovisioning-enablement cards on the 78-06 getStatus/setEnabled routers instead (the genuinely-shippable surface).

**3. [Rule 1 - Bug] Switch query/handler shape**
- Base-ui Switch uses aria-disabled (not native disabled) and fires onCheckedChange(checked, eventDetails). Wrapped the handler in the views and aligned tests to the 77 toggle-table aria-disabled pattern.

**4. [Rule 3 - Blocking] integrations-tab test needed new section mocks**
- The existing layout test rendered the real new containers (which call useTRPC) without a provider. Added entra/okta/github section mocks (mirroring the toggle-table mock).

---

**Total deviations:** 4 (1 scope reduction from existing-table reuse, 2 plan-vs-reality UI corrections, 1 regression-test fix). No scope creep; the schema-blocked credential connect for ENTRA/OKTA remains the one deferred item (78-06 deviation 4).

## Issues Encountered
- ProviderConnectionCardContainer not reusable for ENTRA/OKTA (enum gap) — see deviation 2.

## User Setup Required
None for code/tests. Post-deploy: flip `module.idp-deprovisioning-*` flags to APPROVED after legal review to make the enable toggles actionable (Standing Constraint — deferred).

## Next Phase Readiness
- Phase 78 UI complete. The provider cards + toggle table render for all five providers; toggles are flag-gated (disabled until APPROVED). Full OAuth/credential connect for ENTRA/OKTA is a documented follow-up requiring the IntegrationProvider enum + migration.

---
*Phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator*
*Completed: 2026-05-31*
