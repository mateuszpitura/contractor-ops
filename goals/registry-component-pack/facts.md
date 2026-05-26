# Facts — Registry Component Pack

> Scope: curate **tier-1 component pack** from 7 registries (magicui, aceternity, cult, originui, tailark, reui, shadcn.io) and apply across `apps/landing` (marketing + blog) and `apps/web-vite` (product). Related prior art: [`goals/shadcn-ecosystem-integration`](../shadcn-ecosystem-integration/facts.md). This pack is **narrower + opinionated** — picks the strongest component per slot, not a full library import.

## Foundation

- Registries already wired in [`packages/ui/components.json`](../../packages/ui/components.json) (`@magic`, `@aceternity`, `@cult`, `@origin`, `@tailark`, `@reui`, `@shadcnio`).
- Pre-populated registry folders: `magic/`, `ace/`, `atelier/`, `shadcn/`, `workbench/`.
- Empty registry folders to populate: `cult/`, `origin/`, `reui/`, `shadcnio/`, `tailark/`.
- All adds via `pnpm dlx shadcn add @<registry>/<name>` from `packages/ui` root (respects 7-day minimum-release-age via pnpm; no `@latest` bypass).
- All new components exported via `packages/ui/src/components/<registry>/index.ts` and surfaced through `@contractor-ops/ui/components/<registry>` subpath export already declared in [`packages/ui/package.json`](../../packages/ui/package.json).

## Pack contents — landing (10)

- **L1** `@aceternity/spotlight-new` → ambient lighting layer for hero background in `apps/landing/src/components/hero.tsx` (replaces static gradient div).
- **L2** `@magic/aurora-text` → gradient-animated keyword inside hero `<h1>` (e.g. "contractor ops", "compliance").
- **L3** `@magic/blur-fade` → staggered reveal wrapper for hero rows, archive grids, feature cards. Single component, reused across landing + blog.
- **L4** `@aceternity/infinite-moving-cards` → replaces static `apps/landing/src/components/sections/testimonials.tsx` row with auto-scrolling marquee, pause-on-hover.
- **L5** `@aceternity/world-map` → swap into `apps/landing/src/components/sections/integrations-grid.tsx` OR new "global coverage" band showing EU / UK / Gulf reach.
- **L6** `@aceternity/bento-grid` → refines existing `apps/landing/src/components/sections/bento-features.tsx` layout (already imported, formalize usage).
- **L7** `@cult/shift-card` → flagship feature card for "Why contractor-ops" section (one-off, hero-class).
- **L8** `@aceternity/moving-border` → gradient-border CTA variant used in `cta-band.tsx` and pricing primary CTA.
- **L9** `@tailark/pricing-*` → drop-in replacement for `apps/landing/src/components/pricing.tsx` core table (pick the 4-tier comparison variant; keep credits section separate).
- **L10** `@tailark/faqs-*` → animated accordion replacement for `apps/landing/src/components/sections/faq-section.tsx`.

## Pack contents — blog (4; L3 shared)

- **B1** `@magic/scroll-progress` → replaces `apps/landing/src/components/blog/reading-progress.tsx` (top-of-viewport bar, no custom scroll math).
- **B2** `@aceternity/tracing-beam` → side rail beam that follows scroll, anchors the TOC in `apps/landing/src/components/blog/toc.tsx`.
- **B3** `@aceternity/direction-aware-hover` → post card hover in `apps/landing/src/components/blog/post-card.tsx` (image follows cursor entry direction).
- **B4** `@magic/blur-fade` (shared with L3) → staggered reveal for blog archive cards in `apps/landing/src/app/[locale]/blog/page.tsx`.

## Pack contents — web-vite product (8)

