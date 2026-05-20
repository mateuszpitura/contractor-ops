# Facts — shadcn ecosystem integration

## Foundation

- A new workspace package `packages/ui` exists and is published internally via pnpm workspace alias `@contractor-ops/ui`.
- All existing shadcn primitives currently in `apps/web/src/components/ui/` are moved into `packages/ui/src/components/` (no duplication left in `apps/web`).
- `apps/web` and `apps/landing` import shadcn primitives from `@contractor-ops/ui`, not from local `components/ui`.
- A single shared Tailwind preset is exported from `packages/ui/tailwind-preset.ts` and consumed by both `apps/web` and `apps/landing`.
- A single shared `globals.css` with CSS variables (theme tokens) is exported from `packages/ui` and imported by both consumer apps.
- `pnpm typecheck` and `pnpm build` pass at repo root after the extraction.

## Community-first principle

- Default approach for any new UI surface: pull a community block (from shadcn/ui blocks, Magic UI, Aceternity, Cult UI, Origin UI, Tailark, ReUI, shadcn.io, 21st.dev) when one fits.
- Hand-rolled custom components are only built when no community block fits or when fit is < 70% (heavy edits required).
- Every adopted component is committed into `packages/ui` (or the relevant app) — no runtime dependency on registries.

## MCP integration

- The shadcn MCP server is configured in `.mcp.json` and reachable from Claude Code.
- The 21st.dev MCP server is configured and reachable from Claude Code.
- A developer can issue a natural-language request like "install an animated marquee" and Claude resolves it via MCP, installing the component into `packages/ui` (or the relevant app).
- A short doc at `packages/ui/README.md` lists supported registries + example prompts.

## Free libraries adopted

- The following libraries are wired into `packages/ui` or the relevant consumer app, all free / MIT: shadcn/ui official blocks, Magic UI, Aceternity UI (free tier), Cult UI, Origin UI, Tailark blocks, ReUI, shadcn.io community, 21st.dev community.
- Framer Motion is a runtime dependency of `packages/ui` — animation libs may be used anywhere in the codebase including `apps/web`.
- No paid licenses, subscriptions, or recurring costs are introduced.

## Blog architecture (clarification)

- Blog content (Posts, Authors, Categories) lives in **Payload CMS** at `apps/cms` — admin UI + REST/local API.
- Blog **public frontend routes** live in `apps/landing/[locale]/blog/` — Next.js pages that fetch from Payload and render with shadcn/community blocks.
- `apps/cms` is not user-facing for readers; only authors/editors log in there.

## Landing pages — `apps/landing`

### Home `/`
- Hero with animated bento grid (Aceternity + Magic UI).
- Animated customer logo marquee.
- Feature highlights section using Cult UI bento-reveal cards.
- Stats / social-proof band with Magic UI number tickers.
- "How it works" three-step section.
- Testimonials carousel using Magic UI marquee.
- Integrations grid (bank/accounting/Steuerberater) with hover cards.
- FAQ section using `Accordion`.
- Final CTA band.

### Pricing `/pricing`
- Plan cards row.
- Comparison matrix `Table` with `Tooltip` per feature.
- Monthly/yearly `Switch` toggle with smooth price transition.
- Currency selector (EUR/PLN/USD) via `Select`.
- FAQ block specific to pricing.

### Solutions `/solutions/[role]`
- Persona tabs: general contractor, subcontractor, accountant.
- Each persona has hero, pain-points list, workflow showcase, screenshot gallery, CTA.

### Changelog `/changelog`
- Vertical timeline.
- Version `Badge` chips (feature/fix/breaking).
- Filter by tag using `Select` + `Toggle Group`.
- RSS feed at `/changelog/rss.xml`.

### Compare `/compare/[competitor]`
- Heads-up comparison table vs known competitor (placeholder names allowed).
- Sticky column for contractor-ops.

### About `/about`
- Mission section, team grid (Avatar + Cult UI hover card), values, contact CTA.

### Legal / Trust `/security`
- Hero, compliance badges grid, FAQ, data-handling section. Uses shadcn `Card` + `Accordion`.

### Global landing chrome
- Sticky header with mega-menu (Solutions / Pricing / Blog / Changelog / Compare / Docs).
- Footer with sitemap, language switcher (`Select`), newsletter signup (Origin UI input + submit), social icons.
- Theme switcher (light/dark/system) via Cult UI animated toggle.
- 404 + 500 pages with Aceternity glare background.
- All landing pages render in `en`, `de`, `pl`, `ar` (RTL verified for `ar`).
- All landing pages score Lighthouse ≥ 90 Perf + A11y on production build.

## Blog frontend — `apps/landing/[locale]/blog/`

### Index `/blog`
- Card grid (3-col responsive) using Cult UI/Magic UI cards.
- Search `Input` with debounced query.
- Category `Select` and tag `Toggle Group` filters.
- Sort `Select` (latest / popular).
- Pagination component (or infinite scroll variant).
- Featured post hero at top.
- Skeleton loading states.

