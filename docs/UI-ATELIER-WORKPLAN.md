# UI Atelier — Work Plan

Status: Draft — supersedes the codex `UI-ATELIER-ROADMAP.md` proposal.
Owner: TBD.
Target horizon: 4–6 PRs over 2–3 weeks of focused work, then incremental rollout.

---

## 1. Context & strategic decisions

### 1.1 V2 will not be promoted as-is

V2 (`apps/web/src/app/[locale]/(dashboard)/v2/*`) was a layout spike created on **2026-04-11** (commit `7e58cae6`). Substantive work stopped on **2026-04-12** (commit `7e051af0`). Between then and now, V1 received feature work that V2 never absorbed:

| V1 capability | Source | V2 status |
|---|---|---|
| `EInvoiceComplianceWidget` (Phase 47-07) | `ad374796` (2026-04-11) | Missing |
| `TaxObligationsWidget` (Phase 47-07) | `ee0c9b06` (2026-04-11) | Missing |
| `OnboardingChecklist` | pre-existing | Missing |
| `DashboardEmptyState` (zero-data org) | `(dashboard)/page.tsx:27-44` | Missing — zeros render with live pulse, looks broken |
| Suspense + skeleton fallback | `page.tsx:134-159` | Missing — paints blank during fetch |
| `useRtlChartConfig` (Phase 50-07) | `d03cd7cb` (2026-04-12) | Missing in `SpendChartV2` |
| Logical CSS pass for dashboard charts | `48c00b65` | Partial in V2 |

V2 also has independent regressions: 14 hardcoded English strings in `v2/page.tsx`, hardcoded `'pl-PL'` and `'en-US'` locales in `dashboard-primitives.tsx:332` and `v2/page.tsx:77`, mouse-only `TiltCard` (no `(hover: hover)` gate), and an unconditional `atelier-hero-glow` 5s animation.

