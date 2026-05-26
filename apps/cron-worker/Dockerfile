# ─────────────────────────────────────────────────────────────────────────────
# apps/cron-worker — Background Worker: node-cron scheduler that runs every
# in-process cron job ported from apps/web/src/app/api/cron/*.
#
# Build: docker build -f apps/cron-worker/Dockerfile -t cron-worker .
# Health: HTTP on CRON_HEALTH_PORT (default 4100) — private network only.
#
# Image bundles only what the worker needs (compiled dist + workspace deps).
# Does NOT include Next.js / React / SPA assets.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
RUN apk add --no-cache libc6-compat

# ── Stage 2: deps ──────────────────────────────────────────────────────────
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

# ── Stage 3: builder ───────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/cron-worker/node_modules ./apps/cron-worker/node_modules

COPY . .

RUN DATABASE_URL=postgres://x:x@localhost:5432/x \
    DATABASE_URL_EU=postgres://x:x@localhost:5432/x \
    DATABASE_URL_ME=postgres://x:x@localhost:5432/x \
    pnpm --filter @contractor-ops/db exec prisma generate

ENV NODE_ENV=production
RUN pnpm turbo build --filter=@contractor-ops/cron-worker

# ── Stage 4: runner ────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 cron

ENV NODE_ENV=production
ENV CRON_HEALTH_PORT=4100
ENV CRON_HEALTH_HOST=0.0.0.0

COPY --from=builder --chown=cron:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=cron:nodejs /app/packages ./packages
COPY --from=builder --chown=cron:nodejs /app/apps/cron-worker/dist ./apps/cron-worker/dist
COPY --from=builder --chown=cron:nodejs /app/apps/cron-worker/package.json ./apps/cron-worker/
COPY --from=builder --chown=cron:nodejs /app/apps/cron-worker/node_modules ./apps/cron-worker/node_modules

USER cron

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4100/health || exit 1

CMD ["node", "apps/cron-worker/dist/index.js"]
