# Phase 99 — Research: API Keys + Scopes + Rate Limiting

**Compiled:** 2026-07-05 · Grounded in the live tree (paths + line numbers verified).

This phase is **low-novelty, high-consequence**: every primitive already exists (HMAC key service, scope
enforcement, dark gate, tier resolution, audit writer that takes ip/UA). The one genuinely new design is
the **API-key → user-identity actor model** (A1). Everything else is wiring + the inherited write surface.

---

## A. Assumptions & Seams (decisions the executor must not re-litigate)

### A1 — Actor model: acting-user binding (THE decision)
`apiKeyTenantProcedure` exposes `ctx.apiKeyId` + `ctx.apiKeyScopes` but **no `ctx.user`**
(`api-key-auth.ts:66-79`). Three create pipelines demand a non-null `User` FK:

| Create | Non-null FK | Schema |
|---|---|---|
| `paymentRun.create` | `PaymentRun.createdByUserId` | `payment.prisma:10` |
| `workflow.create` / `workflow.execute` | `WorkflowRun.startedByUserId` | `workflow.prisma:114` |
| `complianceDocument.create` | `ClassificationDocument.generatedByUserId` (+ system `sha256Hash`/`byteSize`) | `classification.prisma:56` |

Optional-FK writes (need no actor, attribute opportunistically): `Contractor.ownerUserId`
(`contractor.prisma:29`, optional), `Invoice.createdByUserId` (`invoice.prisma:144`, optional),
`WorkflowTaskRun.completedByUserId` (`workflow.prisma:164`, optional). `payment.update` mutates a
`PaymentRunItem` (no user FK). `invoice.void` mutates status (no user FK).

**Design (locked D-01): a mutable `actingUserId` column on `OrganizationApiKey`, surfaced as
`ctx.apiKeyActingUserId`.** It is an **attribution FK, not an authorization source** — the key's power is
`scopes[]`, enforced by `requirePermission`. Contrast the two candidates:

| Option | FK satisfied | Blast radius | Survives creator departure | Auth changes |
|---|---|---|---|---|
| **Acting-user binding (chosen)** | ✅ real member id | 1 column + ctx wiring | ✅ rebindable | none |
| Synthetic per-org service `User` | ✅ synthetic row | new User rows, Better-Auth membership, member-UI pollution | ✅ | yes |
| Reuse `createdByUserId` verbatim | ✅ | 0 | ❌ immutable → breaks on departure | none |

Acting-user binding = the synthetic-user's stability without its blast radius. `actingUserId` **defaults
to `createdByUserId`** at creation and is rebindable in the Developer UI. **Bind-time guard**:
`actingUserId` must be an ACTIVE member of the key's org (query the membership relation; reject
otherwise) — an IDOR/privilege-ghost defense. Fix `core/api-key.ts:68` (`ctx.user?.id ?? ''` → require a
real id; empty string violates the `createdBy` FK today).

### A2 — Scope taxonomy is DONE; do not touch it
`PUBLIC_API_SCOPES` (`scope-utils.ts:41-62`) already enumerates every read + write scope
(`contractor:create/update`, `invoice:create/update`, `payment:create/update/export`,
`workflow:create/update/execute`, `document:create/update`, + all reads). `requirePermission`
(`rbac.ts:19-42`) already enforces `permissionToScopes(permission) ⊆ ctx.apiKeyScopes` in apiKey-mode.
**Phase 99 adds no scope strings** — it attaches `requirePermission({resource:[action]})` to each write
procedure and proves the 403 matrix. The plural `contractors:read|write` labels in INTEG-AUTH-02 are the
**scope-picker display bundles** that expand to the granular on-key strings (reconciled in Phase 98 A1).

### A3 — Rotation grace lives in `resolveByPrefix`
`resolveByPrefix` (`api-key-service.ts:116-138`) filters `revokedAt: null` + not-expired. Rotation adds a
**superseded** state: the OLD key stays resolvable until `graceExpiresAt`, then hard-stops. Extend the
`where` to also admit `{ supersededAt: { not: null }, graceExpiresAt: { gt: now } }`, and reject once the
grace passes. A superseded key MUST NOT be usable to rotate again (single grace chain).

### A4 — Two limiters, two purposes (do not merge)
`rate-limiter.ts` runs **before** auth (Hono middleware, keyed by prefix) → keep as a flat burst/DoS cap.
The per-tier **monthly quota** needs the org+tier, only known **after** auth → new tRPC middleware
`enforceApiTierQuota` inside `apiKeyTenantProcedure`, using `getSubscription(orgId).tier` +
an Upstash fixed-window monthly counter (`api-quota:{orgId}:{YYYY-MM}`). Unlimited (Enterprise) short-
circuits without a counter write.

