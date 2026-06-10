---
last_mapped_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
last_mapped_at: 2026-06-08
---

# contractor-ops — Technology Stack

Canonical reference for languages, runtimes, frameworks, and shared libraries. Verified against root `package.json`, `pnpm-workspace.yaml`, app `package.json` files, and `packages/api/src/root.ts`.

## Workspace & tooling

| Concern | Path / version | Notes |
|---------|----------------|-------|
| Package manager | `pnpm@10.33.2` (`package.json`) | Workspaces: `apps/*`, `packages/*`, `goals/qa-walk-and-fix` |
| Monorepo orchestration | Turborepo `^2.9.9` (`turbo.json`) | `build`/`typecheck`/`test` depend on `i18n:types`; global env from `.env` |
| Supply-chain gate | `pnpm-workspace.yaml` | `minimumReleaseAge: 10080` (7 days); mirrored in `.npmrc` |
| Lint / format | Biome `^2.4.14` (`biome.json`, `biome.ci.json`) | No ESLint; `lint:ci` runs guards from `scripts/` |
| TypeScript | `^6.0.3` (`tsconfig.base.json`) | `strict: true`, `erasableSyntaxOnly: true`, `noImplicitReturns: true` |
| Fast typecheck | `@typescript/native-preview` (tsgo) | `pnpm typecheck:fast` via per-package `typecheck:fast` scripts |
| Tests | Vitest `^4.1.5` | Root `vitest.config.ts`; `pnpm test` via turbo |
| Git hooks | Husky + lint-staged (`package.json`) | Biome on staged files; Prisma format on `*.prisma` |
| Deploy | `render.yaml` | Docker web + worker; static landing; private Unleash EU/ME |

