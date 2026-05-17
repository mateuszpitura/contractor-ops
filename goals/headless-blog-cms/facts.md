# Facts — Headless Blog + CMS (Payload)

## Topology & deployment

- A new Next.js app exists at `apps/cms` containing both Payload CMS admin and the public blog frontend in a single process.
- Payload admin UI is mounted at `/admin/*`; public blog routes (`/`, `/blog`, `/blog/[slug]`, `/[locale]/blog/...`) live in the same Next.js app.
- `apps/cms` is deployed as a Render web service on the subdomain `blog.contractor-ops.io`.
- `apps/cms` has its own `package.json` named `@contractor-ops/cms`, its own `next.config.ts`, and participates in the Turborepo pipeline (`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`).
- `apps/cms` runs Next.js 16 with React 19, matching the version used by `apps/web` and `apps/landing`.
- `apps/cms` uses webpack for `next build` (consistent with `apps/web` and `apps/landing`).
- `apps/landing` stays a pure static export (`output: 'export'`); no changes are required to the landing build pipeline.
- The "Blog" link in `apps/landing` points to `https://blog.contractor-ops.io`.

## Database

- Payload connects to a dedicated Neon Postgres database via a new env var `CMS_DATABASE_URL`.
- The CMS database is fully isolated from existing Prisma multi-region databases (`DATABASE_URL`, `DATABASE_URL_EU`, `DATABASE_URL_ME`).
- The `@contractor-ops/db` package and Prisma schema are not touched by this work.
- `CMS_DATABASE_URL` is added to `.env.example` with a placeholder Neon connection string and a comment explaining its purpose.
- Payload uses `@payloadcms/db-postgres` adapter.
- Payload migrations live under `apps/cms/migrations/` and are committed to the repo.

## Auth (CMS admin)

- Payload native auth is used for CMS admin login (no SSO bridge with Better Auth).
- Editor accounts are created manually by an admin via the Payload admin UI; there is no public self-registration.
- First-run bootstrap: a seed script (`apps/cms/scripts/seed-admin.ts`) creates the first admin user from `CMS_ADMIN_EMAIL` and `CMS_ADMIN_PASSWORD` env vars when no users exist.
- Payload sessions are independent of Better Auth sessions in `apps/web`.

## Collections

### Posts
- A `posts` collection exists with fields: `title` (localized), `slug` (unique per locale), `excerpt` (localized), `body` (rich text, localized), `coverImage` (relation to `media`), `author` (text, localized), `tags` (array of strings, localized), `publishedAt` (date), `status` (`draft` | `published`), `seo.title` (localized), `seo.description` (localized).
- Only posts with `status: 'published'` AND `publishedAt <= now` are exposed via public routes.
- `slug` is auto-generated from `title` on create, editable afterwards, and validated unique-per-locale.

### Media
- A `media` collection exists using Payload's built-in upload feature.
- Media files are stored in Cloudflare R2 via `@payloadcms/storage-s3` adapter.
- R2 credentials and bucket name are configured via env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
- In dev (when R2 env vars are absent), Payload falls back to local FS storage under `apps/cms/media/`.
- Media collection has `alt` text field (localized, required) for accessibility.

### LegalDocuments
- A `legal-documents` collection exists with fields: `type` (`privacy` | `terms` | `sub-processors` | `breach-notification`), `jurisdiction` (`gb` | `de` | `eu` | `ae` | `sa`), `version` (string, e.g. `1.0.0`), `effectiveDate` (date), `body` (rich text, localized).
- The combination `(type, jurisdiction)` is unique — at most one document per pair.
- A previous version is preserved via Payload `versions` (draft & publish) feature with at least 10 retained versions per entry.

## Localization

- Payload localization plugin is enabled with locales `en`, `pl`, `de`, `ar`.
- `en` is the default locale.
- `ar` is configured with RTL flag for admin UI hints.
- All `localized: true` fields support all 4 locales; missing translations fall back to `en` in public reads.

## Public blog frontend (apps/cms)

