# Plan — Headless Blog + CMS (Payload)

## Solution approach

Build a new Next.js 16 app `apps/cms` that hosts the Payload CMS admin under `/admin/*` and the public blog frontend at the root (`/`, `/[locale]/blog`, `/[locale]/blog/[slug]`). Payload connects to a dedicated Neon Postgres via `CMS_DATABASE_URL` using `@payloadcms/db-postgres`. Media uploads route to Cloudflare R2 via `@payloadcms/storage-s3` (reusing existing R2 credentials). Three collections: `posts`, `media`, `legal-documents`. Localization plugin enables `en`/`pl`/`de`/`ar` on all content fields.

`apps/web` switches its hardcoded legal pages (`privacy`, `terms`, `sub-processors`, `breach-notification`) to fetch from Payload REST API by `(type, jurisdiction, locale)`. A new `/api/revalidate-legal` route in `apps/web` receives HMAC-signed webhooks from Payload `afterChange`/`afterDelete` hooks and calls `revalidateTag()`. A one-shot migration script reads the existing legal TSX content and seeds Payload.

`apps/landing` stays static; its footer "Blog" link flips from `#` to `https://blog.contractor-ops.io`.

Deploy as a new Render web service `cms` in `render.yaml`.

---

## Phase A — Scaffold apps/cms (no Payload yet)

### A1. Add `apps/cms` skeleton

- Create `apps/cms/package.json` named `@contractor-ops/cms`, scripts mirroring `apps/web` (`dev` on port 3002, `build`, `start`, `lint`, `typecheck`, `test`).
- Create `apps/cms/next.config.ts` with `output: 'standalone'`, webpack builder, `transpilePackages: ['@contractor-ops/logger', '@contractor-ops/ui']`.
- Create `apps/cms/tsconfig.json` extending root config (match `apps/web/tsconfig.json` baseline).
- Create `apps/cms/src/app/layout.tsx`, `apps/cms/src/app/page.tsx` (placeholder).
- Create `apps/cms/biome.json` (or rely on root) and verify `pnpm lint` passes.

**Files touched:** `apps/cms/{package.json,next.config.ts,tsconfig.json,src/app/{layout.tsx,page.tsx}}`, `pnpm-lock.yaml`.

**Verification:**
- `pnpm install` succeeds.
- `pnpm --filter @contractor-ops/cms typecheck` succeeds.
- `pnpm --filter @contractor-ops/cms dev` starts on port 3002 and serves the placeholder page.

### A2. Wire into Turborepo

- Confirm `pnpm-workspace.yaml` glob `apps/*` picks up `apps/cms` (no edit needed).
- Add `apps/cms` to root `postinstall` if it needs builds (likely not — Payload runs at dev time).
- Verify `turbo build --filter=@contractor-ops/cms` produces a `.next/` output.

**Verification:**
- `turbo build --filter=@contractor-ops/cms` exits 0.
- `turbo typecheck --filter=@contractor-ops/cms` exits 0.

**Risk:** webpack alias `.js → .ts/.tsx` from `apps/web/next.config.ts` may also be needed if `apps/cms` imports `@contractor-ops/logger` (ESM workspace package). Copy the `webpack(config)` block from `apps/web/next.config.ts` if imports fail at build.

---

## Phase B — Install and configure Payload CMS

### B1. Install Payload + adapters

- Add deps to `apps/cms`: `payload`, `@payloadcms/next`, `@payloadcms/richtext-lexical`, `@payloadcms/db-postgres`, `@payloadcms/storage-s3`, `@payloadcms/plugin-localization` (if separate in v3), `sharp` (image processing).
- Use `pnpm add` inside `apps/cms`. Respect `minimumReleaseAge: 10080` from `pnpm-workspace.yaml` — if a Payload release is <7 days old, pin to the previous version.
- Verify `find-docs` (Context7) for current Payload v3 API before writing config — Payload v3 uses Next.js App Router integration that differs from v2.