- **W1** `@reui/command` → global command palette (cmd+k) for jump-to-contractor / invoice / contract.
- **W2** `@reui/data-grid` → high-density tables for contractors / invoices / contracts (replaces ad-hoc table-shell where pagination + sort + column controls matter).
- **W3** `@reui/kanban` → workflow board in `apps/web-vite/src/components/workflows/*` (drag-to-stage).
- **W4** `@reui/stepper` → onboarding wizard in `apps/web-vite/src/components/onboarding/*`, contract wizard in `contracts/contract-wizard/*`.
- **W5** `@reui/combobox` → searchable selects for contractor picker, category picker, classification.
- **W6** `@origin/file-upload` (or strongest dropzone variant) → document/OCR dropzone in `apps/web-vite/src/components/documents/*` and `ocr/*`.
- **W7** `@origin/phone-number-input` → phone field for contractor profile + portal sign-up.
- **W8** `@reui/timeline` → audit log view in `apps/web-vite/src/components/admin/*` and contract amendments timeline.

## Quality bars (apply to every fact above)

- **Accessibility:** WCAG 2.2 AA. Every interactive component has keyboard nav, visible focus ring, ARIA labels where Radix/Base UI doesn't auto-provide; contrast checked against design tokens in [`packages/ui/src/styles`](../../packages/ui/src/styles).
- **Motion:** every animated component respects `useReducedMotion()` from `motion/react` — degrades to instant/static when user opts out.
- **RTL:** all 4 locales (`en`, `de`, `pl`, `ar`) render correctly. Arabic = RTL flip. Verified by navigating to `/ar/*` for each surface.
- **i18n:** zero hard-coded English in new components; all strings via `useTranslations()` and added to `apps/landing/src/i18n/locales/{en,de,pl,ar,en-GB,ar-SA}.json`.
- **Bundle:** landing route JS ≤ baseline + 60 KB gzip; web-vite route JS ≤ baseline + 50 KB gzip; verified via `pnpm --filter @contractor-ops/landing build` + Next.js build output.
- **Type safety:** `pnpm typecheck` green at repo root; new components have strict prop types; no `any`.
- **Logger:** no `console.*` in any new code; use `@contractor-ops/logger`.
- **Pattern compliance:** web-vite components follow container + hooks split per [`apps/web-vite/ARCHITECTURE.md`](../../apps/web-vite/ARCHITECTURE.md); registry components live in `packages/ui/src/components/<registry>/` and are imported via subpath, not relative paths.
- **`frontend-design` skill:** consulted before every landing/blog surface change; typography + atmosphere choices documented inline where non-obvious.

## Out of scope

- New marketing pages (only swap existing surfaces).
- Payload CMS (`apps/cms`) component upgrades.
- 21st.dev integration or MCP server wiring (covered by [`goals/shadcn-ecosystem-integration`](../shadcn-ecosystem-integration/facts.md)).
- Tier-2 backlog: `@aceternity/wobble-card`, `@aceternity/magnetic-button`, `@aceternity/lamp-effect`, `@magic/animated-list`, `@magic/dock`, `@magic/orbiting-circles`, `@tailark/footer-*`, `@tailark/integrations-*`, `@tailark/features-*`, `@cult/typography`, `@origin/date-picker-*` variants, `@origin/otp-input`, `@reui/empty`, `@shadcnio/*` blocks. Reserved for follow-up goal.
- Replacing existing `@contractor-ops/atelier-*` primitives that are tightly bound to product brand (e.g. `AtelierStatusPill`, `Sparkline`) — keep as-is.

## Validation gate (re-audit after install)

- Run `pnpm typecheck && pnpm test && pnpm --filter @contractor-ops/landing build && pnpm --filter @contractor-ops/web-vite build` — all green.
- Manually walk `/`, `/blog`, `/blog/[slug]`, `/pricing`, `/ar/`, `/de/`, `/pl/` in dev; verify each tier-1 component renders, animates, and degrades under `prefers-reduced-motion`.
- Re-run this audit (the user-requested validation pass): does the installed pack still match the curated list above? Any drift → log in `plan.md` risk register.
