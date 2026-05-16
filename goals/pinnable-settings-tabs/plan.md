# Plan — Pinnable Settings Tabs

## Solution approach

Introduce a generic per-user "pinned view" mechanism backed by a new Prisma model `UserPinnedView (kind, key)`. Surface it through two tRPC procedures (`user.pins.list`, `user.pins.toggle`) using the existing `authedProcedure` (no tenant context required). On the settings page, render a `frontend-design`-built pin button next to every `TabsTrigger`. In the sidebar's `system` group, render pinned entries dynamically **below** the `Settings` nav item (replacing the hardcoded `integrations` entry in `navigationGroups`). New users are seeded with `integrations` pinned via a Better Auth `databaseHooks.user.create.after` hook — no migration for existing data because there are no production users yet.

## Ordered steps

### Step 1 — Prisma model

- Edit `packages/db/prisma/schema/auth.prisma`:
  - Add `UserPinnedView` model:
    ```prisma
    model UserPinnedView {
      id        String   @id @default(cuid())
      userId    String
      kind      String
      key       String
      pinnedAt  DateTime @default(now())

      user User @relation(fields: [userId], references: [id], onDelete: Cascade)

      @@unique([userId, kind, key])
      @@index([userId, kind])
    }
    ```
  - Add back-relation on `User`: `pinnedViews UserPinnedView[]`
- Run:
  ```bash
  pnpm --filter @contractor-ops/db prisma:format
  pnpm --filter @contractor-ops/db prisma:generate
  pnpm --filter @contractor-ops/db prisma:migrate-dev -- --name add_user_pinned_view
  ```
- Verification: `pnpm --filter @contractor-ops/db typecheck` passes; generated Prisma client includes `UserPinnedView`; migration SQL diff inspected.

### Step 2 — Default pin via Better Auth signup hook

- Edit `packages/auth/src/config.ts`:
  - Extend `databaseHooks` with:
    ```ts
    user: {
      create: {
        after: async user => {
          await prisma.userPinnedView.create({
            data: { userId: user.id, kind: 'settings-tab', key: 'integrations' },
          }).catch(err => {
            log.warn({ event: 'auth.signup.default_pin_failed', userId: user.id, err }, 'failed to seed default pinned view');
          });
        },
      },
    },
    ```
  - Failure is logged but non-fatal — signup must not break if the pin write fails.
- Verification:
  - Unit test in `packages/auth/src/__tests__/config.test.ts` (or new file): mock `prisma.userPinnedView.create`, invoke the hook, assert payload matches.
  - Manual: trigger a fresh signup in dev, query `select * from "UserPinnedView" where "userId" = '<new>';` and confirm one `integrations` row exists.

### Step 3 — tRPC `user.pins` sub-router

- New file `packages/api/src/routers/core/user-pins.ts`:
  ```ts
  import { z } from 'zod';
  import { authedProcedure } from '../../middleware/auth';
  import { router } from '../../init';

  const pinInput = z.object({
    kind: z.literal('settings-tab'),         // expand union later when other surfaces pinnable
    key: z.string().min(1).max(64),
  });

  export const userPinsRouter = router({
    list: authedProcedure
      .input(z.object({ kind: z.literal('settings-tab') }).optional())
      .query(async ({ ctx, input }) => {
        return ctx.db.userPinnedView.findMany({
          where: { userId: ctx.user.id, ...(input?.kind ? { kind: input.kind } : {}) },
          orderBy: { pinnedAt: 'asc' },
          select: { kind: true, key: true, pinnedAt: true },
        });
      }),
    toggle: authedProcedure.input(pinInput).mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.userPinnedView.findUnique({
        where: { userId_kind_key: { userId: ctx.user.id, kind: input.kind, key: input.key } },
        select: { id: true },
      });
      if (existing) {
        await ctx.db.userPinnedView.delete({ where: { id: existing.id } });
        return { pinned: false };
      }
      await ctx.db.userPinnedView.create({
        data: { userId: ctx.user.id, kind: input.kind, key: input.key },
      });
      return { pinned: true };
    }),
  });
  ```
- Edit `packages/api/src/routers/core/user.ts`: merge new sub-router as a property of `userRouter`, OR keep separate and mount under `user.pins` in `root.ts`. Pick the property-merge form to keep one `user.*` namespace:
  ```ts
  export const userRouter = router({
    // ...existing procedures
    pins: userPinsRouter,
  });
  ```
- Edit `packages/api/src/routers/core/index.ts` if a new export needed.
- Verification:
  - New tests in `packages/api/src/routers/__tests__/user-pins.test.ts`:
    - `list` returns only the caller's pins.
    - `toggle` creates when missing, deletes when present, is idempotent.
    - `authedProcedure` rejects unauthenticated callers.
  - `pnpm --filter @contractor-ops/api typecheck` passes.
  - `pnpm --filter @contractor-ops/api test -- user-pins` passes.