**Files touched:** `apps/cms/package.json`, `pnpm-lock.yaml`.

**Verification:**
- `pnpm install` succeeds without minimum-release-age violations.
- `node -e "require('payload')"` runs (from apps/cms cwd via `pnpm node`).

### B2. Create `payload.config.ts`

- Create `apps/cms/src/payload.config.ts` with: `db: postgresAdapter({ pool: { connectionString: env.CMS_DATABASE_URL } })`, `editor: lexicalEditor()`, `localization: { locales: ['en','pl','de','ar'], defaultLocale: 'en', fallback: true }`, `secret: env.PAYLOAD_SECRET`, `collections: [Posts, Media, LegalDocuments, Users]`, `plugins: [s3Storage({ collections: { media: true }, bucket: env.R2_BUCKET, config: { endpoint, credentials, region: 'auto' } })]`.
- Create `apps/cms/src/collections/Posts.ts`, `Media.ts`, `LegalDocuments.ts`, `Users.ts` matching the field shape from `facts.md`.
- Add Payload Next.js route handlers under `apps/cms/src/app/(payload)/admin/[[...segments]]/page.tsx` and `apps/cms/src/app/api/[...slug]/route.ts` per Payload v3 template.
- Create `apps/cms/src/app/(payload)/layout.tsx` with Payload providers.

**Files touched:** `apps/cms/src/payload.config.ts`, `apps/cms/src/collections/{Posts,Media,LegalDocuments,Users}.ts`, `apps/cms/src/app/(payload)/admin/**`, `apps/cms/src/app/api/[...slug]/route.ts`.

**Verification:**
- `pnpm --filter @contractor-ops/cms dev` starts; `http://localhost:3002/admin` renders Payload login UI.
- `pnpm --filter @contractor-ops/cms typecheck` exits 0 (Payload generates types into `apps/cms/payload-types.ts`).

### B3. Env vars + `.env.example`

- Add to `.env.example`: `CMS_DATABASE_URL`, `PAYLOAD_SECRET`, `CMS_ADMIN_EMAIL`, `CMS_ADMIN_PASSWORD`, `CMS_WEBHOOK_SECRET`, `CMS_PUBLIC_URL=http://localhost:3002`.
- Note that `R2_*` env vars already exist in `.env.example` from `apps/web`; reuse them (no duplication).
- Document the new vars at the top of `apps/cms/README.md` (file created in Phase G).

**Files touched:** `.env.example`.

**Verification:**
- `pnpm run check:no-process-env` (existing root script) still passes.
- Grep `.env.example` shows all 5 new vars.

### B4. Bootstrap admin seed script

- Create `apps/cms/scripts/seed-admin.ts` using Payload Local API: if `users` collection empty, create one with email/password from env.
- Add npm script `seed:admin` in `apps/cms/package.json`.

**Verification:**
- Drop dev CMS DB, run `pnpm --filter @contractor-ops/cms seed:admin`, log into `/admin` with seeded creds successfully.

### B5. Initial Payload migration

- Run `pnpm --filter @contractor-ops/cms exec payload migrate:create initial` to generate `apps/cms/src/migrations/<timestamp>_initial.ts`.
- Commit the migration file. Add `migrate` and `migrate:create` scripts to `apps/cms/package.json`.

**Files touched:** `apps/cms/src/migrations/<timestamp>_initial.ts`, `apps/cms/package.json`.

**Verification:**
- `pnpm --filter @contractor-ops/cms exec payload migrate` applies the migration to a clean DB and the admin UI loads collections.

---

## Phase C — Public blog frontend in apps/cms

### C1. Locale routing

- Create `apps/cms/src/app/[locale]/layout.tsx` and `apps/cms/src/app/[locale]/page.tsx`.
- Implement minimal locale detection in middleware or root `page.tsx` redirecting `/` → `/en`.
- Decision: use a thin custom locale gate (not `next-intl`) to avoid pulling next-intl into a CMS-only app. Reuse `apps/landing/src/i18n/config.ts` locale list by copying or extracting to a shared `packages/ui` helper if not yet shared.

