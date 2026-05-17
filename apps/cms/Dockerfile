# ─────────────────────────────────────────────────────────────────────────────
# apps/cms — Next.js + Payload v3 standalone container (Render Blueprint)
#
# Build:  docker build -f apps/cms/Dockerfile -t cms .
# Port:   3000 (Render convention — internal traffic uses 3000, not 10000)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
RUN apk add --no-cache libc6-compat

# ── Stage 2: deps — install monorepo dependencies ──────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/cms/package.json apps/cms/
COPY apps/web/package.json apps/web/
COPY apps/landing/package.json apps/landing/
COPY apps/public-api/package.json apps/public-api/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/classification/package.json packages/classification/
COPY packages/db/package.json packages/db/
COPY packages/einvoice/package.json packages/einvoice/
COPY packages/feature-flags/package.json packages/feature-flags/
COPY packages/gov-api/package.json packages/gov-api/
COPY packages/integrations/package.json packages/integrations/
COPY packages/logger/package.json packages/logger/
COPY packages/offboarding-templates/package.json packages/offboarding-templates/
COPY packages/secrets/package.json packages/secrets/
COPY packages/shared/package.json packages/shared/
COPY packages/test-utils/package.json packages/test-utils/
COPY packages/ui/package.json packages/ui/
COPY packages/validators/package.json packages/validators/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 3: builder — build CMS standalone bundle ─────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/cms/node_modules ./apps/cms/node_modules
COPY --from=deps /app/packages ./packages

COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time stub for Payload init — actual values supplied at runtime via
# Render env vars. The build does not connect to Postgres.
ENV PAYLOAD_SECRET=build-time-stub-do-not-use-in-production
ENV CMS_DATABASE_URL=postgresql://stub:stub@localhost:5432/stub

RUN pnpm turbo build --filter=@contractor-ops/cms

# ── Stage 4: runner — minimal runtime image ────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/apps/cms/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/cms/.next/static ./apps/cms/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/cms/public ./apps/cms/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/users/me -H 'Accept: application/json' || exit 1

CMD ["node", "apps/cms/server.js"]
