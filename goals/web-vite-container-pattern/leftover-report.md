# Leftover report — web-vite container pattern (2026-05-25)

Audit scope: post-Wave-1 read-only sweep across `apps/web-vite/src/components/{admin,approvals,auth,billing,classification,consent,contractors,contracts,dashboard,documents,einvoice,equipment,import,integrations,invoices,layout,legal,notifications,ocr,offboarding,onboarding,organization,payments,peppol,portal,reports,search,settings,shared,time,workflows,zatca}/`. Empty domains (no source): `workflow/`, `wht/`.

## Static gates

- `check:data-layer`: **PASS** (exit 0)
- `check:page-shells`: **PASS** (exit 0)
- `check:web-vite-presentational`: **PASS** (exit 0)
- `typecheck` (web-vite): **FAIL** (144 `error TS*` lines; **all** in test files under `__tests__/` — pre-existing mock-typing rot, no source-file errors)
- `vitest` (web-vite): **FAIL** — `Test Files  5 failed | 454 passed | 170 skipped (629)` / `Tests  12 failed | 3058 passed (3070)`; documented failures are pre-existing jsdom/base-ui shim rot + mock-shape drift, not Wave-1 regressions

### Typecheck failures (files only — all are tests, not source)

```
src/components/contractors/classification/dashboard/__tests__/market-card.test.tsx
src/components/contractors/classification/drv-clearance/__tests__/a11y.test.tsx
src/components/contractors/contractor-table/__tests__/data-table-bulk-actions.test.tsx
src/components/contracts/contract-detail/__tests__/signing-progress-bar.test.tsx
src/components/integrations/__tests__/attach-doc-dialog.test.tsx
src/components/integrations/__tests__/doc-links-section.test.tsx
src/components/integrations/__tests__/google-workspace-provider-section.test.tsx
src/components/integrations/__tests__/jira-project-mapping-dialog.test.tsx
src/components/integrations/__tests__/jira-provider-section.test.tsx
src/components/integrations/__tests__/jira-status-mapping-dialog.test.tsx
src/components/integrations/__tests__/jira-task-config.test.tsx
src/components/integrations/__tests__/linear-provider-section.test.tsx
src/components/integrations/__tests__/linear-status-mapping-dialog.test.tsx
src/components/integrations/__tests__/teams-channel-mapping-card.test.tsx
src/components/integrations/__tests__/teams-provider-section.test.tsx
src/components/integrations/google-workspace/__tests__/directory-import-wizard.test.tsx
src/components/integrations/google-workspace/__tests__/sync-status-section.test.tsx
src/components/settings/__tests__/api-keys-tab.test.tsx
src/components/settings/__tests__/carrier-credential-form.test.tsx
src/components/settings/__tests__/chain-editor-dialog.test.tsx
src/components/settings/__tests__/invite-dialog.test.tsx
```

## Heuristic findings (grouped by domain)

### useTRPC()/usePortalTRPC() outside hooks/providers

**Zero** real call-site violations. All textual matches outside `**/hooks/**` / `**/providers/**` are inside header-comment doc strings (lines starting with `*` describing the migration). Boundary is clean.

### Raw `UseQueryResult` / `UseMutationResult` returned from hooks (props-bag normalization deferred)

Hooks that still expose a raw RQ object on their return surface. **Same shape as the documented Wave-1 reports deferral** — record as cross-domain, not goal-blocking.

#### `billing/`
- `components/billing/hooks/use-billing.ts:123` → spreads `mutation` (raw `UseMutationResult` properties bleed into return) + appends `checkout` callback.

#### `classification/` (contractors-scoped)
- `components/contractors/classification/hooks/use-drv-clearance.ts:56` → `{ createMutation, updateMutation }` raw.
- `components/contractors/classification/hooks/use-drv-clearance.ts:89` → `{ uploadMutation, upload, isPending }`.
- `components/contractors/classification/hooks/use-classification-disclaimer.ts:33` → `{ ackMutation, acknowledge, isPending }`.
- `components/contractors/classification/hooks/use-classification-dashboard.ts:92` → `{ mutation, exportCsv, isPending }`.