**Files touched:** `apps/cms/src/app/[locale]/{layout,page}.tsx`, `apps/cms/src/app/page.tsx` (redirect), `apps/cms/src/i18n/config.ts` (local copy).

**Verification:**
- `/` redirects to `/en`. `/pl`, `/de`, `/ar` render their layouts.
- `/xx` (invalid locale) returns 404.

### C2. Blog list page

- Create `apps/cms/src/app/[locale]/blog/page.tsx` (server component).
- Use Payload Local API: `import { getPayload } from 'payload'; import config from '@/payload.config'; const payload = await getPayload({ config });` then `payload.find({ collection: 'posts', where: { status: { equals: 'published' }, publishedAt: { less_than_equal: new Date() } }, locale, sort: '-publishedAt', limit: 10, page })`.
- Add pagination params via `searchParams`.
- Use frontend-design plugin (per CLAUDE.md) for the visual layout — production-grade card grid.
- `export const revalidate = 60`.

**Files touched:** `apps/cms/src/app/[locale]/blog/page.tsx`, `apps/cms/src/components/blog/post-card.tsx`.

**Verification:**
- Seed 3 dummy published posts via admin UI. `/en/blog` lists them sorted desc.
- Setting a post status to `draft` removes it from the list within 60s (or after `revalidateTag` is wired in C5).

### C3. Blog detail page

- Create `apps/cms/src/app/[locale]/blog/[slug]/page.tsx`.
- Fetch by `{ slug: { equals: params.slug }, status: { equals: 'published' } }, locale`.
- 404 via `notFound()` if no result or post exists only in another locale (no fallback).
- Render Lexical rich-text via `@payloadcms/richtext-lexical/react`.
- Emit `<link rel="alternate" hreflang="...">` for every locale where the post exists (query each locale).
- Export `generateMetadata` for `<title>`, `<meta description>`, OG/Twitter tags pointing at OG image route (C6).

**Files touched:** `apps/cms/src/app/[locale]/blog/[slug]/page.tsx`, `apps/cms/src/lib/lexical-renderer.tsx`.

**Verification:**
- `/en/blog/my-post` renders the seeded post.
- `/de/blog/my-post` 404s if no German translation exists.
- View source shows `<link rel="alternate" hreflang="en">` etc. for available locales.

### C4. RSS and sitemap

- Create `apps/cms/src/app/[locale]/feed.xml/route.ts` returning RSS 2.0 XML of latest 20 published posts in the requested locale.
- Create `apps/cms/src/app/sitemap.xml/route.ts` returning sitemap with all locales × all published posts + locale homepages.

**Files touched:** `apps/cms/src/app/[locale]/feed.xml/route.ts`, `apps/cms/src/app/sitemap.xml/route.ts`.

**Verification:**
- `curl http://localhost:3002/en/feed.xml` returns valid RSS XML (validate via `xmllint --noout`).
- `curl http://localhost:3002/sitemap.xml` lists all expected URLs.

### C5. On-demand revalidation hook for posts

- In `apps/cms/src/collections/Posts.ts`, add `hooks: { afterChange: [revalidatePostHook], afterDelete: [revalidatePostHook] }` that calls Next's `revalidateTag('posts:list:<locale>')` and `revalidateTag('post:<id>')`.
- Use `next/cache` `revalidateTag` directly (Payload runs inside Next process — same runtime).

**Files touched:** `apps/cms/src/collections/Posts.ts`, `apps/cms/src/hooks/revalidate-post.ts`.

**Verification:**
- Edit a post in admin UI, save, reload `/en/blog` — change visible within 1s without waiting 60s ISR.

### C6. OG image generation

