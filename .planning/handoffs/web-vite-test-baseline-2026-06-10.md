# web-vite test baseline — 2026-06-10

## Run

```bash
cd apps/web-vite && pnpm vitest run
```

## Metrics (after 3 fix rounds)

| Snapshot | Failed files | Failed tests | Passed tests |
|----------|--------------|--------------|--------------|
| Start of session | 31 | 105 | ~4205 |
| After round 1 | 31 | 105 | 4205 |
| After round 2 | 21 | 55 | 4255 |
| After round 3 | **0** | **0** | **4309** |

Skipped: 24 files / 3 tests (unchanged). Todo: 1.

## Scripts added

| Script | Purpose |
|--------|---------|
| `scripts/fix-web-vite-test-container-mocks.mjs` | Stale `*-container` import paths → wired modules |
| `scripts/fix-web-vite-tests-round1.mjs` | Toast periods, mock export names, View imports |
| `scripts/fix-web-vite-tests-round2.mjs` | Layout mocks, billing View, data-table selection props |
| `scripts/fix-web-vite-tests-round2b.mjs` | User-menu dialog, onboarding projects harness, usage-dashboard rewrite |
| `scripts/fix-web-vite-tests-round3.mjs` | Hook toasts, deriveIsNotFound path, badge tests, directory guards |
| `scripts/fix-web-vite-tests-round3b.mjs` | Intensity router, portal env, peppol toast keys |

## Notable product fixes (not test-only)

- `packages/ui/src/components/atelier/status-pill.tsx` — forwards `className`, `aria-label`, other span attrs
- `apps/web-vite/src/lib/derive-is-not-found.ts` — NOT_FOUND message underscore normalization (earlier)

## Patterns fixed

1. **Wired vs View** — tests importing wired components with presentational props (`TopUpDialog` → `TopUpDialogView`, `UsageDashboard` → mock `useUsageDashboard` + `UsageDashboardView`)
2. **Mock export names** — `WizardDialog` not `ContractorWizardDialog`; `DropZone` not `DropZoneContainer`
3. **Toast i18n** — trailing `.` on success; `useTranslatedError` generic fallback for raw `Error('…')`
4. **Data-table props** — `selectedRows`, `columnVisibility`, `sorting` required after workbench port
5. **Hook return shape drift** — `onProjectsChange(array)` not full `FetchProjectsOutput`; popup-blocked → toast not redirect
6. **Dashboard bento** — `KpiCards` + child widgets need mocks or QueryClient; test uses `dashboardHomeState` + stubbed `KpiCards`
7. **Intensity router** — default workbench except `/` and `/reports/*` (atelier)

## Turbo note

`pnpm test --filter=@contractor-ops/web-vite` still blocked by `@contractor-ops/billing` build (`erasableSyntaxOnly`). Use `cd apps/web-vite && pnpm vitest run` until billing types fixed.

## Update 2026-06-10 (session 2)

- **web-vite:** `pnpm vitest run` in `apps/web-vite` → **4318 passed**, 0 failed.
- **typecheck:** `pnpm typecheck` → **41/41 green**.
- **build:** `pnpm build` → **21/21 green** (CMS `@contractor-ops/ui/marketing` subpath fix).
- **api:** down from ~74 failures → **35 failures** (mock harness: `prismaRaw`, `getIdpAuditLogger`, `vi.clearAllMocks` reseed, status-mapping orgId, workflow Date mocks). Script: `scripts/fix-api-test-mocks.mjs`.
- **db:** `replica.test.ts` — unsupported region fixture `US` → `XX` (US now in `SUPPORTED_REGIONS`).
- **validators:** `retryItemInputSchema` uses `itemKey` not `email`; signoff pending-count guard relaxed.
- **i18n:** added `workflowAssigneeNotMember`, `importJobStateConflict` to en/de/pl/ar.
- **lint:** not run repo-wide (pre-existing debt).
