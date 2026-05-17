# ─────────────────────────────────────────────────────────────────────────────
# apps/public-api — Enterprise REST API (Hono + tRPC caller)
#
# Build: docker build -f apps/public-api/Dockerfile -t public-api .
# Port: 3000 (overridable via PORT; PUBLIC_API_PORT mirrors it).
#
# This image bundles only what public-api needs: its compiled dist + the
# workspace packages it imports (@contractor-ops/api, db, logger, validators)
# plus Prisma runtime. It does NOT include Next.js, React, or apps/web assets.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apk add --no-cache libc6-compat

# ── Stage 2: deps — install workspace dependencies ─────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/public-api/package.json apps/public-api/
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

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 3: builder — build workspace deps + public-api ───────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/public-api/node_modules ./apps/public-api/node_modules

COPY . .

# Prisma 7 config loader reads DATABASE_URL at generate time — dummy URL is
# enough (no DB connection is made during code generation).
RUN DATABASE_URL=postgres://x:x@localhost:5432/x \
    DATABASE_URL_EU=postgres://x:x@localhost:5432/x \
    DATABASE_URL_ME=postgres://x:x@localhost:5432/x \
    pnpm --filter @contractor-ops/db exec prisma generate

ENV NODE_ENV=production

# Turbo resolves `^build` — this builds db, auth, logger, validators, api,
# and every other workspace dep of public-api before public-api itself.
RUN pnpm turbo build --filter=@contractor-ops/public-api

# ── Stage 4: runner — minimal production image ─────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PUBLIC_API_PORT=3000

# Copy workspace node_modules (pnpm symlink graph) + built packages + app.
COPY --from=builder --chown=public:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=public:nodejs /app/packages ./packages
COPY --from=builder --chown=public:nodejs /app/apps/public-api/dist ./apps/public-api/dist
COPY --from=builder --chown=public:nodejs /app/apps/public-api/package.json ./apps/public-api/
COPY --from=builder --chown=public:nodejs /app/apps/public-api/node_modules ./apps/public-api/node_modules

USER public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "apps/public-api/dist/index.js"]
