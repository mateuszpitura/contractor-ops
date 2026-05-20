# Portal UI Polish — Plan

## Solution Approach

Polish pass over every portal route, layered top-down: shared shell → shared components → per-route pages → tests. Brand-color wiring lands first because later steps tint against it. New tRPC org-switching endpoints are minimal, reusing the existing portal session signer (`signPortalSessionToken`) and `/api/portal/set-session` cookie-setter. New illustrations are inline monoline SVGs added to the existing Atelier illustration module — no asset pipeline.

## Files & Systems Map

- `apps/web/src/app/[locale]/(portal)/layout.tsx` — shell, brand color CSS var
- `apps/web/src/components/portal/portal-top-bar.tsx` — profile dropdown + brand accents
- `apps/web/src/components/portal/portal-mobile-menu.tsx` — mobile parity
- `apps/web/src/components/portal/org-picker.tsx` — login-time picker polish
- `apps/web/src/app/[locale]/(portal)/portal/{overview,contracts,invoices,documents,time,equipment,payments,settings}/*` — per-route pass
- `apps/web/src/app/[locale]/(portal)/portal/{login,login/verify}/*` — auth flow polish
- `packages/api/src/routers/portal/portal.ts` — `listMyOrgs`, `switchOrg`
- `packages/api/src/services/org-cache.ts` — add `getOrgBranding` (separate cache row)
- `packages/ui/src/components/workbench/empty-state-illustrations.tsx` — new illustrations
- `apps/web/messages/{en,de,pl,ar}.json` — i18n additions
- `apps/web/src/test/setup.ts` (or new `setup-axe.ts`) — `expect.extend(toHaveNoViolations)`

## Ordered Steps

### Step 1 — Brand color plumbing

- Add `getOrgBranding(orgId)` service to `packages/api/src/services/org-cache.ts` with its own Upstash key namespace (`org-branding:<id>`, 5 min TTL). Returns `{ name, logo, brandColor }` where `brandColor` is parsed from `settingsJson.brandColor`.
- Modify `apps/web/src/app/[locale]/(portal)/layout.tsx`:
  - Call new `getOrgBranding` instead of `getOrgMeta` for the portal shell.
  - Wrap children with a `<div>` that sets inline style `--portal-brand: <color>` when present.
  - Fallback: no inline var when missing → existing `--primary` token wins.
- Add Tailwind utility class or update `apps/web/tailwind.config.ts` / portal CSS so portal-scoped utilities can read `var(--portal-brand, var(--primary))`. Easiest: portal layout sets `--primary` directly for its subtree (scoped override).
- **Verification**:
  - `pnpm --filter web typecheck`
  - Unit-test the parser: reject invalid hex/HSL.
  - Manual: set `settingsJson.brandColor` on a seed org, observe accent on `/portal` page.

### Step 2 — Add missing Atelier illustrations

- Inspect `packages/ui/src/components/workbench/empty-state-illustrations.tsx`. Confirm which of these exist: `ContractsIllustration`, `InvoicesIllustration`, `DocumentsIllustration`, `EquipmentIllustration`. Add ones not yet present:
  - `PaymentsIllustration`
  - `TimeEntriesIllustration`
  - `SettingsAuditEmptyIllustration`
- Each is an inline `<svg>` with `stroke="currentColor"`, `strokeWidth={1.5}`, accepts `className`, no fill.
- Export from `packages/ui/src/components/workbench/index.ts`.
- **Verification**:
  - `pnpm --filter @contractor-ops/ui typecheck && pnpm --filter @contractor-ops/ui build`
  - Storybook / `pnpm --filter @contractor-ops/ui test` (if illustration snapshot tests exist; otherwise add minimal render test).

### Step 3 — Per-route polish loop

For each of: `overview`, `contracts`, `contracts/[id]`, `invoices`, `invoices/[id]`, `invoices/submit`, `invoices/submit/success`, `documents`, `time`, `equipment`, `payments`, `settings`, `login`, `login/verify`:

