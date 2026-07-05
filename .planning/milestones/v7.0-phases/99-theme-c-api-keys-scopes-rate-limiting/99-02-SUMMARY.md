# 99-02 SUMMARY — actor model + schema (actingUserId + rotation cols + IP log)

**Wave:** 1 · **Status:** done

## What landed

### Schema + reversible migration (apply deferred)
- `OrganizationApiKey` gains a **non-null `actingUserId`** (named relation `ApiKeyActingUser`, distinct
  from the immutable `ApiKeyCreatedBy`), the rotation columns (`supersededAt`, `supersededByKeyId`,
  `graceExpiresAt`), and a child model **`ApiKeyIpEvent`** (bounded per-key source-IP log).
- Migration `20260705000000_phase99_api_key_actor_rotation_ip_log` is reversible: add `actingUserId`
  NULLABLE → backfill `= createdByUserId` → `SET NOT NULL`; rotation cols nullable; `ApiKeyIpEvent` table
  + indexes + FKs. **NOT applied** to any live DB (deploy-time human step — EXTERNAL-ENABLEMENT row #11).
  Prisma client regenerated so code compiles.

### Actor is attribution-only, membership-guarded
- `apiKeyRouter.create` now sets `actingUserId` (defaults to the creator) and `apiKeyRouter.update` can
  rebind it — both run `assertActiveMember` (a `Member` with `disabledAt: null` in the key's org), so a
  cross-org / removed / disabled user is rejected with `INVALID_ACTING_USER` (BAD_REQUEST). The
  empty-string `createdByUserId` FK bug (`ctx.user?.id ?? ''`) is removed — creation requires a real
  member id. `actingUserId` NEVER authorizes; scopes remain the sole authority.
- `list` select exposes `actingUserId` / `actingUser` / rotation columns for the Developer page.

### ctx + audit-field threading
- Public tRPC ctx gains `apiKeyActingUserId` (from the resolved key), `sourceIp`, and `userAgent`
  (context type extended). `createPublicCaller` captures `sourceIp` (x-forwarded-for left-most hop /
  x-real-ip, proxy-trusted) + `userAgent` at the Hono boundary.
- `apiKeyAuthMiddleware` enriches `apiKeyActingUserId` and appends a bounded, debounced, pruned
  `ApiKeyIpEvent` (only when a source IP was captured; fire-and-forget via `appendApiKeyIpEvent`).

## Tests
- `api-key-actor.security.test.ts` — the binding rows (default to creator, cross-org bind rejected on
  create + update) are **GREEN**; the FK-on-create rows stay **RED** until 99-04.
- Fixed a pre-existing break in `api-key-auth.test.ts` (surfaced once the actor middleware stopped
  masking it): the suite never mocked `module.public-api` (default OFF, wired into the chain by phase 98),
  so its flag-gated tests 404'd. Added an `evaluate → enabled` mock + the new `appendApiKeyIpEvent` export.
- No regression in the public read suites; `public-api-flag` write-half stays RED (→ 99-04).

## Verification
- `pnpm --filter @contractor-ops/db build` + `prisma validate` clean; client regenerated (no drift).
- `pnpm typecheck --filter @contractor-ops/db --filter @contractor-ops/api --filter @contractor-ops/public-api` clean.

## For downstream
- `ctx.apiKeyActingUserId` is **attribution-only** — 99-04 sets FK-requiring creates
  (`PaymentRun.createdByUserId`, `WorkflowRun.startedByUserId`) to it; never read it to authorize.
- Rotation columns + `ApiKeyIpEvent` are in place for 99-05 (rotate) and 99-07 (Developer page ipLog).
