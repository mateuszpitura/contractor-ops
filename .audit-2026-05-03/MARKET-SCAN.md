# Market Scan — Libraries & SaaS for Phase 2

**Date:** 2026-05-03
**Scope:** Independent ecosystem scan for the six Phase 2 architectural units in `NEXT-PHASE-PLAN.md`. Goal: avoid reinventing wheels, but also avoid paying ongoing rent for things we already do well.

---

## TL;DR — Recommendations table

| Unit | Buy / Build / Use library | Choice | Why |
| --- | --- | --- | --- |
| **P2-A — Outbox + canonical enqueue** | Build | Stay on **QStash + custom `OutboxEvent` table** | QStash already handles retries/dedup/cron. The missing piece is the *transactional* hop, which is a ~150-LOC table + 1 cron consumer. Migrating to Inngest/pg-boss is a 2-quarter rip-out. |
| **P2-B — Resilience layer** | Libraries | **`opossum` 9 + `p-retry` + `p-limit` + keep `fetchWithTimeout` as the call-site shim** | Opossum is the de-facto circuit breaker (Red Hat–backed, active 9.x line). Compose with p-retry + p-limit for retry+bulkhead. ~30 LOC of glue, zero bus-factor risk. Cockatiel was the elegant composable alternative but no npm release in 12+ months disqualifies it for a critical production layer. |
| **P2-C — RLS + DB cache** | Build | **`SET LOCAL app.org_id` via Prisma client extension + Upstash Redis cache** | Prisma's own RLS extension example is the right pattern. Don't pay for Accelerate; we already have Upstash. Skip community `prisma-extension-redis`/`-cache-manager` packages (single-maintainer risk). |
| **P2-D — OAuth + uploads** | Library + Build | **`arctic` for new OAuth providers**, keep `oauth-state.ts` for existing 7+; **`file-type` for MIME**; **`proxy-addr` for XFF** | Arctic for greenfield OAuth, but don't rip out 7 working flows. file-type and proxy-addr are 100% the right call. |
| **P2-E — Observability** | Library (partial) | **OpenTelemetry SDK piggybacking on Sentry's OTel ingestion + AsyncLocalStorage (native) + W3C `traceparent`** | Sentry now ingests OTel spans natively. Use `@sentry/nextjs`'s built-in fetch/http/tRPC instrumentation; add `@opentelemetry/instrumentation-pg` only if Prisma slow query log is insufficient. Skip a separate APM. |
| **P2-F — Async exports + PDF** | Build (mostly) | **Keep `@react-pdf/renderer` behind a QStash worker + stream CSV via `fast-csv`** | @react-pdf/renderer is fine *off the request path*. Puppeteer on Render is a memory landmine. Managed PDF SaaS is unnecessary spend. |
| **Cross-cutting: Inngest/Trigger.dev** | Avoid (now) | Stay on QStash | The migration cost outweighs the benefit. Reconsider if we hit ≥3 multi-step durable workflows. |
| **Cross-cutting: Hookdeck/Svix** | Avoid (now) | Build per-provider webhook handlers | We have 4–5 inbound webhook providers, not 50. Hookdeck is US-only data residency, Svix EU plan starts at $490/mo. |
| **Cross-cutting: Cloudflare Turnstile** | Buy | **Adopt for signup + password reset** | Free, EU-friendly, 5-min token integration. Closes F-SEC-22 cleanly. |
| **Cross-cutting: Axiom/Datadog/Grafana** | Defer | Stay on Sentry + Pino → file/stdout | Render's log retention is short, but a logs SaaS is a Phase 4 conversation, not Phase 2. |

---

## Per-unit deep dive

### P2-A — Outbox + canonical enqueue + notification correctness

**The ~12 `dispatch().catch(_=>{})` after Prisma transactions is a textbook outbox-pattern failure.** Three realistic options:

**Option 1: Stay on QStash + add an `OutboxEvent` table (RECOMMENDED).**
The minimal fix is a single table with `(id, organizationId, type, payload, status, attempts, nextAttemptAt, createdAt, processedAt)` written *inside* the same Prisma transaction, plus a 30-second QStash schedule that polls `WHERE status='pending' AND nextAttemptAt <= now() FOR UPDATE SKIP LOCKED LIMIT 100` and dispatches via the existing `qstashClient.publishJSON()`. QStash already gives us at-least-once delivery, `Upstash-Deduplication-Id` for idempotency, and a 10-minute dedup window ([Upstash docs](https://upstash.com/docs/qstash/features/deduplication)). The outbox table closes the *transactional* gap; QStash closes the *delivery* gap. Net new code: ~150 LOC + a Prisma migration. This also subsumes F-ASYNC-15 (notification dedup via DB unique index on `(organizationId, dedupKey)`) and F-SCALE-05 (advisory locks for cron — Postgres `pg_try_advisory_lock(hashtext('cron:reminders'))` is 1 line).

**Option 2: Migrate to `pg-boss` or `graphile-worker`.**
Both are mature Postgres-native job queues. **graphile-worker** has an exceptional latency story: 2–5ms from insert to execution thanks to LISTEN/NOTIFY ([worker.graphile.org](https://worker.graphile.org/docs/performance)), and built-in cron with multi-worker leader election — directly absorbs F-SCALE-05. **pg-boss** (12.18.1, last published 3 days ago, 230k weekly downloads — [npmjs.com](https://www.npmjs.com/package/pg-boss)) is more popular and slightly higher level. Both let us enqueue *inside* the Prisma transaction, eliminating the outbox table entirely. **However**: we already pay for QStash, our cron monitoring is wired to Cronitor against QStash schedules, and our consumer routes are HTTP. Switching means setting up long-running Node workers on Render (separate from the Next.js app), losing QStash's HTTP-callback model that fits Render's web-service lifecycle. Both also rely on `SKIP LOCKED` which creates dead tuples and needs vacuum tuning at high throughput ([npmtrends comparison](https://npmtrends.com/better-queue-vs-bullmq-vs-graphile-worker-vs-kue-vs-pg-boss)).

**Option 3: Migrate to Inngest or Trigger.dev v3.**
Inngest's "step functions" model and built-in dedup/idempotency could absorb 8+ findings (F-ASYNC-02, -03, -04, -05, -06, -09, -12, -16). Free tier: 50k runs/month; paid starts at $75/mo. Trigger.dev: $10/mo, Apache 2.0 self-hostable ([buildpilot comparison](https://trybuildpilot.com/610-trigger-dev-vs-inngest-vs-temporal-2026)). **Critical caveat I could not verify on a definitive vendor source: Inngest's EU data residency story is unclear** — the search returned no public EU-region announcement. For a German-jurisdiction app handling PII + KSeF tax data, this is a hard block until confirmed. Self-hosting Inngest on Render is a "build" exercise that erases the SaaS convenience.

**Recommendation: Option 1.** The outbox table is ~1 day of work, doesn't introduce a new vendor or runtime, and is the boring answer most prod systems land on. Reconsider Inngest only if (a) we hit 3+ multi-step durable workflows (we don't) and (b) Inngest publishes a Frankfurt region.

---

### P2-B — Resilience layer (timeouts, retries, breakers, idempotency)

**Decision (post-verification): three single-purpose libraries beat one stale composable kit.**

**`opossum` 9.x (RECOMMENDED — circuit breaker).** The de-facto Node circuit breaker. Latest **9.0.0 published June 2025** ([npm](https://www.npmjs.com/package/opossum)), drops Node <20, fully aligned with WHATWG Fetch. Maintained by the Nodeshift community with **Red Hat backing** (`@redhat/opossum` is a fully-supported channel — [Nodeshift docs](https://nodeshift.dev/opossum/), [Red Hat developer blog](https://developers.redhat.com/blog/2021/04/15/fail-fast-with-opossum-circuit-breaker-in-node-js)). ~600k weekly downloads, 205+ npm dependents. Built-in event metrics (`fire`, `success`, `failure`, `timeout`, `reject`, `open`, `halfOpen`, `close`) that map cleanly to Sentry/Pino emission. Single-purpose: it's *only* a circuit breaker — by design.

**`p-retry` (RECOMMENDED — retries + jitter).** Sindre Sorhus, ~50M weekly downloads, exponential backoff with optional jitter, abort signal support. Tiny, no native deps. Pairs with opossum's `breaker.fire(() => pRetry(...))` pattern.

**`p-limit` (RECOMMENDED — concurrency / bulkhead).** Same author. Caps concurrent in-flight calls per origin, prevents one slow upstream from starving the worker. Used as `const limit = pLimit(10); breaker.fire(() => limit(() => pRetry(call)))`.

**`cockatiel` (REJECTED).** TS-first port of .NET Polly with composable `Policy.wrap()`. Elegant API, ~500–600k weekly. **Disqualifying issue: latest npm release is v3.2.1 from July 2024 — 12+ months stale.** A v4 sits unreleased on master ([github](https://github.com/connor4312/cockatiel)). For a critical production-readiness layer the bus-factor on a single-maintainer release pipeline is too high. Code quality is high (author is Connor Peet, VS Code core), but "elegant API now, vendor-fork later" is a bad trade vs three boring well-maintained libraries.

**Roll our own (REJECTED).** ~80 LOC gets you a 5-failure / 30s open / 1-trial half-open breaker. Doesn't give jitter helpers, bulkheads, or the metrics surface opossum publishes for free. Owning the test matrix on a critical reliability primitive is poor leverage.

**HTTP client layer.** `fetchWithTimeout` is fine — keep it. Don't switch to `got` (heavier), `ky` (browser-leaning), or full `undici` Dispatcher (we'd wire keep-alive Agents per-origin, which on serverless gives us nothing because instances aren't long-lived). The native `fetch` Node provides is undici under the hood already.

**Idempotency keys.** Don't reach for a library. The pattern is 5 lines: `const key = sha256(\`${orgId}:${businessKey}:${operation}\`)` for derived keys; pass to Stripe/Resend as `Idempotency-Key` header; pass to QStash as `Upstash-Deduplication-Id`. Storecove and InPost don't honor RFC idempotency keys, so use the dedup-id at our queue layer instead.

**Recommendation: `opossum` 9 + `p-retry` + `p-limit` + keep `fetchWithTimeout`.** Build a small `withResilience(call, { breaker, retry, limit })` helper (~30 LOC) and wrap each integration's HTTP calls per-provider config (failure threshold, half-open delay, retry attempts, concurrency cap). Hold breaker state in a per-process Map (not Redis) — the cost of a few extra retries on cold starts is less than the latency of a Redis round-trip per call. Emit opossum's events to Pino + Sentry for observability hooks.

---

### P2-C — Defense-in-depth (RLS) + DB cache

**RLS approach.** Both options in the plan are valid but have very different cost profiles.

- **Full Postgres `CREATE POLICY` per tenant table** is the gold standard but a quarter+ of work: every multi-tenant table needs policies, the migration must coexist with existing queries, and Prisma's superuser default connection bypasses RLS unless we configure a non-superuser role. This is "Phase 5 Q3" work, not Phase 2.
- **`SET LOCAL app.org_id` + Prisma client extension** is the pragmatic defense-in-depth move. Prisma's own example for this exact pattern is documented at [prisma-client-extensions/row-level-security](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security). The extension wraps every query in a `prisma.$transaction()` that calls `SET LOCAL` first. It's ~50 LOC and immediately gives us a defensive guard: if our existing tenant middleware ever drops `organizationId` from a `where` clause, the database has the second line of defense (once we layer in actual policies later).

**Community Prisma RLS extension `s1owjke/prisma-rls`** exists and is reasonable but adds a single-maintainer dependency for what is fundamentally a 50-LOC piece of code we'll fully understand. **Skip it.**

**Cross-region tenant cache.** The plan calls out 5-minute TTL on `Organization.findUnique`, keyed `org:${id}:meta`, invalidated on update. This is the right shape.

- **`@prisma/extension-accelerate`** ([Prisma docs](https://www.prisma.io/docs/accelerate/more/faq)) is Prisma's hosted query cache: ~$60/mo entry tier. It also gives connection pooling, but Neon already does that. For tenant lookup specifically, Accelerate is a sledgehammer.
- **Community `prisma-extension-redis` / `prisma-extension-cache-manager`** ([github.com/yxx4c/prisma-extension-redis](https://github.com/yxx4c/prisma-extension-redis), [random42/prisma-extension-cache-manager](https://github.com/random42/prisma-extension-cache-manager)) work and have multi-tenant namespace support, but they're solo-maintained forks-of-forks. Bringing one in for a single hot path is poor leverage.
- **Direct Upstash Redis from `tenantMiddleware`** is ~30 LOC: read-through cache, `setex` 300, `del` on `Organization.update` audit hook. We already have `@upstash/redis` wired. Done.

**In-memory pagination OOMs (F-DB-05, F-DB-12).** No library buys this — it's `prisma.findMany({ cursor })` rewrites + cursor streams to the consumer (CSV/PDF writer). See P2-F for the CSV side.

**Recommendation: Plain Upstash Redis read-through cache + `SET LOCAL` Prisma extension hand-rolled from Prisma's official example.** No new dependencies.

---

### P2-D — OAuth + file-upload security

**Application-level OAuth (NOT end-user, that's Better Auth).**

- **`arctic`** by the Lucia author ([arcticjs.dev](https://arcticjs.dev/)) is the modern small choice — 50+ providers, exports `generateState()`, `createAuthorizationURL()`, `validateAuthorizationCode()`, handles PKCE, no dependencies. ~75 KB. The catch: it doesn't *solve* the cookie-binding problem; you still have to set a `__Host-` cookie with the state and compare on callback. Arctic just gives you tested provider configs.
- **`oauth4webapi`** ([github.com/panva/oauth4webapi](https://github.com/panva/oauth4webapi)) is even smaller and runtime-agnostic (Bun/Deno/Edge). Has zero dependencies, FAPI-certified. Better choice if we ever move OAuth flows to Edge runtime; for plain Node it's overkill.
- **`openid-client`** is heavy and Node-only; the maintainer himself recommends `oauth4webapi` for new projects.

**Reality check on the existing 7+ flows.** Slack, Jira, Linear, Notion, Google, Outlook, Confluence, Clockify — these all already work. The Tier-1 sweep added HMAC-signed state. The remaining gap (F-SEC-05, F-SEC-21) is **single-use binding to session**, which arctic does not magically solve — the right answer is the `OAuthChallenge` DB row from the plan (one insert per OAuth start, deletes on callback). That gives true single-use guarantees and replay protection, regardless of whether the underlying OAuth client is arctic or ours.

**Recommendation:** Adopt `arctic` for *new* providers from this point forward (the typed configs save real time when adding e.g. HubSpot or Zoom later), but do **not** rip out the existing `oauth-state.ts`. Layer the `OAuthChallenge` table on top of all current callbacks. This is a 1-day fix.

**File-upload MIME sniffing.** `file-type` (Sindre Sorhus, ~8M weekly downloads, ESM-only — [pkgpulse comparison](https://www.pkgpulse.com/blog/file-type-vs-mime-types-vs-mmmagic-file-detection-nodejs-2026)) is the unambiguous right answer. It's pure JS (no native deps, runs on serverless), reads magic bytes from a buffer, and supports all the formats we care about (PDF, JPEG/PNG, DOCX, XLSX, ZIP). Pull the first 4 KB from R2 via a `Range: bytes=0-4095` request, sniff, reject + delete on mismatch. Total integration: ~15 LOC.

**Skip mmmagic** — libmagic native binding, Python build deps, won't run on Render's standard environment, won't work on Vercel Edge.

**XFF / trusted-proxy chain.** `proxy-addr` (Express team) is the canonical implementation. ~85M weekly downloads; tiny; zero deps. It correctly walks the XFF list right-to-left, terminating at the first untrusted hop. Configure with Render's IP range as trusted. **`forwarded`** (same author) parses RFC 7239 `Forwarded` headers but Render only sets `X-Forwarded-For`, so we don't need it. Total integration: ~10 LOC in `apps/web/src/middleware.ts`.

**Bot protection on signup (F-SEC-22).** **Cloudflare Turnstile** is the right call: free, EU-friendly (Cloudflare handles the GDPR posture), 5-minute server-verify TTL, no annoying image puzzles ([Cloudflare docs](https://developers.cloudflare.com/turnstile/get-started/)). Drop `<Turnstile siteKey={...}/>` on the signup form, verify token in Better Auth's `before` hook on signup. Beats reCAPTCHA on UX *and* privacy. Beats hCaptcha on accuracy at the free tier.

**Recommendation:** `file-type` + `proxy-addr` + Cloudflare Turnstile + DB-backed `OAuthChallenge` row. `arctic` adopted opportunistically going forward, not a rip-out.

---

### P2-E — Observability propagation

**The big strategic question: OpenTelemetry, or roll our own AsyncLocalStorage requestId?**

**Reality of `@sentry/nextjs` in 2026.** Sentry now natively ingests OTel spans. Outgoing fetch is auto-instrumented; the SDK injects `sentry-trace`, `baggage`, and (with `propagateTraceparent: true`) the W3C `traceparent` header onto outbound requests ([Sentry distributed tracing docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/distributed-tracing/)). The `Sentry.trpcMiddleware()` wraps tRPC procedures with proper spans ([Sentry tRPC integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/integrations/trpc/)). Next.js 15 has `instrumentation.ts` enabled by default ([Next.js OTel guide](https://nextjs.org/docs/app/guides/open-telemetry)). For our stack, **most of what F-OBS-02/03/06 need is already happening if we set the right Sentry options**.

**What's NOT auto-instrumented.**
- The QStash hop (we publish via `@upstash/qstash` SDK, which is plain `fetch` — auto-instrumented for the publish, but the QStash *consumer* request comes in with no Sentry trace context unless we manually inject `traceparent` as a header on publish and read it on the consumer route — that's ~10 LOC).
- Prisma queries (Sentry's `prismaIntegration` exists but logs each query as a span which is noisy at scale; the safer move is the official Prisma slow-query log via `$on('query')` with a 200ms warn threshold).
- AsyncLocalStorage propagation across the QStash boundary (not solved by Sentry — but we don't need *Node* ALS to cross processes; what we need is the `traceparent` header reseeded in the consumer).

**OpenTelemetry full-fat (`@opentelemetry/sdk-node` + `auto-instrumentations-node`).** Auto-instruments fetch, http, pg, undici, etc. Cold-start overhead 200–800ms depending on enabled instrumentations ([oneuptime guide](https://oneuptime.com/blog/post/2026-02-06-opentelemetry-vercel-serverless-functions/view)). For Render's long-running web service this is fine; for serverless Vercel-style functions it's painful. Sentry can be the OTel sink, so we're not adding a vendor.

**`@vercel/otel`** is optimized for serverless cold-starts but is largely a thin wrapper. Works on Render but doesn't give us anything @opentelemetry/sdk-node doesn't, except being slightly smaller.

**`prom-client` vs OTel metrics.** prom-client is the boring industry standard for Node, but if we're already standing up OTel for traces, OTel metrics is one less thing. Render doesn't run a Prometheus scrape job by default, so we'd send metrics to Sentry's measurement API or to a separate vendor (Grafana Cloud / Axiom). For Phase 2: emit a small set of measurements directly to Sentry via `Sentry.metrics.distribution()`. Skip prom-client for now.

**`@godaddy/terminus`.** Last published 3 years ago ([npm](https://www.npmjs.com/package/@godaddy/terminus)). Still works. For our `/api/health` real probe (F-OBS-07), the entire integration is ~30 LOC (await Promise.all of pg ping, redis ping, qstash health URL ping, R2 head). Don't add the dep.

**Recommendation:**
1. **Set `propagateTraceparent: true` and `tracesSampleRate: 0.1` in Sentry config** — gets us cross-system traces immediately.
2. **Build a 50-LOC `request-context.ts` AsyncLocalStorage module** that seeds `requestId` (UUID v7) and reads existing `traceparent` from incoming headers; expose via Pino mixin so every log line carries it. This is the right level of "build" — frameworks don't help here.
3. **Inject `traceparent` + `x-request-id` headers at the QStash publish layer; read them in the consumer route handler** to seed the consumer-side ALS. ~20 LOC.
4. **Skip full `@opentelemetry/sdk-node` for now.** Sentry's built-in integrations cover 80%. Add OTel only when we hit a need Sentry can't satisfy (e.g., emitting to a second backend like Grafana Cloud Tempo).
5. **Real `/api/health` route** — hand-rolled, no terminus.
6. **Sentry `beforeSend` PII scrub** — hand-rolled; recipe is 30 LOC of regex/key-allowlist on `event.request.data` and `event.user`.

This keeps us off the OTel boilerplate treadmill while still getting end-to-end traceability via Sentry's existing instrumentation.

---

### P2-F — Async exports + sync work offload (PDF, large CSV, dashboard)

**PDF generation.** Three options:

- **`@react-pdf/renderer` (current) behind a QStash worker (RECOMMENDED).** The library is fine; the bug is that we render *on the request path*. Move SDS/DRV/GDPR PDF generation to a `/api/exports/_process` consumer that writes to R2 and emails a signed link. @react-pdf handles "hundreds of pages" fine ([npm-compare](https://npm-compare.com/html-pdf,pdfkit,pdfmake,puppeteer,react-pdf,wkhtmltopdf)) and the React API is pleasant for legal-doc layouts.
- **Puppeteer.** Pixel-perfect HTML→PDF, but on serverless/containerized deploys it's 200+ MB of Chromium, frequent OOM after a few hundred generations (~2 GB RAM creep), and Render's standard plans cap at 512 MB. Hard pass for our use case.
- **Managed PDF SaaS (PDFShift, DocRaptor, etc.).** $50–$200/mo for the volume we need; adds yet another vendor; sends document content (which includes PII) to a third party that we'd need to DPA. Not worth it.

**CSV streaming.** `fast-csv` (@fast-csv/format, ~4M weekly downloads) and `csv-stringify` (csv module, ~5M weekly) both expose a `Transform` stream that pairs with Prisma's cursor pagination to write rows as we read them. Either is fine; **`csv-stringify`** has a slightly cleaner API and more active release cadence. Our existing custom RFC-4180 helper at `packages/api/src/lib/csv.ts` is a synchronous in-memory builder — replace it with a `csv-stringify`-based `Readable` that pipes to R2 multipart upload. ~80 LOC.

**XLSX streaming.** We already use `exceljs`. Its `WorkbookWriter` (streaming write API) supports row-by-row commits with O(1) memory. No new dep; just refactor the 3 places that buffer everything in memory.

**Dashboard caching.** Singleflight pattern + Redis cache + RSC parallel fetch. No library. Singleflight is `if (in-flight) return promise; else compute, cache result for 5s, return promise`. ~15 LOC. Don't reach for `dataloader` here — it's request-scoped batching, wrong tool.

**`react-email`.** Already implicitly relevant since we use Resend. React Email 6.0 shipped April 2026 ([Resend blog](https://resend.com/blog/react-email-6)). Templates are typed React components → MJML-quality HTML. **Adopt for branded transactional templates** (the export-ready link email from F-SCALE-01, account verification, invoice notifications). Saves the "design-by-string-concatenation" pain we'll otherwise hit. 1-day adoption.

**Recommendation:** No new heavy frameworks. `csv-stringify` + `react-email` are the only two new libs. Move @react-pdf and exceljs to streaming usage *behind QStash*. The single typed export registry from the plan is correct — just keep it 100% in-house.

---

## Cross-cutting SaaS evaluation

### Inngest vs Trigger.dev v3

**Pitch:** durable workflows with built-in retries, idempotency, cron, observability, and a dashboard. Could in theory absorb 8+ findings (most of P2-A and parts of P2-E).

**Inngest pricing:** free tier 50k runs/month; $75/mo for production tier ([buildmvpfast](https://www.buildmvpfast.com/alternatives/inngest)). Runs *on your serverless platform* — Inngest sends HTTP calls to your endpoints when steps fire.

**Trigger.dev v3 pricing:** free tier 5k runs/month; $10/mo entry. Runs on Trigger.dev's *own* compute (no Vercel function timeouts). Apache 2.0 self-hostable.

**Why we should NOT migrate now:**
1. **EU data residency unclear for Inngest.** No public Frankfurt-region announcement. We process EU PII + Saudi tax data; this is not negotiable.
2. **Already paying for QStash.** And QStash already has at-least-once delivery, dedup IDs, cron schedules, and Cronitor monitoring. The transactional-outbox gap is the *only* thing it doesn't solve, and that's a 1-day fix on our side.
3. **Migration cost.** ~12 dispatch sites + 8 cron schedules + 6 consumer routes would all need to be re-shaped to Inngest's `inngest.createFunction()` API. That's 1–2 weeks of mechanical work for a system that mostly works.
4. **Vendor lock-in.** Inngest's step-function abstraction is proprietary; you can't easily move off it.

**When to reconsider:** if we ever need a multi-step durable workflow that sleeps for days (e.g., "send DRV reminder, wait 7 days, escalate, wait 7 days, mark stalled"). We don't have that today; we have HTTP callbacks with retries.

### Hookdeck vs Svix

**Pitch:** webhook gateway for inbound — signature verify, retry with replay UI, dedup, queueing.

**Reality of our setup.** We have ~5 inbound webhook providers (Stripe, KSeF, Storecove, DocuSign, Resend status). Stripe has best-in-class signature verification + replay tooling out of the box. KSeF's webhook is a polling pattern, not push. The rest are 1-2 endpoints each.

**Hookdeck:** $39/mo entry, $3.30/M events. **US-only data residency** — disqualifying for EU PII.
**Svix:** $490/mo entry (no mid-tier), $100/M events. EU + custom regions available ([hookdeck comparison](https://hookdeck.com/webhooks/platforms/hookdeck-event-gateway-vs-svix-ingest-webhook-receiving-comparison)).

**Recommendation: skip both.** The cost is wildly out of proportion to our 5-provider reality. Hand-rolled signature verification + the new `OutboxEvent`-backed retry path covers us. Reconsider when we cross 10+ inbound webhook providers or hit an SOC2 audit that demands centralized webhook audit logs.

### Cloudflare Turnstile

**Adopt for signup, password reset, and any unauthenticated form**. Free, well-documented Next.js integration, EU-friendly, doesn't require user puzzles. Closes F-SEC-22 in <1 day. ([Cloudflare docs](https://developers.cloudflare.com/turnstile/get-started/))

### Unkey

**Skip.** We have ~zero need for managed customer-facing API keys today (our public API is OAuth-protected per integration). Unkey is great for products that ship a public REST API for developers — that's Phase 5+ for us, if ever.

### PostHog

**Out of scope for this audit.** Product analytics, not infrastructure. Worth a separate evaluation when we have a growth/PM team to use it.

### Axiom vs Datadog vs Honeycomb vs Grafana Cloud

**Defer.** Render gives us 7 days of stdout logs; that plus Sentry's error+trace store covers most incident scenarios. The case for adding a logs SaaS would be either (a) we need to query historical logs across tenants for compliance, or (b) we hit incident-response situations where Sentry traces are insufficient. Neither is true today.

If/when we do add one:
- **Axiom** is the best price/value fit ([buildmvpfast](https://www.buildmvpfast.com/alternatives/axiom)) for a Pino → SaaS pipeline. EU region exists. ~$25/mo entry.
- **Datadog** is the most expensive and most feature-complete; only justifiable when we have ≥3 engineers full-time on observability.
- **Grafana Cloud** with Loki+Tempo is the self-managed-flavored SaaS — best if we already run Grafana.
- **Honeycomb** is wonderful for high-cardinality trace exploration but pricey for log volume.

### Sentry Performance (already paying)

**Use it more aggressively.** It already auto-instruments Next.js fetch, has tRPC middleware, ingests OTel spans, and supports W3C `traceparent` propagation. Most of P2-E is "configure what we already pay for" rather than "build new." Make sure `tracesSampleRate` is non-zero in production (start at 0.1) and that the tRPC middleware is actually wired.

---

## Overall recommendation summary

If I had to pick: **add six small libraries, adopt one SaaS, and resist everything else.**

The libraries: **`opossum` 9 + `p-retry` + `p-limit` (P2-B resilience), `file-type` (P2-D MIME), `proxy-addr` (P2-D XFF), `csv-stringify` (P2-F streaming)**, plus **`react-email`** for branded transactional templates which is more polish than necessity. Optionally **`arctic`** for new OAuth providers going forward — not a rip-out.

The one SaaS: **Cloudflare Turnstile** for signup bot protection. Free, EU-friendly, closes F-SEC-22.

What to keep building in-house: **the outbox table, the Prisma RLS extension (modeled on Prisma's official example), the Upstash Redis tenant cache, the requestId/AsyncLocalStorage propagation, the QStash `traceparent` header threading, the singleflight dashboard cache, and the typed async export registry.** All of these are 30–150 LOC each, well-understood, and don't justify a vendor.

What to **not** do in Phase 2: don't migrate off QStash to Inngest/Trigger.dev/pg-boss, don't add Hookdeck/Svix for 5 webhook providers, don't add a logs SaaS yet, don't switch HTTP clients, don't adopt full `@opentelemetry/sdk-node` when Sentry's built-ins cover 80%, don't pay for Prisma Accelerate when Upstash + read-through covers the one hot path, and don't reach for `effect-ts` for resilience — it's a paradigm shift, not a Phase 2 ask.

None of the recommended libraries carry significant maintenance risk. `opossum` is Red Hat–backed; p-retry / p-limit / file-type / proxy-addr are all Sindre Sorhus or Express-team stalwarts with millions of weekly downloads.

---

## Sources

- [pg-boss vs graphile-worker (npm trends)](https://npmtrends.com/better-queue-vs-bullmq-vs-graphile-worker-vs-kue-vs-pg-boss)
- [Graphile Worker performance docs](https://worker.graphile.org/docs/performance)
- [pg-boss on npm](https://www.npmjs.com/package/pg-boss)
- [Inngest vs Trigger.dev vs Temporal — BuildPilot](https://trybuildpilot.com/610-trigger-dev-vs-inngest-vs-temporal-2026)
- [Inngest pricing](https://www.inngest.com/pricing)
- [Best Inngest alternatives](https://www.buildmvpfast.com/alternatives/inngest)
- [Cockatiel GitHub](https://github.com/connor4312/cockatiel) (rejected — stale release pipeline)
- [Cockatiel security analysis (Aikido)](https://intel.aikido.dev/packages/npm/cockatiel)
- [Opossum on npm](https://www.npmjs.com/package/opossum) (recommended)
- [Opossum GitHub](https://github.com/nodeshift/opossum)
- [Opossum 8.1.3 docs (Nodeshift)](https://nodeshift.dev/opossum/)
- [Red Hat developer blog on Opossum](https://developers.redhat.com/blog/2021/04/15/fail-fast-with-opossum-circuit-breaker-in-node-js)
- [p-retry on npm](https://www.npmjs.com/package/p-retry)
- [p-limit on npm](https://www.npmjs.com/package/p-limit)
- [API Resilience patterns 2026](https://apiscout.dev/blog/api-resilience-circuit-breakers-retries-bulkheads-2026)
- [Prisma row-level security extension example](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security)
- [s1owjke/prisma-rls](https://github.com/s1owjke/prisma-rls)
- [Prisma Accelerate FAQ](https://www.prisma.io/docs/accelerate/more/faq)
- [Upstash Redis pricing](https://upstash.com/docs/redis/overall/pricing)
- [Caching Prisma queries with Upstash Redis](https://upstash.com/blog/caching-prisma-redis)
- [yxx4c/prisma-extension-redis](https://github.com/yxx4c/prisma-extension-redis)
- [random42/prisma-extension-cache-manager](https://github.com/random42/prisma-extension-cache-manager)
- [Arctic OAuth docs](https://arcticjs.dev/)
- [oauth4webapi GitHub](https://github.com/panva/oauth4webapi)
- [file-type vs mime-types vs mmmagic — PkgPulse](https://www.pkgpulse.com/blog/file-type-vs-mime-types-vs-mmmagic-file-detection-nodejs-2026)
- [Cloudflare Turnstile docs](https://developers.cloudflare.com/turnstile/get-started/)
- [Adding Cloudflare Turnstile to Next.js 15](https://medium.com/@jedpatterson/adding-cloudflare-turnstile-to-a-next-js-app-78121bf4d7e3)
- [X-Forwarded-For — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For)
- [Express behind proxies (proxy-addr usage)](https://expressjs.com/en/guide/behind-proxies.html)
- [Sentry Next.js OpenTelemetry support](https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/)
- [Sentry Next.js distributed tracing](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/distributed-tracing/)
- [Sentry tRPC middleware](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/integrations/trpc/)
- [Sentry Next.js sensitive data scrubbing](https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/)
- [Next.js OpenTelemetry guide](https://nextjs.org/docs/app/guides/open-telemetry)
- [@vercel/otel npm](https://www.npmjs.com/package/@vercel/otel)
- [OpenTelemetry serverless guide](https://opentelemetry.io/docs/languages/js/serverless/)
- [Cold-start overhead with @opentelemetry/sdk-node](https://oneuptime.com/blog/post/2026-01-07-opentelemetry-serverless/view)
- [@godaddy/terminus on npm](https://www.npmjs.com/package/@godaddy/terminus)
- [JavaScript PDF libraries — Nutrient](https://www.nutrient.io/blog/javascript-pdf-libraries/)
- [PDF library comparison — npm-compare](https://npm-compare.com/html-pdf,pdfkit,pdfmake,puppeteer,react-pdf,wkhtmltopdf)
- [React PDF Generation in 2026 — Viprasol](https://viprasol.com/blog/react-pdf-generation/)
- [React Email 6.0 announcement](https://resend.com/blog/react-email-6)
- [Hookdeck vs Svix comparison](https://hookdeck.com/webhooks/platforms/hookdeck-event-gateway-vs-svix-ingest-webhook-receiving-comparison)
- [Bottleneck on npm](https://www.npmjs.com/package/bottleneck)
- [@upstash/qstash deduplication docs](https://upstash.com/docs/qstash/features/deduplication)
- [Why we chose QStash and Upstash Workflow at scale](https://upstash.com/blog/qstash-workflow-at-scale)
- [Outbox / Inbox patterns — Event-Driven.io](https://event-driven.io/en/outbox_inbox_patterns_and_delivery_guarantees_explained/)
- [Datadog vs Grafana — SigNoz](https://signoz.io/blog/datadog-vs-grafana/)
- [Best Axiom alternatives](https://www.buildmvpfast.com/alternatives/axiom)
- [Unkey homepage](https://www.unkey.com/)
- [undici on npm](https://www.npmjs.com/package/undici)
- [ky GitHub](https://github.com/sindresorhus/ky)
