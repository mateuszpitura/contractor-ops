# @contractor-ops/ui

The Atelier visual system — shared design tokens, React primitives, and a
domain-aware status mapper consumed by `apps/web` and `apps/landing`.

This package codifies the workplan in `docs/UI-ATELIER-WORKPLAN.md`. Read
that first if you need context for *why* the package is shaped this way;
this README is the reference for *what* it ships and *how* to use it.

---

## What's in the box

| Layer | Path | Purpose |
|---|---|---|
| CSS tokens | `./styles/tokens.css` | OKLCh color palette, surface hierarchy, elevation, teal scale, motion easing/duration tokens, high-contrast media query |
| CSS glass | `./styles/glass.css` | `.atelier-glass`, `.glass-subtle/medium/heavy` + reduced-transparency + print fallbacks |
| CSS motion | `./styles/motion.css` | Universal `prefers-reduced-motion` + print floor; Atelier keyframes (atelier-in, atelier-hero-glow, atelier-border-breathe, atelier-shimmer-sweep, atelier-drift-1/2/3, atelier-ring-ping, atelier-grain-drift); utility classes (`.atelier-enter`, `.atelier-shimmer`, `.atelier-border-glow`, `.atelier-pulse`, `.atelier-hero-glow`) |
| CSS status | `./styles/status.css` | 8 semantic variant tokens (`--status-{success\|warning\|danger\|info\|neutral\|processing\|blocked\|live}{,-bg,-fg}`) |
| Atelier React | `components/atelier/` | Premium dashboard primitives — see §Atelier primitives |
| Workbench React | `components/workbench/` | Dense-page chrome — see §Workbench primitives |
| Status logic | `status/` | `statusToVariant(domain, status)` mapper across 18 domains |
| Hooks | `hooks/` | `useReducedMotion()`, `useHoverCapability()` — both SSR-safe |

---

## CSS imports

Both apps' `globals.css` import the shared layer at the top:

```css
@import "tailwindcss";
/* ...app-specific imports... */
@import "@contractor-ops/ui/styles/tokens.css";
@import "@contractor-ops/ui/styles/glass.css";
@import "@contractor-ops/ui/styles/motion.css";
@import "@contractor-ops/ui/styles/status.css";

@custom-variant dark (&:is(.dark *));

/* ...app-specific overrides (e.g. surface family) below... */
```

