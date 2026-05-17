# ─────────────────────────────────────────────────────────────────────────────
# apps/web — multi-target Dockerfile (Render Blueprint)
#
# Targets:
#   - runner-web    → Next.js standalone server (HTTP, port 3000)
#   - runner-worker → background worker running node-cron jobs (no HTTP)
#
# Build (web):    docker build -f apps/web/Dockerfile --target runner-web -t web .
# Build (worker): docker build -f apps/web/Dockerfile --target runner-worker -t worker .
#
# Render selects the target via `dockerTarget` in render.yaml.
# Port 3000 is used (NOT 10000) because Render blocks port 10000 on the
# private network for inter-service traffic.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
RUN apk add --no-cache libc6-compat

# ── Stage 2: deps — install all dependencies (monorepo-wide) ───────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
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

# --ignore-scripts skips the root `postinstall` (turbo build of shared
# packages) — that build needs source files which are not yet copied at
# this stage. The builder stage runs the full turbo build explicitly.
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 3: builder — build packages + Next.js standalone ─────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages

COPY . .

# Prisma 7's prisma.config.ts loads env at generate time. We pass a
# dummy URL purely to satisfy the loader — no DB connection is made
# during code generation.
RUN DATABASE_URL=postgres://x:x@localhost:5432/x \
    DATABASE_URL_EU=postgres://x:x@localhost:5432/x \
    DATABASE_URL_ME=postgres://x:x@localhost:5432/x \
    pnpm --filter @contractor-ops/db exec prisma generate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Skip Sentry source-map upload during local Docker builds. On Render the
# SENTRY_AUTH_TOKEN env var (sync: false) re-enables uploads at build time.
ENV SENTRY_AUTH_TOKEN=""
ENV SENTRY_ORG=""
ENV SENTRY_PROJECT=""

RUN pnpm turbo build --filter=@contractor-ops/web

# Install runtime deps for the worker target into the standalone output:
#   - node-cron: scheduler
#   - pino: structured logger (matches @contractor-ops/logger baseOptions)
#   - @sentry/node: F-OBS-04 process handlers + crash capture for the worker
# The web target reuses this stage but never executes worker-cron.mjs.
RUN cd apps/web/.next/standalone && pnpm init -y && pnpm add node-cron pino @sentry/node

# ── Stage 4a: runner-base — minimal common runtime layer ───────────────────
FROM node:24-alpine AS runner-base
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/worker-cron.mjs ./apps/web/worker-cron.mjs
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/generated ./packages/db/generated
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma ./packages/db/prisma

USER nextjs

# ── Stage 4b: runner-web — Next.js HTTP server ─────────────────────────────
FROM runner-base AS runner-web

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]

# ── Stage 4c: runner-worker — background cron scheduler (no HTTP) ──────────
FROM runner-base AS runner-worker

# Worker has no listening port — it makes outbound HTTP calls to WORKER_TARGET_URL.
CMD ["node", "apps/web/worker-cron.mjs"]