- Create `apps/cms/src/app/[locale]/blog/[slug]/og.png/route.ts` using `ImageResponse` from `next/og`.
- Render branded card: post title + author + brand mark, 1200×630.
- Reference URL in `generateMetadata` from C3.

**Files touched:** `apps/cms/src/app/[locale]/blog/[slug]/og.png/route.ts`.

**Verification:**
- `curl -I http://localhost:3002/en/blog/my-post/og.png` returns 200 image/png.
- Twitter/Facebook OG debuggers preview correctly (manual smoke).

---

## Phase D — Migrate legal docs from TSX to CMS

### D1. Migration script

- Create `apps/cms/scripts/migrate-legal-from-tsx.ts`.
- Read TSX files: `apps/web/src/app/[locale]/(legal)/legal/privacy/(content)/{gb,de,eu}/page.tsx`, `apps/web/.../legal/terms/page.tsx`, `apps/web/.../legal/sub-processors/page.tsx`, `apps/web/.../legal/breach-notification/page.tsx`.
- For privacy: each file maps 1:1 to one `(type='privacy', jurisdiction=<slug>, locale='en')` entry. German/Polish/Arabic translations come from `apps/web/messages/{en,de,pl,ar}.json` `Legal.privacy.*` keys — for each jurisdiction, build per-locale body by combining the structural TSX (headings/structure) with translated strings where they exist; otherwise leave English body.
- For terms/sub-processors/breach-notification: current pages are not jurisdiction-split. Migrate as single `(type, jurisdiction='eu')` entries — flag in script log that GB/DE/AE/SA variants need legal review.
- Convert TSX JSX (using `@/components/legal/privacy-prose` H1/H2/P/Strong/Ul/Li) to Payload Lexical JSON: write a small AST converter that walks the JSX element tree and produces Lexical nodes.
- Idempotency: upsert by `(type, jurisdiction)` — `payload.find` first, then `update` or `create`.
- Set `version: '1.0.0'`, `effectiveDate: new Date('2026-01-01')` on initial migrate.

**Files touched:** `apps/cms/scripts/migrate-legal-from-tsx.ts`, `apps/cms/src/lib/tsx-to-lexical.ts`.

**Verification:**
- Run script against dev CMS DB. Inspect admin UI: 5 legal-documents entries (privacy/gb, privacy/de, privacy/eu, terms/eu, sub-processors/eu, breach-notification/eu — actually 6).
- Re-run script: log shows "updated" not "duplicated"; entry count unchanged.
- Spot-check rendered body in admin UI for privacy/eu — headings + paragraphs preserved.

### D2. Update apps/web legal pages to fetch from CMS

- Rewrite `apps/web/src/app/[locale]/(legal)/legal/privacy/[jurisdiction]/page.tsx` (need to create — currently uses `(content)/{eu,de,gb}/page.tsx` static segments) to a dynamic route `apps/web/src/app/[locale]/(legal)/legal/privacy/[jurisdiction]/page.tsx` that:
  - Validates `jurisdiction` via `isPrivacyJurisdictionSlug` from `_resolve.ts`.
  - Fetches from `${CMS_PUBLIC_URL}/api/legal-documents?where[type][equals]=privacy&where[jurisdiction][equals]=<slug>&locale=<locale>` with `next: { tags: ['legal:privacy:<jurisdiction>'] }`.
  - Renders body using a shared Lexical renderer (publish from `apps/cms` as a tiny package OR copy into `packages/ui`).
- Keep `apps/web/src/app/[locale]/(legal)/legal/privacy/page.tsx` (index) as-is — its redirect logic via `_resolve.ts` is unchanged.
- Rewrite `apps/web/.../legal/terms/page.tsx`, `sub-processors/page.tsx`, `breach-notification/page.tsx` to fetch from CMS by `(type, jurisdiction='eu', locale)`.
- Delete `apps/web/src/app/[locale]/(legal)/legal/privacy/(content)/{eu,de,gb}/page.tsx` and the `(content)/` route group.
- Update `apps/web/src/app/[locale]/(legal)/legal/privacy/__tests__/privacy-{de,eu,gb}.test.tsx` to mock the CMS fetch (or convert to integration test hitting a test Payload instance — start with mock).

