# Plan — Dropdown Normalization

## Solution approach

Three independent workstreams, sequenced so the riskiest piece (DB enum migration) runs first and downstream code can land against a stable contract.

1. **Schema** — flip remaining lowercase Prisma enum values to `UPPER_SNAKE_CASE`, drop-and-recreate the affected enum types in a single migration (no prod data per `CLAUDE.md` local-only posture).
2. **UI primitive** — extend `packages/ui` Select with explicit `loading` and `error` props, plus a centralized `<SelectValueLabel>` helper that owns the dev-throw / prod-log-fallback behavior for unknown keys.
3. **Call-site sweep** — port every dropdown surface (Select, Combobox, DataTable column filter, Radio/SegmentedControl, native `<select>`) across `apps/web-vite`, `apps/landing`, and non-Payload `apps/cms` Select usages to the new primitive contract, with i18n locale keys mirrored to the enum case.

Audit gates between steps so we know each layer is clean before the next lands.

## Affected systems (verified)

- **Prisma schema**: `packages/db/prisma/schema/*.prisma` — 11 lowercase enum value lines confirmed across 5 enums:
  - `ClassificationAssessmentStatus` (`draft`, `completed`) — `classification.prisma:10`
  - `EconomicDependencyBand` (`safe`, `warning`, `critical`) — `classification.prisma:151`
  - `ValidationStatus` (`valid`, `invalid`, `stale`, `unavailable`) — `tax.prisma:76`
  - `UserRole` (`admin`, `readonly`, plus mixed siblings) — `workflow.prisma:256`
  - Plus any additional matches surfaced by the audit script (Step 1.1).
- **UI Select primitive**: `packages/ui/src/components/shadcn/select.tsx` (base-ui wrapper). Legacy duplicate at `packages/ui/@/components/shadcn/select.tsx` — confirm whether still imported; remove if dead.
- **Web-vite Select call sites**: 49 files under `apps/web-vite/src/components/**/*.tsx` (`grep -lE "<Select(Trigger|Value|Item|Content)?"`).
- **Combobox / Radio / native `<select>`**: 14 files under `apps/web-vite/src/components/**/*.tsx`.
- **DataTable column filters**: 7 toolbar/filters files under `apps/web-vite/src/components/{invoices,contracts,workflows,contractors}/.../data-table-*`.
- **Landing**: dropdown surfaces under `apps/landing/src/components/**/*.tsx` (language switcher + any contact forms; confirm in Step 3.3).
- **CMS**: `apps/cms` — non-Payload-rendered Select usages only (config screens, custom views); Payload field rendering excluded.
- **i18n locales**:
  - `apps/web-vite/messages/{en,de,pl,ar}.json`
  - `apps/landing/src/i18n/locales/{en,de,pl,ar,ar-SA,en-GB}.json`
- **enumKey helper**: `apps/web-vite/src/lib/enum-key.ts` — currently maps `UPPER_SNAKE → camelCase` for i18n lookup. Once locale keys mirror enum case, this helper becomes an identity function and should be deleted; all `tKey(t, enumKey(value))` call sites become `tKey(t, value)`.

## Ordered steps

### Step 1 — DB enum audit + migration

**1.1 Audit script** — add `pnpm db:audit-enum-casing` (Node script) that:
- Parses `packages/db/prisma/schema/*.prisma`.
- Reports every enum value not matching `^[A-Z][A-Z0-9_]*$`.
- Exits non-zero if any found.

Files touched: `packages/db/scripts/audit-enum-casing.ts` (new), `packages/db/package.json`.

**Verify**: `pnpm --filter @contractor-ops/db db:audit-enum-casing` lists the 11 known offenders and exits non-zero.

**1.2 Schema edits** — rewrite the 5 known enums (plus any uncovered by 1.1) so every value is `UPPER_SNAKE_CASE`. Files touched: the `.prisma` files surfaced above.

**Verify**: `pnpm --filter @contractor-ops/db db:audit-enum-casing` exits zero. `pnpm --filter @contractor-ops/db prisma format` clean.

**1.3 Migration** — generate single Prisma migration that drop-and-recreates each affected enum type. Reset local DB or use `prisma migrate dev --name normalize_enum_casing_uppercase`. Update any seed scripts under `packages/db/prisma/seeds/**` that emit the old casing.

**Verify**: `pnpm --filter @contractor-ops/db prisma migrate reset --skip-seed --force` then `prisma migrate dev` clean. Generated client compiles.

