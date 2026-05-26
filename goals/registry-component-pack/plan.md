# Plan — Registry Component Pack

## Solution approach

Five waves, each = `(install → wire → verify)`. Components arrive into `packages/ui/src/components/<registry>/` via `pnpm dlx shadcn add @<registry>/<name>` (registries already configured in [`packages/ui/components.json`](../../packages/ui/components.json)). Each registry namespace is also re-exported through `@contractor-ops/ui/components/<registry>/*` subpath ([`packages/ui/package.json`](../../packages/ui/package.json)), so apps consume via the package boundary — never relative paths.

Bundle and a11y baselines captured **before each wave** so deltas are measurable. A final re-audit pass (the user-requested validation) walks every wired surface against `facts.md` and produces an audit report.

Order rationale: foundation first (no surface change), then landing hero (most visible), then dense landing sections, then blog (smaller surface), then web-vite (largest surface, most risk), then audit.

## Wave 0 — Foundation

**Steps**

1. Capture baselines:
   - `pnpm --filter @contractor-ops/landing build` → record `.next/analyze` route sizes (or build output table). Save snapshot as `goals/registry-component-pack/baseline-landing.txt`.
   - `pnpm --filter @contractor-ops/web-vite build` → record route bundle sizes. Save as `baseline-web-vite.txt`.
   - `pnpm typecheck` → must be green before starting any wave. If red, stop and fix root cause.
2. Verify registry resolution: run `pnpm dlx shadcn diff @magic/border-beam` from `packages/ui/` — confirms registries reachable (smoke test, no install).
3. Confirm `motion/react` + `useReducedMotion` are already deps of landing + web-vite (they are; hero.tsx imports them).
4. Add a `pack:` row to [`packages/ui/README.md`](../../packages/ui/README.md) (one short table) listing the tier-1 namespaces this pack draws from, so future devs find the convention.

**Verification**

- Baseline snapshots committed to goal dir (not the repo build artifacts).
- `pnpm typecheck` green.
- `shadcn diff` returns a structured diff (not 404).

## Wave 1 — Landing hero + atmosphere (L1, L2, L3)

**Steps**

1. From `packages/ui/`, install:
   - `pnpm dlx shadcn add @aceternity/spotlight-new` → `src/components/ace/spotlight-new.tsx`
   - `pnpm dlx shadcn add @magic/aurora-text` → `src/components/magic/aurora-text.tsx`
   - `pnpm dlx shadcn add @magic/blur-fade` → `src/components/magic/blur-fade.tsx`
2. Export each from the registry's `index.ts` barrel.
3. Wire into `apps/landing/src/components/hero.tsx`:
   - Wrap hero container in `<SpotlightNew />` (absolute-positioned background; `pointer-events-none`; gated by `!reduced`).
   - Replace static `<span>` keyword in `<h1>` with `<AuroraText>contractor ops</AuroraText>` per locale via translation key (the keyword to highlight is locale-specific — add `hero.auroraKeyword` to all 6 locale files).
   - Wrap each metric card + dashboard mock row in `<BlurFade delay={i * 0.08}>`.
4. RTL check: navigate `/ar` — spotlight position must mirror; aurora gradient direction must not look broken. If RTL flip needed, wrap in `dir`-aware class.
5. Add unit prop-type check (one tiny vitest spec) — skip if components are mostly visual; rely on typecheck + manual.

**Verification**

- `pnpm typecheck` green.
- `pnpm --filter @contractor-ops/landing build` — home route JS ≤ baseline + 25 KB gzip.
- Manual walk: `/`, `/de`, `/pl`, `/ar` — hero renders, animates; toggle macOS *Reduce motion* — all three components degrade to static.
- Keyboard tab through hero — focus order unchanged, no new tab traps from spotlight overlay.

## Wave 2 — Landing sections (L4 – L10)

**Steps**

