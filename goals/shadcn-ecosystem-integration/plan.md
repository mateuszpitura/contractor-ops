# Plan — shadcn ecosystem integration

## Current state (verified)

- `packages/ui` already exists with `@contractor-ops/ui` workspace alias.
- Shared CSS tokens already exported: `tokens.css`, `glass.css`, `motion.css`, `status.css`.
- Both `apps/web` and `apps/landing` already import shared styles.
- `packages/ui/src/components/{atelier,workbench}` already host premium dashboard primitives + hooks (`useHoverCapability`, `useReducedMotion`).
- shadcn primitives still live in `apps/web/src/components/ui/` (not yet moved to `packages/ui`).
- `apps/landing` already depends on `motion` (Framer Motion).
- Payload CMS has `Posts` collection + i18n (en/pl/de/ar). Missing `Authors`, `Categories`.
- Tailwind v4 (CSS-config based, no tailwind.config files).
- shadcn registry config: `apps/web/components.json` uses style `base-nova`, ui alias `@/components/ui`.

## Solution approach

Five waves. Each wave is independently shippable. Foundation work first (W1) consolidates the already-partial shared package and wires MCP tooling. W2 hits the visible win (landing). W3 builds blog end-to-end (CMS + frontend). W4 upgrades the dashboard. W5 is hardening: i18n parity, Lighthouse, a11y, bundle budgets.

Community-first principle applied throughout: pull a block from shadcn/ui, Magic UI, Aceternity, Cult UI, Origin UI, Tailark, ReUI, shadcn.io, or 21st.dev before hand-rolling. All adopted code lives in the repo (no runtime registry deps).

## Wave 1 — Foundation + MCP

### 1.1 Move shadcn primitives to `packages/ui`

- Files: every `apps/web/src/components/ui/*.tsx` → `packages/ui/src/components/shadcn/*.tsx`.
- Update `apps/web/components.json` `aliases.ui` from `@/components/ui` → `@contractor-ops/ui/components/shadcn` (and verify shadcn CLI still installs into the new location).
- Add `apps/landing/components.json` with the same registry config so shadcn CLI works from `apps/landing` too.
- Update `packages/ui/src/index.ts` barrel to re-export shadcn primitives (`button`, `card`, `dialog`, etc.).
- Rewrite imports across `apps/web/src/**` from `@/components/ui/...` → `@contractor-ops/ui` using a codemod (jscodeshift or `tsx scripts/rewrite-ui-imports.ts`).
- Keep `apps/web/src/components/ui/` empty until verified, then delete.
- Verify: `pnpm typecheck && pnpm build && pnpm -F @contractor-ops/web test`.

### 1.2 Tailwind v4 shared source paths

- Confirm `apps/landing/src/app/globals.css` has `@source "../../../../packages/ui/src"` directive (matches web already).
- Verify: `pnpm -F @contractor-ops/landing build` produces utilities used in shared components.

### 1.3 MCP wiring

- Add `.mcp.json` at repo root (or augment existing) with:
  - `shadcn` MCP server (per `ui.shadcn.com/docs/mcp`)
  - `21st-dev` MCP server (per `21st.dev` docs)
- Test from Claude Code: ask "install marquee from magic ui" and verify install path lands in `packages/ui/src/components/marquee.tsx`.
- Document supported registries + prompt examples in `packages/ui/README.md`.

### 1.4 Animation deps consolidation

- Ensure `framer-motion` (or `motion`) is a direct dep of `packages/ui` (currently in `apps/landing`).
- Move to `peerDependencies` so consumer apps pin version.
- Verify: `pnpm -r typecheck`.

Verification gate for W1: `pnpm typecheck && pnpm build && pnpm test && pnpm -F @contractor-ops/web e2e` all green; visual diff on `apps/web` shows no regression (manual spot check on 3 routes).

## Wave 2 — Landing pages

### 2.1 Adopt animation + block libraries

- Install / copy-paste into `packages/ui/src/components/` via shadcn CLI or MCP:
  - From Aceternity: `bento-grid`, `glare-card`, `glowing-effect`, `hero-parallax`, `text-generate-effect`.
  - From Magic UI: `marquee`, `number-ticker`, `animated-beam`, `border-beam`, `retro-grid`, `shimmer-button`, `flickering-grid`.
  - From Cult UI: `family-button`, `direction-aware-hover`, `bento-reveal`, `feature-card`.
  - From Tailark: `pricing-table`, `feature-section`, `testimonials`, `cta-section`, `footer`, `header-mega-menu`.
  - From shadcn/ui official: `accordion`, `pagination`, `hover-card`, `carousel`, `kbd`, `chart`.
