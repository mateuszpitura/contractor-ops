# 100-03 SUMMARY — replay-resistant HMAC signer + sample verifiers

**Wave:** 1 · **Status:** complete · `webhook-hmac.security.test.ts` GREEN (11/11); api typecheck clean.

## What shipped

- `packages/api/src/services/webhooks/signer.ts`:
  - `signWebhookPayload(secret, rawBody, tMs?) → { header: 't={ms},v1={hex}', t, v1 }` where
    `v1 = HMAC_SHA256(secret, "{t}.{rawBody}")` (mirrors the storecove/inpost hex idiom).
  - `verifyWebhookSignature(secret, rawBody, header, { nowMs?, toleranceMs=300_000 })` — rejects
    `|now - t| > tolerance` BEFORE the `timingSafeEqual` digest compare (replay defence); never `===`.
  - `generateWebhookSecret() → whsec_ + 64 hex` (256-bit, `crypto.randomBytes`). Never logged/returned.
- Four dependency-free sample verifiers under `apps/public-api/docs/webhooks/verifiers/`
  (`verify.ts`, `verify.py`, `verify.go`, `verify.php`) — each parses `t`/`v1`, rejects outside the 5-min
  window before a constant-time compare (`timingSafeEqual` / `hmac.compare_digest` / `hmac.Equal` /
  `hash_equals`), each with a header comment documenting the window.

## Drift guard

`webhook-hmac.security.test.ts` round-trips the shipped **TS verifier** (imported via a non-literal URL so
tsc does not pull the docs file into the api program) against `signWebhookPayload`: it accepts a fresh
signature and rejects a stale timestamp + a tampered body. The Python verifier was additionally cross-checked
against a Node signer vector (fresh→true, stale→false); Go/PHP mirror the identical algorithm.

## Verify

`pnpm --filter @contractor-ops/api test webhook-hmac` → 11/11 GREEN. `pnpm --filter @contractor-ops/api typecheck` → clean.