1. From `packages/ui/`, install:
   - `pnpm dlx shadcn add @aceternity/infinite-moving-cards` → `ace/infinite-moving-cards.tsx`
   - `pnpm dlx shadcn add @aceternity/world-map` → `ace/world-map.tsx`
   - `pnpm dlx shadcn add @aceternity/bento-grid` (refresh existing) → `ace/bento-grid.tsx`
   - `pnpm dlx shadcn add @cult/shift-card` → `cult/shift-card.tsx`
   - `pnpm dlx shadcn add @aceternity/moving-border` → `ace/moving-border.tsx`
   - Choose Tailark pricing variant: fetch `https://tailark.com/r/pricing-05.json` and `pricing-03.json`, pick by JSON quality + 4-tier structure. Install chosen one → `tailark/pricing-XX.tsx`.
   - Same for FAQ: probe `tailark/faqs-02` vs `faqs-04`, pick. Install → `tailark/faqs-XX.tsx`.
2. Export each from its registry barrel.
3. Wire:
   - `apps/landing/src/components/sections/testimonials.tsx` → swap row for `<InfiniteMovingCards items={...} pauseOnHover />`.
   - `apps/landing/src/components/sections/integrations-grid.tsx` → embed `<WorldMap dots={[EU, UK, Gulf coordinates]} />` above logo cloud.
   - `apps/landing/src/components/sections/bento-features.tsx` → migrate to `@contractor-ops/ui/components/ace/bento-grid` BentoGridItem layout.
   - Insert `<ShiftCard>` into "Why" section (likely inside `apps/landing/src/components/sections/index.ts` composition — adjust where the existing flagship card sits, or `features.tsx`).
   - `apps/landing/src/components/sections/cta-band.tsx` → primary CTA wrapped in `<MovingBorder>`; same in `apps/landing/src/components/pricing.tsx` plan-CTA buttons.
   - Replace body of `apps/landing/src/components/pricing.tsx` with the Tailark variant, **preserving** market-switcher integration and credits section (currency + region logic stays).
   - `apps/landing/src/components/sections/faq-section.tsx` → swap accordion implementation for Tailark variant; keep existing FAQ content array.
4. i18n: every Tailark-shipped string must be translated. Add new keys to all 6 locale files.

**Verification**

- `pnpm typecheck` green.
- Landing home + `/pricing` routes JS ≤ baseline + 60 KB gzip.
- Tests: `pnpm --filter @contractor-ops/landing test` green (snapshot updates allowed, but eyeball diffs first).
- Manual: all 4 locales render; RTL pricing table flips correctly; `prefers-reduced-motion` honored on marquee + moving-border + world-map.
- `pnpm check:no-process-env` and `pnpm security:scan` clean (new deps audited).

## Wave 3 — Blog (B1, B2, B3; B4 shared)

**Steps**

1. From `packages/ui/`, install:
   - `pnpm dlx shadcn add @magic/scroll-progress` → `magic/scroll-progress.tsx`
   - `pnpm dlx shadcn add @aceternity/tracing-beam` → `ace/tracing-beam.tsx`
   - `pnpm dlx shadcn add @aceternity/direction-aware-hover` → `ace/direction-aware-hover.tsx`
2. Wire:
   - `apps/landing/src/components/blog/reading-progress.tsx` → replace internal scroll math with `<ScrollProgress />`. Keep the file (exports unchanged) but render the new primitive inside.
   - `apps/landing/src/components/blog/toc.tsx` → wrap TOC list in `<TracingBeam>`. Keep sticky positioning, IntersectionObserver-driven active-id logic.
   - `apps/landing/src/components/blog/post-card.tsx` → wrap card thumbnail in `<DirectionAwareHover imageUrl={cover}>`. Preserve existing semantic anchor + alt text.
   - `apps/landing/src/app/[locale]/blog/page.tsx` (archive) → wrap each `PostCard` in `<BlurFade delay={i * 0.06}>` (B4, from Wave 1).