### Post detail `/blog/[slug]`
- Sticky right-side TOC built from headings (`ScrollArea`).
- Author card sidebar with Avatar + bio + social links.
- Breadcrumbs.
- Reading-progress bar (Magic UI) at top.
- Share dropdown (X, LinkedIn, copy link).
- Code blocks with syntax highlighting (Shiki) and copy button.
- Inline image components with caption + lightbox via `Dialog`.
- Related posts grid at bottom (3 cards).
- Comments OR reactions block (whichever lower-effort — pick reactions: 👍 ❤️ 🎉 with anon vote).
- Mobile TOC via `Sheet`.

### Author archive `/blog/author/[handle]`
- Author profile header (Avatar XL, bio, socials).
- Tabs: "Posts" / "Series".
- Post grid.

### Tag archive `/blog/tag/[tag]`
- Header with tag name + count.
- Filtered post grid.

### Blog-wide features
- RSS feed at `/blog/rss.xml`.
- OG image generation per post (Next.js `opengraph-image`).
- Sitemap entries for all posts.
- Newsletter signup CTA at end of every post.
- All blog routes work in `en`, `de`, `pl`, `ar`.
- All blog routes score Lighthouse ≥ 90 Perf + A11y.

## Payload CMS additions — `apps/cms`

- `Posts` collection: title, slug, excerpt, body (rich text), hero image, author (relation), categories (relation), tags (array), status (draft/published), publishedAt, SEO group.
- `Authors` collection: name, handle, avatar, bio (rich text), socials (array of url+label), email.
- `Categories` collection: name, slug, description, color.
- All three collections support i18n (en/de/pl/ar) on text fields.
- Posts support draft → publish workflow with preview URL.
- Admin role gating: editors can draft, only admins publish.

## Web dashboard — `apps/web`

### Global chrome
- Command palette (⌘K / Ctrl+K) mounted in `(dashboard)/layout.tsx`. Lists routes, contractor search, recent invoices, settings, theme toggle, locale switch.
- Sidebar revamp using shadcn `Sidebar` block — collapsible, groups, badges for counts.
- Top bar with breadcrumbs, search shortcut hint (`Kbd`), notifications popover, user menu.
- Theme switcher (Cult UI animated).
- Toast system upgrade — `sonner` with custom variants per domain.

### Dashboard home `/`
- Hero stats row using Magic UI number-ticker cards.
- Tremor charts: revenue line, payments by status donut, equipment utilization bar.
- Activity feed using shadcn `Card` + Cult UI hover.
- Quick actions grid (Bento layout).

### Settings hub `/settings`
- Vertical `Tabs` layout (sections: Profile, Organization, Billing, Notifications, Integrations, Security, Team, Danger Zone).
- Onboarding `Progress` card visible until 100%.
- Per-section forms use Origin UI primitives.
- Mobile: `Sheet` slide-over for sections.

### Contractors `/contractors`
- Table revamp using ReUI/shadcn data-table block (column visibility, filters, faceted filters, density toggle).
- Detail page tabs (already exist) get Cult UI hover treatments + animated tab indicator.
- Empty state with Magic UI animated illustration.

### Equipment `/equipment`
- Same data-table treatment as contractors.
- Equipment detail tabs with animated indicator.
- Calendar view for assignments using shadcn `Calendar` block.

### Payments `/payments`
- Table + bulk-select toolbar.
- Payment run wizard using shadcn `Stepper` (community).
- Status filter chips using `Toggle Group`.

### Invoices `/invoices`
- Table treatment.
- Invoice detail view with PDF preview pane (`ScrollArea`).
- Empty state polish.

### Onboarding flow
- Multi-step wizard using shadcn `Stepper` + Origin UI form primitives.
- Each step has progress + skip-for-now option.
- Confetti / animated success on completion (Magic UI).

### Notifications
- `Popover` from top bar with grouped notification list (`Tabs`: all / unread).
- Mark-all-read action.

### Forms primitives swap
- Origin UI replaces `Input`, `OTP`, `Switch`, `Slider`, password field, tags input, time pickers, phone input, date range picker.
- All existing form tests pass after swap.

### Empty / loading / error states
- Empty states across web get Magic UI animated illustrations + Cult UI hover CTAs.
- Loading skeletons audited and unified using shadcn `Skeleton`.
- Error boundaries get a polished page with retry CTA.

## Cross-cutting quality bars

- `pnpm typecheck` passes at repo root.
- All existing unit + integration test suites pass.
- E2E test suite (Playwright or current runner) passes against the new pages.
- No new ESLint or a11y-lint violations introduced.
- Bundle: landing route JS ≤ baseline + 80 KB gzip; web route JS ≤ baseline + 60 KB gzip.
- All new pages keyboard-navigable; focus ring visible; WCAG AA contrast respected.
- RTL verified on `ar` locale for hero, nav, blog, tables.

## Out of scope

- Backend tRPC routers (no API changes, no contract changes).
- Database schema (Prisma migrations) — Payload CMS additions live in CMS DB and are the only exception.
- Auth flow logic (Better Auth mechanics) — only primitive swap (Origin UI inputs), not authentication behavior.
- Marketing copy authoring beyond placeholder text — copywriting is a follow-up effort.
- Real customer testimonials/logos — placeholders OK; sourcing real ones is follow-up.