### A5 — sourceIp/userAgent are a plumbing exercise
`writeAuditLog` already accepts `ipAddress` + `userAgent` (`audit-writer.ts:76-77`, `buildAuditLogRow`
maps them at `:111-112`). The gap is only capture + threading: Hono `c.req.header('x-forwarded-for')`
(left-most, proxy-trusted) / `x-real-ip` + `user-agent` → `createPublicCaller(c)` ctx → the write
procedures' `writeAuditLog({ ipAddress, userAgent })`. Persist a bounded per-key IP log for the UI.

### A6 — Writes are double-dark until Phase 100 (do NOT flip)
`module.public-api` stays off; write Hono routes carry `hide:true`. The flag flip + un-hide is a Phase-100
act after INTEG-SEC-01. `apiKeyTenantProcedure` already carries `publicApiFlagGate` — writes inherit it.

### A7 — Payout initiation stays deferred
`_initiatePayoutForRun` (money movement) is NOT exposed (Phase 98 RESEARCH A7). `paymentRun.transition`
covers FSM state changes; actual payout init needs its own scoped review (Phase 100+).

---

## B. Locked write-verb-per-entity (reconciled with 98-03 scopes + the actor model)

| Entity | Verbs | Scope(s) | Needs actor? | Reuse |
|--------|-------|----------|--------------|-------|
| contractors | create, update | `contractor:create` / `:update` | no (owner optional) | `.strict()` allowlist + contractor-shared validation |
| invoices | create, void | `invoice:create` / `:update` | no (createdBy optional) | invoice-shared, invoice-actions void |
| payments | update | `payment:update` | no (PaymentRunItem) | payment-run-ops markItemPaid + `autoCompleteRunIfTerminal` |
| payment_runs | create, transition, export | `payment:create` / `:update` / `:export` | **create: YES** (`createdByUserId`) | payment-shared (load/validate/seed/allocate/withhold/VALID_TRANSITIONS/export) |
| workflows | create, execute | `workflow:create` / `:execute` | **YES** (`startedByUserId`) | workflow-shared |
| workflow_tasks | transition | `workflow:update` / `:execute` | no (completedBy optional) | workflow-shared validateTransition + unblockDependents |
| compliance_documents | *(create DEFERRED — see D-02)* | `document:*` defined, unused | (create would need actor + server hash) | — |

Money for `paymentRun.create` is **server-derived** from eligible invoices (never client body); the DTO
omits money entirely. classifications + audit_log stay read-only.

---

## C. Patterns

### Pattern 1 — Write procedure (mirrors Phase 98 RESEARCH Pattern 2 + actor)
```
apiKeyTenantProcedure
  .use(requirePermission({ <resource>: ['<action>'] }))     // MANDATORY BFLA guard
  .input(<.strict() write DTO — no organizationId/workerType/money>)
  .mutation(({ ctx, input }) => ctx.db.$transaction(async tx => {
    const row = await tx.X.findFirstOrThrow({ where: { id: input.id, organizationId: ctx.organizationId }});
    <reuse invariant helper>;                                // never reimplement FSM/money
    const result = await tx.X.<create|update>({ data: <explicit allowlist,
        createdByUserId/startedByUserId: ctx.apiKeyActingUserId> });   // FK from actor
    await writeAuditLog({ tx, organizationId: ctx.organizationId,
      actorType: 'API_KEY', actorId: ctx.apiKeyId,
      action: '<x.verb>', resourceType: '<X>', resourceId: result.id,
      ipAddress: ctx.sourceIp, userAgent: ctx.userAgent,
      metadata: { actingUserId: ctx.apiKeyActingUserId } });
    return result;
  }))
```

### Pattern 2 — Rotation with grace
`rotate(id, graceHours?)`: load the key (must be active, not superseded), `generateApiKey()` a NEW row
(same name/scopes/actingUserId), set the OLD row `supersededAt = now`, `supersededByKeyId = new.id`,
`graceExpiresAt = now + graceHours` (default 24h, max e.g. 168h). Return the new plaintext ONCE. Audit
`API_KEY_ROTATE` (old+new prefixes, grace). `resolveByPrefix` admits superseded-within-grace keys.

### Pattern 3 — Per-tier monthly quota (tRPC middleware, post-auth)
```
const TIER_MONTHLY_QUOTA = { STARTER: 1_000, PRO: 10_000, ENTERPRISE: Infinity };
enforceApiTierQuota = t.middleware(async ({ ctx, next }) => {
  const tier = (await getSubscription(ctx.organizationId))?.tier ?? 'STARTER';
  const limit = TIER_MONTHLY_QUOTA[tier];
  if (limit === Infinity) return next();
  const count = await incrMonthlyCounter(ctx.organizationId);   // Upstash INCR + monthly TTL
  if (count > limit) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: E.API_QUOTA_EXCEEDED });
  return next();
});
```
Webhook-sub caps `{ STARTER:1, PRO:5, ENTERPRISE:Infinity }` live in the same tier-limits module,
consumed by Phase 100.

