# Goal — Pinnable Settings Tabs

Each tab on the dashboard `/settings` page gets a pin/unpin toggle icon. Pinned tabs render as shortcut entries in the main sidebar's `system` group (below the `Settings` entry) and the state is persisted globally per user. New users get the `integrations` tab pinned by default. UI built using the `frontend-design` plugin.

## Shared understanding

See [`facts.md`](./facts.md) for the testable facts that define this outcome.

## Execution plan

See [`plan.md`](./plan.md) for the ordered implementation steps and verifications.

## Done condition

- `UserPinnedView` Prisma model exists, migrated, and Prisma client generated.
- `user.pins.list` and `user.pins.toggle` tRPC procedures are deployed under `authedProcedure` and covered by tests.
- Every `TabsTrigger` on `/settings` renders a pin button (designed via `frontend-design`) wired to `user.pins.toggle` with optimistic updates and sonner error toasts.
- The sidebar's `system` group dynamically renders pinned settings tabs below the `Settings` entry, with permission-based filtering, active-state ownership, and distinct pinned styling.
- The hardcoded `integrations` entry has been removed from `navigationGroups`.
- Better Auth `databaseHooks.user.create.after` seeds `{ kind: "settings-tab", key: "integrations" }` for every new user; duplicate inserts are swallowed safely.
- `pnpm typecheck`, `pnpm lint`, and the new pin tests all pass.
- Manual smoke checklist from `plan.md` Step 8 has been walked through.