1. Confirm root wrapper uses single `space-y-6`; remove any `mt-6`, `mb-6` siblings that duplicate.
2. Ensure loading state is a skeleton matching the final layout (page-local component when needed).
3. Ensure empty state is `AtelierEmptyState` from `@contractor-ops/ui` with illustration + title + body + (optional) action; never plain text.
4. Replace any literal directional Tailwind classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`) with logical equivalents.
5. Grep for hard-coded UI strings; route through `useTranslations`.
6. Tap target audit: ensure interactive elements at least `h-10 w-10` (or `min-h-10`).
7. Add new i18n keys to `apps/web/messages/{en,de,pl,ar}.json` under `Portal.emptyStates.<surface>`.

- **Verification per surface**:
  - `pnpm --filter web lint -- --files apps/web/src/app/[locale]/(portal)/portal/<surface>/page.tsx`
  - Visit route in dev (`pnpm --filter web dev`) at 360px, 768px, 1280px in `en` and `ar`.
  - Confirm Atelier components render, illustration tints with brand override.

### Step 4 — Top bar & profile dropdown polish

- Modify `apps/web/src/components/portal/portal-top-bar.tsx`:
  - Active nav item gets `bg-accent` tint + brand-tinted underline (`border-[var(--primary)]`).
  - All nav `<a>`s get `aria-current={active ? 'page' : undefined}` and `focus-visible:ring-2 focus-visible:ring-ring`.
  - Org logo stays as a non-link (decorative) — switcher moved into profile dropdown.
- **Verification**: keyboard-only nav tab cycle hits every link; visible focus ring; `aria-current` set on active route.

### Step 5 — Org switcher endpoints + UI

- Add to `packages/api/src/routers/portal/portal.ts`:
  - `listMyOrgs` (procedure: `portalProcedure.query`) returns `[{contractorId, organizationId, orgName, orgLogo}]` for the current session's `userId` (or canonical `email`).
  - `switchOrg` (procedure: `portalProcedure.mutation`) takes `{contractorId, organizationId}`, validates the user owns that contractor row, mints a new session via `signPortalSessionToken`, returns `{token, expiresAt, signature}` — same shape as `selectOrg`.
- Add `useOrgSwitcher` client hook in `apps/web/src/components/portal/` that:
  - Calls `listMyOrgs` query.
  - Calls `switchOrg` mutation → POSTs the result to `/api/portal/set-session` → `router.refresh()`.
- Modify `portal-top-bar.tsx` profile `DropdownMenu`:
  - When `listMyOrgs.data.length > 1`, add a `DropdownMenuSub` (or inline list) with "Switch organization" header.
  - Each org row: logo/initial + name + checkmark on current; click triggers `switchOrg`.
  - During switch, show `Loader2` next to clicked row.
- Modify `portal-mobile-menu.tsx` to surface the same switcher list.
- **Verification**:
  - `pnpm --filter @contractor-ops/api test -- portal`
  - Manual: seed a contractor with 2 org associations; verify switcher appears, switching changes the dashboard org context.

### Step 6 — Brand-tinted illustrations across portal

- Confirm every `AtelierEmptyState` consumed by portal pages renders illustration with `currentColor` and inherits `--primary` (i.e., picks up brand color).
- If `AtelierEmptyState` hard-codes a color, audit `packages/ui/src/components/workbench/empty-state.tsx` and switch to `currentColor`.
- **Verification**: brand-color seed test shows illustrations tint correctly on contracts/invoices/payments pages.

### Step 7 — jest-axe setup + per-route tests

- Install: confirm `jest-axe` is not already present (if missing, add as dev dep to `apps/web`).
  - **Out of scope reminder**: spec says no new npm deps — if `jest-axe` is absent, fall back to manual axe in `axe-core` via a test helper; otherwise add it.
- Create `apps/web/src/test/axe-setup.ts` exporting `setupAxe()` that registers `toHaveNoViolations`. Import from page tests.
- For each portal route page, add a sibling `__tests__/<route>.axe.test.tsx` that:
  - Renders the page within `NextIntlProvider`, `TRPCProvider` mocks
  - Awaits all skeletons to resolve to mock data
  - Runs `axe(container)` and asserts `toHaveNoViolations()`
- **Verification**: `pnpm --filter web test -- axe` → 0 violations.

### Step 8 — RTL & mobile sweep

- Run `rg -n '\b(ml|mr|pl|pr)-[0-9]' apps/web/src/components/portal apps/web/src/app/\[locale\]/\(portal\)` — expect 0 hits after the per-route loop; fix stragglers.
- Run `rg -n '\b(left|right)-[0-9]' apps/web/src/components/portal apps/web/src/app/\[locale\]/\(portal\)` — same.
- Manual sweep at 360 / 390 / 430 / 768 / 1024 / 1280 in `en`, `de`, `pl`, `ar`. Capture any cramping, fix in place.
- **Verification**: dev server walk, no horizontal scroll, icons flip in `ar`.

### Step 9 — Final regression

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm --filter web test -- portal` (existing portal tests still pass)
- `pnpm --filter web test -- axe` (new tests pass)
- Commit per step group with conventional prefixes (`feat(portal-ui)`, `chore(ui)`, `test(portal)`).

## Risks & Open Questions

- **brandColor parsing**: `settingsJson.brandColor` is typed `unknown`; need a strict parser that accepts `#RRGGBB`, `#RGB`, `hsl(...)`. Anything else → fallback. Risk: contrast violations if a tenant picks a light brand color on light surfaces — mitigate by gating contrast in Step 6 audit and possibly clamping luminance in the parser.
- **Cache invalidation**: `getOrgBranding` separate from `getOrgMeta` means the existing branding mutation (`packages/api/src/routers/core/settings.ts` `setBranding`) must invalidate the new key too. Add to the same mutation handler.
- **switchOrg session reuse**: must invalidate the existing portal_session on switch (don't leave two valid sessions). Confirm `signPortalSessionToken` matches the route's expected key derivation.
- **Atelier consumer drift**: if `AtelierEmptyState` is also used outside the portal, changing its color to `currentColor` could shift dashboard visuals. Verify with a grep before changing; if used elsewhere, scope the change via a prop (`tintWithCurrentColor`) defaulting to false outside portal.
- **i18n key explosion**: adding 8+ empty states × 4 locales = ~32 strings. Risk of translation drift; flag for translation pass post-merge.
- **`jest-axe` dependency**: if user enforces "no new deps", confirm whether `jest-axe` is acceptable as a dev-only dep or whether we drop it for a manual `axe-core` wrapper.
