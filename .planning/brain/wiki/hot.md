---
title: Hot cache
type: hot-cache
updated: 2026-06-10
source_commit: 19f747bca80fe58d162d3e8c3967ec553e057151
---

# Hot cache

Discovery shortcuts for agents — not a changelog. History lives in `wiki/log.md` and git.

## web-vite UI layering (current)

| Layer | Where | tRPC? |
|-------|-------|-------|
| Page | `pages/**` — `Suspense` + `*PageContent` (route shell) | No |
| Wired section | `components/{domain}/*.tsx` — calls hook, branches loading/empty/error | No (hooks only) |
| Presentational | `*View` or props-only component in same/sibling file | No |
| Hook | `components/{domain}/hooks/use-*.ts` | **Yes** |

No `*-container.tsx` files under `apps/web-vite/src/`. Verify: `find apps/web-vite/src -name '*-container.tsx'`.

Canonical shape:

```tsx
export function FooView(props: FooProps) { /* JSX only */ }
export function Foo() {
  const state = useFoo();
  if (state.isLoading) return <FooSkeleton />;
  return <FooView {...state} />;
}
```

Tests render `FooView` with stub props; mock `layout/feature-gate` or wired sibling imports — not deleted container paths.

## Gates

```bash
pnpm check:web-vite-data-layer
pnpm check:web-vite-page-shells   # blocks direct tRPC/RQ in pages only
pnpm check:web-vite-presentational
```

## Onboarding import (cross-tool wizard)

| Piece | Path |
|-------|------|
| Route shell | `apps/web-vite/src/pages/dashboard/onboarding-import.tsx` — `OnboardingImportPageContent` |
| Steps | `components/onboarding/*-step.tsx` — wired `*Step` + presentational `*StepView` / siblings (`ConfirmImportStep`, `ConfirmImportStepView`, …); deprecated `*StepContainer` aliases only |
| Hooks | `components/onboarding/hooks/use-onboarding-{people,projects,confirm,progress,source-selection}.ts`; types in `import-wizard.tsx` |
| Dashboard checklist (separate) | `components/onboarding/hooks/use-onboarding-checklist.ts` — not part of import wizard |

**API output shapes** (not flat arrays):

- `fetchPeople` → `{ people, sourceErrors }`
- `fetchProjects` → `{ projects, sourceErrors }` (only `JIRA` / `LINEAR` fetched)
- `startImport` → `{ jobId }`; progress via `getProgress({ jobId })`

## Integration health

- `integration.getHealth` → `scopeCapabilities` (JSONB)
- GWS: `useGoogleWorkspaceProviderSection` → `useIntegrationHealthProviderSection` + `GoogleWorkspaceReconnectBanner` in `google-workspace-provider-section.tsx`
- Shared helper: `integrations/hooks/use-integration-provider-section.ts` (`useIntegrationHealthProviderSection`)

## Reading order

1. [[patterns/web-vite-data-layer]] + `apps/web-vite/ARCHITECTURE.md` (verify both — may drift)
2. [[structure/web-vite-domains]]
3. `semble search` before code edits
