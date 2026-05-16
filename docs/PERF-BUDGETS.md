# Performance Budgets

**Owner:** apps/web maintainers
**Last reviewed:** 2026-05-16 (Phase C.6.a, production-hardening goal)
**Tooling:** `@next/bundle-analyzer` (dev) + `size-limit` + `@size-limit/file` (CI gate)

This document publishes the per-route JS/CSS budgets enforced for `apps/web` and
the process for measuring + revising them. Budgets are an early-warning system:
breaching them blocks PR merge until either the regression is fixed or the
budget is bumped via a reviewed PR.

---

## Budgets

| Surface                                  | Gzipped JS | Gzipped CSS | Notes                                      |
| ---------------------------------------- | ---------- | ----------- | ------------------------------------------ |
| `/dashboard`                             | ≤ 250 KB   | ≤ 80 KB     | Highest-traffic authenticated route        |
| Other top-10 dashboard routes            | ≤ 300 KB   | n/a         | contracts, invoices, contractors, etc.     |
| `framework-*.js` chunk (react/next core) | ≤ 200 KB   | n/a         | React 19 + Next 16 runtime                 |
| `main-app-*.js` chunk (app shell)        | ≤ 300 KB   | n/a         | Shared client runtime across the dashboard |

The top-10 routes that share the 300 KB JS budget are the ones already tracked
by the C.4 axe-core a11y gate and the C.5 error/loading boundary coverage:

`/dashboard`, `/contractors`, `/contracts`, `/invoices`, `/payments`,
`/approvals`, `/equipment`, `/workflows`, `/settings`, `/admin`.

Routes outside the top-10 are not gated by default — add them to
`apps/web/.size-limit.json` if traffic data shows they become hot.

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
matcher exceeds its limit. Each entry uses glob paths against the Next.js 15
build output under `apps/web/.next/static/chunks/**`.

---

## Process

1. **Headroom on initial values.** The initial limits (250/300 KB) are set at
   roughly current baseline + 15 % so the first CI run is green. Once the first
   green run lands, tighten each limit to baseline + 5 % so future regressions
   surface within one PR.
2. **Bumping a budget** requires a PR with a one-paragraph justification
   covering: (a) which dependency or feature drove the increase, (b) the user
   impact (LCP / TTI estimate), (c) why the increase is unavoidable. Maintainer
   approval required — do not auto-merge budget bumps.
3. **Tightening a budget** can land in the same PR as the optimisation that
   freed up space (e.g. a dynamic-import or dependency removal).
4. **Best-guess globs.** The initial path matchers in `.size-limit.json` are
   based on Next.js 15 conventions. After the first green CI run, replace any
   glob that does not match real chunks (visible in the run's actual byte
   accounting) with the exact path printed by `size-limit`.

---

## Cross-references

- `.github/workflows/ci.yml` → `bundle-size` job (Phase C.6.a)
- `apps/web/.size-limit.json` → per-entry budgets
- `apps/web/next.config.ts` → `withBundleAnalyzer` wrap (ANALYZE=true)
- `goals/production-hardening/facts.md` → Phase C.6
- `docs/PRODUCTION-CHECKLIST.md` → C.6 row
