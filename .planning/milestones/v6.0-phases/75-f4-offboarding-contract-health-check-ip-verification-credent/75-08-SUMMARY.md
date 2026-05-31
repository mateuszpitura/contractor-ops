---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
plan: 08
subsystem: ui
tags: [web-vite, react-i18next, contract-health, credential-vault, esign, templates]
status: partial

requires:
  - phase: 75-04
    provides: ipAssignmentResultsSchema (HealthCheckPanel parse)
  - phase: 75-05
    provides: looksLikeSecret (CredentialAddDialog client-side hint)
  - phase: 75-06
    provides: contract.rerunHealthCheck (re-run mutation)
  - phase: 75-07
    provides: workflow.credentialReference namespace + forceCompleteRunWithPendingCredentials
provides:
  - 6 per-jurisdiction IP-ratification templates (DRAFT/PENDING legal review)
  - web-vite HealthCheckPanel + container + hook
  - CredentialsTab + CredentialAddDialog + container + hook
  - PendingCredentialsWarningDialog + IpVerificationEsignButton (presentational)
  - i18n keys (en/de/pl/ar)
affects: []

tech-stack:
  added: []
  patterns:
    - "web-vite Page->Container->Hook->Component re-architecture of the plan's flat Next.js components"
    - "Client-side looksLikeSecret hint mirrors server-side looksLikeSecretRefinement (defence-in-depth)"

key-files:
  created:
    - packages/api/src/services/contract-health/templates/ip-ratification-{uk,de,pl,us,ksa,uae}.txt
    - apps/web-vite/src/components/contracts/health-check-panel.tsx
    - apps/web-vite/src/components/contracts/health-check-panel-container.tsx
    - apps/web-vite/src/components/contracts/hooks/use-health-check-panel.ts
    - apps/web-vite/src/components/workflow/credentials-tab.tsx
    - apps/web-vite/src/components/workflow/credentials-tab-container.tsx
    - apps/web-vite/src/components/workflow/credential-add-dialog.tsx
    - apps/web-vite/src/components/workflow/pending-credentials-warning-dialog.tsx
    - apps/web-vite/src/components/workflow/ip-verification-esign-button.tsx
    - apps/web-vite/src/components/workflow/hooks/use-credentials-tab.ts
  modified:
    - apps/web-vite/messages/{en,de,pl,ar}.json
    - apps/web-vite/src/components/contracts/__tests__/health-check-panel.test.tsx
    - packages/integrations/src/services/__tests__/esign-webhook-ip-ratification.test.ts

key-decisions:
  - "Re-architected the plan's flat Next.js components (next-intl, '@/lib/trpc', JSX.Element) into web-vite Page->Container->Hook->Component (react-i18next shim, useTRPC/useQuery/useMutation hooks, @contractor-ops/ui/components/shadcn/*)"
  - "CredentialsTab renders a definition-style list, NOT the shadcn Table primitive, to satisfy the web-vite table-pattern guard (short action list, not a sortable data grid)"
  - "IpVerificationEsignButton is presentational (onSign prop) so it is ready for its container/hook once the deferred startIpRatificationSigning mutation lands"

patterns-established:
  - "i18n keys are nested objects under Contracts.healthCheck + Workflow.{credentials,ipVerification,pendingCredentialsDialog}, mirrored across 4 locales"

requirements-completed: []

duration: 75 min
completed: 2026-05-31
---

# Phase 75 Plan 08: Offboarding UI + Templates (PARTIAL — e-sign signing/webhook deferred)

**Shipped the offboarding UI surfaces (HealthCheckPanel, CredentialsTab + add dialog, PendingCredentialsWarningDialog, IpVerificationEsignButton) re-architected for web-vite, the 6 IP-ratification templates, and i18n in 4 locales. The e-sign signing mutation + webhook IP-ratification atomic flow are DEFERRED to a follow-up slice (STATE.md blocker) — they require schema + render-pipeline work the plan does not concretely specify against the current tree.**

## Status: PARTIAL

### Done (6 of 9 tasks)
- 75-08-01: 6 IP-ratification templates (DRAFT; DE cites §7/§31 UrhG Schöpferprinzip/Nutzungsrechte).
- 75-08-02: HealthCheckPanel (web-vite presentational) + use-health-check-panel hook + container.
- 75-08-03: CredentialsTab + CredentialAddDialog (client-side looksLikeSecret hint) + container + use-credentials-tab hook; PendingCredentialsWarningDialog; IpVerificationEsignButton.
- 75-08-06: health-check-panel.test flipped GREEN (7 passing + 1 todo).
- 75-08-07: esign-webhook-ip-ratification.test (2 contract-constant assertions GREEN + 7 todo locking the deferred flow).
- 75-08-08: i18n keys added in lockstep across en/de/pl/ar (i18n:parity OK).

### Deferred (tasks 75-08-04, 75-08-05) — STATE.md blocker
- `startIpRatificationSigning` tRPC mutation: the real e-sign entry is `esign-orchestrator.sendForSignature` (needs an existing Document/storageKey PDF in R2 + connectionId + signers), NOT a raw template string. No template->PDF->R2 render pipeline exists.
- e-sign webhook IP_RATIFICATION atomic flow: `SigningEnvelope` has no `documentType`/`metadata` column (esign.prisma) — detection needs a schema column + migration the plan only hand-waves; and the `materialiseFromPolicy` carry-forward is not the real helper signature.

## Task Commits
1. **75-08-01..03,06,07,08** - `64ff310b` (feat)

## Deviations from Plan

**[Path drift — 75-DRIFT-MAP] apps/web -> apps/web-vite + framework** — Every component re-architected: next-intl -> `@/i18n/useTranslations`; `@/lib/trpc` -> `useTRPC`/`useQuery`/`useMutation` in hooks; flat components -> Page->Container->Hook->Component; `@contractor-ops/ui/components/shadcn/*` imports. Passes all 5 web-vite CI guards + lint:no-next.

**[Project rule] table-pattern guard** — CredentialsTab uses a `<ul>` list, not the shadcn `Table` primitive (banned in feature components by check:web-vite-table-pattern). Appropriate for a short credential action list.

**[Rule 3 — test infra] no vitest-mock-extended** — esign test uses constant/shape assertions (the dep is not installed); full atomic-flow integration is it.todo pending the deferred schema/pipeline.

**[BLOCKER — deep drift] e-sign signing + webhook (75-08-04/05) deferred** — see STATE.md. Surfaced per execute-phase policy rather than guessing schema + render-pipeline work.

**Total deviations:** 1 path-drift (framework) + 1 project-rule + 1 test-infra + 1 deferral. **Impact:** UI + templates + i18n are production-grade and guard-clean; the IP-ratification e-sign loop is the one outstanding F4 capability, scoped in the blocker.

## Self-Check: PARTIAL
- 6 templates + 5 UI components + 4 hooks/containers + i18n (4 locales) present.
- health-check-panel 7 GREEN; esign test 2 GREEN; web-vite typecheck clean; 5 web-vite guards + lint:no-next + i18n:parity PASS.
- e-sign signing mutation + webhook atomic flow NOT implemented — STATE.md blocker filed.

## Next
This plan is PARTIAL. Do NOT mark Phase 75 fully complete. Follow-up slice: implement the deferred e-sign IP-ratification signing + webhook flow (schema + render pipeline) per the STATE.md blocker, then re-verify the phase.
