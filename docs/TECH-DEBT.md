# Tech Debt Register

Living list of deliberate shortcuts and known limitations. Each entry has a **trigger** that should prompt a revisit.

---

## 1. Upstash REST + QStash → Render Key Value + BullMQ

**Status**: Active. Set during Render deployment cutover.

**Current state**:
- Rate limiting and cache use `@upstash/redis` (HTTP REST) and `@upstash/ratelimit` — see `apps/web/src/middleware.ts`, `packages/api/src/services/cache.ts`.
- Webhook ingress (`apps/web/src/app/api/webhooks/_process/route.ts`) enqueues to Upstash QStash, which calls back over HTTP with retry/delay/signing.

**Why we're holding it**:
- Zero-refactor path to Render. REST API works from any process (Edge, Node, serverless) without TCP connection management.
- QStash provides retries, delays, scheduling, and signature verification out-of-the-box — no infrastructure to run.
- Time-to-deploy for Render cutover is the immediate priority.

**Why it's debt**:
- **Cost**: Upstash bills per Redis command and per QStash message. At meaningful traffic (~10M requests/month) the bill grows linearly, while a self-hosted Valkey + BullMQ on Render KV is a flat plan price.
- **Latency**: HTTP REST adds ~5–20ms per call vs ~1ms TCP within the same Render region. Rate-limit middleware runs on every request.
- **External SPOF**: Two extra third-party hops (Upstash + QStash) in the critical path for webhooks. Outages in either degrade ingestion.
- **Lock-in**: QStash retry/DLQ semantics are not portable. Switching providers later is a bigger refactor than doing it now.
- **Observability**: BullMQ exposes job state, retry history, DLQ, and queue depth via standard Redis primitives. QStash hides this behind a vendor dashboard.

**Target state**:
- Add `keyvalue` service to `render.yaml` (Valkey 8, TCP, same region as `web`).
- Replace `@upstash/redis` with `ioredis` and a thin wrapper that preserves the existing `cache.get/set/del` API — see `packages/api/src/services/cache.ts`.
- Replace `@upstash/ratelimit` with the BullMQ + Redis-based equivalent or a small custom sliding-window using Lua (Redis `EVAL`) — `apps/web/src/middleware.ts`.
- Replace QStash producer in webhook ingress with BullMQ producer; consume in the existing Render Background Worker (or a second worker dedicated to queues). Reuse the signature verification logic per provider.

**Trigger to revisit**:
- Upstash monthly bill > $200, OR
- Webhook processing p95 latency > 2s, OR
- Need for advanced retry policies / DLQ inspection / scheduled jobs at scale.

**Estimated effort**: 2–3 days (cache + rate limit + queue producer/consumer + signature verification + tests).

**Files affected**:
- `render.yaml` (add `keyvalue`)
- `packages/api/src/services/cache.ts`
- `packages/api/src/services/queue.ts` (new)
- `apps/web/src/middleware.ts`
- `apps/web/src/app/api/webhooks/_process/route.ts`
- `apps/web/worker-cron.mjs` → split into worker-cron + worker-queue OR merge
- `.env.example` (add `REDIS_URL`)

---

## 2. ME data residency — logical only (plan: AWS `me-south-1` if contractually required)

**Status**: Active. Currently all app workloads and both DBs run in Frankfurt (Render EU, Neon EU).

**Current state**:
- ME tenants are routed to a logically separate Neon database (`DATABASE_URL_ME`), R2 bucket (`R2_BUCKET_NAME_ME`), and Unleash instance (`unleash-me`).
- All three **physically reside in EU** (Neon has no ME region, Render has no ME region, R2 is global-edge but primary is EU).
- Code enforces per-jurisdiction short-circuits in the feature-flag wrapper, cross-region detection service (`packages/api/src/services/cross-border.ts`), and GDPR purge paths.
- This satisfies the common contractual clause "ME tenant data is not commingled with EU tenant data" — the data is isolated at the schema/bucket level.

**Why we're holding it**:
- Render + Neon is a one-cloud, low-ops deployment. Moving ME to AWS means owning Terraform, IAM, ECS/Fargate, Aurora, ACM, Route53, CloudWatch — an entire second platform.
- At today's ME tenant count (0–few), the cost/complexity ratio is absurd: AWS minimum (VPC + ALB + Fargate 2×0.5 vCPU + Aurora Serverless v2) ≈ $80–150/month **per ME tenant footprint**, vs ~$0 incremental on Render.
- No current customer has a hard physical-residency requirement.

**Why it's debt**:
- Saudi NDMO / NCA ECC controls, UAE NESA, Qatar PDPPL may require data to remain physically within GCC borders for regulated sectors (government, healthcare, finance). Logical isolation in Frankfurt does NOT satisfy those.
- An enterprise sales cycle may hard-block on "data resident in-country" — at that point we need this ready, not starting.

**Target state**:
- Provision a parallel ME stack in AWS `me-south-1` (Bahrain) or `me-central-1` (UAE) via `infra/aws-me/` Terraform module (skeleton committed, NOT yet applied — see `infra/aws-me/README.md`).
- Stack: VPC + ALB + ECS Fargate (`web` + `public-api` + `worker` tasks, same Docker images from ECR mirror) + Aurora PostgreSQL Serverless v2 + S3 bucket + Secrets Manager + CloudWatch.
- App-level routing: when a tenant's `dataRegion === 'ME'`, tRPC/Hono resolvers use a ME-region client for DB and storage calls. Infra for this already exists (`DATABASE_URL_ME`, `R2_BUCKET_NAME_ME`) — only the values change to point at AWS.
- Traffic split: EU stack stays on Render for EU tenants; ME stack on AWS for ME tenants. Shared codebase, same CI builds both Docker images.

**Trigger to revisit**:
- First customer with hard physical-residency clause in their contract (typically government / regulated enterprise in Saudi Arabia / UAE / Qatar), OR
- Regulatory change mandating in-country hosting for a segment we serve.

**Estimated effort (honest)**:
- **First time (Terraform skeleton → running ME stack)**: **3–5 days**. Breakdown:
  - Day 1: AWS account setup, ECR mirror for all 3 images, `terraform apply` of VPC + RDS + ECR, first Aurora snapshot restore test.
  - Day 2: ECS/Fargate + ALB + ACM cert + Route53, first `web` task running and responding on HTTPS.
  - Day 3: `public-api` + `worker` tasks, Secrets Manager wiring, CloudWatch alarms, Sentry region tag.
  - Day 4: App-side tenant routing validation (force a test tenant to ME region, run e2e suite against ME stack), Infisical ME project, Unleash-ME mirror on ECS.
  - Day 5: Buffer for DNS cutover, load test, runbook write-up.
- **Subsequent re-apply** (e.g. redeploy to different ME region): **1–2 days** — Terraform is parametrized by region, so it's variable change + apply + DNS.
- The often-quoted "1–2 days" is only realistic for step 2, not the first provision.

**Files affected**:
- `infra/aws-me/*.tf` (new — skeleton already scaffolded; not applied)
- `infra/aws-me/README.md` (runbook)
- `.github/workflows/ecr-mirror.yml` (new — mirror Docker Hub → ECR)
- `packages/api/src/services/tenant-region-router.ts` (new — routes DB/storage clients by `org.dataRegion`)
- `.env.example` (add `AWS_ME_DATABASE_URL`, `AWS_ME_S3_BUCKET`, `AWS_ME_UNLEASH_URL`)
- `apps/web/src/server/db.ts`, `apps/public-api/src/server/db.ts` (switch to region-aware client)
