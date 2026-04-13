# ─────────────────────────────────────────────────────────────────────────────
# Worker Dockerfile — runs the Next.js API routes + cron scheduler in Docker.
#
# Handles: QStash callbacks, webhook processing, cron jobs, background tasks.
# Does NOT serve the frontend to end-users (Vercel handles that).
#
# Build:  docker build -f apps/web/Dockerfile -t contractor-ops-worker .
# Run:    docker run --env-file .env -p 3000:3000 contractor-ops-worker
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apk add --no-cache libc6-compat

# ── Stage 2: deps — install all dependencies (monorepo-wide) ───────────────
FROM base AS deps
WORKDIR /app

# Copy lockfile + workspace manifests first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/einvoice/package.json packages/einvoice/
COPY packages/gov-api/package.json packages/gov-api/
COPY packages/integrations/package.json packages/integrations/
COPY packages/logger/package.json packages/logger/
COPY packages/secrets/package.json packages/secrets/
COPY packages/shared/package.json packages/shared/
COPY packages/test-utils/package.json packages/test-utils/
COPY packages/ui/package.json packages/ui/
COPY packages/validators/package.json packages/validators/

RUN pnpm install --frozen-lockfile

# ── Stage 3: builder — build packages + Next.js standalone ─────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages

# Copy full source
COPY . .

# Generate Prisma client (needed before build)
RUN pnpm --filter @contractor-ops/db exec prisma generate

# Build shared packages first, then the web app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Skip Sentry source map upload during Docker build
ENV SENTRY_AUTH_TOKEN=""
ENV SENTRY_ORG=""
ENV SENTRY_PROJECT=""

RUN pnpm turbo build --filter=@contractor-ops/web

# Install node-cron into standalone output for the cron scheduler
RUN cd apps/web/.next/standalone && pnpm init -y && pnpm add node-cron

# ── Stage 4: runner — minimal production image ─────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone server + static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy cron scheduler
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/worker-cron.mjs ./apps/web/worker-cron.mjs

# Copy Prisma generated client (custom output: packages/db/generated/prisma/client)
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/generated ./packages/db/generated
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma ./packages/db/prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Default: run as worker with cron scheduler.
# Override with CMD ["node", "apps/web/server.js"] for API-only (no crons).
CMD ["node", "apps/web/worker-cron.mjs"]
