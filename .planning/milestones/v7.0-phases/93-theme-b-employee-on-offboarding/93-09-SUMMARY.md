# Plan 93-09 Summary — web-vite employee on/offboarding UI

**Wave:** 4 · **Status:** complete

## What shipped

- **Worker-keyed deprovisioning trigger** (`use-start-deprovisioning.ts` + `deprovisioning-trigger.tsx`): a `workerId?` path passes the worker straight through to `startDeprovisioningRun({ subjectType:'EMPLOYEE', workerId })` (no server resolver, `assignmentId` stays null); the hook stays the sole tRPC boundary. `DeprovisioningTriggerWired` gains `workerId` + `disabledReason` — the employee branch skips the assignment guard, gates the button on `disabledReason`, and shows no impact-preview panel (the confirm dialog's description carries the warning). Contractor paths byte-identical.
- **Employee lifecycle surface** (strict Page → Container → Hook → Component):
  - `use-employee-lifecycle.ts` — sole tRPC boundary: `employeeLifecycle.get` (displayName / employmentStatus / **terminatedAt**) + the four mutations (start on/offboard, generateCert, recordTermination) with toasts + translated errors.
  - `employee-lifecycle-panel.tsx` — presentational: on/offboard actions, started-run links to the reused subject-agnostic workflow detail (`workflows/:id`), a cert-type picker + generate/download, a **Record Termination** date action, and the worker-keyed IdP trigger **gated disabled until `terminatedAt` is set** (server re-runs the 14-day cooldown regardless). AnimateIn entrance; Input/Label/Badge/Button; WCAG labels + section headings + roles.
  - `employee-lifecycle-container.tsx` — calls the hook; loading (skeleton) / error (retry) section states; empty (no runs) handled in the panel.
  - `pages/dashboard/employees/lifecycle.tsx` — thin composer: `useFlag('module.workforce-employees')` gate + Suspense, NO tRPC. Routed at `employees/:workerId/lifecycle`.
- **Backend support**: added an `employeeLifecycle.get({ workerId })` read query (HR-RBAC `employee:read`, flag-gated, tenant-scoped) so the hook can surface `terminatedAt` — no prior query returned it.
- **i18n**: new `EmployeeLifecycle` namespace at parity across en/de/pl/ar with real de/pl translations (ar machine-acceptable pending native review — recorded post-merge). Cert adviser-verify disclaimer kept out of messages (locked const).

## Verification

- `pnpm --filter @contractor-ops/web-vite exec tsc --noEmit` → green; `pnpm typecheck --filter=@contractor-ops/api` → green.
- `pnpm check:web-vite-data-layer` + `pnpm check:web-vite-dialog-pattern` → OK.
- `pnpm i18n:parity` → OK (en covered in de/pl/ar; en-US fallback-aware); `pnpm lint:i18n-casts` → 0 violations.
- The IdP trigger is disabled (with a "record a termination date" reason) until `terminatedAt` is set, actionable after — cooldown stays server-enforced.

## Deferred (post-merge)

Arabic strings are machine-acceptable pending a native-speaker review pass.
