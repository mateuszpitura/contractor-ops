# Goal — Headless Blog + CMS (Payload)

Ship a new `apps/cms` Next.js 16 application hosting Payload CMS admin (`/admin/*`) and a public blog frontend (`/`, `/[locale]/blog`, `/[locale]/blog/[slug]`) on `blog.contractor-ops.io`. Add three Payload collections (`posts`, `media`, `legal-documents`) with full 4-locale support (en/pl/de/ar). Migrate the existing hardcoded legal TSX pages in `apps/web` to fetch from the CMS with on-demand revalidation via HMAC webhook.

## Artefacts

- **Shared understanding:** [facts.md](./facts.md) — flat fact sheet, gated and approved via Plannotator.
- **Execution plan:** [plan.md](./plan.md) — ordered phases (A–G), files touched, verification steps, risks. Gated and approved via Plannotator.

## Done condition

1. `apps/cms` runs locally (`pnpm --filter @contractor-ops/cms dev`) on port 3002 with Payload admin at `/admin` and the public blog frontend on `/`.
2. All three collections (`posts`, `media`, `legal-documents`) exist, are creatable in the admin UI, and respect the 4-locale localization.
3. Media uploads land in Cloudflare R2 (or local FS fallback in dev).
4. The 4 legal-doc types (`privacy`, `terms`, `sub-processors`, `breach-notification`) across all relevant `(jurisdiction, locale)` combinations are backfilled into Payload by the migration script; the hardcoded TSX content files under `apps/web/src/app/[locale]/(legal)/legal/privacy/(content)/` are deleted.
5. Editing a `legal-documents` entry in CMS triggers a verified HMAC webhook to `apps/web/api/revalidate-legal`, which `revalidateTag`s the corresponding cache key; the change is visible in `apps/web` within ~1 second.
6. Public blog routes serve list, detail, RSS feed, dynamic sitemap, and per-post OG images.
7. Landing footer "Blog" link points to `https://blog.contractor-ops.io`.
8. `render.yaml` includes a new `cms` web service definition and `apps/cms/Dockerfile` exists.
9. `pnpm typecheck`, `pnpm lint`, `pnpm test` and `turbo build` all pass green across the monorepo including the new app.
10. `apps/cms/README.md` documents local dev, env vars, deploy, webhook contract, and collection extension.