3. Confirm Lexical-rendered body in `apps/landing/src/components/blog/lexical-body.tsx` is unchanged this wave (typography upgrade is tier-2).

**Verification**

- `pnpm typecheck` green.
- Blog `/blog` + `/blog/[slug]` routes JS ≤ baseline + 25 KB gzip.
- Manual: reading progress fills as you scroll; tracing beam animates along TOC; post card hover follows cursor direction; reduced-motion degrades all three to static.
- Existing blog tests (`apps/landing/src/__tests__/**` if any) still green.

## Wave 4 — Web-vite product (W1 – W8)

**Steps**

1. From `packages/ui/`, install (one `pnpm dlx shadcn add` per component, into matching folder):
   - `@reui/command` → `reui/command.tsx`
   - `@reui/data-grid` → `reui/data-grid.tsx`
   - `@reui/kanban` → `reui/kanban.tsx`
   - `@reui/stepper` → `reui/stepper.tsx`
   - `@reui/combobox` → `reui/combobox.tsx`
   - `@reui/timeline` → `reui/timeline.tsx`
   - `@origin/file-upload` → `origin/file-upload.tsx` — originui ships numbered variants (e.g. `file-upload-01`, `-02`, ...). Probe ≥2 via raw JSON fetch and pick the dropzone variant with multi-file + drag-state. Final installed filename matches the chosen variant.
   - `@origin/phone-number-input` → `origin/phone-number-input.tsx` — same: probe numbered variants, pick the one with country-code combobox + E.164 validation. Final filename matches chosen variant.
2. Export each from the registry barrel.
3. Wire (follow [`apps/web-vite/ARCHITECTURE.md`](../../apps/web-vite/ARCHITECTURE.md) container + hooks pattern — components are presentational; data fetching stays in hooks):
   - **W1 command palette**: new `apps/web-vite/src/components/shared/command-palette-container.tsx` mounted at app shell; hook `use-command-palette.ts` fetches contractor/invoice/contract index; keyboard binding `cmd+k`/`ctrl+k` in layout.
   - **W2 data-grid**: replace table internals (not the container) in `apps/web-vite/src/components/contracts/contract-table/*`, `contractors/contractor-table/*`, `invoices/invoice-table/*` (folder names are singular — verified by audit). Wrap with existing `<TablePageLayout>` from `workbench/`.
   - **W3 kanban**: new board view in `apps/web-vite/src/components/workflows/workflow-board-container.tsx`. Active dir is `workflows/` (plural); vestigial `workflow/` (singular, only `__tests__/`) is **not** touched by this goal.
   - **W4 stepper**: replace step UI in `apps/web-vite/src/components/onboarding/*` and `apps/web-vite/src/components/contracts/contract-wizard/*`.
   - **W5 combobox**: contractor picker, category picker, classification picker — wherever current `<Select>` shows >10 options.
   - **W6 file-upload**: dropzone in `apps/web-vite/src/components/documents/*` upload paths and `ocr/*` capture.
   - **W7 phone input**: contractor profile form, portal sign-up form.
   - **W8 timeline**: audit log views (admin) + contract amendments tab.
