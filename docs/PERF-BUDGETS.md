# Performance Budgets

**Owner:** apps/web maintainers
**Last reviewed:** 2026-05-17 (Phase C.6.b, production-hardening goal)
**Tooling:** `@next/bundle-analyzer` (dev) + `size-limit` + `@size-limit/file` (CI gate)

This document publishes the per-route JS/CSS budgets enforced for `apps/web` and
the process for measuring + revising them. Budgets are an early-warning system:
breaching them blocks PR merge until either the regression is fixed or the
budget is bumped via a reviewed PR.

---

## Budgets

All route bundles share an initial 250 KB ceiling — that is the practical lower
bound that still leaves headroom for the framework client manifest plus any
near-term feature work. The shell budgets stay higher because `main-app` and
`framework` are loaded on every authenticated navigation.

| Surface                                  | Budget (brotli) | Notes                                          |
| ---------------------------------------- | --------------- | ---------------------------------------------- |
| `main-app-*.js` (app shell)              | ≤ 300 KB        | Shared client runtime across the dashboard     |
| `framework-*.js` (react/next runtime)    | ≤ 200 KB        | React 19 + Next 16 core                        |
| `/contractors` route bundle              | ≤ 250 KB        | Heaviest dashboard route (classification flow) |
| `/contracts` route bundle                | ≤ 250 KB        | Contract list + detail + signing modal         |
| `/invoices` route bundle                 | ≤ 250 KB        | Intake, detail, list                           |
| `/payments` route bundle                 | ≤ 250 KB        | Payment runs list                              |
| `/approvals` route bundle                | ≤ 250 KB        | Approval queue                                 |
| `/equipment` route bundle                | ≤ 250 KB        | Asset register                                 |
| `/workflows` route bundle                | ≤ 250 KB        | Templates + runs                               |
| `/settings` route bundle                 | ≤ 250 KB        | All settings sub-pages (tax, integrations, …)  |
| `/admin` route bundle                    | ≤ 250 KB        | Backoffice tools (boe-rate, feature-flags)     |

Note: `/dashboard` was removed because no such route exists in the App Router
tree — the dashboard segment is the `(dashboard)` route group, mounted under
`/[locale]`. Its routes are listed individually above.

---

## Methodology

Initial budgets were set at **measured baseline × 1.20** with a floor of
**250 KB** to keep the ceiling above noise from the framework runtime split.
Measurements were taken from a fresh `pnpm --filter=@contractor-ops/web run
build` against commit `beeadf17` (Phase C.6.b) on 2026-05-17.

Per-route measurements (sum of all `.js` chunks under the route's emitted
chunk directory, gzip -9):

| Route          | Measured (gzip) | × 1.20 | Final budget |
| -------------- | --------------- | ------ | ------------ |
| `/contractors` | 107.1 KB        | 128.5  | 250 KB       |
| `/contracts`   |  40.8 KB        |  49.0  | 250 KB       |
| `/invoices`    |  60.0 KB        |  72.0  | 250 KB       |
| `/payments`    |  24.4 KB        |  29.3  | 250 KB       |
| `/approvals`   |  18.5 KB        |  22.2  | 250 KB       |
| `/equipment`   |  31.4 KB        |  37.7  | 250 KB       |
| `/workflows`   |  39.4 KB        |  47.3  | 250 KB       |
| `/settings`    | 110.3 KB        | 132.4  | 250 KB       |
| `/admin`       |  13.3 KB        |  16.0  | 250 KB       |

`size-limit` reports brotli sizes by default — the green-CI thresholds above
are expressed in brotli (consistent with `size-limit` output), but the
baseline measurements use gzip for parity with most CDN / Sentry tooling. The
two algorithms agree within ~5 % for our chunk profile.

### Next.js 16 chunk path convention

Next.js 16's webpack emitter preserves App Router segment names literally,
including dynamic-segment brackets and route-group parens:

```
.next/static/chunks/app/[locale]/(dashboard)/<route>/*.js
.next/static/chunks/app/admin/**/*.js
```

`size-limit`'s glob layer (fast-glob) treats `[…]` and `(…)` as meta-characters
— each one must be backslash-escaped in `apps/web/.size-limit.json` paths so
the matcher resolves them as literal directory segments. See the JSON for the
exact form.

---

## Tooling

### Local: `@next/bundle-analyzer`

```bash
ANALYZE=true pnpm --filter=@contractor-ops/web run build
```

Writes `.next/analyze/{client,nodejs,edge}.html` — open in a browser to inspect
chunk composition. Useful for identifying which dependency pulled a route over
budget.

### CI: `size-limit`

The `bundle-size` job in `.github/workflows/ci.yml` runs:

```bash
pnpm --filter=@contractor-ops/web run build
pnpm --filter=@contractor-ops/web exec size-limit
```

`size-limit` reads `apps/web/.size-limit.json` and fails the job if any path
matcher exceeds its limit.

---

## Process

1. **Headroom on initial values.** The current 250 KB ceiling is intentionally
   loose — most routes are 5×–10× below it. Once the bundle-size CI job has a
   stable green run, tighten each route to its individual measured baseline +
   ~25 % so regressions surface within one PR.
2. **Bumping a budget** requires a PR with a one-paragraph justification
   covering: (a) which dependency or feature drove the increase, (b) the user
   impact (LCP / TTI estimate), (c) why the increase is unavoidable. Maintainer
   approval required — do not auto-merge budget bumps.
3. **Tightening a budget** can land in the same PR as the optimisation that
   freed up space (e.g. a dynamic-import or dependency removal).
4. **Re-measuring after a Next.js major.** Next 16 → 17 may rewrite chunk
   layout; regenerate this table from a fresh build, re-escape any new
   meta-characters in the size-limit globs, and commit both files together.

---

## Cross-references

- `.github/workflows/ci.yml` → `bundle-size` job (Phase C.6.a)
- `apps/web/.size-limit.json` → per-entry budgets (escaped App Router globs)
- `apps/web/next.config.ts` → `withBundleAnalyzer` wrap (ANALYZE=true)
- `goals/production-hardening/facts.md` → Phase C.6
- `docs/PRODUCTION-CHECKLIST.md` → C.6 row