- Files: `packages/ui/src/components/{ace,magic,cult,tailark}/*.tsx`.
- Verify: `pnpm -F @contractor-ops/ui typecheck`.

### 2.2 Build landing sections

Each section is one component under `apps/landing/src/components/sections/`:

- `hero.tsx` — Aceternity hero + Magic UI text effects.
- `bento-features.tsx` — Aceternity bento grid + Cult UI reveal cards.
- `logo-marquee.tsx` — Magic UI marquee.
- `stats-band.tsx` — Magic UI number tickers.
- `how-it-works.tsx` — 3-step layout with Aceternity glare cards.
- `testimonials.tsx` — Magic UI marquee + Cult UI hover cards.
- `integrations-grid.tsx` — hover cards with logos.
- `faq.tsx` — `Accordion`.
- `cta-band.tsx` — shimmer button.
- `header.tsx` — sticky mega-menu (Tailark + custom).
- `footer.tsx` — Tailark footer + newsletter signup.

### 2.3 Wire pages

- `apps/landing/src/app/[locale]/page.tsx` — compose home sections.
- `apps/landing/src/app/[locale]/pricing/page.tsx` — comparison matrix + currency/billing toggles.
- `apps/landing/src/app/[locale]/solutions/[role]/page.tsx` — persona tabs (new dynamic route).
- `apps/landing/src/app/[locale]/changelog/page.tsx` + `changelog/rss.xml/route.ts` — timeline + RSS.
- `apps/landing/src/app/[locale]/compare/[competitor]/page.tsx` — heads-up table.
- `apps/landing/src/app/[locale]/about/page.tsx` — team grid.
- `apps/landing/src/app/[locale]/security/page.tsx` — trust page.
- 404 + 500 pages with Aceternity background.

### 2.4 i18n + RTL

- Add new translation keys to `apps/landing/messages/{en,de,pl,ar}.json`.
- RTL audit: verify `ar` locale on every section (mega-menu, marquee direction, hero alignment).
- Verify: `pnpm i18n:parity && pnpm i18n:code-coverage`.

### 2.5 Theme switcher + language switcher

- Cult UI animated theme toggle in `apps/landing/src/components/theme-switcher.tsx`.
- Language `Select` in footer + header.

Verification gate for W2: visual screenshot diff per locale; Lighthouse ≥ 90 on `/`, `/pricing`, `/solutions/general-contractor`, `/changelog`; `pnpm -F @contractor-ops/landing build` green.

## Wave 3 — Blog (Payload + frontend)

### 3.1 Payload schema additions

- New collection: `apps/cms/src/collections/Authors.ts` with fields: name, handle (slug), avatar (Media relation), bio (lexical), socials (array {url,label}), email.
- New collection: `apps/cms/src/collections/Categories.ts` with fields: name, slug, description, color.
- Extend `Posts.ts` with: author (relation→Authors), categories (relation→Categories, hasMany), tags (array of text), heroImage (Media), excerpt, SEO group (title/description/ogImage), readingTimeMinutes (computed hook).
- Register in `apps/cms/src/payload.config.ts` collections array.
- Verify: run `pnpm -F @contractor-ops/cms payload migrate:create blog-collections && pnpm -F @contractor-ops/cms payload migrate`; check `apps/cms/src/payload-types.ts` regenerates.

### 3.2 Payload → Next data layer

- Create `apps/landing/src/lib/cms.ts` with typed fetchers: `getPosts({locale, page, category, tag, search})`, `getPost({slug, locale})`, `getAuthor({handle, locale})`, `getRelatedPosts({postId, limit})`.
- Use Payload REST or local API; reuse generated types from `apps/cms/src/payload-types.ts`.
- Add ISR via `revalidate: 300` per route.
- Verify: unit tests in `apps/landing/src/lib/__tests__/cms.test.ts` mock fetch responses.

### 3.3 Blog routes