### Step 4 — Settings tab registry

- New file `apps/web/src/lib/settings-tabs.ts`:
  ```ts
  import type { LucideIcon } from 'lucide-react';
  import { Bell, Building2, FileLock2, Key, Plug, Receipt, ScrollText, ShieldCheck, Users } from 'lucide-react';
  import type { FlagKey } from '@contractor-ops/feature-flags';
  import type { LeafKeysOf } from '@/types/next-intl';
  import type messages from '../../messages/en.json';

  export type SettingsTabKey =
    | 'general' | 'approvals' | 'notifications' | 'integrations'
    | 'billing' | 'audit-log' | 'privacy' | 'api-keys' | 'members';

  export interface SettingsTabDef {
    key: SettingsTabKey;
    i18nKey: LeafKeysOf<typeof messages.Settings.tabs>;
    icon: LucideIcon;
    permission: { resource: string; actions: string[] } | null;
  }

  export const SETTINGS_TABS: readonly SettingsTabDef[] = [
    { key: 'general',       i18nKey: 'general',      icon: Building2,   permission: null },
    { key: 'approvals',     i18nKey: 'approvals',    icon: ShieldCheck, permission: null },
    { key: 'notifications', i18nKey: 'notifications',icon: Bell,        permission: null },
    { key: 'integrations',  i18nKey: 'integrations', icon: Plug,        permission: { resource: 'organization', actions: ['update'] } },
    { key: 'billing',       i18nKey: 'billing',      icon: Receipt,     permission: { resource: 'organization', actions: ['update'] } },
    { key: 'audit-log',     i18nKey: 'auditLog',     icon: ScrollText,  permission: { resource: 'settings',     actions: ['read'] } },
    { key: 'privacy',       i18nKey: 'privacy',      icon: FileLock2,   permission: null },
    { key: 'api-keys',      i18nKey: 'apiKeys',      icon: Key,         permission: { resource: 'organization', actions: ['update'] } },
    { key: 'members',       i18nKey: 'members',      icon: Users,       permission: null },
  ] as const;
  ```
- Verification: import resolves; icon choices reviewed in the next step's UI work.

### Step 5 — Pin toggle UI on settings tabs (frontend-design plugin)