- The route tree under `apps/cms/src/app/[locale]/` mirrors the locale convention of `apps/web` and `apps/landing`.
- Supported locale prefixes: `/en`, `/pl`, `/de`, `/ar`. Visiting `/` redirects to `/en` (or browser-preferred supported locale).
- `/[locale]/blog` lists all published posts in that locale, sorted by `publishedAt` desc, paginated (10 per page).
- `/[locale]/blog/[slug]` renders a single published post in that locale.
- Visiting `/[locale]/blog/[slug]` for a post that exists in another locale but not the requested one returns a 404 (no silent fallback content).
- A working `hreflang` link tag is emitted on every blog page pointing at the equivalent URL in every locale where the post exists.
- `/feed.xml` returns an RSS feed of the most recent 20 published posts (per-locale via `/[locale]/feed.xml`).
- `/sitemap.xml` returns a dynamic sitemap including the blog list, all published post URLs across all locales, and one entry per locale homepage.
- Every blog post page generates a dynamic OG image via Next.js `ImageResponse` at `/[locale]/blog/[slug]/og.png` containing the post title and brand mark.
- OG image URLs are referenced in `<meta property="og:image">` and `<meta name="twitter:image">` on the post page.
- Public blog pages fetch posts via Payload Local API (no HTTP round-trip) inside server components.
- Post pages use Next ISR with `export const revalidate = 60` and `revalidateTag('post:<id>')` triggered by a Payload `afterChange` hook.

## Public consumption from apps/web (legal docs)

- `apps/web` fetches legal documents from `apps/cms` via Payload REST API (`https://blog.contractor-ops.io/api/legal-documents`).
- Fetches use `next: { tags: ['legal:<type>:<jurisdiction>'] }` for cache tagging.
- Payload `afterChange` and `afterDelete` hooks on `legal-documents` POST a webhook to `https://app.contractor-ops.io/api/revalidate-legal` with HMAC signature.
- The webhook payload contains `{ type, jurisdiction, locale }` and the receiving route calls `revalidateTag('legal:<type>:<jurisdiction>')`.
- The webhook is authenticated by a shared HMAC secret stored in env var `CMS_WEBHOOK_SECRET` (same value on both apps).
- A new route `apps/web/src/app/api/revalidate-legal/route.ts` handles the webhook, verifies HMAC, and calls `revalidateTag`.
- The existing hardcoded legal pages (`apps/web/src/app/[locale]/(legal)/legal/{privacy,terms,sub-processors,breach-notification}/...`) are rewritten to render content fetched from Payload by `(type, jurisdiction, locale)`.
- The existing jurisdiction-resolver helpers in `apps/web/src/app/[locale]/(legal)/legal/privacy/(content)/_resolve.ts` are preserved and still drive redirect logic; only the page bodies switch to CMS-sourced content.

## Migration of existing legal content

- A one-shot migration script (`apps/cms/scripts/migrate-legal-from-tsx.ts`) reads the existing legal TSX page files in `apps/web/src/app/[locale]/(legal)/legal/**/page.tsx`, extracts JSX content, converts it to Payload Lexical/rich-text JSON, and writes one `legal-documents` entry per `(type, jurisdiction, locale)` combination.
- The migration is idempotent — re-running it does not duplicate entries (upsert by `(type, jurisdiction)`).
- After successful migration and verification, the hardcoded legal `(content)/{eu,de,gb}/page.tsx` files and corresponding `.test.tsx` files are deleted; the top-level `page.tsx` for each legal route stays and now reads from CMS.
- The migration script logs a summary of created/updated/skipped entries.

## CI / pipeline

- `apps/cms` is added to `pnpm-workspace.yaml` (implicitly via `apps/*` glob if present, otherwise explicitly).
- `apps/cms` runs `pnpm typecheck`, `pnpm lint`, `pnpm test` in CI alongside other apps.
- `turbo build --filter=@contractor-ops/cms` works without errors on a clean clone after `pnpm install`.

## Documentation

- A `apps/cms/README.md` exists describing: local dev setup, env vars, how to create the first admin user, how to add a new collection, the webhook contract with apps/web.
- `.env.example` is updated with all new env vars (`CMS_DATABASE_URL`, `CMS_ADMIN_EMAIL`, `CMS_ADMIN_PASSWORD`, `CMS_WEBHOOK_SECRET`, `R2_*`).

## Out of scope

- No Pages / page-builder collection (marketing landing stays code-driven in `apps/landing`).
- No comments system on blog posts.
- No newsletter signup integration.
- No search / Algolia integration.
- No tag/category landing pages (`/blog/tag/[tag]`) — tags render only as visual badges on post detail pages in MVP.
- No author profile pages — author rendered as a plain text byline.
- No Better Auth ↔ Payload SSO bridge.
- No Render Terraform / Render Blueprint files (deploy config done manually in Render dashboard for MVP).
- No load testing or Lighthouse perf budgets for the blog in MVP.