- `apps/landing/src/app/[locale]/blog/page.tsx` — index grid + filters + pagination + featured hero.
- `apps/landing/src/app/[locale]/blog/[slug]/page.tsx` — detail with TOC, author card, share, related, reactions.
- `apps/landing/src/app/[locale]/blog/author/[handle]/page.tsx` — author archive.
- `apps/landing/src/app/[locale]/blog/tag/[tag]/page.tsx` — tag archive.
- `apps/landing/src/app/[locale]/blog/rss.xml/route.ts` — RSS handler.
- `apps/landing/src/app/[locale]/blog/[slug]/opengraph-image.tsx` — OG image generation.

### 3.4 Blog components

- `apps/landing/src/components/blog/post-card.tsx` — Cult UI hover treatment.
- `apps/landing/src/components/blog/toc.tsx` — sticky `ScrollArea` + active heading observer.
- `apps/landing/src/components/blog/reading-progress.tsx` — Magic UI.
- `apps/landing/src/components/blog/share-dropdown.tsx` — `DropdownMenu`.
- `apps/landing/src/components/blog/reactions.tsx` — emoji reactions (anon, localStorage or Payload endpoint).
- `apps/landing/src/components/blog/code-block.tsx` — Shiki SSR highlight + copy button.
- `apps/landing/src/components/blog/newsletter-cta.tsx` — Origin UI input + submit.

### 3.5 Sitemap + RSS + OG

- Extend `apps/landing/src/app/sitemap.ts` to include blog post URLs from Payload.
- Verify: `curl localhost:3001/en/blog/rss.xml` returns valid Atom; OG image renders.

Verification gate for W3: 5 posts seeded in Payload across 4 locales; all blog routes render; Lighthouse ≥ 90; `pnpm i18n:parity` green.

## Wave 4 — Web dashboard upgrades

### 4.1 Global chrome

- Command palette: `apps/web/src/components/command-palette.tsx`, mounted in `apps/web/src/app/[locale]/(dashboard)/layout.tsx`. Uses shadcn `Command` + `Dialog`. ⌘K / Ctrl+K shortcut. Sections: routes, contractor search (tRPC `contractor.list`), recent invoices (tRPC), settings, theme, locale.
- Sidebar revamp: replace `apps/web/src/components/dashboard/sidebar.tsx` with shadcn `Sidebar` block; add badges for counts (pending invoices, etc.) via tRPC.
- Top bar: breadcrumb + notifications popover + user menu.
- Theme switcher: Cult UI animated toggle.
- Toast variants: extend `sonner` setup in `apps/web/src/components/ui/sonner.tsx` with domain variants.

### 4.2 Dashboard home

- `apps/web/src/app/[locale]/(dashboard)/page.tsx` — stats row (Magic UI number tickers), Tremor charts (revenue, payments by status, equipment utilization), activity feed, quick actions bento.
- Add `@tremor/react` (free, MIT) to `apps/web` deps.

### 4.3 Settings hub

- Rewrite `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` with vertical `Tabs`.
- Sections: Profile / Organization / Billing / Notifications / Integrations / Security / Team / Danger Zone.
- Onboarding `Progress` card (computes from existing user state via tRPC).
- Mobile: `Sheet` slide-over.

### 4.4 Tables + detail pages

- Contractors table (`apps/web/src/components/contractors/contractor-table/*.tsx`) → ReUI/shadcn data-table block with column visibility, faceted filters, density toggle.
- Equipment table (`apps/web/src/components/equipment/equipment-table/equipment-table.tsx`) → same treatment.
- Invoice table (`apps/web/src/components/invoices/invoice-table/data-table.tsx`) → same treatment.
- Payment run + invoice selection tables (`apps/web/src/components/payments/**/data-table.tsx`) → same.
- Detail tab indicators get animated underline (Cult UI / Magic UI pattern).
- Empty states across tables get Magic UI animated illustrations.

### 4.5 Forms primitive swap (Origin UI)

- Install Origin UI components via shadcn CLI into `packages/ui/src/components/origin/`.
- Replace primitives in:
  - `apps/web/src/components/contractors/contractor-wizard/*.tsx`
  - `apps/web/src/app/[locale]/(dashboard)/settings/**`
  - `apps/web/src/app/[locale]/(auth)/**`
  - `apps/web/src/app/[locale]/(portal)/portal/login/**`