Root scripts worth knowing: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint:ci`, `pnpm security:scan`, `pnpm db:migrate:all`, `pnpm seed:qa`.

## Deployable applications (`apps/`)

| App | Package | Runtime | Primary stack |
|-----|---------|---------|---------------|
| API server | `@contractor-ops/api-server` (`apps/api`) | Fastify `^5.6.1` + tsx | tRPC v11 host, Better Auth, webhooks, QStash routes, Stripe webhooks |
| Staff + portal SPA | `@contractor-ops/web-vite` (`apps/web-vite`) | Vite `8.0.10` + React `^19.2.6` | TanStack Query, tRPC client, React Router 7, Tailwind 4 |
| Cron / queue worker | `@contractor-ops/cron-worker` (`apps/cron-worker`) | Fastify + node-cron | QStash callbacks, scheduled jobs, background integrations |
| Public REST API | `@contractor-ops/public-api` (`apps/public-api`) | Hono `^4.12.18` | API-key HMAC auth; reuses `@contractor-ops/api` callers |
| Marketing site | `@contractor-ops/landing` (`apps/landing`) | Next.js `^16.2.5` | Tailwind 4, PostHog, Stripe pricing hooks |
| CMS | `@contractor-ops/cms` (`apps/cms`) | Payload `^3.84.1` on Next 16 | Authors / Categories / Posts; Lexical rich text; S3 storage adapter |

Entrypoints: `apps/api/src/index.ts` (listen), `apps/api/src/server.ts` (`buildServer()`), `apps/web-vite/src/main.tsx`, `apps/cron-worker/src/index.ts`, `apps/public-api/src/index.ts`.

The legacy Next.js staff app (`apps/web`) is deleted; all staff UI lives in `apps/web-vite`.

## Shared packages (`packages/`)

Nineteen workspace packages under `packages/`:

| Package | Path | Role |
|---------|------|------|
| `@contractor-ops/api` | `packages/api` | tRPC routers, middleware, services, PDF templates; exports `appRouter`, `portalAppRouter` |
| `@contractor-ops/db` | `packages/db` | Prisma 7 (`@prisma/client` `^7.8.0`), multi-region clients, migrations in `packages/db/prisma/schema/` |
| `@contractor-ops/auth` | `packages/auth` | Better Auth `^1.6.9`, Resend email, session types for `packages/api/src/context.ts` |
| `@contractor-ops/validators` | `packages/validators` | Zod schemas shared by tRPC, forms, public API |
| `@contractor-ops/ui` | `packages/ui` | shadcn components, workbench `DataTable`, marketing primitives |
| `@contractor-ops/shared` | `packages/shared` | Cross-cutting helpers; money via `packages/shared/src/money.ts` (dinero.js) |
| `@contractor-ops/logger` | `packages/logger` | Pino structured logging — no `console.*` in app source |
| `@contractor-ops/feature-flags` | `packages/feature-flags` | Unleash OSS wrapper; registry in `packages/feature-flags/src/registry.ts` |
| `@contractor-ops/integrations` | `packages/integrations` | OAuth adapters, credential store, webhook dispatcher, provider registry |
| `@contractor-ops/einvoice` | `packages/einvoice` | Country profiles (KSeF, ZATCA, Peppol, XRechnung, ZUGFeRD) |
| `@contractor-ops/billing` | `packages/billing` | Stripe subscription helpers; webhook handlers in `packages/billing/src/webhook/` |
| `@contractor-ops/compliance-policy` | `packages/compliance-policy` | Payment-gate rules, doc registry |
| `@contractor-ops/classification` | `packages/classification` | IR35 / Scheinselbständigkeit scoring engine |
| `@contractor-ops/gov-api` | `packages/gov-api` | Government API clients (HMRC VAT, etc.) |
| `@contractor-ops/secrets` | `packages/secrets` | Secret-store abstraction (Infisical path planned) |
| `@contractor-ops/idp-saga` | `packages/idp-saga` | IdP deprovisioning saga orchestration |
| `@contractor-ops/offboarding-templates` | `packages/offboarding-templates` | Offboarding workflow templates |
| `@contractor-ops/lint-guards` | `packages/lint-guards` | Architecture guard helpers (`packages/lint-guards/src/architecture-guard/`) |
| `@contractor-ops/test-utils` | `packages/test-utils` | MSW factories, integration test helpers |

`packages/api/package.json` exposes 40+ subpath exports (services, lib, routers) consumed by `apps/cron-worker` and tests.

## API layer (tRPC v11)

Router assembly: `packages/api/src/root.ts`.

**Staff `appRouter`:** **53 always-mounted namespaces** + **8 conditional classification namespaces** when `module.classification-engine` is enabled in Unleash (or `QA_DEFAULT_ORG_ID` is set for QA walks).

Always mounted (53): `adminBoeRate`, `apiKey`, `bacs`, `organization`, `organizationDefinitions` (nested `team` / `project` / `costCenter`), `user`, `settings`, `contractor`, `contract`, `document`, `workflow`, `workflowRoles`, `authPermissions`, `invoice`, `invoiceIntake`, `approval`, `notification`, `reminder`, `integration`, `payment`, `dashboard`, `report`, `audit`, `import`, `search`, `skonto`, `esign`, `ocr`, `ksef`, `latePaymentInterest`, `legal`, `time`, `jira`, `linear`, `docs`, `calendar`, `billing`, `deprovisioning`, `equipment`, `googleWorkspace`, `gdpr`, `teams`, `onboardingImport`, `complianceAdmin`, `einvoice`, `leitwegId`, `exchangeRate`, `featureFlags`, `consent`, `peppol`, `tax`, `zatca`, `gulf`.

Conditional (8, flag-gated): `classification`, `classificationDashboard`, `classificationDocument`, `ir35Chain`, `ir35Attestation`, `economicDependencyAlert`, `reassessmentTrigger`, `statusfeststellungsverfahren`.

**Portal router** (separate endpoint): `packages/api/src/portal-root.ts` → `portalAppRouter` with 2 namespaces: `portal`, `portalTime`. Mounted at `/api/trpc/portal` to keep staff `AppRouter` inference smaller.

Middleware chain: `packages/api/src/init.ts` (observability, `TRPCError` formatter), `packages/api/src/middleware/rbac.ts` (`requirePermission`), `packages/api/src/middleware/tenant.ts`, `packages/api/src/middleware/sensitive.ts`.

Public REST surface reuses tRPC logic via `packages/api/src/routers/public-api/` and `createPublicCaller` — no duplicated DB access in `apps/public-api`.

## Data & persistence

| Layer | Technology | Key paths |
|-------|------------|-----------|
| Primary DB | PostgreSQL 17 via Neon | `DATABASE_URL`, `DATABASE_URL_EU`, `DATABASE_URL_ME` (`render.yaml`, `packages/db/src/region.ts`) |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Client in `packages/db/src/client.ts`; schema split under `packages/db/prisma/schema/` |
| Pooling | `pg` pool per region | `PG_POOL_MAX` default 10 (`packages/db/src/client.ts`) |
| Read replicas | Circuit-breaker routing | `packages/db/src/read-replica.ts` |
| Tenant isolation | AsyncLocalStorage Prisma extension | `packages/db/src/tenant-extension.ts` |
| Object storage | Cloudflare R2 (S3-compatible) | `packages/api/src/services/r2.ts`, `packages/api/src/services/regional-storage.ts` |
| Cache / queues | Upstash Redis + QStash | `@upstash/redis`, `@upstash/qstash` in `apps/api`; `packages/integrations/src/services/qstash-client.ts` |
| Virus scan | ClamAV private service | Referenced in `render.yaml`; document upload path in `packages/api/src/routers/core/document.ts` |

Regional migration runner: `packages/db/scripts/migrate-all-regions.ts` (`DATABASE_URL_EU`, `DATABASE_URL_ME`, `DATABASE_URL_US`).

## Authentication & authorization

| Concern | Implementation |
|---------|----------------|
| Staff auth | Better Auth — config in `packages/auth/src/config.ts`, plugin in `apps/api/src/plugins/auth.ts` |
| Portal auth | Cookie-based contractor session — `packages/api/src/services/portal-session.ts`, `portalProcedure` middleware |
| RBAC | 8 roles + workflow roles — `packages/api/src/middleware/rbac.ts`, `packages/validators/src/roles.ts` |
| Public API | HMAC API keys — `packages/api/src/routers/core/api-key.ts`, `API_KEY_HMAC_SECRET` in `render.yaml` |
| Feature gating | `requireTier` / `requireAddOn` middleware + Unleash flags |

## Frontend (web-vite)

| Concern | Library | Path |
|---------|---------|------|
| Routing | React Router 7 | `apps/web-vite/src/router.tsx` |
| Server state | TanStack Query 5 + tRPC 11 | `apps/web-vite/src/lib/trpc.ts` |
| URL state | nuqs | Filter hooks across list pages |
| Local UI state | zustand (minimal) | Command palette / ephemeral UI only |
| Forms | react-hook-form + Zod resolvers | Domain wizards and settings |
| i18n | i18next + ICU | `apps/web-vite/messages/{en,de,pl,ar}.json`; types from `scripts/generate-i18n-types.ts` |
| Styling | Tailwind CSS 4 | `apps/web-vite/vite.config.mjs`, PostCSS |
| Tables | TanStack Table + `WorkbenchDataTable` | `apps/web-vite/src/components/table-kit/workbench-data-table.tsx` |
| Charts | recharts | Dashboard spend chart (lazy-load candidate) |
| Analytics | PostHog | `apps/web-vite/src/lib/posthog.ts` (consent-gated) |
| Error tracking | Sentry React | `apps/web-vite/src/sentry.ts` |

UI layering enforced by scripts: Page → Container → Hook → Component (`apps/web-vite/ARCHITECTURE.md`). Guards: `scripts/check-web-vite-data-layer.mjs`, `check-web-vite-page-shells.mjs`, etc.

## Observability & ops

| Service | Integration | Paths |
|---------|-------------|-------|
| Error tracking | Sentry (`@sentry/node`, `@sentry/react`) | `apps/api/src/lib/sentry.ts`, `apps/web-vite/src/sentry.ts`, `apps/cron-worker/src/lib/sentry.ts`, `apps/public-api/src/lib/sentry.ts` |
| Logging | Pino via `@contractor-ops/logger` | tRPC observability middleware in `packages/api/src/init.ts` |
| Product analytics | PostHog | Server: `packages/api/src/services/posthog.ts`; client: `apps/web-vite/src/lib/posthog.ts` |
| Local observability | Docker Compose profiles | `pnpm dev:observability` — GlitchTip, Grafana, Loki (`package.json`) |
| Load tests | k6 | `load-tests/smoke.js`, `load-tests/api-read.js` |

## Build & quality gates

CI-equivalent local check: `pnpm lint:ci` runs Biome plus ~15 custom guards (`lint:raw-sql`, `lint:audit-log`, `lint:architecture`, `check:web-vite-data-layer`, `i18n:parity`, etc.).

Typecheck: `pnpm typecheck` (tsc) and `pnpm typecheck:fast` (tsgo). `apps/web-vite` has `i18n:types` wired; turbo `build` depends on it.

Postinstall builds core packages: `@contractor-ops/validators`, `auth`, `integrations`, `logger`, `api` (`package.json` `postinstall`).

## Related docs

- System architecture: `.planning/codebase/ARCHITECTURE.md`
- External integrations: `.planning/codebase/INTEGRATIONS.md`
- Tech debt & risks: `.planning/codebase/CONCERNS.md`
- Engineering contract: `CLAUDE.md`
- Product state: `.planning/PROJECT.md`