App-specific overrides go *after* the imports so the cascade hands the
last word to the consumer (e.g. apps/web's brighter dark surfaces vs
apps/landing's deeper Exhibition surfaces).

---

## Intensity tiers

Three tiers determine how aggressive the visual treatment is on a given
page. Components consult the tier via `useAtelierIntensity()` and
self-downgrade.

| Tier | Where | What's allowed |
|---|---|---|
| `exhibition` | Marketing/landing pages | Cinematic. Hero glow without rate-limit, full TiltCard tilt, all keyframes, glass-heavy on persistent surfaces |
| `atelier` | Dashboard, reports — insight-heavy product screens | Premium surfaces, ≤3 atelier-border-glow per viewport, hero glow on the hero metric only |
| `workbench` | Operational pages: contractors, invoices, payments, approvals, workflows, contracts, settings, portal | Calm. **No** orbs, **no** per-row tilt, **no** per-row shimmer, **no** atelier-hero-glow. `glass-medium` reserved for page header only. Static `--surface-1` is the default |

The current tier is set two ways:

1. **React context** via `<AtelierIntensityProvider value="...">` — read by leaf primitives.
2. **DOM attribute** `<body data-intensity="...">` — read by CSS rules that live outside the React tree (e.g. `.atelier-main-surface` in apps/web).

In `apps/web`, `components/layout/intensity-router.tsx` derives the
tier from the active route segment and sets both. In `apps/landing`,
the root layout sets `data-intensity="exhibition"` directly and the
Hero component wraps the dashboard mockup in `AtelierIntensityProvider`
locally.

---

## Atelier primitives

Live in `components/atelier/`. Designed for dashboards and insight-heavy
screens. Most are `'use client'` for SSR-safe hooks.

### `AtelierIntensityProvider`, `useAtelierIntensity()`

Context provider + reader for the active tier. Default `'atelier'` when
no provider is mounted.

```tsx
import { AtelierIntensityProvider, useAtelierIntensity } from '@contractor-ops/ui';

<AtelierIntensityProvider value="workbench">
  <ContractorTable />
</AtelierIntensityProvider>
```

### `AtelierBackground`

Decorative ambient background — three drifting orbs + dot grid. Always
`pointer-events: none` and absolute-positioned. Renders nothing in
`workbench` intensity.

```tsx
<div className="relative">
  <AtelierBackground />
  <div className="relative z-10">{/* page content */}</div>
</div>
```

### `TiltCard`

Frosted-glass surface with cursor-following 3D tilt. Becomes a static
card under any of: `prefers-reduced-motion`, `(hover: hover)` false,
or `intensity === 'workbench'`.

```tsx
<TiltCard glow shimmer delay={120} className="h-full">
  {/* card content */}
</TiltCard>
```

Props:
- `glow?: boolean` — apply atelier-border-glow (breathing teal→amber border)
- `shimmer?: boolean` — apply atelier-shimmer (metallic sweep on hover)
- `delay?: number` — entrance animation delay in ms
- `className`, `style`, `children` — passthrough

### `AnimatedNumber`

`requestAnimationFrame` tween from 0 to `value`. Honors reduced-motion
(jumps to final value). **Locale-neutral** — pass a `format` function
bound to a locale-aware `Intl.NumberFormat`.

```tsx
const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n / 100);
<AnimatedNumber value={totalMinor} format={fmt} duration={1600} />
```

**A11y:** silent — parent must carry `aria-label` with the destination
value so AT users hear the final state, not animation frames.

### `Sparkline`

Compact SVG line + area chart with an optional pulse dot at the latest
value. The pulse is suppressed in `workbench` intensity.

```tsx
<Sparkline
  data={monthlyTotals}
  srLabel="Six-month spend trend, up 8 percent"
  w={720} h={56}
  color="var(--color-primary)"
/>
```

**A11y:** `srLabel` is **required** (not optional) — the SVG itself is
`aria-hidden`, so the sr-only sibling is the only thing AT reads.

### `Ring`

Static SVG progress arc. No animation. Centered children slot.

```tsx
<Ring value={5} max={8} color="var(--color-warning)" size={48} stroke={3.5}>
  <span className="text-[8px] font-bold">{value}</span>
</Ring>
```

### `PulseDot`

Tiny inline indicator with optional ring-pulse. `aria-hidden` —
meaningful state must come from adjacent text.

```tsx
<PulseDot color="var(--color-success)" pulse />
```

### `SectionLabel`

Editorial section header — small uppercase tracked label, optional icon
chip, fading divider.

```tsx
<SectionLabel icon={CircleDot}>Key Metrics</SectionLabel>
```

### `AtelierStatusPill`

Compact status badge with one of 8 variants. Backed by status.css color
tokens. Use with `statusToVariant` for domain-aware mapping (see below).

```tsx
<AtelierStatusPill variant={statusToVariant('invoice', invoice.status)}>
  {t(`status.${enumKey(invoice.status)}`)}
</AtelierStatusPill>
```

Variants: `success | warning | danger | info | neutral | processing | blocked | live`.

---

## Workbench primitives

Live in `components/workbench/`. Designed for dense operational pages.
**No glass on rows, no per-row tilt, no per-row shimmer** — workbench is
calm-by-construction.

### `AtelierPageHeader`

Page title + description + action slot. Optional eyebrow label.

```tsx
<AtelierPageHeader
  eyebrow="Finance"
  title="Invoices"
  description="Match, approve, and pay supplier invoices."
  actions={<Button>New invoice</Button>}
/>
```

### `AtelierEmptyState`

Icon-in-circle, display heading, optional dot-grid background. Carries
the V1 prerequisite-aware CTA sequencing.

The primitive can't import the app's locale-aware `Link`, so consumers
pass a `renderAction` callback. The canonical bridge in `apps/web` is
`apps/web/src/components/shared/atelier-bridges.tsx`.

```tsx
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';

<AtelierEmptyState
  icon={Receipt}
  heading={t('emptyHeading')}
  body={t('emptyBody')}
  primaryAction={{ label: t('upload'), onClick: handleUpload }}
  secondaryAction={{ label: t('settings'), href: '/settings' }}
  prerequisiteMissing={contractorCount === 0}
  prerequisiteAction={{ label: t('addContractor'), href: '/contractors' }}
  renderAction={renderEmptyStateAction}
/>
```

### `AtelierToolbar`

Three-slot layout (search | filters | actions) with optional sticky
positioning and a footer for filter chips or selection summary.

### `AtelierTableShell`

Wraps a `<table>` (or any tabular layout) with rounded chrome,
sticky-header support (caller's `<thead>` `position: sticky`), overlay
loading state, and a pagination footer slot. Doesn't render the table
itself — keeps the primitive compatible with `@tanstack/react-table`
render functions.

### `AtelierPanel`

Side-panel/detail-drawer surface with header, scrollable body, and
sticky footer. `surface="medium"` (default, Atelier-tier modals) or
`"subtle"` (Workbench pages).

---

## Status mapping

`statusToVariant(domain, status)` lives in `status/mapper.ts`. 18 domains:

```
invoice, invoice-match, contractor, contractor-lifecycle, contract,
payment, payment-run, payment-run-item, approval, workflow-run,
workflow-task, einvoice-validation, einvoice-transmission,
peppol-participant, peppol-transmission, zatca, change-request, member
```

Each domain has a typed status union mirroring the corresponding Prisma
enum. Adding a new enum value without updating the mapper fails the
typecheck — every switch falls through to `assertExhaustive(value: never)`.

```tsx
import { statusToVariant, type InvoiceStatusInput, AtelierStatusPill } from '@contractor-ops/ui';

const variant = statusToVariant('invoice', invoice.status as InvoiceStatusInput);
<AtelierStatusPill variant={variant}>{label}</AtelierStatusPill>
```

The package can't import `@contractor-ops/db` (no server-runtime deps),
so the per-domain status types are mirrored as string literal unions.
TS will catch drift at the call site.

---

## Hooks

### `useReducedMotion()`

Reads `prefers-reduced-motion: reduce`. SSR-safe (returns `false` until
the first effect tick). Animated primitives **must** consult this — the
universal CSS rule disables animations, but JS-driven effects (rAF
loops, mouse tracking) need an explicit opt-out.

### `useHoverCapability()`

Reads `(hover: hover) and (pointer: fine)`. SSR-safe. JS-driven hover
effects (TiltCard mouse tracking, custom shimmer triggers) must consult
this so they degrade gracefully on touch.

---

## Constraints (the Workbench performance rules)

| Rule | Exhibition | Atelier | Workbench |
|---|---|---|---|
| `AtelierBackground` (orbs + grain) | Allowed | Allowed (1×) | **Banned** (component returns null) |
| `backdrop-filter` on repeated rows | N/A | N/A | **Banned** (>20× repetition) |
| `atelier-shimmer:hover` on rows | N/A | Cards only | **Banned** on rows |
| `atelier-tilt` on rows | N/A | Cards only | **Banned** on rows |
| `atelier-border-glow` count per viewport | Hero only | ≤3 | ≤1 |
| `atelier-hero-glow` (continuous gradient anim) | Hero only | Hero metric only | **Banned** |
| `glass-heavy` (blur 48px) | Hero panels | Modals, hero | **Banned** on persistent surfaces |
| `glass-medium` (blur 32px) | Allowed | Allowed | Page header only |
| Static `--surface-1` backgrounds | OK | OK | **Default** |

The shared CSS at `styles/glass.css` and `styles/motion.css` enforces
parts of this contract via `(hover: hover)` media gates and the
universal reduced-motion floor. The rest is style-discipline.

---

## Accessibility floor

Every primitive must:

- ✅ Honor `prefers-reduced-motion` (via the universal CSS rule + a JS
  opt-out for rAF loops)
- ✅ Honor `prefers-reduced-transparency` (glass classes fall back to
  solid `--surface-1`)
- ✅ Honor `prefers-contrast: more` (border + foreground darken via
  tokens.css)
- ✅ Render solid surfaces under `@media print`
- ✅ Use logical CSS (`-start`, `-end`, `inline-start`) for RTL safety
- ✅ Mark decorative SVGs/elements `aria-hidden`
- ✅ Carry `aria-label` on parents whose children animate (so AT
  hears the final state, not animation frames)

`Sparkline` enforces its own contract — the `srLabel` prop is required.

---

## Adding a new primitive

1. Drop the component in `components/atelier/` (premium) or
   `components/workbench/` (dense). Pick the directory by *who renders
   it* — if it's mostly used on operational pages, it's workbench.
2. Mark it `'use client'` only if it uses hooks or refs.
3. If it animates: consult `useReducedMotion()`. If it tracks the mouse:
   consult `useHoverCapability()`. If it should self-downgrade per page
   tier: consult `useAtelierIntensity()`.
4. Imports use explicit `.js` extensions (NodeNext module resolution):
   `import { foo } from './bar.js'`.
5. Re-export from the directory's `index.ts`. The package's
   `src/index.ts` re-exports both directories — no further wiring needed.
6. Add CSS keyframes/utilities to `styles/motion.css` with `atelier-`
   prefix to avoid collisions with app-specific animations.

---

## Workplan

The full design rationale, per-tier rules, and locked decisions live in
`docs/UI-ATELIER-WORKPLAN.md` at the repo root. The package's source
files cite specific workplan sections in their JSDoc.
