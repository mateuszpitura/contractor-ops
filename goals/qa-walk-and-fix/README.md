# QA walk-and-fix

Playwright orchestrator that walks every route in [`routes.ts`](routes.ts), captures screenshots (flat layout), and writes findings.

## Prerequisites

- Dev servers: web (`3000`), landing (`3001`), cms (`3002`) — or set `QA_WALK_*_URL`
- Seeded DB + `.env`: `QA_ADMIN_*`, `QA_DEFAULT_ORG_ID`, optional `CMS_ADMIN_*`

```bash
pnpm seed:qa   # if not already seeded
```

## Commands

```bash
# Expected surface count (page + modals/tabs per route × full matrix)
pnpm qa:walk:surfaces

# Quick single-page check (en / light / desktop)
pnpm qa:walk -- --smoke --routes=web-contractors-list --run-id=smoke

# Full visual catalog for one route
pnpm qa:walk -- --catalog --routes=web-contractor-detail --locales=en --viewports=desktop --themes=light --run-id=detail

# CI-style: fail on any finding or incomplete coverage
pnpm qa:walk -- --catalog --strict --run-id=ci

# Matrix only (no browser)
pnpm qa:walk -- --dry-run --routes=web-dashboard-home
```

## Output layout

```
findings/2026-05-22-fix01/
  manifest.json      # canonical index + coverage
  REPORT.md
  SUMMARY.md
  en/
    008-web-contractors-list-desktop-light.png
    008-web-contractors-list-desktop-light-modal-filter-sheet.png
  routes/
    web-contractors-list.md
```

Filename pattern: `{index}-{routeId}-{viewport}-{theme}[-{variant}].png` (hyphens only; variant e.g. `modal-filters`, `tab-invoices`, `broken`).

## Modules

| File | Role |
|------|------|
| `walk.ts` | CLI + matrix loop |
| `routes.ts` | Route/surface registry |
| `capture.ts` | Modal/tab screenshots |
| `ui-probe.ts` | Loading/render/layout/i18n gates |
| `auth.ts` | Login + `resolveQaParams` |
| `paths.ts` | Flat path helpers |
| `manifest.ts` / `report.ts` | Artifacts |

Manual triage after a run: use `agent-browser` or IDE browser on PNGs in `findings/<run-id>/`.

## Trigger protocol (`SurfaceSpec.trigger`)

Labels match **English** `apps/web/messages/en.json` (walk runs with `locale=en` for capture). Resolution order in `capture.ts`:

| Prefix | Example | Opens |
|--------|---------|--------|
| *(plain)* | `Add contractor` | `getByRole(button\|tab, { name })` by `kind` |
| `keyboard:` | `keyboard:Meta+K` | Command palette |
| `tab:` | `tab:invoices` | `?tab=invoices` (contractor profile tabs) |
| `menu:` | `menu:Archive` | More actions → menuitem; `menu:open` = menu only |
| `popover:` | `popover:Filters` | Button by accessible name |
| `icon:` | `icon:column-toggle` | SlidersHorizontal column picker (sr-only says "Filters") |
| `row:` | `row:0:Approve` | `tbody tr.n` → button in that row |
| `profile:` | `profile:Start workflow` | Button in profile header bar (not sidebar/tabs) |
| `after-tab:` | `after-tab:workflows:Start workflow` | Navigate tab, then button in tabpanel |

**Lifecycle / seed gotchas**

- `web-contractor-detail`: QA contractor is resolved as **ACTIVE** (`auth.ts`) so profile tabs work.
- TemplatePicker: `profile:Start workflow` (header, ACTIVE/OFFBOARDING) or `after-tab:workflows:Start workflow` — not in default catalog (empty vs list state).
- `menu:Archive` only when `lifecycleStage === ENDED` — do not register as default catalog surface.
- `menu:Mark as inactive` mutates immediately (no dialog) — not a `modal` surface.
- Invoice approve/reject/submit surfaces need matching invoice status in seed.

**Variant filenames:** tabs → `tab-{name}` (e.g. `tab-invoices`); others → `{kind}-{id}`.