**Files touched:**
- create: `apps/web/src/app/[locale]/(legal)/legal/privacy/[jurisdiction]/page.tsx`
- modify: `apps/web/src/app/[locale]/(legal)/legal/{terms,sub-processors,breach-notification}/page.tsx`
- delete: `apps/web/src/app/[locale]/(legal)/legal/privacy/(content)/`
- modify: 3× test files
- modify: `apps/web/src/components/legal/privacy-notice-layout.tsx` if structure changes (likely keep wrapper, change children source)

**Verification:**
- `pnpm --filter @contractor-ops/web test` passes.
- Local dev: `apps/web` on :3000, `apps/cms` on :3002. Visit `/en/legal/privacy/eu` in web — renders CMS-sourced content.
- Edit privacy/eu in CMS admin, save, reload web page — webhook (D3) triggers, content updates.

### D3. Revalidation webhook contract

- Create `apps/web/src/app/api/revalidate-legal/route.ts`:
  - POST handler. Verify HMAC of body with `CMS_WEBHOOK_SECRET` (constant-time compare).
  - Parse `{ type, jurisdiction, locale }`. Call `revalidateTag(\`legal:${type}:${jurisdiction}\`)`.
  - Return 200 `{ ok: true }` or 401 on bad signature.
- In `apps/cms/src/collections/LegalDocuments.ts`, add `afterChange` and `afterDelete` hooks that POST to `${env.WEB_APP_URL}/api/revalidate-legal` with HMAC header.
- Add `WEB_APP_URL` and `CMS_WEBHOOK_SECRET` to `apps/cms/.env.example` snippet and root `.env.example`.

**Files touched:**
- `apps/web/src/app/api/revalidate-legal/route.ts`
- `apps/cms/src/collections/LegalDocuments.ts`
- `apps/cms/src/hooks/revalidate-legal.ts`
- `.env.example`

**Verification:**
- Edit privacy/eu in CMS, save. Web app shows updated content within 1-2s (server log shows `revalidateTag` invocation).
- POST to `/api/revalidate-legal` with wrong signature returns 401.
- POST with no body returns 400.

**Risk:** local dev — `apps/cms` on :3002 must reach `apps/web` on :3000. Use `WEB_APP_URL=http://localhost:3000` in dev. In prod the hook hits `https://app.contractor-ops.io/api/revalidate-legal`.

---

## Phase E — Landing footer link

### E1. Flip "Blog" href in landing footer

- In `apps/landing/src/components/footer.tsx`, replace `{ label: 'Blog', href: '#' }` with `{ label: 'Blog', href: 'https://blog.contractor-ops.io', external: true }`.
- Open links with `target="_blank" rel="noopener noreferrer"` when `external: true`.
- Also flip `Privacy Policy`, `Terms of Service` if their `href: '#'` should point at `apps/web` legal routes — out of scope of this goal unless trivial; flag in plan log.

**Files touched:** `apps/landing/src/components/footer.tsx`.

**Verification:**
- `pnpm --filter @contractor-ops/landing dev` (port 3001). Footer "Blog" link navigates to `blog.contractor-ops.io`.
- `pnpm --filter @contractor-ops/landing build` (static export) succeeds.

---

## Phase F — Render deploy config

### F1. Add `cms` service to `render.yaml`

- Add a new entry under `services:` named `cms`, type `web`, runtime `docker` (matching `web` service pattern), region `frankfurt`, port `3000` (Render convention).
- Reference `app-shared` env var group for shared bits (R2_*, NODE_ENV).
- Add CMS-specific env vars on the service (sync: false): `CMS_DATABASE_URL`, `PAYLOAD_SECRET`, `CMS_ADMIN_EMAIL`, `CMS_ADMIN_PASSWORD`, `CMS_WEBHOOK_SECRET`, `WEB_APP_URL`.
- Create `apps/cms/Dockerfile` (copy pattern from `apps/web/Dockerfile`).
- Custom domain `blog.contractor-ops.io` bound in Render dashboard post-deploy (not in YAML).