#### `contractors/`
- `components/contractors/hooks/use-ir35-chain.ts:94` → `{ mutation, addParticipant, isPending }`.
- `components/contractors/hooks/use-leitweg-id-inline-selector.ts:32` → `{ query, options }` (raw `UseQueryResult`).
- `components/contractors/hooks/use-classification-documents.ts:58` → `{ mutation, generate, isPending }`.
- `components/contractors/hooks/use-recompute-compliance.ts:62` → `{ mutation, recompute, isPending }`.
- `components/contractors/hooks/use-revalidate-vat.ts:38` → `{ mutation, revalidate, isPending }`.

#### `equipment/`
- `components/equipment/hooks/use-equipment-shipment-form.ts:33` → `{ createMutation, isPending }`.
- `components/equipment/hooks/use-equipment-detail-actions.ts:33,64,129` → multiple raw `{ mutation, …, isPending }` shapes.
- `components/equipment/hooks/use-equipment-detail-actions.ts:106` → `{ approveMutation, rejectMutation }`.
- `components/equipment/hooks/use-equipment-assignment.ts:55` → `{ assignMutation, assign, isPending }`.

#### `legal/`
- `components/legal/hooks/use-legal-privacy-pdf.ts:25` → `{ mutation, isPending }`.

#### `peppol/`
- `components/peppol/hooks/use-peppol.ts:17` → `{ statusQuery, participantQuery }` raw.

#### `reports/` (already documented in Wave-1 summary; recorded here for completeness)
- `components/reports/hooks/use-overdue-invoices-report.ts:74` → `{ …, tableQuery, exportMutation, … }`.
- `components/reports/hooks/use-expiring-contracts-report.ts`, `use-spend-team-report.ts`, `use-spend-contractor-report.ts`, `use-compliance-gaps-report.ts` — same raw-RQ shape; section components destructure `tableQuery.refetch()` / `exportMutation.mutate()` directly.

#### `workflows/`
- `components/workflows/hooks/use-workflow-ui.ts:347` → `{ commentsQuery, addCommentMutation }`.
- `components/workflows/hooks/use-workflow-ui.ts:376,448,467` → `{ connectionQuery, linkedQuery|issuesQuery }`.

### Containers >120 LOC (possible un-extracted view logic)

`wc -l` ≥120 on `*-container.tsx`. **Not** a hard violation — large containers can be legitimate composers. Flagged for inspection, NOT for Wave 3:

| LOC | File |
|---:|---|
| 330 | `components/contractors/engagement-classification-container.tsx` |
| 300 | `components/portal/portal-invoice-detail-container.tsx` |
| 287 | `components/portal/portal-invoices-container.tsx` |
| 277 | `components/portal/portal-contract-detail-container.tsx` |
| 262 | `components/time/time-tracking-container.tsx` |
| 262 | `components/portal/portal-time-container.tsx` |
| 240 | `components/equipment/equipment-list-container.tsx` |
| 187 | `components/settings/settings-index-container.tsx` |
| 178 | `components/approvals/approval-queue-container.tsx` |
| 173 | `components/workflows/workflows-list-container.tsx` |
| 172 | `components/equipment/equipment-detail-container.tsx` |
| 168 | `components/portal/portal-login-verify-container.tsx` |
| 167 | `components/invoices/invoices-list-container.tsx` |
| 166 | `components/invoices/invoice-detail-container.tsx` |
| 151 | `components/contractors/contractor-detail-container.tsx` |
| 144 | `components/portal/portal-documents-container.tsx` |
| 139 | `components/portal/portal-payments-container.tsx` |
| 136 | `components/portal/portal-index-container.tsx` |
| 127 | `components/contractors/contractor-list-container.tsx` |
| 122 | `components/notifications/notification-center-container.tsx` |

### Hooks without colocated `__tests__/use-*.test.{ts,tsx}` (126 of 301 hooks)

Per-domain untested count (any hook whose basename has no matching `use-*.test.*` test file under the same domain — coverage gap, not a goal-blocker):

