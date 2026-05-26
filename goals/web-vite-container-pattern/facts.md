# Facts — web-vite container pattern enforcement

## Scope

- Audit covers every `.tsx` file under `apps/web-vite/src/pages/**` (dashboard, portal, auth, legal, admin).
- Audit covers every `.tsx` file under `apps/web-vite/src/components/**` that is not already a `*-container.tsx` or a hook under `components/{domain}/hooks/`.
- No code outside `apps/web-vite/` is changed by this goal.
- Pattern reference is `apps/web-vite/ARCHITECTURE.md`; this goal applies it, it does not redefine it.

## Layering rules (binding)

- Each page is a thin shell composing one or more `*Container` components plus optional `Suspense` with a section-appropriate fallback.
- The Suspense fallback preserves current UX: skeleton rows for tables, shimmer cards for lists, layout-stable placeholders for forms — not a generic full-page spinner. `PageLoadingSpinner` is only used where the page already used it before the refactor.
- A page may import from `components/**` only paths matching `*-container.tsx`, `page-loading-spinner`, or a `*-skeleton.tsx` / shimmer fallback colocated with the container.
- A page does not call `useTRPC`, `useQuery`, `useMutation`, `useSuspenseQuery`, `useQueryClient`, `useTranslations`, `useParams`, `useSearchParams`, `usePermissions`, `useFlag`, or render `<Navigate />`.
- A container calls domain hooks from `components/{domain}/hooks/use-*.ts`; it does not call `useTRPC` or React Query hooks directly.
- A presentational component receives props only; it does not call `useTRPC` or React Query hooks at runtime (`import type` from `@tanstack/react-query` is allowed).
- A domain hook in `components/{domain}/hooks/use-*.ts` is the only place that touches `useTRPC` / React Query for that section.
- A page may have 1 container or many — the count is driven by sections/tabs on the page, not by a fixed quota.
- A multi-section page (detail screens, tabs) composes one container per section; shared entity reads are extracted into a `use-{entity}-query.ts` helper.

## Hook contracts

- A domain hook returns a props bag plus boolean flags (e.g. `isLoading`, `showEmptyState`, `toolbarProps`, `tableProps`); it does not return raw React Query objects.
- Business logic (filter derivation, bulk handlers, mutation orchestration, toast wiring, invalidation) lives in the hook, not in the container or component.
- A hook owns its own toast/notification side-effects; the container is JSX-only wiring.

## Test contracts

- Every new or modified hook under `apps/web-vite/src/components/**/hooks/use-*.ts` has a colocated vitest spec covering: loading, empty, error, success.
- Mutations additionally cover: optimistic state (when applicable), invalidation calls, and toast emission.
- Specs use `@testing-library/react` + a tRPC/React Query test harness (existing test-utils under `apps/web-vite/src/test-utils/`).
- A hook spec runs in <1s and does not hit a real network or DB.
- Presentational components do not get new tests added by this goal.

## CI / verification

- CI runs at the **end** of the goal, not per agent mid-flight. Agents do the refactor work first; full CI gate is the last step before declaring the goal done.
- Per-domain agents may run scoped sanity checks (`pnpm --filter @contractor-ops/web-vite test` on touched files, local typecheck) but do not block on full repo CI.
- Final gate (run once, after all domains complete):
  - `pnpm --filter @contractor-ops/web-vite check:data-layer` exits 0.
  - `pnpm --filter @contractor-ops/web-vite check:page-shells` exits 0.
  - `pnpm check:web-vite-presentational` exits 0.
  - `pnpm typecheck --filter=@contractor-ops/web-vite` exits 0.
  - `pnpm --filter @contractor-ops/web-vite test` exits 0.
  - A grep for `useTRPC` outside `components/**/hooks/**` and `providers/**` returns no app-source matches.

## Execution model

- Work is split one subagent per domain folder under `apps/web-vite/src/components/` (admin, approvals, auth, billing, classification, consent, contractors, contracts, dashboard, documents, einvoice, equipment, import, integrations, invoices, layout, legal, notifications, ocr, offboarding, onboarding, organization, payments, peppol, portal, reports, search, settings, shared, time, wht, workflow, workflows, zatca).
- **Max 4 agents run in parallel** at any time. Main thread maintains a queue of remaining domains and dispatches a new agent each time a slot frees.
- **Agents do not stop early.** If a domain needs a cross-domain change (shared hook, shared component, router config), the agent records the dependency in its summary and completes everything it can in-scope; the dependency is collected for a follow-up pass, not a halt.
- After all domain agents complete, main thread spawns a **leftover-audit agent** in its own context. That agent re-runs the checks listed under "CI / verification" plus a fresh sweep for missed violators, mis-located hooks, untested hooks, and unresolved cross-domain dependencies surfaced earlier. Findings dispatch a final round of fix agents (also capped at 4 parallel).
- Each subagent owns: audit → hook extraction → container creation/refactor → page-shell cleanup → tests → scoped sanity checks.
- Main thread does not edit web-vite source files; main thread only orchestrates agents, reads agent summaries, dispatches the leftover-audit, and runs the final CI gate.
- Each subagent produces atomic commits scoped to its domain (no cross-domain edits in a single commit).
- Agent outputs are caveman-compressed summaries; main thread does not re-do the agent's discovery.

## Done condition (per domain)

- All pages in scope use the container pattern (verified by `check:page-shells`).
- All hooks in the domain have passing vitest specs covering loading/empty/error/success.
- All CI commands listed under "CI / verification" pass.
- No `useTRPC` / React Query calls remain outside `components/**/hooks/**`.
- Each commit message follows Conventional Commits and references the domain (e.g. `refactor(web-vite/contractors): extract list logic to hook`).

## Out of scope

- Visual redesign or copy changes; refactor preserves rendered UI.
- Changes to tRPC routers, Prisma schema, or any `packages/*` package.
- New features, new routes, or new domain folders.
- Tests for presentational components, pages, or already-tested hooks (unless their public API changed).
- Storybook, e2e (Playwright), or visual regression work.
- `apps/web` (Next.js) — this goal is `apps/web-vite` only.
