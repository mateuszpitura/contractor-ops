---
phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
plan: 10
subsystem: web

requires:
  - phase: 70-04
    provides: pnpm i18n:parity guard (this plan is its first eat-our-own-dogfood validation)
  - phase: 70-09
    provides: ScopeCapabilities TS type + scopeCapabilitiesSchema Zod schema (banner reads connection.scopeCapabilities)

provides:
  - "GoogleWorkspaceReconnectBanner component — visible iff scopeCapabilities is null OR capabilities lack 'user.deprovision'"
  - "Reconnect CTA — anchors to existing /api/oauth/google_workspace/start (NO new OAuth scopes — Phase 76 will upgrade)"
  - "i18n keys Integrations.GoogleWorkspaceReconnect.{bannerTitle,bannerBody,reconnectButton,dismissAria} in en/de/pl/ar — formal DE Sie register, formal PL register, MSA AR, RTL-safe (logical-property classes only)"
  - "First eat-our-own-dogfood validation that pnpm i18n:parity stays GREEN after adding peer translations across all 4 locales"

affects:
  - apps/web/src/components/integrations/google-workspace-provider-section.tsx (renders banner above existing connection-status row when isConnected, gated on scopeCapabilities placeholder)

tech-stack:
  added: []
  patterns:
    - "Banner reads scopeCapabilities prop typed as `ScopeCapabilities | null` — null is treated as 'show' (legacy v3.0 connection, never backfilled OR pre-D-14 grant)"
    - "Visibility logic: `scopeCapabilities === null || !scopeCapabilities.capabilities.includes('user.deprovision')` — branches on TYPED capability enum, never on raw scope strings (matches the D-13 contract)"
    - "Phase-gated capability rollout: banner ships in Phase 70 with ZERO new OAuth scopes; Phase 76 upgrades the scope set + writes the new capability via the backfill function from Plan 70-09; banner self-removes once user.deprovision lands in scopeCapabilities.capabilities"
    - "RTL-safe Tailwind: only logical-property classes (ps-/pe-/ms-/me-) — no physical pl-/pr-/ml-/mr-. Phase 56 PITFALLS P20 convention"
  notes:
    - "Provider section currently passes `null` for scopeCapabilities pending Phase 76 wiring scopeCapabilities through `getProviderHealth`'s response. Until then the banner renders for ALL connected v3.0 tenants, which is the correct opt-in-prompt UX. TODO comment in google-workspace-provider-section.tsx documents the Phase-76 wire-up."
    - "Pre-commit hook (lint-staged + biome --write) auto-formatted the new component (single-line import, single-line condition). Tests still pass against the formatted output."

key-files:
  created:
    - apps/web/src/components/integrations/google-workspace-reconnect-banner.tsx
  modified:
    - apps/web/src/components/integrations/google-workspace-provider-section.tsx (import + conditional render above ProviderConnectionCard, scopeCapabilities placeholder = null with Phase 76 TODO)
    - apps/web/src/components/integrations/__tests__/google-workspace-reconnect-banner.test.tsx (replaced Wave-0 stub with 4 real tests using NextIntlClientProvider and the actual ScopeCapabilities type)
    - apps/web/messages/en.json (added Integrations.GoogleWorkspaceReconnect.* — 4 keys)
    - apps/web/messages/de.json (formal Sie register)
    - apps/web/messages/pl.json (formal register)
    - apps/web/messages/ar.json (MSA + RTL-safe)

key-decisions:
  - "Reconnect button uses a plain `<a href>` to the existing OAuth start URL. NOT triggering tRPC `getOAuthUrlGeneric` here — the banner is intentionally a static link. Acceptance criterion T-70-10-01 requires NO `scope=` query string, which a static href trivially satisfies. Phase 76 will replace the underlying server endpoint to grant new scopes; the banner component itself does not change."
  - "The base-ui Button accepts a `render` prop (NOT shadcn's `asChild`). Pattern: `<Button render={<a href={reconnectHref} />}>{label}</Button>` — the children passed to Button are projected into the rendered anchor at runtime. Verified by snapshot of the test DOM (anchor receives the translated label as its text content)."
  - "Test queries by `role: 'button'` (not `role: 'link'`) because base-ui's Button assigns role=button to the rendered anchor. Test asserts `cta.tagName === 'A'` to confirm anchor semantics + `cta.getAttribute('href')` to verify href safety (no scope= leak)."
  - "i18n keys nested under `Integrations.GoogleWorkspaceReconnect` (sibling of existing `Integrations.jira` and `Integrations.linear`). Inserted as the first child to keep the diff minimal and the alphabetical order PascalCase-first (matches existing convention where top-level namespaces are PascalCase)."
  - "Provider section's scopeCapabilities is typed `ScopeCapabilities | null = null` with an explicit annotation — biome's `lint/suspicious/noEvolvingTypes` flags `const x = null` as implicit-any-evolution otherwise. Explicit annotation also documents the future Phase-76 shape."

requirements-completed: [FOUND6-05, FOUND6-03]

verification:
  - "pnpm --filter @contractor-ops/web test google-workspace-reconnect-banner → 4/4 pass"
  - "pnpm i18n:parity → exit 0 (the new banner keys are parity-clean across all 4 locales — eat-our-own-dogfood validated)"
  - "pnpm --filter @contractor-ops/validators exec vitest run locked-phrases-guard → 78/78 still passing (no DE legal-locked phrases used)"
  - "pnpm --filter @contractor-ops/web test google-workspace-provider-section → 2/2 still pass (parent test mocks the banner; wiring change is non-breaking)"
  - "Banner href === '/api/oauth/google_workspace/start' AND href does not contain 'scope=' (T-70-10-01 mitigated)"
  - "No physical-property RTL classes (ml-/mr-/pl-/pr-) in the new banner file"

manual-only-verifications:
  - "Visual RTL check in the AR locale — banner padding/margin still align correctly in dir=rtl. Defer to Phase 76 (when this banner is actually surfaced in production)."
  - "Build-time `pnpm --filter @contractor-ops/web build` fails on PRE-EXISTING type errors in unrelated files (api/cron/reminders/route.ts route export, time/* asChild props, default-skonto-section.tsx onError). The Next.js compile step itself succeeds (`✓ Compiled successfully in 2.2min`). Out of scope for Plan 70-10 — to be cleaned up by future Phase-71+ hardening or a dedicated typing-debt phase."

phase-status:
  - "Plan 70-10 closes Phase 70 (10/10 plans shipped). Phases 71, 74, 76, 79 (whose only dependency was Phase 70) become unblocked for /gsd-discuss-phase + /gsd-plan-phase."

duration: ~25min (component + 4-locale i18n + tests + commit including a precommit-hook iteration)
completed: 2026-04-27