| domain | untested / total |
|---|---:|
| `admin` | 0/2 |
| `approvals` | 0/4 |
| `auth` | 0/4 |
| `billing` | 0/2 |
| `classification` (top-level) | 0/2 |
| `consent` | 0/1 |
| `contractors` (incl. `classification/` sub) | 29/32 |
| `contracts` | 18/24 |
| `dashboard` | 0/1 |
| `documents` | 0/6 |
| `einvoice` | 0/2 |
| `equipment` | 0/9 |
| `import` | 0/1 |
| `integrations` | 0/16 |
| `invoices` | 28/30 |
| `layout` | 0/11 |
| `legal` | 0/3 |
| `notifications` | 0/2 |
| `ocr` | 0/2 |
| `onboarding` | 0/5 |
| `organization` | 0/10 |
| `payments` | 0/11 |
| `peppol` | 0/1 |
| `portal` | 0/20 |
| `reports` | 0/6 |
| `search` | 0/2 |
| `settings` | 48/55 |
| `time` | 1/5 |
| `workflows` | 1/19 |
| `zatca` | 1/14 |

Biggest gaps: `settings` (48), `invoices` (28), `contractors` (29), `contracts` (18). Wave-1 goal did not mandate hook tests — recorded as future coverage debt.

## Cross-domain follow-ups (page-shell skeleton wiring)

Pages still rendering generic `<PageLoadingSpinner />` where legacy `apps/web` UI used a section skeleton. Distribution across `apps/web-vite/src/pages/`:

- `portal/` — 15 pages
- `dashboard/` — 15 pages (top-level)
- `dashboard/settings/` — 7 pages
- `dashboard/workflows/` — 2 pages
- `dashboard/invoices/` — 2 pages
- `dashboard/contractors/` — 2 pages
- `admin/` — 2 pages

Wave-1 per-agent summaries flagged the following domains for skeleton wiring (page level): `invoices`, `settings`, `onboarding`, `workflows`. The `apps/web-vite` page-shell gate is green (`check:page-shells` PASS), so this is a UX-polish backlog item, not a goal-blocker.

## Pre-existing rot (NOT blocking the goal, recorded for future cleanup)

- **jsdom / base-ui shim gap** affecting `__tests__/` under `layout/`, `time/`, `search/` and the 5 vitest failure files — `getAnimations` / pointer-event shims missing in setup; reproduced as the only 12-test failures in the run.
- **`apps/web-vite/src/test-utils/render-hook.tsx`** missing `infiniteQueryOptions` proxy — known gap noted in Wave-1 dispatch; hooks using infinite queries cannot exercise the canonical harness yet.
- **lint-staged scope** widening commits beyond a single agent's intended files. Confirmed via `git show`:
  - `e8b694f3 refactor(web-vite/layout): split presentational components and add containers` swept `auth/` files (auth agent's work attributed to layout commit).
  - `9b234182 feat(web-vite/import): port import wizard with container + hook split` swept `ocr/` files (ocr agent's work attributed to import commit).
- **144 typecheck errors** confined to `**/__tests__/*.test.tsx` (integrations + settings + contractors/classification + contracts). All mock-typing drift against current router shapes; zero errors in container/hook/page source.

## Decision

**ZERO blocking findings — Wave 3 not needed.**

- Static gates (`data-layer`, `page-shells`, `web-vite-presentational`) all PASS — the container/hook/page boundary is intact.
- No `useTRPC()` / `usePortalTRPC()` call-site leaked outside `**/hooks/**` / `**/providers/**`.
- Typecheck and vitest failures are entirely confined to pre-existing test rot (mock shapes + jsdom shim gaps); container-pattern source compiles and runs.
- Raw-`UseQueryResult` / `UseMutationResult` returns across `billing`, `contractors`, `classification`, `equipment`, `legal`, `peppol`, `reports`, `workflows` are an architectural smell but match the Wave-1 deferred-scope note. Recommend a follow-up "props-bag normalization" phase rather than reopening this goal.
- Hook-test coverage gap (126/301 hooks lack colocated tests, concentrated in `settings`/`contractors`/`invoices`/`contracts`) was out of Wave-1 scope and is a separate testing-debt item.