`v2/contractors/page.tsx` (643 lines vs V1's 160) is a different UX — a 24-card grid, not a table — and bypasses `ContractorDataTable`, `ContractorSidePanel`, `ImportWizardDialog`, `EmptyState`, `PageHeader`. Its stage counts are admittedly wrong on page ≥ 2 (line 431 comment). It is **not** a Workbench-tier reference.

### 1.2 Strategy: extract primitives, don't promote layouts

Keep V1 as the production dashboard. Treat V2 as a primitives source. Apply Atelier visual treatment to V1's existing widget composition. Add the strongest V2 element — the hero spend metric with sparkline — as a new V1 widget, gated on `report:read`.

This preserves V1's correct widget composition, permissions gating, i18n discipline, RTL handling, Suspense boundary, empty state, and compliance widgets. Zero UX risk; pure visual upgrade.

### 1.3 Architectural decisions locked in this plan

1. **Tokens ship as CSS, components ship as TS.** Shared CSS at `packages/ui/src/styles/{tokens,glass,motion,status}.css`, imported by both apps' `globals.css`. Components in `packages/ui/src/components/`. Bundling utility classes into npm packages adds build complexity for no benefit.
2. **Intensity is a context-driven prop.** A leaf primitive consults `useAtelierIntensity()` and self-downgrades (`Sparkline` skips its pulsing dot in `workbench`; `TiltCard` becomes a static card; orbs are skipped). The app shell sets intensity per route.
3. **Status mapping is domain-aware.** A `statusToVariant(domain, status)` mapper, not a global enum. `APPROVED` means different things for invoices, change-requests, and Peppol acks.
4. **No layout replacement for operational pages.** Tables stay tables. Cards-vs-tables is a UX decision, not a tier decision.
5. **Workbench tier has hard performance rules.** No `backdrop-filter` on `<tr>` or any element repeated >20× per page. No `AtelierBackground` orbs. No `atelier-shimmer:hover` or tilt on rows. No more than ~3 `atelier-border-glow` elements per viewport.

### 1.4 Delivery mode

Work commits directly to `main`. No PRs, no feature branches, no review gates. Implications for this plan:

- The "PR N" headings in §4 are **commit groups**, not pull requests. Each group is a small, atomic chain of commits on `main` that is independently revertable.
- Every commit message follows a Conventional Commits style with a meaningful body (the *why*, not the *what*).
- CI runs the full suite on every push (typecheck + lint + unit + Playwright visual + axe-core + Lighthouse). A green push is the merge gate.
- **Visual regression baseline discipline:** without PRs, an unintended visual change becomes the new baseline if a developer auto-accepts it. Rule: every baseline update must be a separate commit titled `test(visual): update baselines for <reason>` so accidental drift is greppable in `git log`.
- Failed CI on `main` is a stop-the-line event. Next commit must be the fix (or a revert), not unrelated work.

---

## 2. V2 disposition

Every file currently under `apps/web/src/app/[locale]/(dashboard)/v2/` plus the CSS layer gets a disposition.

| Path | Disposition | Notes |
|---|---|---|
| `v2/_components/dashboard-primitives.tsx` | **Extract** to `packages/ui` | Source of truth for primitives below |
| `v2/_components/spend-chart-v2.tsx` | **Discard** | V1's `SpendChart` has RTL chart config, Suspense, etc. Re-skin V1 instead |
| `v2/page.tsx` | **Discard** | Use V1 layout; harvest hero metric as a new widget |
| `v2/contractors/page.tsx` | **Discard** | Different UX (cards vs table); buggy stage counts; Workbench reference will be re-skinned V1 |
| `v2/workflows/templates/new/atelier-visuals.tsx` (untracked) | **Discard** | Re-implements `TiltCard` and `AtelierBg` with different params; live drift |
| `apps/web/src/app/globals.css` lines 605–760 (atelier classes) | **Move** to `packages/ui/src/styles/glass.css` + `motion.css` | Shared between web and landing |
| `apps/web/src/components/dashboard/overdue-receivables-tile.tsx` | **Decide** | Orphan since `5d8b1c5c` (2026-04-15). Wire into V1 dashboard or delete |

Primitives to extract from `dashboard-primitives.tsx`:

- `AtelierBackground` (3 drifting orbs + grain + dot grid + diagonal lines)
- `TiltCard` (with hover/touch gating fix)
- `AnimatedNumber` (with reduced-motion fix + a11y label)
- `Ring`
- `Sparkline` (with sr-only trend description)
- `PulseDot`
- `SlaPill` → generalize to `AtelierStatusPill`
- `SectionLabel`
- `LiveClock` (verify Suspense/SSR behavior)
- Helpers `dlHref`, `DL_CFG`, `plnFmt`, `fmtAmt` → **do not extract**; locale-specific, app concern

---

## 3. Constraints catalog (apply to every primitive)

These are non-negotiable acceptance criteria for any extracted primitive. Each PR must explicitly tick these off.

### 3.1 Accessibility

- **Reduced motion.** All animations honor `@media (prefers-reduced-motion: reduce)`. `AnimatedNumber` jumps to final value (no rAF tween). `atelier-shimmer`, `atelier-tilt`, `atelier-border-glow`, `atelier-hero-glow`, sparkline pulse dot are all collapsed.
- **Reduced transparency.** Add `@media (prefers-reduced-transparency: reduce)` rules: `.atelier-glass`, `.glass-{subtle,medium,heavy}` fall back to solid `var(--surface-1)` with no `backdrop-filter`. Currently nothing in `globals.css` queries this.
- **Touch & input modality.** `TiltCard` mouse handlers gated by `@media (hover: hover) and (pointer: fine)`. On touch, becomes a static card with no transform. Same for `atelier-shimmer:hover` sweep — no hover, no shimmer.
- **Focus vs glow conflict.** `atelier-border-glow` and the focus ring are mutually exclusive. Define the rule once: focused element drops glow animation, swaps to solid focus ring. No simultaneous breathing border + 2px outline.
- **Screen-reader contracts.**
  - `Sparkline`: `aria-hidden="true"` on the SVG, plus a sibling `<span class="sr-only">` describing trend (e.g., `"6-month spend trend, up 8%"`). Required, not optional.
  - `AnimatedNumber`: parent must carry `aria-label` with the destination value. Component itself silent (no `aria-live`).
  - `LiveClock`: `aria-hidden="true"` (decorative); not a substitute for explicit timestamps.
  - `PulseDot`, `Ring`: `aria-hidden="true"`; meaningful state must be expressed in adjacent text.
- **Print stylesheet.** `@media print` collapses glass, shimmer, orbs, tilt to solid surfaces. Invoices and contracts get printed; the current animated background must not appear in print.
- **Color contrast.** Status pills meet WCAG AA on both surface-1 and surface-2 backgrounds in light and dark mode. Run automated checks in PR (axe-core or pa11y).

### 3.2 Internationalization

- **No hardcoded locale strings in primitives.** Locale comes from `next-intl`. `plnFmt` and `formatGBP` are deleted in favor of a shared `useCurrencyFormatter(currency)` hook (see §1.3 currency decision and §6.5 below). The hook reads the active `next-intl` locale; each amount carries its own ISO 4217 code. No org-default work in this initiative.
- **No hardcoded UI strings.** All 14 hardcoded English strings in `v2/page.tsx` translate via `useTranslations('Dashboard')` keys. Extracted primitives accept text via props or render children only.
- **RTL.** All extracted primitives use logical CSS properties (`-start`, `-end`, `inline-start`, `padding-inline`). `TiltCard` rotation does not flip in RTL — pointer position math is screen-space, not document-flow. Verify in `ar` locale.
- **Tabular numerals.** All numeric KPI displays use `tabular-nums`. Already present in V2; preserve in the extracted versions.

### 3.3 Performance

Per-tier hard rules:

| Rule | Exhibition (landing) | Atelier (dashboard) | Workbench (operational) |
|---|---|---|---|
| `AtelierBackground` (orbs + grain) | Allowed | Allowed (1×) | **Banned** |
| `backdrop-filter` on repeated rows | N/A | N/A | **Banned** (>20× repetition) |
| `atelier-shimmer:hover` on rows | N/A | Cards only | **Banned** on rows |
| `atelier-tilt` on rows | N/A | Cards only | **Banned** on rows |
| `atelier-border-glow` count per viewport | Hero only | ≤3 | ≤1 (page header at most) |
| `atelier-hero-glow` (continuous gradient anim) | Hero only | Hero metric only | **Banned** |
| `glass-heavy` (blur 48px) | Hero panels | Modals, hero | **Banned** on persistent surfaces |
| `glass-medium` (blur 32px) | Allowed | Allowed | Page header only |
| Static `--surface-1` backgrounds | OK | OK | **Default** |

PR with new primitive must include a screenshot of DevTools Performance panel showing 60fps on a representative page (300-row payments table for Workbench, dashboard scroll for Atelier).

### 3.4 SSR / hydration

- **`'use client'` boundary documented per primitive.** `AnimatedNumber`, `TiltCard`, `LiveClock`, `Sparkline` (animation) are client components. `AtelierBackground`, `SectionLabel`, `Ring` (static), `PulseDot` (no pulse) can be server.
- **No hydration mismatches.** Primitives that read `Date.now()`, `performance.now()`, `window.matchMedia` must initialize from a stable server value and update in `useEffect`. `LiveClock` already does this correctly (initial `null`, updates after mount).

### 3.5 Permissions parity

- **No regression from V1.** V1 dashboard gates `SpendChart` on `can('report', ['read'])`. Any layout change must preserve this. PR template includes a "permissions parity" checklist line.

---

## 4. Sequenced PRs

Each PR is independently shippable, behind a feature flag where applicable, with no cross-PR dependencies beyond the previous one.

### PR 1 — Foundation: shared tokens + V2 retirement

**Scope**

1. Create `packages/ui/src/styles/`:
   - `tokens.css` — color, surface, elevation, typography role, easing, duration variables. Lifted from `apps/web/src/app/globals.css` lines 1–340.
   - `glass.css` — `.atelier-glass`, `.glass-subtle`, `.glass-medium`, `.glass-heavy`. Lifted from web globals 612–680. Add `prefers-reduced-transparency` and `@media print` rules.
   - `motion.css` — keyframes (`atelier-in`, `shimmer-sweep`, `border-breathe`, `hero-glow`, `ring-ping`, `fade-up`, `drift-{1,2,3}`, `grain-drift`) and helper classes (`.atelier-enter`, `.atelier-shimmer`, `.atelier-border-glow`, `.atelier-hero-glow`, `.atelier-tilt`, `.atelier-pulse`). Add `prefers-reduced-motion`, `(hover: hover)`, and print rules.
   - `status.css` — semantic color tokens for the 8 status variants.
2. Add to `packages/ui/package.json`: `react`, `react-dom`, `lucide-react` as peer deps. Set up `exports` map for `./styles/*.css`.
3. Both `apps/web/src/app/globals.css` and `apps/landing/src/app/globals.css` import from `@contractor-ops/ui/styles/*`. Delete the duplicated blocks in each app's globals.
4. Delete `v2/_components/spend-chart-v2.tsx`.
5. Delete `v2/contractors/page.tsx`.
6. Delete `v2/workflows/templates/new/atelier-visuals.tsx` (untracked file — must be deleted not committed).
7. Keep `v2/page.tsx` and `v2/_components/dashboard-primitives.tsx` for now — PR 2 retires them.
8. Decide `overdue-receivables-tile.tsx` fate (separate sub-task — see §8).

**Acceptance criteria**

- `pnpm --filter @contractor-ops/web typecheck && lint` pass.
- `pnpm --filter @contractor-ops/landing typecheck && lint` pass.
- Diff `apps/web/src/app/globals.css` → ≥ 600 lines removed.
- Diff `apps/landing/src/app/globals.css` → ≥ 200 lines removed.
- Browser smoke test in light + dark mode + reduced-motion + reduced-transparency: dashboard, landing home, landing pricing visually unchanged.
- New `prefers-reduced-transparency` rule verified in macOS System Settings → Accessibility → Display.

**Out of scope:** No component changes. No new primitives. Pure CSS relocation.

---

### PR 2 — Pure primitives extracted to `@contractor-ops/ui`

**Scope**

1. Create `packages/ui/src/components/atelier/`:
   - `AtelierIntensityProvider.tsx` — React context with `'exhibition' | 'atelier' | 'workbench'`. Default `'atelier'`.
   - `AtelierBackground.tsx`
   - `TiltCard.tsx` — with `(hover: hover) and (pointer: fine)` gate, reduced-motion gate, intensity gate (no tilt in workbench).
   - `AnimatedNumber.tsx` — with reduced-motion gate (jump to final), removed hardcoded `'pl-PL'` (formatter passed by caller).
   - `Ring.tsx`
   - `Sparkline.tsx` — with `srLabel` prop (required, not optional). Pulse dot disabled in workbench intensity.
   - `PulseDot.tsx`
   - `SectionLabel.tsx`
   - `AtelierStatusPill.tsx` — replaces `SlaPill`. Accepts `variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'processing' | 'blocked' | 'live'` and optional `pulse: boolean`.
2. Index file `packages/ui/src/index.ts` exports all of the above.
3. Delete `v2/_components/dashboard-primitives.tsx`.
4. Delete `v2/page.tsx`.
5. Update web app's import sites (none should remain after PR 2 — V2 routes are deleted).

**Acceptance criteria**

- All 8 constraints in §3 ticked off per primitive.
- Each primitive ships with a `__tests__/` file: render test, reduced-motion test (mock `matchMedia`), and a11y assertion (axe).
- `pnpm --filter @contractor-ops/ui typecheck && lint && test` pass.
- Web app builds and lints.
- `apps/web/src/app/[locale]/(dashboard)/v2/` no longer exists.

**Out of scope:** No use of these primitives in app code yet. Extraction only.

---

### PR 3 — V1 dashboard upgrade with Atelier primitives

**Scope**

1. `apps/web/src/components/dashboard/kpi-cards.tsx`: replace internals with `TiltCard` + `Ring` (where currently used) + `AnimatedNumber`. Keep the i18n keys, permissions, data flow exactly as-is.
2. New widget `apps/web/src/components/dashboard/hero-spend-metric.tsx`: the V2 hero card (asymmetric layout, big animated number, sparkline, trend chip). Gated on `can('report', ['read'])`. Translation keys under `Dashboard.heroSpend.*`.
3. `apps/web/src/app/[locale]/(dashboard)/page.tsx`: insert `HeroSpendMetric` as a **full-width hero above `KpiCards`**, immediately under `DashboardGreeting` (decision locked in §8). Keep all existing widgets (`DashboardGreeting`, `KpiCards`, `SpendChart`, `DeadlinesWidget`, `ApprovalQueueWidget`, `ActivityFeed`, `EInvoiceComplianceWidget`, `TaxObligationsWidget`, `OnboardingChecklist`). Keep `DashboardEmptyState`. Keep Suspense + skeleton fallback. Wire `OverdueReceivablesTile` (orphan from Phase 63-07) into the right column — it already self-hides for non-UK orgs and orgs with no overdue data, so non-UK dashboards are unaffected.
4. Wrap dashboard page content in `<AtelierIntensityProvider value="atelier">`.
5. Add new translation keys to `apps/web/messages/{en,pl,de,ar}.json` for the hero metric, plus the `Dashboard.heroSpend.*` namespace.
6. Replace V1's existing accent line / background treatment with `AtelierBackground` (single instance, behind content).

**Acceptance criteria**

- All V1 widgets still render, still respect permissions, still i18n correctly.
- Empty state still works (test with a fresh org seed).
- Reduced-motion: animations collapsed, hero number static.
- Reduced-transparency: glass falls back to solid surfaces.
- Print: dashboard prints as a clean document with no orbs, glass, shimmer.
- Touch (iPad emulation): no broken hover states; cards static, no tilt.
- RTL (`ar` locale): layout mirrors correctly, sparkline doesn't flip incorrectly.
- Lighthouse Performance ≥ 90 on dashboard route (compare to current).
- Translation completeness: no missing keys in any locale file.

**Out of scope:** V1 contractors page, other operational pages, landing app.

---

### PR 4 — Status system normalization

**Scope**

1. `packages/ui/src/status/`:
   - `variants.ts` — exports `AtelierStatusVariant` type (8 values from §1).
   - `mapper.ts` — exports `statusToVariant(domain, status)`. Domains: `'invoice' | 'contractor' | 'contract' | 'payment' | 'workflow' | 'approval' | 'einvoice' | 'peppol' | 'zatca' | 'change-request' | 'user'`. Each domain has its own mapping function. Returns `AtelierStatusVariant`.
2. Audit and replace **124 hardcoded** `bg-{green|red|amber|blue|yellow}-*` and `text-{...}` sites across:
   - `apps/web/src/components/invoices/**` (highest density — `invoice-table/columns.tsx`, `invoice-detail/**`)
   - `apps/web/src/components/contractors/**`
   - `apps/web/src/components/payments/**`
   - `apps/web/src/components/contracts/**`
   - `apps/web/src/components/workflows/**`
   - `apps/web/src/components/settings/users-table.tsx` (uses `statusColors` map at line 53)
   - `apps/web/src/components/settings/change-request-diff-card.tsx` (uses `STATUS_BADGE_VARIANTS` at line 145)
3. Delete the 4 separate `statusBadgeConfig` / `statusColors` definitions:
   - `app/[locale]/(dashboard)/invoices/[id]/page.tsx:65`
   - `components/invoices/invoice-table/columns.tsx:93`
   - `components/settings/users-table.tsx:53`
   - `components/settings/change-request-diff-card.tsx:145`
4. All status badges use `<AtelierStatusPill variant={statusToVariant('invoice', status)} />`.
5. Add unit tests for `statusToVariant` per domain — every status enum value mapped exhaustively.

**Acceptance criteria**

- Grep for `bg-(green|red|amber|blue|yellow)-` in `apps/web/src/components/{invoices,contractors,payments,contracts,workflows,settings}` returns 0 results.
- All 4 `statusBadgeConfig` definitions deleted.
- Visual regression: snapshot every status badge in light/dark mode at the table row level. Compare against pre-PR baseline.
- TypeScript exhaustiveness check: every domain's mapper handles every Prisma enum value (use `never` fallback).

**Out of scope:** No layout changes. No new statuses. Mapping only.

---

### PR 5 — App shell upgrade

**Scope**

1. Update `apps/web/src/components/layout/sidebar.tsx`, `topbar.tsx`, `breadcrumbs.tsx`, search trigger:
   - Apply `glass-subtle` to topbar and sidebar.
   - Improve mobile topbar behavior and breadcrumb truncation (long route segments collapse with ellipsis + tooltip).
2. Main content wrapper sets intensity per route segment via `AtelierIntensityProvider` (decision locked in §8):
   - `/` (dashboard) → `atelier`
   - `/contractors`, `/invoices`, `/approvals`, `/payments`, `/workflows`, `/contracts`, `/settings`, `/portal` → `workbench`
   - `/reports` → `atelier`
3. Workbench routes get a calmer page background — no `AtelierBackground` orbs; static `var(--surface-0)`.
4. Add a `data-intensity` attribute on `<body>` for CSS overrides where context isn't available.

**Acceptance criteria**

- Visual smoke on mobile (375px) and desktop (1440px) for sidebar + topbar in both modes.
- Breadcrumb with 6 long segments truncates and remains keyboard-navigable.
- Route navigation between dashboard and workbench shows clear visual tier transition (not jarring).
- No new console warnings.

**Out of scope:** Operational page internals (PR 6). Command palette redesign.

---

### PR 6 — Workbench tier rollout (operational pages)

**Scope split into 3 sub-PRs** (each independently shippable):

#### 6a. Workbench shell primitives in `@contractor-ops/ui`

- `AtelierPageHeader` — matches the V1 `PageHeader` API but uses Atelier surfaces.
- `AtelierToolbar` — search + filter + bulk-action slots.
- `AtelierTableShell` — wraps `<table>` with consistent borders, padding, sticky header treatment, loading overlay.
- `AtelierEmptyState` — match `apps/web/src/components/shared/empty-state.tsx` API; just visual upgrade.
- `AtelierPanel` — side-panel surface for detail drawers.

#### 6b. Reference upgrade: contractors + invoices

- `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx`: keep V1 logic, swap `PageHeader` → `AtelierPageHeader`, `EmptyState` → `AtelierEmptyState`. `ContractorDataTable` wrapped in `AtelierTableShell`. `ContractorSidePanel` wrapped in `AtelierPanel`.
- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx`: same treatment.
- Verify Workbench performance rules from §3.3: 200-row table holds 60fps scroll, no per-row tilt/shimmer/glass.

#### 6c. Roll out remaining operational pages

- `approvals`, `payments`, `workflows`, `contracts`, `settings`, `portal`.
- One commit per page. Each commit ≤ 200 lines. Each commit reviewed against the Workbench rules.

**Acceptance criteria per sub-PR**

- 60fps scroll on a representative dense page (use Chrome DevTools Performance recording, attached to PR).
- No `backdrop-filter` on `<tr>` elements (grep check in PR script).
- Dialogs, side panels, command palette unaffected.
- All RTL, reduced-motion, reduced-transparency, print, touch checks per §3.

---

### PR 7 — Landing alignment (Exhibition tier)

**Scope**

1. `apps/landing/src/components/`:
   - `hero.tsx` — apply `glass-heavy` and `atelier-hero-glow` (Exhibition is the only tier where this is allowed unconditionally).
   - `pricing.tsx` — pricing cards use `glass-medium` + `atelier-shimmer` on hover, with the constraints from §3.
   - `features.tsx`, `cta.tsx`, `social-proof.tsx`, `logo-bar.tsx`, `how-it-works.tsx`, `problem.tsx` — selective Atelier primitives.
   - **Landing dashboard mockup** lives inline in `hero.tsx:140-226` ("Animated browser mockup" + "Dashboard preview"). Decision locked in §8: rebuild it from real `@contractor-ops/ui` primitives (`TiltCard`, `KpiCards`-style group, `Sparkline`, `AnimatedNumber`) so marketing visually tracks the product as it evolves. Mockup data is static/seeded; the mockup wraps an `<AtelierIntensityProvider value="exhibition">` and disables interactivity (no nav, no real queries).
2. Landing-specific extensions remain in `apps/landing/src/app/globals.css` (e.g., display typography sizing, hero gradient). Cross-app tokens come from `@contractor-ops/ui/styles/`.

**Acceptance criteria**

- Landing visually bolder than the app, but uses the same color/elevation/easing tokens.
- Landing dashboard mockup (if present) renders a real `KpiCards`-style group, not a static image or divergent code.
- Lighthouse Performance ≥ 90 on landing home (Exhibition tier is allowed expensive effects but must still hit perf budget on a mid-tier mobile).
- Reduced-motion + reduced-transparency + RTL + print verified.

**Out of scope:** Marketing copy changes. SEO. Pricing logic.

---

## 5. Cross-cutting deliverables

These don't fit into a single PR but must be tracked.

### 5.1 Translation completeness

- After PR 3 and PR 7, audit `apps/web/messages/{en,pl,de,ar}.json` and `apps/landing/messages/*` for missing keys. Use existing tooling if available; otherwise a script in `scripts/`.
- All 14 hardcoded English strings in former V2 retired (deleted with `v2/page.tsx`). New `Dashboard.heroSpend.*` namespace populated in all 4 locales.

### 5.2 Test infrastructure

Decision locked in §8: **full suite runs on every push to `main`.** Concrete picks:

- **Unit tests:** Vitest. Already in place. Add tests per primitive in `packages/ui/src/components/atelier/__tests__/`.
- **Visual regression:** Playwright with `toHaveScreenshot()`. Set up in commit group 2. One screenshot per primitive in light/dark/RTL/reduced-motion → 4 baseline images per primitive. Baselines live under `packages/ui/__visual__/` and `apps/web/__visual__/`.
- **A11y:** `@axe-core/playwright` integrated into the visual regression workflow. Fail CI on new violations.
- **Performance:** Lighthouse CI on `/dashboard`, `/contractors`, `/invoices`, `/`, `/pricing` routes. Budget = 90 Performance, 95 A11y. Fail CI if regression > 5pts on a measured route.
- **Baseline update protocol** (since work commits to `main` directly): visual baselines are updated only via commits explicitly titled `test(visual): update baselines for <reason>`. Auto-accept of changed snapshots in any other commit is forbidden — CI runs in `--update-snapshots=missing-only` mode to enforce this. Baseline-update commits are scrutinized in retrospective review.
- **CI runtime budget:** target ≤ 8 minutes wall-clock per push. If full suite exceeds this, shard Playwright across 2–3 parallel runners.
- **No Storybook.** Adds a Next.js compatibility maintenance burden. Playwright + a `/dev/atelier` route (gated on `NODE_ENV === 'development'`) showing all primitives works for ~5% of the cost.

### 5.3 Performance budgets (per route)

| Route | LCP | CLS | TBT | Budget owner |
|---|---|---|---|---|
| `/` (dashboard) | ≤ 2.5s | ≤ 0.1 | ≤ 200ms | PR 3 |
| `/contractors`, `/invoices` | ≤ 2.5s | ≤ 0.1 | ≤ 200ms | PR 6b |
| Landing `/` | ≤ 2.0s | ≤ 0.05 | ≤ 150ms | PR 7 |

### 5.4 Documentation

- Add `packages/ui/README.md` documenting each primitive's API, intensity behavior, accessibility contract, and SSR boundary.
- Update root `CLAUDE.md` if Atelier conventions change repo-wide rules.

---

## 6. Status mapping inventory (PR 4 prep work)

Concrete file list to audit. Each entry is a hardcoded color site or local config to be replaced.

**Local status configs to delete** (4 total)

- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx:65` — `statusBadgeConfig`
- `apps/web/src/components/invoices/invoice-table/columns.tsx:93` — `statusBadgeConfig`
- `apps/web/src/components/settings/users-table.tsx:53` — `statusColors`
- `apps/web/src/components/settings/change-request-diff-card.tsx:145` — `STATUS_BADGE_VARIANTS`

**Hardcoded color sites** (124 total — full list to be generated by PR 4 prep script)

```bash
grep -rn "bg-\(green\|red\|amber\|blue\|yellow\)-\|text-\(green\|red\|amber\|blue\|yellow\)-" \
  apps/web/src/components/{invoices,contractors,payments,contracts,workflows,settings}
```

Domains to map:

- `invoice` — `DRAFT | UNDER_REVIEW | MATCHED | UNMATCHED | DISCREPANCY | APPROVED | REJECTED | PAID | CANCELLED`
- `contractor` — `DRAFT | ONBOARDING | ACTIVE | OFFBOARDING | ENDED`
- `contract` — `DRAFT | ACTIVE | EXPIRING | EXPIRED | TERMINATED`
- `payment` — `READY | PROCESSING | SENT | RECONCILED | FAILED`
- `workflow` — `IDLE | RUNNING | COMPLETED | FAILED | CANCELLED`
- `approval` — `PENDING | APPROVED | REJECTED | ESCALATED | EXPIRED`
- `einvoice` — domain-specific compliance states
- `peppol`, `zatca` — ack/error states from external systems
- `change-request` — `PENDING | APPROVED | REJECTED | WITHDRAWN`
- `user` — `INVITED | ACTIVE | SUSPENDED`

The exhaustive enum list per domain comes from `packages/db/src/generated/prisma/client/enums.ts`. PR 4 imports those enum types directly so the mapper is provably exhaustive.

### 6.5 Currency formatter (locked decision)

The current state has two hardcoded formatters: `plnFmt` (`'pl-PL'`, PLN) at `apps/web/src/app/[locale]/(dashboard)/v2/_components/dashboard-primitives.tsx:332` and `formatGBP` (`'en-GB'`, GBP) at `apps/web/src/components/dashboard/overdue-receivables-tile.tsx`. Decision locked in §8: replace both with a shared locale-aware helper.

**Implementation.**

- New file `apps/web/src/lib/format/use-currency-formatter.ts` exports a `useCurrencyFormatter()` hook:
  ```ts
  import { useLocale } from 'next-intl';
  import { useMemo } from 'react';

  export function useCurrencyFormatter() {
    const locale = useLocale();
    return useMemo(
      () => (minor: number, currency: string, opts?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          ...opts,
        }).format(minor / 100),
      [locale],
    );
  }
  ```
- Every site that previously called `plnFmt.format(x)` or `formatGBP(x)` becomes `fmt(x, 'PLN')` or `fmt(x, 'GBP')` with the currency code coming from the data (invoice, payment, etc.).
- Extracted primitives in `@contractor-ops/ui` accept a `format?: (n: number) => string` prop. Locale-awareness lives entirely in the app, not the package.

**Out of scope for this initiative:** adding `Organization.defaultCurrency` / `Organization.locale` schema fields. That's a separate per-org preferences initiative.

---

## 7. Risks & rollback

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| V2 deletion breaks a route someone links to | Low | Low | V2 routes were never linked from app navigation; verify with grep |
| Token CSS extraction changes specificity unintentionally | Medium | Medium | PR 1 is pure relocation; visual diff in browser before merging |
| Status mapper misses a Prisma enum value | Medium | Medium | TypeScript exhaustiveness via `never` default; full enum import |
| Performance regression on Workbench tables | Medium | High | Performance budget enforced in PR 6b; no merge if budget fails |
| Accessibility regression (motion, transparency) | Low | High | Each PR ticks §3 constraints; axe-core in CI |
| Translation drift (missing keys) | High | Low | Translation completeness check post-PR 3 and PR 7 |
| Workbench rules violated in a hotfix later | Medium | Medium | Add a CSS lint rule (or grep check in CI) banning `backdrop-filter` inside `<tr>` selectors |

**Rollback strategy.** Each PR is feature-flag-free but cleanly revertable. The shared CSS in PR 1 is pure relocation — revertible by restoring the deleted blocks. PRs 2–6 are additive component changes; revert the PR commit. PR 4 is the riskiest because it touches 124 sites; if visual regression detects an issue on a single status, fix forward rather than revert.

---

## 8. Resolved decisions

All locked on 2026-05-05.

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| 1 | `overdue-receivables-tile.tsx` fate | **Wire into V1 dashboard (commit group 3)** | UK-specific, gated on `PAY_LATE_INTEREST_ENABLED`, self-hides for non-UK orgs and orgs with no overdue data. Closes out Phase 63-07 with near-zero blast radius. |
| 2 | `HeroSpendMetric` placement | **Full-width hero above `KpiCards`**, immediately under `DashboardGreeting` | Maximum visual impact; KPIs and downstream widgets keep their full-width grid intact. |
| 3 | `/portal` intensity | **Workbench** | Contractors using portal repeatedly for invoice submission and status checks need efficiency, not cinematic surfaces. |
| 4 | Landing dashboard mockup approach | **Rebuild from real `@contractor-ops/ui` primitives** in `apps/landing/src/components/hero.tsx` (currently bespoke at lines 140–226) | Marketing visual stays in lockstep with product as primitives evolve; eliminates manual sync work. |
| 5 | CI scope on push to `main` | **Full suite on every push** — typecheck, lint, unit, Playwright visual, axe-core, Lighthouse | No PR gate exists; CI on `main` is the safety net. Baseline-update discipline enforced via commit-message protocol (see §5.2). |
| 6 | Currency formatter strategy | **Locale-aware `useCurrencyFormatter()` hook** reading active `next-intl` locale; per-amount currency from data | Smallest scope that fixes both `plnFmt` and `formatGBP` hardcoding without touching schema or settings UI. Org-default currency is a separate initiative. See §6.5 for implementation. |

---

## 9. Out of scope (explicitly)

- API route changes
- Database schema changes
- tRPC contract changes
- Auth behavior changes
- Billing logic changes
- Marketing copy changes
- SEO
- Storybook
- Migration to a different chart library (Recharts stays)
- Migration off shadcn/ui base components (they keep working under Atelier surfaces)
- New features beyond visual treatment
- Mobile native app
- Email template restyling
- PDF (invoice) restyling

---

## 10. Definition of Done (whole initiative)

- ✅ V2 routes and primitives deleted; `@contractor-ops/ui` is the source of truth for Atelier primitives.
- ✅ Tokens shared between web and landing via `@contractor-ops/ui/styles/*`.
- ✅ V1 dashboard upgraded with hero metric and Atelier-skinned KPIs; all V1 widgets preserved.
- ✅ Status badges use `AtelierStatusPill` + `statusToVariant` everywhere; 4 local configs deleted; 124 hardcoded color sites gone.
- ✅ App shell uses intensity context; Workbench routes obey the perf rules.
- ✅ Operational pages (contractors, invoices, approvals, payments, workflows, contracts, settings, portal) upgraded.
- ✅ Landing aligned at Exhibition tier; pricing/features/CTA visually consistent with product language.
- ✅ All §3 constraints met for every primitive.
- ✅ Performance budgets met on all measured routes.
- ✅ Visual regression and a11y suites green in CI.
- ✅ Translation files complete in all 4 locales.
- ✅ `packages/ui/README.md` documents the system.
