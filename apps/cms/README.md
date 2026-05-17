# @contractor-ops/cms

Headless CMS + public blog. Single Next.js 16 app that hosts the Payload v3
admin (`/admin`) and the public blog frontend (`/`, `/[locale]/blog`,
`/[locale]/blog/[slug]`) on `blog.contractor-ops.io`.

## Quick start

```bash
# 1. Provision a dedicated Neon Postgres project for the CMS (isolated from
#    the app multi-region databases). Copy its connection string.
# 2. Populate the CMS-specific vars in the repo-level `.env`:
#      CMS_DATABASE_URL=postgresql://...
#      PAYLOAD_SECRET=$(openssl rand -hex 32)
#      CMS_ADMIN_EMAIL=admin@example.com
#      CMS_ADMIN_PASSWORD=$(openssl rand -hex 16)
#      CMS_WEBHOOK_SECRET=$(openssl rand -hex 32)
#      CMS_PUBLIC_URL=http://localhost:3002
#      WEB_APP_URL=http://localhost:3000
# 3. Install (root):
pnpm install
# 4. Generate Payload TS types and the admin import map:
pnpm --filter @contractor-ops/cms generate:types
pnpm --filter @contractor-ops/cms generate:importmap
# 5. Postgres schema — cloned repo ships `apps/cms/migrations/`:
pnpm --filter @contractor-ops/cms migrate
#    Greenfield CMS database only (no migrations yet): run `migrate:create` first, e.g.
#    `pnpm --filter @contractor-ops/cms migrate:create initial`, then `migrate` again.
# 6. Seed the first admin user:
pnpm --filter @contractor-ops/cms seed:admin
# 7. Seed the legal-documents catalog (one-shot):
pnpm --filter @contractor-ops/cms migrate:legal
# 8. Start the app on http://localhost:3002
pnpm --filter @contractor-ops/cms dev
```

Visit `http://localhost:3002/admin` and log in with `CMS_ADMIN_EMAIL` /
`CMS_ADMIN_PASSWORD`.

## Environment variables

| Var                    | Required | Purpose                                                                                   |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `CMS_DATABASE_URL`     | yes      | Postgres connection (Neon, dedicated project — NOT a shared app DB).                      |
| `PAYLOAD_SECRET`       | yes      | Payload session/encryption key (≥ 16 chars, ideally 64 hex).                              |
| `CMS_PUBLIC_URL`       | yes      | Public origin (canonical URLs, OG image refs). Default `http://localhost:3002`.           |
| `WEB_APP_URL`          | yes      | Origin of `apps/web` — destination of the legal-doc revalidate webhook.                   |
| `CMS_WEBHOOK_SECRET`   | yes      | HMAC shared secret for the legal-doc revalidate webhook (same value on both apps).        |
| `CMS_ADMIN_EMAIL`      | seed     | Email of the bootstrap admin. Consumed by `seed:admin`.                                   |
| `CMS_ADMIN_PASSWORD`   | seed     | Password of the bootstrap admin. ≥ 8 chars. Rotate via admin UI after first login.        |
| `R2_BUCKET_NAME`       | prod     | Cloudflare R2 bucket for media uploads. When unset, Payload falls back to local FS.       |
| `R2_ACCOUNT_ID`        | prod     | Cloudflare account ID for the R2 endpoint URL.                                            |
| `R2_ACCESS_KEY_ID`     | prod     | R2 access key id (least-privilege; bucket-scoped).                                         |
| `R2_SECRET_ACCESS_KEY` | prod     | R2 secret access key.                                                                      |

All vars are read through `src/lib/env.ts` (zod-validated, single source of
truth). Direct `process.env` reads are forbidden everywhere else.

## Architecture

```
apps/cms/
├── Dockerfile               # Render build target (Node 24 alpine, standalone Next output)
├── next.config.ts           # wraps the Next config with `withPayload(...)`
├── src/
│   ├── app/
│   │   ├── (frontend)/      # public blog routes (locale shell + posts + RSS + sitemap)
│   │   └── (payload)/       # Payload admin + REST + GraphQL (template, do not edit)
│   ├── collections/
│   │   ├── Posts.ts         # localised; versions + drafts; afterChange revalidateTag
│   │   ├── Media.ts         # localised alt text; image sizes; R2-backed upload
│   │   ├── LegalDocuments.ts# (type, jurisdiction) unique; HMAC-signed webhook to apps/web
│   │   └── Users.ts         # admin auth (Payload native; not Better-Auth)
│   ├── lib/
│   │   ├── env.ts           # zod-validated env (single allow-listed process.env read site)
│   │   ├── lexical.ts       # tiny serialised-Lexical builder (used by seed catalog)
│   │   ├── legal-content.ts # first-run catalog of legal-document bodies
│   │   └── payload-queries.ts # server-only blog reads via the Payload Local API
│   └── payload.config.ts    # postgresAdapter + s3Storage (conditional) + lexicalEditor
└── scripts/
    ├── seed-admin.ts        # idempotent first-admin seed
    └── migrate-legal-from-tsx.ts  # idempotent upsert of the legal-docs catalog
```

## Adding a new collection

1. Create `src/collections/<Name>.ts` exporting a `CollectionConfig`. Use
   `localized: true` on any field that ships content in `en/pl/de/ar`. Wire
   access via `access: { read, create, update, delete }`.
2. Register the collection in `src/payload.config.ts` under `collections`.
3. Re-generate types and the import map:
   `pnpm --filter @contractor-ops/cms generate:types`
   `pnpm --filter @contractor-ops/cms generate:importmap`
4. Author a migration for the new tables:
   `pnpm --filter @contractor-ops/cms migrate:create add-<name>`
5. Apply: `pnpm --filter @contractor-ops/cms migrate`

## Webhook contract — legal documents

CMS-side (`apps/cms/src/collections/LegalDocuments.ts`) emits a POST to
`${WEB_APP_URL}/api/revalidate-legal` after `change`/`delete` events:

- Body: `{ "type": "<type>", "jurisdiction": "<jurisdiction>" }`
- Header: `x-cms-signature: <hex>` — HMAC-SHA256 of the raw body keyed by
  `CMS_WEBHOOK_SECRET`.

Web-side (`apps/web/src/app/api/revalidate-legal/route.ts`) verifies the
signature with constant-time compare, then calls
`revalidateTag(\`legal:${type}:${jurisdiction}\`, 'max')`. Rejection codes:

- `401 bad_signature`
- `400 bad_json`
- `400 missing_fields`
- `500 not_configured` (server missing `CMS_WEBHOOK_SECRET`)

`apps/web/src/lib/legal/fetch-cms.ts` fetches each legal doc with
`next: { tags: ['legal:<type>:<jurisdiction>'], revalidate: 60 }` so the
webhook flips the cache tag immediately and the next request renders fresh.

## Deploy

The `cms` service in `render.yaml` provisions a Docker web service in
`frankfurt`, port 3000 (Render internal-network convention). Custom domain
`blog.contractor-ops.io` is bound manually in the Render dashboard
post-deploy. Render env vars marked `sync: false` are set per-environment
in the dashboard.

## Risks / known follow-ups

- **Legal content fidelity.** `src/lib/legal-content.ts` ships English
  bodies only; PL/DE/AR fall back to EN on read. Editors complete the
  localised versions through the admin UI after first seed.
- **Lexical converter.** The migration uses a hand-authored catalog rather
  than a TSX-AST converter. Full TSX→Lexical AST conversion lives in plan
  Risk #2 — bring it in if/when the legal content set grows beyond the
  current six entries.