4. Each wired surface gets a vitest component test if patterns nearby already test (don't add tests where none exist; match local convention per CLAUDE.md "match existing patterns").
5. Run `pnpm check:web-vite-data-layer` after each surface change.

**Verification**

- `pnpm typecheck` green at repo root.
- `pnpm --filter @contractor-ops/web-vite test <touched-path>` per surface (never the unscoped full suite — memory hog per `feedback_test_run_memory`).
- `pnpm check:web-vite-data-layer` clean (no tRPC in pages/components, only in hooks).
- Bundle: web-vite per-route ≤ baseline + 50 KB gzip.
- Manual: open every wired surface, drive it with keyboard only, verify focus rings, verify empty / loading / error states preserved.
- Audit log: `writeAuditLog` calls untouched on mutations.

## Wave 5 — Re-audit + validation

**Steps**

1. Walk `facts.md` line by line. For each fact (L1 – L10, B1 – B4, W1 – W8): grep for the component import path in apps; if missing → log as drift.
2. Run full verification matrix:
   - `pnpm typecheck`
   - `pnpm test` (turbo will scope per package; safe)
   - `pnpm --filter @contractor-ops/landing build`
   - `pnpm --filter @contractor-ops/web-vite build`
   - `pnpm audit && pnpm security:scan`
   - `pnpm check:no-process-env`
   - `pnpm check:web-vite-data-layer`
3. Lighthouse on `/`, `/pricing`, `/blog`, `/blog/[a-real-slug]` — both `en` and `ar` — record Performance + Accessibility ≥ 90.
4. RTL eyeball pass: `/ar/`, `/ar/pricing`, `/ar/blog`, plus 2 representative web-vite screens.
5. Reduced-motion eyeball pass: toggle OS-level reduced motion, walk landing hero + blog + animated tables.
6. Write `goals/registry-component-pack/audit.md` — bullet list per fact: ✓ wired / △ drift / ✗ missing, with file paths. This audit *is* the user-requested validation pass.

**Verification**

- All checks green.
- `audit.md` shows zero ✗ rows. △ rows allowed only when explicitly downgraded in this plan's risk register below.

## Risks & open questions

- **R1 — Tailark pricing variant mismatch.** Tailark blocks ship opinionated layouts; ours has market-aware currency + credits section. Risk: the variant we pick doesn't accommodate market-switcher. Mitigation: probe ≥2 variants before install; if none fit, keep current `pricing.tsx` body and only adopt the visual styling tokens. Log this decision in `plan.md` revision if it triggers.
- **R2 — Aceternity `world-map` weight.** This component bundles a coordinates dataset and a canvas/svg layer. Risk: pushes landing bundle over budget. Mitigation: lazy-load via `next/dynamic` with `ssr: false` and `loading: <skeleton />`.
- **R3 — RTL bugs in motion-heavy components.** Aceternity / Magic UI components rarely ship RTL-tested. Mitigation: every wave includes an Arabic walkthrough; if RTL breaks, wrap in `dir`-aware class or pin direction.
- **R4 — `@reui/data-grid` may conflict with existing TanStack Table patterns.** Mitigation: pilot on **one** table (contracts) before rolling out; if conflict severe, scope reui usage to *new* tables only and leave existing TanStack tables alone — update fact W2.
- **R5 — Registry availability / version drift.** Some registries are community-run; URLs may 404 at install time. Mitigation: pin via `components.json` resolution, snapshot installed file in PR; do not retry-install in CI.
- **R6 — Bundle creep across waves.** Each wave allows a delta; cumulative could exceed combined budget. Mitigation: re-measure after Wave 2 and again after Wave 4; if over, drop a tier-1 item to tier-2 (rather than ship slow pages).
- **R7 — User-facing strings from Tailark blocks.** Tailark ships hard-coded English. Mitigation: i18n extraction is mandatory in Wave 2; treat the Tailark JSX as a *layout*, not as copy.
- **R8 — Test debt collision.** `project_test_debt_handoff` notes ~51 failing tests in `packages/api`. None of this pack touches `packages/api`, but landing/web-vite test runs may surface unrelated noise. Mitigation: scope tests narrowly per wave; do not "fix while I'm here" outside this goal.
- **R9 — Animation perf on low-end devices.** Mitigation: every motion component reads `useReducedMotion`; for spotlight + world-map also gate on `window.matchMedia('(min-width: 1024px)')` so mobile skips heavy canvases.
- **R10 — Goal overlap with `shadcn-ecosystem-integration`.** That goal is broader (includes 21st.dev, MCP, CMS). This pack is the *opinionated subset*. If both goals run, this one wins on conflict — facts here override (narrower, more recent).