- Components: `Input`, `OTP`, `Switch`, `Slider`, password field, tags input, time pickers, phone input, date range picker.
- Verify: all existing form tests pass after each swap; `pnpm -F @contractor-ops/web test`.

### 4.6 Onboarding wizard

- Multi-step wizard using shadcn `Stepper` (community block from shadcn.io).
- Confetti / animated success on completion (Magic UI).

### 4.7 Notifications

- `Popover` in top bar with grouped notification list (`Tabs`: all / unread).
- Wire to existing notifications service (read-only initially).

Verification gate for W4: command palette demo works; `pnpm -F @contractor-ops/web test && pnpm -F @contractor-ops/web e2e`; manual a11y check (focus, keyboard, screen reader on settings + tables).

## Wave 5 — Hardening

### 5.1 i18n parity

- Run `pnpm i18n:parity` and `pnpm i18n:code-coverage` until clean.
- RTL audit on `ar` for: hero, sidebar, tables, blog detail TOC, mega-menu.

### 5.2 Performance

- Lighthouse CI on:
  - `apps/landing` routes: `/`, `/pricing`, `/blog`, `/blog/[slug]`, `/changelog`.
  - Bundle budget enforcement: landing ≤ baseline + 80 KB gzip; web ≤ baseline + 60 KB gzip.
- Add `next/dynamic` boundaries around Framer Motion heavy components below the fold.
- Verify: `pnpm -F @contractor-ops/landing build` size report; `pnpm e2e:perf`.

### 5.3 Accessibility

- Axe scan on every new page.
- Keyboard nav verified on: command palette, mega-menu, blog TOC, settings tabs, data tables.
- Focus ring tokens consistent across `packages/ui` components.

### 5.4 Docs

- Update `packages/ui/README.md` with: adopted libraries, MCP setup, usage examples.
- Add `apps/landing/README.md` blog authoring guide (Payload login → draft → publish).
- Update root `CLAUDE.md` if new conventions emerge.

Verification gate for W5: all CI checks green on PR; Lighthouse ≥ 90 on all targeted routes; no new a11y violations; bundle budgets within limits.

## Files / systems touched (summary)

- **packages/ui/** — shadcn primitives, ace/magic/cult/tailark/reui blocks, origin forms, index barrel, README.
- **apps/web/** — components.json, all routes under `[locale]/(dashboard)/`, all components under `src/components/`, globals.css, command palette, sidebar, settings, tables, forms.
- **apps/landing/** — components.json, all routes under `[locale]/`, new sections folder, blog folder, CMS data layer, sitemap, RSS, OG image generation.
- **apps/cms/** — `collections/Authors.ts`, `collections/Categories.ts`, extended `Posts.ts`, payload.config.ts, migrations.
- **Root** — `.mcp.json`, possibly `turbo.json` for new pipelines (lighthouse).

## Risks + open questions

- **Risk: `headless-blog-cms` goal already exists** in `goals/`. Overlap on Payload Posts collection. Need to reconcile before W3 — read `goals/headless-blog-cms/facts.md` and confirm we extend rather than conflict.
- **Risk: shadcn primitive move codemod scope is large** — many import sites in `apps/web`. Mitigation: codemod + grep verification; split into one commit per import-source pattern.
- **Risk: bundle budget on landing** with Aceternity + Magic UI + Tailark all on home page. Mitigation: dynamic imports for below-fold sections, audit `motion` tree-shake.
- **Risk: RTL on Magic UI marquee** — animation direction may not auto-flip. Mitigation: explicit `reverse` prop wired to `useLocale()`.
- **Risk: Payload REST cache invalidation** when post published. Mitigation: `revalidatePath` webhook from Payload `afterChange` hook.
- **Risk: Origin UI primitive API divergence from current shadcn API** — drop-in not guaranteed. Mitigation: per-primitive adapter shim; swap one at a time with tests.
- **Risk: existing `packages/ui` atelier/workbench naming** — may clash with new shadcn import paths. Mitigation: namespace shadcn under `components/shadcn/` to avoid collision with atelier/workbench.
- **Open question: comments vs reactions** on blog detail — reactions is anon (localStorage). Confirm with user during W3 if comments need real auth.
- **Open question: competitor names** in `/compare/[competitor]` — placeholder list or real? Confirm before W2.
- **Open question: PR strategy** — one big branch per wave, or one PR per sub-task? Recommendation: PR per sub-task, branch per wave.