**1.4 Codebase fan-out** — `grep -rE "'(draft|completed|safe|warning|critical|valid|invalid|stale|unavailable|admin|readonly)'"` (scoped to enum-typed contexts) across `apps/`, `packages/`, `prisma/seeds/`. Replace string literals only where they reference the migrated enum values (Zod schemas, fixtures, tests, hand-rolled mappings). Skip non-enum domain strings (CSS classes, log levels) by reviewing each match.

**Verify**: `pnpm typecheck` across `@contractor-ops/api`, `@contractor-ops/db`, `@contractor-ops/web-vite`, `@contractor-ops/cron-worker`, `@contractor-ops/portal-api` passes. Affected unit tests updated and green.

### Step 2 — UI Select primitive extension

**2.1 Add `loading` + `error` API** to `packages/ui/src/components/shadcn/select.tsx`:
- `loading?: boolean` — when true, render `<Loader2 className="size-3.5 animate-spin" />` slot inside `SelectTrigger` and apply `data-loading` + `disabled` to the trigger.
- `error?: { message: string }` — when set, render an `AlertCircle` icon with `aria-label={error.message}` and keep trigger disabled.
- States are mutually exclusive: loading > error > resolved.

**2.2 Add `<SelectValueLabel>` helper** in the same module that:
- Accepts `value: string`, `options: ReadonlyArray<{ value: string; label: string }>`.
- Looks up the matching option label.
- If no match:
  - `process.env.NODE_ENV !== 'production'` → throws `Error("[SelectValueLabel] no option for value ${value}; available: ${keys}")`.
  - `production` → calls `@contractor-ops/logger` `error()` with structured context and renders `<span data-fallback="unknown-key" className="text-muted-foreground">{value}</span>`.

**2.3 Tests** — add Vitest unit tests in `packages/ui/src/components/shadcn/__tests__/select.test.tsx` covering: loading trigger render, error trigger render, label rendering with match, dev-throw on miss, prod-log + muted fallback on miss.

**2.4 Storybook / docs** — append usage notes to `packages/ui/README.md` or the package's docs target so call sites see the new contract.

**Verify**: `pnpm --filter @contractor-ops/ui test`, `pnpm --filter @contractor-ops/ui typecheck`.

### Step 3 — i18n key casing migration

**3.1 Codemod for `enumKey()` call sites** — script that:
- Walks `apps/web-vite/src/**/*.{ts,tsx}` and `apps/landing/src/**/*.{ts,tsx}`.
- Replaces `tKey(t, enumKey(X))` and `tDynLoose(t, 'ns', enumKey(X))` with the uppercase-key form (drops the `enumKey` wrapper).
- Records the namespace + key shape rewrites for Step 3.2.

Files touched: `scripts/codemod/migrate-enum-key-casing.ts` (new), then applied across the two app trees.

**3.2 Locale JSON rewrites** — for each surfaced namespace, rename child leaves from camelCase to `UPPER_SNAKE_CASE` matching the enum identifier. Apply consistently across all six locale files. Update only leaves that back enum dropdowns; preserve unrelated translation keys.

Files touched:
- `apps/web-vite/messages/{en,de,pl,ar}.json`
- `apps/landing/src/i18n/locales/{en,de,pl,ar,ar-SA,en-GB}.json`

**3.3 Delete `enumKey` helper** at `apps/web-vite/src/lib/enum-key.ts` (and any landing equivalent) once no call sites remain.

**Verify**: `pnpm --filter @contractor-ops/web-vite test` for any i18n-coverage audit (e.g. `scripts/audit-i18n-code-coverage.ts`). `pnpm --filter @contractor-ops/web-vite typecheck`. Smoke-render at least one badge using each migrated enum (Equipment status, Shipment status, Compliance band, Tax validation, Classification, UserRole).

### Step 4 — Call-site sweep (Select / Combobox / DataTable filter / Radio / native)

**4.1 Static option arrays** — for every constant array feeding a Select (e.g. `CURRENCY_OPTIONS`, `SERVICE_OPTIONS`, `CARRIERS`, `DURATION_OPTIONS`, `CONDITION_FIELDS`, `OPERATORS`), confirm `value` is uppercase. Convert any that aren't (e.g. `'all'` sentinel — keep sentinel but document it as a non-enum special case).

**4.2 Trigger label rendering** — replace every `<SelectValue />` with no children by either:
- Passing the new `<SelectValueLabel value={...} options={...} />` helper, or
- For trivial cases, an explicit lookup expression rendering the label.

This guarantees the trigger always shows the human label, never the raw key.

