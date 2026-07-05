# 100-02 SUMMARY — SSRF guard (subscribe + dispatch)

**Wave:** 1 · **Status:** complete · `webhook-ssrf.security.test.ts` GREEN (19/19); api typecheck clean.

## What shipped

- `packages/api/src/services/webhooks/errors.ts` — `WebhookUrlError` with a typed `reason`
  (`invalid-url | https-required | blocked-range | resolves-private | unresolvable`).
- `packages/api/src/services/webhooks/ssrf-guard.ts`:
  - `isBlockedIp(ip)` / `isBlockedHostLiteral(host)` — pure IPv4 + IPv6 classifiers covering RFC 1918,
    loopback, link-local (incl. `169.254.169.254`), ULA `fc00::/7`, unspecified, CGNAT `100.64/10`,
    multicast/reserved, and IPv4-mapped/compat/NAT64 embeddings (so `::ffff:169.254.169.254` is caught).
  - `assertWebhookUrlSafe(url, { httpAllowed })` — async subscribe/dispatch gate: HTTPS-only unless the
    per-org override, literal-IP short-circuit (no DNS), else resolve EVERY address and reject any blocked;
    fails CLOSED on DNS error.
  - `webhookAgentLookup(hostname, options, cb)` — connect-time re-resolve + classify (DNS-rebind / TOCTOU
    defence), bound into `webhookHttpsAgent` / `webhookHttpAgent` via a `createConnection` override.

## Dependency decision (Open Question F2)

**No `request-filtering-agent` added.** Used the hand-rolled `lookup`-hook fallback the plan sanctions — it
IS the library's core mechanism, avoids a supply-chain add under the 7-day age rule, and is fully unit-tested
(`webhookAgentLookup` called directly with mocked `node:dns/promises`). `package.json` unchanged; `pnpm audit`
not required (no dep change). Redirects are never followed because the deliver drain (100-06) uses
`https.request`, which does not auto-follow — a `302 → http://169.254.169.254/` returns as a non-2xx.

## Verify

`pnpm --filter @contractor-ops/api test webhook-ssrf` → 19/19 GREEN.
`pnpm --filter @contractor-ops/api typecheck` → clean.
