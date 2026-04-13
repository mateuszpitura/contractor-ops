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