**4.3 Async dropdowns** — for every Select whose options come from a `useQuery`/`useTRPC` source, replace the existing ad-hoc `Loader2` inside `SelectValue` placeholder with the new `loading={query.isLoading}` and `error={query.error ? { message: ... } : undefined}` props. Known files to touch:
- `apps/web-vite/src/components/integrations/jira-project-mapping-dialog.tsx`
- `apps/web-vite/src/components/integrations/jira-status-mapping-dialog.tsx`
- `apps/web-vite/src/components/integrations/linear-status-mapping-dialog.tsx`
- `apps/web-vite/src/components/integrations/linear-task-config.tsx`
- `apps/web-vite/src/components/integrations/teams-channel-mapping-card.tsx`
- Any other Select consuming `*Query.data` (surface via grep in 4.0 pre-sweep).

**4.4 Combobox / cmdk** — same loading + label rules. Identify shared Combobox wrapper (likely under `packages/ui` or `apps/web-vite/src/components/ui/`), extend it the same way, then sweep call sites.

**4.5 DataTable column filters** — apply uppercase keys + label rendering to the 7 known filter/toolbar files. Filter chip text reads from option label, never the raw value.

**4.6 Radio / SegmentedControl / native `<select>`** — sweep the 14 files. Replace `<select>` with `Select` primitive; convert RadioGroup `value` constants to uppercase and ensure rendered labels use translated text.

**4.7 Landing + CMS** — apply same rules to `apps/landing/src/components/**` dropdown surfaces and any non-Payload Select in `apps/cms`.

**Verify per app**:
- `pnpm --filter @contractor-ops/web-vite typecheck && pnpm --filter @contractor-ops/web-vite test`
- `pnpm --filter @contractor-ops/landing typecheck && pnpm --filter @contractor-ops/landing test`
- `pnpm --filter @contractor-ops/cms typecheck && pnpm --filter @contractor-ops/cms test`
- Manual UAT walk per CLAUDE.md UI rules: open each migrated form with network throttled, confirm spinner-in-trigger + disabled, then resolved label-not-key render. Capture screenshots per major surface.

### Step 5 — Final gates

- `pnpm --filter @contractor-ops/db db:audit-enum-casing` → zero lowercase enum values.
- `pnpm typecheck` repo-wide.
- `pnpm test` repo-wide (scoped per CLAUDE.md memory: never run full web-vite suite unscoped — drive per package).
- `pnpm audit` + `pnpm security:scan` (no new deps expected; sanity check).
- Final UAT sweep + screenshots stored under `goals/dropdown-normalization/evidence/`.

## Risks and open questions

- **Mixed-case enum siblings**: `UserRole` likely has uppercase values mixed with lowercase (`admin`, `readonly`). Audit script in Step 1.1 must enumerate ALL values per enum so we migrate consistently, not just the obviously lowercase ones.
- **Drop-and-recreate ordering**: Prisma's enum drop-and-recreate fails if columns reference the type. Migration SQL must follow Postgres pattern: `ALTER TABLE ... ALTER COLUMN ... TYPE text`, drop enum, recreate enum with new values, cast column back. Local-only posture means we can iterate, but generated migration must be reproducible from clean DB.
- **Seed scripts and fixtures**: any `packages/db/prisma/seeds/**` or test fixtures emitting the old casing break post-migration. Step 1.4 covers code, but seed data needs explicit pass.
- **Public-API / Hono surface**: `apps/public-api` may accept enum strings from external consumers. Confirm whether any payload uses lowercase casing today; document the breaking change for the few enums that move, even though no consumer code lives in this repo.
- **Better Auth / Unleash payloads**: external systems may store enum-typed values (e.g. user roles in session). Check for cached payloads or migration scripts touching auth session data.
- **`enumKey` deletion blast radius**: if any package outside `apps/web-vite` imports `enumKey`, those imports must be migrated first or the file kept as a deprecated identity for one cycle. Step 3.3 must be preceded by a repo-wide `grep -r "enumKey"`.
- **`packages/ui` duplicate**: `packages/ui/@/components/shadcn/select.tsx` looks like a legacy duplicate. Confirm imports before touching the primary; if still referenced, extend both or migrate references first.
- **Storybook / chromatic** (if present): snapshots referencing old labels will diff. Refresh as part of Step 2/4.
- **Sentinel values** (e.g. `'all'`, `'__skip__'`) are non-enum and should remain lowercase / underscored — document the carve-out so the audit doesn't flag them.