- Use the `frontend-design` plugin to design the pin button component. Constraints handed to the plugin:
  - Pinned state: filled `Pin` icon, always visible.
  - Unpinned state: outline `PinOff` (or muted `Pin`), shown only on hover/focus of the tab trigger.
  - Must be an accessible toggle (separate button, `aria-pressed`).
  - Must not navigate to the tab when clicked (must `e.stopPropagation()` / `e.preventDefault()` on the trigger's pointer event).
  - Light + dark theme parity.
- New file `apps/web/src/components/settings/pin-tab-button.tsx`:
  - Props: `tabKey: SettingsTabKey`, `pinned: boolean`, `onToggle: () => void`, `disabled?: boolean`.
  - Optimistic state managed via TanStack Query `useMutation` with `onMutate` setting query data, `onError` reverting + showing `toast.error(t('pin.error'))`.
  - Uses translations: `t('pin.pin', { tab })` / `t('pin.unpin', { tab })` for `aria-label` and tooltip.
- Edit `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx`:
  - Read pins via `trpc.user.pins.list.useQuery({ kind: 'settings-tab' })`.
  - For each `<TabsTrigger>` render the existing label PLUS `<PinTabButton tabKey="..." pinned={isPinned(key)} onToggle={...} />`.
  - Replace the hand-written list of `<TabsTrigger>` entries with a `SETTINGS_TABS.map(...)` driven loop so the page and the registry stay in sync.
- Verification:
  - Manual in browser: hover a tab → pin icon appears; click → flips state instantly; reload → state persists.
  - Component test `apps/web/src/components/settings/__tests__/pin-tab-button.test.tsx`: renders both states, fires onToggle, reverts on simulated mutation failure.
  - Network tab confirms only one POST per click.
  - Storybook entry under `apps/web/src/components/settings/__stories__/pin-tab-button.stories.tsx` if Storybook is used (check repo first; if absent, skip).

### Step 6 — Sidebar rendering of pinned tabs

- Edit `apps/web/src/lib/navigation.ts`:
  - Remove the hardcoded `integrations` entry from `system.items`.
  - System group items become: `[notifications, settings]`.
- Edit `apps/web/src/components/layout/nav-items.tsx`:
  - Fetch pins client-side via `trpc.user.pins.list.useQuery({ kind: 'settings-tab' })` (already a client component).
  - Inside the `system` group render: existing items first, then a thin divider, then a `.map()` over the user's settings-tab pins:
    - Look up `SETTINGS_TABS` for icon + i18n key + permission.
    - Filter out entries whose permission the user lacks (`can(p.resource, p.actions)`).
    - Render as `<SidebarMenuItem>` with a distinct className (e.g. `data-pinned="true"` + Tailwind classes for accent border-left or muted background) so pinned entries look slightly different from canonical nav items. Final styling produced via `frontend-design`.
    - `href` = `/settings?tab=<key>`.
  - Extend `NAV_ACTIVE_OVERRIDES.settings` so the parent Settings entry is **not** marked active when the URL `?tab=<x>` corresponds to a *pinned* tab (the pinned entry owns active state in that case).
  - Add an active-state check for each rendered pinned entry: `pathname === '/settings' && settingsTabFromSearch(searchParams) === pinnedKey`.
- Verification:
  - Manual: pin a tab → it appears below Settings in sidebar; click it → navigates to `/settings?tab=<x>`, that pinned entry highlights, parent Settings does NOT highlight.
  - Unpin → entry disappears.
  - With a non-admin role, pinning `integrations` keeps the DB row but hides the sidebar entry.
  - Existing test `apps/web/src/components/layout/__tests__/sidebar.test.tsx` updated; new test `nav-items.test.ts` covers pinned-entry rendering, permission filter, active-state ownership.

### Step 7 — Translations

- Edit `apps/web/messages/en.json` (add under `Settings`):
  ```json
  "pin": {
    "pin": "Pin {tab} to sidebar",
    "unpin": "Unpin {tab} from sidebar",
    "error": "Couldn't update your pinned tabs. Please retry."
  }
  ```
- Mirror the keys in `de.json`, `pl.json`, `ar.json` (translations produced via existing localisation workflow or marked TODO with English fallback if that is the repo's convention — check `messages/__tests__` first).
- Verification: `pnpm --filter web typecheck` passes (next-intl message-key typing).

### Step 8 — Cross-package wiring + final checks

- Bump tRPC client types: rebuild `packages/api` so `apps/web` picks up the new `user.pins` namespace.
- Run:
  ```bash
  pnpm typecheck
  pnpm lint
  pnpm test -- pin
  pnpm --filter @contractor-ops/db prisma:validate
  ```
- Manual smoke test in `apps/web`:
  1. Fresh signup → confirm `integrations` is pinned by default (visible in sidebar and on the settings page).
  2. Toggle pins for multiple tabs → verify insertion order in sidebar.
  3. Permission-revoked tab (e.g. demote to non-admin role) → pinned `integrations` entry hidden but DB row preserved (verify via Prisma Studio or psql).
  4. Mobile viewport (<1024px) → sidebar sheet shows pinned tabs.
  5. Light + dark theme parity for the pin icon.
  6. Optimistic toggle: throttle the network in DevTools, click pin → icon flips immediately; force the request to fail → state reverts and error toast appears.

## Risks & open questions

- **Better Auth hook signature** — `databaseHooks.user.create.after` may pass a different argument shape than `session` hooks; confirm with Better Auth docs (use `ctx7` / `find-docs`) before wiring. If the hook fires before the user row is committed, fall back to the `after` variant or a transactional callback.
- **`UserPinnedView.key` is an unconstrained string** — relying on Zod at the API boundary plus the in-app `SettingsTabKey` union; if a future code path writes raw input, we could end up with orphan keys. Mitigation: keep the Zod enum derived from `SETTINGS_TABS` keys, not a free-form string.
- **Hidden-by-permission pins** — a user who pins `audit-log`, loses the permission, regains it later, will see the pin reappear. Confirmed desired behavior; documented in `facts.md`.
- **Sidebar query coupling** — `nav-items.tsx` runs in a Suspense boundary. The new `useQuery` should render an empty list while loading rather than suspending so the sidebar paint isn't delayed.
- **Default-pin idempotency** — if the signup hook runs twice (Better Auth retry), the `@@unique([userId, kind, key])` constraint converts the duplicate into a P2002 error. Wrap in a try/catch that swallows P2002 specifically.
- **Order stability under clock skew** — `pinnedAt` is server-set via `@default(now())`, so multi-tab pins in quick succession get distinct timestamps. No client-time exposure.
- **Out-of-scope confirmations** — drag-to-reorder, admin/portal settings pinning, command-palette integration, and per-org-scoped pins are deferred. Architecture leaves the door open (generic `kind`, future `sortIndex` column).
