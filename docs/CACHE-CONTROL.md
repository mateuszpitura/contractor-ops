# Cache-Control Policy for Public API Routes

**Owner:** Backend / API. **Phase:** C.7.a (production-hardening). **Last reviewed:** 2026-05-16.

This document is the canonical reference for the `Cache-Control` header on
every Route Handler under `apps/web/src/app/api/**`. It captures the per-route
decision matrix, the defaults a new route inherits, and the update process.

## Defaults

| Posture | Header | When to use |
|---|---|---|
| **Default (private)** | `no-store, private` | Authenticated handler, org-scoped data, single-use redirects, anything tied to a session cookie. Applied via `withNoStore()` from `apps/web/src/lib/cache-control.ts`. |
| **Public, brief** | `public, max-age=60, must-revalidate` | Liveness probes that may legitimately be cached by a CDN for ~1 minute so monitor traffic does not stampede origin. Applied via `CACHE_CONTROL_HEALTH`. |
| **Public, long-lived** | `public, max-age=3600` | Static well-known resources that change rarely (`/.well-known/security.txt`). Set directly on the response. |

Every new GET route MUST pick one of the above (or document a fourth in this
file). The default if you forget is `no-store, private` via the helper —
which is safe but suboptimal for genuinely cacheable content.

## Per-route inventory

| Route | Method(s) | Cache-Control | Rationale |
|---|---|---|---|
| `/.well-known/security.txt` | GET | `public, max-age=3600` | RFC 9116 contact file. Changes only when security contact rotates; an hour of CDN cache is fine. |
| `/api/health` | GET | `public, max-age=60, must-revalidate` | Liveness probe. Brief CDN cache absorbs Render / Cronitor / uptime-kuma bursts without masking a real outage (`must-revalidate` forces freshness when `max-age` elapses). |
| `/api/auth/[...all]` | GET, POST | `no-store, private` | Better Auth catch-all. Sign-in cookies, magic-link tokens, OAuth callbacks — must never be cached or leaked across users. |
| `/api/oauth/[provider]/start` | GET | `no-store, private` | Mints per-request HMAC state + `__Host-oauth_state` cookie. Single-use. |
| `/api/oauth/[provider]/callback` | GET | `no-store, private` | Consumes single-use IdP state; every response is user-scoped. |
| `/api/exports/[exportId]/download` | GET | `no-store, private` | Returns a 302 to a freshly-signed R2 URL or a JSON error envelope. Both are per-session. |
| `/api/cron/boe-rate-poll` | GET, POST | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/classification-economic-dependency` | GET, POST | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/classification-reassessment-triggers` | GET, POST | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/data-purge` | GET | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/job-health` | GET | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/late-interest-pdf-reaper` | GET | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/reminders` | GET | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/token-refresh` | GET | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/trial-notifications` | GET | `no-store, private` | Internal cron, Bearer-CRON_SECRET-gated. |
| `/api/cron/inpost-status-poll` | POST | _N/A (POST)_ | Browsers and CDNs ignore `Cache-Control` on POST. |
| `/api/csp-report` | POST | _N/A (POST)_ | Browser-initiated; never cached. |
| `/api/exports/_process` | POST | _N/A (POST)_ | QStash worker; never cached. |
| `/api/google-workspace/_sync` | POST | _N/A (POST)_ | QStash worker; never cached. |
| `/api/ksef/_sync` | POST | _N/A (POST)_ | QStash worker; never cached. |
| `/api/late-interest/_render-claim-pdf` | POST | _N/A (POST)_ | QStash worker; never cached. |
| `/api/ocr/_process` | POST | _N/A (POST)_ | QStash worker; never cached. |
| `/api/outbox/_drain` | POST | _N/A (POST)_ | QStash worker; never cached. |
| `/api/peppol/inbound` | POST | _N/A (POST)_ | Peppol Access Point ingress. |
| `/api/peppol/outbound` | POST | _N/A (POST)_ | Internal dispatch. |
| `/api/peppol/poll` | POST | _N/A (POST)_ | Scheduled poll. |
| `/api/portal/clear-session` | POST | _N/A (POST)_ | Cookie clear. |
| `/api/portal/set-session` | POST | _N/A (POST)_ | Cookie set. |
| `/api/teams/messages` | POST | _N/A (POST)_ | Outbound Teams adapter. |
| `/api/trpc/[trpc]` | GET, POST | _Per-procedure_ | tRPC handler emits its own headers per Better Auth / TanStack Query semantics; never blanket-cached. |
| `/api/trpc/portal/[trpc]` | GET, POST | _Per-procedure_ | Same as `/api/trpc/[trpc]`. |
| `/api/web-vitals` | POST | _N/A (POST)_ | Browser beacon ingress. |
| `/api/webhooks/_process` | POST | _N/A (POST)_ | QStash webhook worker. |
| `/api/webhooks/[provider]` | POST | _N/A (POST)_ | Provider webhook ingress. |
| `/api/webhooks/inpost` | POST | _N/A (POST)_ | InPost webhook ingress. |
| `/api/webhooks/storecove` | POST | _N/A (POST)_ | Storecove webhook ingress. |
| `/api/webhooks/stripe` | POST | _N/A (POST)_ | Stripe webhook ingress. |
| `/api/zatca/_submit` | POST | _N/A (POST)_ | QStash worker. |

POST handlers are intentionally not listed individually for cache-control —
browsers and CDNs ignore the header on non-GET methods, so adding it would
be noise without benefit. They are listed for completeness so a reader can
confirm the full inventory was reviewed.

## How to add a new route

1. Decide the posture (private default vs public exception). Default is
   `no-store, private`.
2. For a GET handler returning JSON, add at the top of the file:
   ```ts
   import { withNoStore } from '@/lib/cache-control';

   export const dynamic = 'force-dynamic';
   ```
   Then wrap every `return NextResponse.json(...)` with `withNoStore(...)`.
3. For a genuinely cacheable GET, set the header directly on the response:
   ```ts
   return new NextResponse(body, {
     headers: { 'Cache-Control': 'public, max-age=600' },
   });
   ```
4. Add a row to the inventory above with a one-line rationale.

## Future work

- A pre-push lint guard (`scripts/lint-cache-control.mjs`) would fail when a
  new GET handler ships without either `withNoStore(...)` or a literal
  `Cache-Control` header. Tracked under Phase B-style lint rollout.
- CDN-side enforcement (Cloudflare in front of Render) should be configured
  to honour `private` and `no-store` and to strip any conflicting cache hints
  on routes under `/api/`. See `docs/INFRA-RECOMMENDATIONS.md`.
