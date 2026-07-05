# 99-05 SUMMARY — key rotation with a grace window

**Wave:** 3 · **Status:** done

## What landed
- **Grace-aware `resolveByPrefix`** (`api-key-service.ts`): the `where` now also admits
  `{ supersededAt: null } OR { graceExpiresAt: { gt: now } }`, so a superseded key resolves ONLY within
  its grace window and hard-stops after `graceExpiresAt`. Revocation still wins (`revokedAt: null`
  preserved). No new crypto — the HMAC verify loop is unchanged.
- **`apiKeyRouter.rotate(id, graceHours?)`** (`core/api-key.ts`): issues a fresh `co_live_*` key
  (`generateApiKey()`) inheriting the old key's name/scopes/actingUserId/expiresAt, marks the old key
  `supersededAt = now`, `supersededByKeyId = new.id`, `graceExpiresAt = now + clamp(graceHours ?? 24, max
  168)h`, and returns the new plaintext EXACTLY ONCE. Rotating a revoked or already-superseded key is
  rejected (BAD_REQUEST — single grace chain). Audited as `API_KEY_ROTATE` (old + new prefix + grace).
- `API_KEY_CANNOT_ROTATE_SUPERSEDED` added to `errors.ts`.

## Grace window
Default **24h**, max **168h** (7d) — surfaced to 99-07's rotation dialog.

## Tests (GREEN)
- `api-key-rotation.security.test.ts` (4): the grace-aware `resolveByPrefix` query references
  `supersededAt`/`graceExpiresAt` while keeping `revokedAt: null`; `rotate` issues a new key + supersedes
  the old with a grace window; rotating a revoked/superseded key is rejected.
- No regression: `api-key.test` + `api-key-auth` (15) pass; audit-log lint OK.

## Verification
- `pnpm typecheck --filter @contractor-ops/api` clean.