### Pattern 4 — sourceIp/UA capture (Hono → ctx → audit)
`createPublicCaller(c)` builds the tRPC ctx from the Hono `Context`; add `sourceIp` (parse
`x-forwarded-for` left-most, fallback `x-real-ip`) + `userAgent` (`user-agent`) to that ctx and to the
tRPC context type. Write procedures pass them to `writeAuditLog`; the source-IP-log writer appends a
capped per-key `ApiKeyIpEvent`.

---

## D. Pitfalls

1. **actingUserId used for authz** — it is attribution ONLY. Authorization is `scopes[]` via
   `requirePermission`. Never gate a mutation on the acting user's role.
2. **Superseded key resolvable forever** — the grace `where` MUST also hard-stop past `graceExpiresAt`;
   test both sides (usable within grace, 401 after).
3. **Quota counter double-count / wrong reset** — use a calendar-month fixed window (`YYYY-MM` key + TTL
   to month-end); do not reset on rolling 30 days. Enterprise (Infinity) must not write a counter.
4. **Empty-string createdBy FK** (`core/api-key.ts:68`) — must become a real member id; add a not-empty
   guard so the actor invariant holds from key birth.
5. **x-forwarded-for spoofing** — trust only the proxy-appended left-most hop on Render; do not accept a
   client-set full XFF chain as gospel for the leak alarm.
6. **hide:true forgotten on a write route** — re-run `openapi-doc` write-verb-count = 0 after adding
   routes; a leaked write path breaks the double-dark contract.
7. **Reimplementing FSM/money** — import `VALID_TRANSITIONS`/`autoCompleteRunIfTerminal`/
   `validateTransition`; grep the write files for the helper imports in review.

---

## E. Validation Architecture (feeds 99-01 RED net + 99-VALIDATION)

| Requirement | Behavior (secure) | Test | Command |
|---|---|---|---|
| INTEG-AUTH-02 | every write 403s a key WITHOUT its scope; passes WITH it (live BFLA matrix) | security | `pnpm --filter @contractor-ops/api test public-api-write-scope` |
| INTEG-AUTH-01 | HMAC verify: superseded key usable within grace, 401 after; revoked → 401 | security | `pnpm --filter @contractor-ops/api test api-key-rotation` |
| INTEG-AUTH-04 | Nth+1 request in a month for a tier over quota → 429; Enterprise never 429 | security | `pnpm --filter @contractor-ops/api test api-tier-quota` |
| INTEG-AUTH-05 | every external mutation writes an AuditLog row with apiKeyId + sourceIp + userAgent | contract | `pnpm --filter @contractor-ops/api test public-api-mutation-audit` |
| D-01 | FK-creates set the FK to actingUserId; audit records API_KEY + metadata.actingUserId | contract | `pnpm --filter @contractor-ops/api test api-key-actor` |
| INTEG-API-01 | `.strict()` write DTO rejects org/workerType (contractor) + server-derived money (paymentRun) | unit | `pnpm --filter @contractor-ops/public-api test strict-dto` |
| D-03 | write route 404 when flag off AND absent from `buildOpenApiDocument` | integration | `pnpm --filter @contractor-ops/public-api test write-routes-dark` |

**Turn-green targets:** the 15 currently-skipped rows (`public-api-write-scope`, `public-api-flag`
write-half, `strict-dto` write DTOs) + the four NEW RED files above (rotation, quota, mutation-audit,
actor). NEVER run the full unscoped web-vite suite (RAM). Scope every command with `--filter` + a path.

---

## F. Open Questions (executor MUST surface, not silently decide)

1. **compliance_document.create** — recommended READ-ONLY (INTEG-AUTH-02 has `compliance:read` only,
   ClassificationDocument is a system artifact). Confirm with product before building any create; if
   built, server-COMPUTE `sha256Hash`/`byteSize`, `generatedByUserId = actingUserId`. **Default: skip.**
2. **Lower-tier public keys** — the chain gates `requireTier('ENTERPRISE')`, so today only Enterprise
   keys exist and the Starter/Pro monthly quotas are latent. Keep the Enterprise gate (quota table ready)
   unless product opens Starter/Pro to the public API.
3. **Rotation grace max** — default 24h; confirm the upper bound (lean 168h/7d) with product/security.
4. **Source-IP log retention** — child `ApiKeyIpEvent` (queryable, needs a migration + prune) vs capped
   JSON column (simpler, lossy). Lean: child model, last-N per key, pruned; confirm N + retention.
5. **Quota window** — calendar-month fixed vs rolling 30-day. Lean calendar-month (matches "req/mo"
   billing language); confirm with billing.

---

*Phase: 99-theme-c-api-keys-scopes-rate-limiting · Research compiled 2026-07-05*
