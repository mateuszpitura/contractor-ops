# Phase 77 — Pattern Map

> Closest existing analog for each file Phase 77 creates/modifies. Anchored to the
> CURRENT tree (post `apps/web` → `apps/web-vite` migration; `apps/api` Fastify for
> server routes). Phase-76-built files are marked `[P76]` — read once Phase 76 is
> executed.

---

## Types / contracts (packages/integrations)

| Phase 77 file | Role | Closest analog | Pattern to copy |
|---|---|---|---|
| `src/types/deprovisionable.ts` (extend) `[P76]` | additive union (`LIKELY_GONE`) + `describeImpact` method | `src/types/provider.ts` (`IntegrationProviderAdapter`) | sibling interface conventions; export from `types/index.ts` |
| `src/idp/impact-preview.ts` (new) | discriminated union `ImpactPreview` keyed on `provider` | classification result discriminated unions (search `type … = \| { provider:` patterns) | `as const` providers + exhaustive `switch` narrowing |
| `src/idp/error-classifier.ts` (new) | pure `(httpStatus, providerErrorCode) → ErrorClass` | `packages/api` status-machine classifiers; `withResilience` error filter (`src/services/resilience.ts`) | closed-enum return; exhaustive table; no side effects |
| `src/scopes/slack-deprovision-scopes.ts` (new) | `SLACK_DEPROVISION_SCOPES = [...] as const` | `src/scopes/google-workspace-deprovision-scopes.ts` `[P76]` (Plan 76-03) | typed-const + `as const` (Phase 70 D-02 pattern) |

## Adapters (packages/integrations/src/adapters)

| Phase 77 file | Role | Closest analog | Pattern to copy |
|---|---|---|---|
| `google-workspace-adapter.ts` (extend) | `implements Deprovisionable`; suspend/revoke(×2 sub-actions)/verify/describeImpact | its own `listAllDirectoryUsers` (lines 224–272) | `fetchWithTimeout` + `withResilience({ provider:'google-workspace', retryAttempts })` + `do/while` pagination + `Bearer` auth |
| `slack-adapter.ts` (extend) | `implements Deprovisionable`; SCIM (raw fetch + org-grid token) + `admin.users.session.invalidate` + verify/describeImpact | its own `postMessage` (lines 260–303) for web-API; `exchangeCodeForTokens` for raw fetch | `withResilience({ provider:'slack' })`; SCIM = raw `fetchWithTimeout` w/ org token + `application/scim+json` |
| `register-all.ts` (extend) | register GWS + Slack as Deprovisionable | existing `registerAllAdapters()` body | call `registerDeprovisionableAdapter('GOOGLE_WORKSPACE'|'SLACK', adapter)` `[P76]` |

## DB schema (packages/db/prisma/schema)

| Phase 77 change | Role | Closest analog | Pattern |
|---|---|---|---|
| `idp-deprovisioning.prisma` (extend) `[P76]` | append `MANUAL_COMPLETED` to step status enum; add `errorClass`, `manualOverride*` cols + `ErrorClass` + `ManualOverrideCategory` enums | the Phase 76 file itself (Plan 76-02) + `WorkflowRun.overrideMetadata` precedent | all additive nullable; generate migration; manual multi-region apply (autonomous:false) |

## tRPC + server routes (packages/api, apps/api)

| Phase 77 file | Role | Closest analog | Pattern |
|---|---|---|---|
| `packages/api/src/routers/deprovisioning.ts` (extend) `[P76]` | `describeImpact` query, `overrideStepFailure`, `enableProviderForOrg`, `connectSlackOrgGrid` | `routers/workflow/workflow-execution.ts` `overrideBlockingTask` | `requirePermission({ idp:['override_step_failure'] })` + `$transaction(JSONB + AuditLog + status + recompute)` |
| `packages/api/src/services/idp-impact-preview.ts` (new) | cached describeImpact orchestration | `services/cache.ts` `cached(key, ttl, fn)` consumers | `cacheKey('idp','preview',provider,id)`; `requirePermission` BEFORE `cached`; `invalidate` for refresh |
| `apps/api/src/routes/idp-deprovisioning.ts` (new) | QStash `POST /idp-deprovisioning/_step-runner` | `apps/api/src/routes/google-workspace.ts` / `ksef.ts` | `guardQStashRequest` → `withQueueObservability` → Zod body → adapter call → step update + audit + `recomputeRunStatus`; register in `scripts/check-webhook-routes.mjs` |
| `packages/api/src/root.ts` | router registration | existing `workflow`/`integration` entries | add/confirm `deprovisioning` namespace |

## Auth (packages/auth)

| Phase 77 change | Role | Closest analog | Pattern |
|---|---|---|---|
| `src/permissions.ts` | add resource `idp: ['override_step_failure']` | `workflow: [..., 'override_blocking_task']` line | append to `accessControlStatement` |
| `src/roles.ts` | grant to OWNER (`allPermissions`) + ADMIN (explicit) | `allPermissions` map + `admin: ac.newRole({...})` | mirror `workflow` grant placement |

## Feature flags (packages/feature-flags)

| Phase 77 change | Role | Closest analog | Pattern |
|---|---|---|---|
| `src/flags-core.ts` | 2 flag defs `idp-deprovisioning-gws/-slack` | `module.classification-engine` def | `category:'module'`, `default:false`, owner |
| `src/signoff-registry-flags.json` | 2 PENDING entries | existing PENDING entries | `{ status:'PENDING' }`; gated by `assertFlagSignoffsOrExit` + `FLAG_SIGNOFF_BYPASS=local` |

## UI (apps/web-vite) — Page→Container→Hook→Component

| Phase 77 file (new) | Role | Closest analog | Pattern |
|---|---|---|---|
| `src/components/idp/deprovisioning-run-view*.tsx` + `hooks/use-deprovisioning-run.ts` | saga run/step view: LIKELY_GONE, override button+modal, badge, refresh | `components/workflows/*` run header + `hooks/use-run-header.ts` | container owns loading/empty/error; hook = only tRPC boundary |
| `src/components/offboarding/override-badge.tsx` (reuse/extend) | permanent override badge | itself (already ported) | Badge + Tooltip; category icon |
| `src/components/settings/slack-org-grid-card*.tsx` + hook | second Slack connection card | `components/integrations/google-workspace-provider-section*` + hook | ProviderConnectionCardContainer pattern |
| `src/components/settings/idp-deprovisioning-toggle*.tsx` + hook | per-provider enable table | `components/settings/feature-flags-tab.tsx` (Table) + a mutating settings container | Table + per-row toggle bound to `Setting.idpDeprovisioningEnabled.{provider}` |
| message catalogs `messages|i18n` (en/de/pl/ar) | i18n keys | existing `Settings.integrations.*` keys | parity across 4 locales incl. RTL ar |

## Cross-cutting CI guards Phase 77 must satisfy

- `scripts/check-webhook-routes.mjs` — new QStash route entry.
- `lint:scopes` (Phase 76 D-15 `[P76]`) — Slack scopes traced to `SLACK_DEPROVISION_SCOPES` const.
- `pnpm check:web-vite-data-layer` + `check:web-vite-dialog-pattern` — UI layering + Dialog body/footer.
- `pnpm lint:schema`, `lint:logs`, `i18n:parity`, `pnpm typecheck` (tsc).

## PATTERN MAPPING COMPLETE