**Files touched:** `render.yaml`, `apps/cms/Dockerfile`, optionally `apps/cms/.dockerignore`.

**Verification:**
- `docker build -f apps/cms/Dockerfile .` succeeds locally.
- (Manual, post-merge) Render Blueprint sync provisions the service without errors.

**Note:** facts.md says "deploy config done manually in Render dashboard for MVP" — but adding to `render.yaml` is the project convention. Add it to YAML to stay consistent; mark manual step as just DNS/custom-domain binding.

---

## Phase G — Documentation

### G1. apps/cms/README.md

- Create `apps/cms/README.md` covering: local dev (`pnpm dev`, seed admin), env vars, adding a new collection, deploy via Render, webhook contract with apps/web, R2 setup, migration script usage.

**Files touched:** `apps/cms/README.md`.

**Verification:** human review.

### G2. Update root README / docs

- Add `apps/cms` to top-level repo description if a list exists.

---

## Order of operations

A1 → A2 → B1 → B2 → B3 → B4 → B5 → C1 → C2 → C3 → C5 → C4 → C6 → D1 → D2 → D3 → E1 → F1 → G1.

D2 depends on D1 (entries must exist before fetch-based pages can render). D3 should land in the same PR as D2 to avoid a window where edits in CMS don't propagate.

C5 (revalidate hook) earlier than C4 (RSS/sitemap) so that posting a new post invalidates the feed list as well.

---

## Risks & open questions

1. **Payload v3 + Next 16 compatibility.** Payload v3 GA targets Next 15. Verify via `find-docs payload-next.js` before B1; if incompatible, either downgrade `apps/cms` to Next 15 (allowed — version need only match across web/landing for shared packages) or wait. **Mitigation:** start with a `find-docs` lookup; pin Next version in `apps/cms` independently.

2. **Lexical AST conversion fidelity (D1).** TSX→Lexical conversion is hand-rolled — risk of subtle markup loss (e.g. `<Strong>` nested in `<Li>`). **Mitigation:** snapshot test that re-renders converted Lexical and diffs against original TSX render; manually approve before deleting old TSX in D2.

3. **Test of fetch-based legal pages (D2).** Existing tests use `next-intl` translations directly; switching to CMS fetch means tests must mock `fetch`. **Mitigation:** keep tests minimal — assert page renders without error + has expected heading. Deep content tests live in Payload (collection seed test).

4. **Webhook reliability (D3).** Single POST with no retry; if `apps/web` is down, the revalidation is lost. **Mitigation:** acceptable for MVP — legal docs rarely change. Add retry queue post-MVP if it becomes a problem.

5. **R2 dev fallback.** Local FS fallback when R2 env vars missing — Payload S3 adapter doesn't support this natively. **Mitigation:** conditionally register the plugin only when `R2_BUCKET` is set; otherwise rely on Payload default local storage. Documented in apps/cms/README.md.

6. **`minimumReleaseAge: 10080` (7 days) in pnpm-workspace.yaml.** Payload publishes frequently — may need to pin to a 7-day-old version. **Mitigation:** B1 checks release dates and pins accordingly.

7. **Locale config duplication.** Both `apps/landing` and `apps/cms` will have their own copy of the locales list. **Mitigation:** acceptable duplication for MVP (4-line const); extract to `packages/ui` later if a third app needs it.

8. **terms/sub-processors/breach-notification not jurisdiction-split today.** Migrated as single `eu` entries. Legal review required to confirm GB/DE/AE/SA need separate variants — flagged in D1 script log; out of scope for this goal per facts.md.
