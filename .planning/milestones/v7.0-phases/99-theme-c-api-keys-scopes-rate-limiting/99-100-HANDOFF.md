# 99 → 100 HANDOFF — the write flag flip + webhooks

Phase 99 built, scope-enforced, rate-limited, and audited the public WRITE surface, but left it
**double-dark**. Phase 100 owns the acts that make it reachable — **gated on the INTEG-SEC-01
OWASP-Top-10 review**.

## The flag flip + un-hide (Phase-100 act, AFTER the OWASP gate)

- Flip `module.public-api` **per org** (default OFF today) — the runtime dark gate in
  `apiKeyTenantProcedure` (`publicApiFlagGate`) 404s the whole surface until then.
- Remove `hide: true` from the write `createRoute`s in `apps/public-api/src/routes/*` so the writes
  enter the derived OpenAPI 3.1 document → Scalar portal → Speakeasy SDK.
- Promote the SDK to include writes (SDK 1.0). Re-run the `openapi-doc` writes-count check to *confirm the
  writes are now present* (it currently asserts ZERO write ops — invert or scope it for post-flip).
- **Do NOT flip or un-hide before INTEG-SEC-01 passes.** No unscoped mutating endpoint ever exists;
  keep the mandatory `requirePermission` on every write.

## What Phase 100 consumes from Phase 99

- **Webhook-subscription tier caps** — `TIER_WEBHOOK_SUBSCRIPTION_CAP` in
  `packages/api/src/lib/api-tier-limits.ts` (Starter 1 / Pro 5 / Enterprise ∞) is DEFINED but not yet
  enforced; Phase 100's webhook-subscription feature enforces it (subscriptions do not exist yet).
- **Source-IP log** — the `ApiKeyIpEvent` child model (append-on-auth, bounded/pruned) feeds the
  Phase-100 **">3 source IPs in 24h" leak alarm**; the model + the Developer-page `ipLog` view already
  exist.
- **The actor model** — `ctx.apiKeyActingUserId` is the attribution FK for any future FK-requiring public
  create; keep it attribution-only (scopes authorize).

## Still deferred after Phase 100 sequencing

- **`_initiatePayoutForRun`** (payout initiation / money movement) is NOT exposed — it needs its own
  scoped actor review (RESEARCH A7); Phase 100+.
- **`compliance_document.create`** stays READ-ONLY externally unless product explicitly asks for external
  upload (D-02) — if built, server-COMPUTE `sha256Hash`/`byteSize`, `generatedByUserId = actingUserId`.
- **The `actingUserId`/rotation/`ApiKeyIpEvent` migration** (`20260705000000_phase99_api_key_actor_rotation_ip_log`)
  is generated + committed but NOT applied — apply to each regional `DATABASE_URL_*` at deploy
  (EXTERNAL-ENABLEMENT #11).

## Verify before the flip

```bash
pnpm --filter @contractor-ops/api test public-api-write-scope   # BFLA 403 matrix GREEN
pnpm --filter @contractor-ops/public-api test write-routes-dark openapi-doc   # double-dark holds
```
