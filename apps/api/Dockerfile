# ─────────────────────────────────────────────────────────────────────────────
# apps/api — Fastify service hosting Better Auth + tRPC + webhooks +
# utility routes, replacing apps/web's app/api/* surface.
#
# Build: docker build -f apps/api/Dockerfile -t api-server .
# Port: 4000 (overridable via PORT / HOST).
#
# This image bundles only what api-server needs: its compiled dist + the
# workspace packages it imports (@contractor-ops/{api,auth,logger,db,...}).
# It does NOT include Next.js, React, the SPA bundle, or apps/web assets.
# Mirrors apps/public-api/Dockerfile in shape (same stages, same multi-arch
# pnpm graph) so a follow-up consolidation can extract a shared base.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
RUN apk add --no-cache libc6-compat

# ── Stage 2: deps — install workspace dependencies ─────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/public-api/package.json apps/public-api/
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
COPY apps/web-vite/package.json apps/web-vite/
COPY apps/cron-worker/package.json apps/cron-worker/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/classification/package.json packages/classification/
COPY packages/compliance-policy/package.json packages/compliance-policy/
COPY packages/db/package.json packages/db/
COPY packages/einvoice/package.json packages/einvoice/
COPY packages/feature-flags/package.json packages/feature-flags/
COPY packages/gov-api/package.json packages/gov-api/
COPY packages/integrations/package.json packages/integrations/
COPY packages/lint-guards/package.json packages/lint-guards/
COPY packages/logger/package.json packages/logger/
COPY packages/offboarding-templates/package.json packages/offboarding-templates/
COPY packages/secrets/package.json packages/secrets/
COPY packages/shared/package.json packages/shared/
COPY packages/test-utils/package.json packages/test-utils/
COPY packages/ui/package.json packages/ui/
COPY packages/validators/package.json packages/validators/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 3: builder — build workspace deps + api-server ───────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY . .

# Prisma 7 generate; dummy DATABASE_URL is fine — no DB connection is made.
RUN DATABASE_URL=postgres://x:x@localhost:5432/x \
    DATABASE_URL_EU=postgres://x:x@localhost:5432/x \
    DATABASE_URL_ME=postgres://x:x@localhost:5432/x \
    pnpm --filter @contractor-ops/db exec prisma generate

ENV NODE_ENV=production

# Turbo resolves `^build` — builds every workspace dep of api-server first.
RUN pnpm turbo build --filter=@contractor-ops/api-server

# ── Stage 4: runner — minimal production image ─────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiserver

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

COPY --from=builder --chown=apiserver:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=apiserver:nodejs /app/packages ./packages
COPY --from=builder --chown=apiserver:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=apiserver:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=apiserver:nodejs /app/apps/api/node_modules ./apps/api/node_modules

USER apiserver

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
