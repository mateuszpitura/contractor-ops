# Facts — Pinnable Settings Tabs

## UI — Pin toggle on settings tabs

- Every `TabsTrigger` on `/settings` renders a pin icon button to the right of the tab label.
- When the tab is **unpinned**, the icon is an outline pin (`PinOff` or `Pin` outline) and only appears on hover or keyboard focus of the tab trigger.
- When the tab is **pinned**, the icon is a filled `Pin` (rotated 45° per Lucide convention) and is always visible regardless of hover/focus.
- The pin icon is a separate accessible toggle button (`role="switch"` or `aria-pressed`), not part of the tab's clickable area — clicking the icon must NOT switch the active tab.
- The pin icon has an accessible label: `"Pin <tab name> to sidebar"` / `"Unpin <tab name> from sidebar"` (i18n-driven).
- Clicking the pin icon performs an optimistic toggle: icon flips state instantly, sidebar updates instantly, network call runs in background.
- On mutation failure: state reverts to prior value and a sonner error toast appears with a retry CTA. No toast on success.
- Pin icon UI is designed using the `frontend-design` plugin for visual polish (matches existing tab/icon vocabulary).

## Sidebar — Rendering pinned tabs

- The hardcoded `integrations` entry in `apps/web/src/lib/navigation.ts` is removed.
- Pinned settings tabs render dynamically inside the existing `system` group, **below** the `settings` entry (i.e. order in the system group is: `notifications`, `settings`, then pinned tabs).
- Each pinned tab in the sidebar shows: `<TabIcon> <translated tab label>`. The icon is a small filled pin glyph prefix (or a pin marker on the right) that visually distinguishes pinned entries from regular nav items. Final styling produced via `frontend-design` plugin.
- Order of pinned entries: insertion order — earliest `pinnedAt` first.
- Clicking a pinned tab navigates to `/settings?tab=<key>`.
- The active-state logic in `nav-items.tsx` highlights the matching pinned entry when `pathname === '/settings'` and `?tab=<key>` matches.
- When a pinned tab corresponds to a permission-gated tab (e.g. `integrations`, `billing`, `audit-log`, `api-keys`) and the current user lacks the required permission, that pinned entry is hidden from the sidebar (but the DB row stays).
- Mobile sheet (<1024px) renders pinned tabs identically to desktop.

## Data — Storage & API

- New Prisma model `UserPinnedView` (generic, future-proof for other pinnable surfaces):
  - `id String @id @default(cuid())`
  - `userId String` — FK → `User.id` with `onDelete: Cascade`
  - `kind String` — enum-like string; first value: `"settings-tab"`
  - `key String` — for `settings-tab` kind: one of `general | approvals | notifications | integrations | billing | audit-log | privacy | api-keys | members`
  - `pinnedAt DateTime @default(now())`
  - `@@unique([userId, kind, key])`
  - `@@index([userId, kind])`
- Pin state is global per user (not per Member / per organization).
- No max pin count.
- No backfill migration — the codebase has no production users yet.
- New users get `integrations` pinned automatically via Better Auth `databaseHooks.user.create.after` in `packages/auth/src/config.ts`: inserts one `UserPinnedView { kind: "settings-tab", key: "integrations" }` row for the newly created user.
- tRPC procedures (under a new `user.pins` router or extending an existing user router):
  - `list` — query: returns the current user's pinned views.
  - `toggle` — mutation: input `{ kind, key }`; upserts (creates if missing, deletes if exists). Returns the resulting state (`pinned: boolean`).
- The settings page reads pins via `trpc.user.pins.list.useQuery({ kind: "settings-tab" })` to drive the icon state.
- The sidebar reads pins via the same query (server component or client query) to render the dynamic entries.
- Both reads use TanStack Query with shared query key — toggle invalidates both consumers.
- All procedures are protected (require authenticated user). Zod input validation on every payload.

## Default tab metadata registry

- A central registry `apps/web/src/lib/settings-tabs.ts` defines every pinnable settings tab:
  - `key` (matches the URL `?tab=<key>` and the `UserPinnedView.key`)
  - `i18nKey` (resolves to `Settings.tabs.<x>`)
  - `icon` (Lucide icon, mirrors the existing sidebar `integrations` icon `Plug` for that one; new icons chosen for other tabs by `frontend-design`)
  - `permission` (mirrors the existing permission gating from `settings/page.tsx`)
- This registry is the single source of truth for: rendering the pin button on each tab, rendering pinned entries in the sidebar, and filtering by permission.

## Scope boundaries

- In scope: the 9 tabs on `/settings` (dashboard route).
- Out of scope (this iteration): admin (`/admin/settings/*`), portal (`/portal/settings`), drag-to-reorder, multi-select pin operations, per-org-scoped pins, command-palette integration.
- Future-extensible: the `UserPinnedView` model accepts other `kind` values (e.g. `resource-list`) so resource-list-level pins can be added later without a schema change.

## Non-functional

- All UI strings flow through `next-intl`; new keys (pin/unpin tooltips, ARIA labels) added to `messages/*.json`.
- Pin icon must be keyboard-reachable (Tab → Space/Enter toggles) and not steal focus from the tab activation.
- Pin icon meets WCAG AA contrast in both pinned and unpinned states, in light and dark themes.
- No console.* in any new code — use `@contractor-ops/logger` for any logging in mutations / hooks.
- Tests: unit tests for the toggle mutation, integration test for the signup hook inserting the default pin, component test for the settings page rendering pin icons and reacting to pin state, sidebar test asserting pinned entries appear after Settings and respect permission gating.
