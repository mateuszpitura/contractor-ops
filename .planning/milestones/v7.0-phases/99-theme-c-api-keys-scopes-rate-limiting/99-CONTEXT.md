# Phase 99: Theme C — API Keys + Scopes + Rate Limiting - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 99 makes the public REST API **least-privilege and production-safe** on top of the Phase 98
foundation gate. It delivers five locked requirements (INTEG-AUTH-01..05):

- **Key lifecycle** — org creates / **rotates** / revokes named `co_live_*` keys, HMAC-SHA256-hashed,
  every lifecycle event audited (create/revoke already shipped in Phase 98; **rotation with a grace
  period is net-new**).
- **Per-endpoint scope enforcement (BFLA fix)** — every WRITE endpoint carries a mandatory
  `requirePermission({resource:[action]})`; a `read` key cannot reach a write endpoint; least-privilege
  default. The mechanism (`requirePermission` apiKey-mode + `PUBLIC_API_SCOPES`) shipped in Phase 98;
  Phase 99 lands the **actual write endpoints that carry the scopes** and the **live 403 matrix** that
  proves the gap is closed.
- **Settings → Developer page** — key CRUD (exists), **last-used-at, source-IP log, scope
  visualization, and a rotation flow with grace period** (net-new UI).
- **Per-tier rate limits** — Starter 1k req/mo (+1 webhook sub), Pro 10k/mo (+5), Enterprise unlimited;
  extends the existing flat 100/min Upstash burst limiter with a **per-tier monthly quota**.
- **Mutation audit** — every external mutation audit-logged with `apiKeyId` + `sourceIp` + `userAgent`.

**Phase 99 also OWNS the write half Phase 98 deferred** (98-09/98-10 were NOT executed — see
[`98-09-HANDOFF.md`](../98-theme-c-public-rest-api-surface-foundation-gate/98-09-HANDOFF.md)): the
public WRITE tRPC procedures + their hidden Hono routes, blocked in 98 on the **API-key → user-identity
actor model** decision below. The whole write surface stays **double-dark** (per-org `module.public-api`
off + `hide:true` in the spec/SDK) throughout Phase 99. **The write flag flip is sequenced into Phase
100**, after the INTEG-SEC-01 OWASP review gate — Phase 99 builds, scope-enforces, and rate-limits the
writes; it does NOT make them externally reachable.

**Depends on:** Phase 98 (reads live; scope taxonomy, dark gate, HMAC key service, Wave-0 test
scaffolding). **NOT this phase:** outbound webhooks + SSRF + the write flag flip (Phase 100);
marketplace listings + full DX portal + SDK 1.0 promotion (Phase 101).
</domain>

<decisions>
## Implementation Decisions

### D-01 (locked) — API-key → user-identity actor model = **acting-user binding on the key**
The write blocker Phase 98 refused to hack: three create pipelines write a **non-null `User` FK** the
API-key context cannot supply (`ctx.user` does not exist on `apiKeyTenantProcedure`, only `ctx.apiKeyId`):
`PaymentRun.createdByUserId` (`payment.prisma:10`), `WorkflowRun.startedByUserId` (`workflow.prisma:114`),
`ClassificationDocument.generatedByUserId` (`classification.prisma`). A real FK cannot be faked.

**Decision:** bind each `OrganizationApiKey` to a mutable **`actingUserId`** (a real, active org-member
`User`), surfaced as `ctx.apiKeyActingUserId` by `apiKeyAuthMiddleware`. FK-requiring creates set the FK
to `ctx.apiKeyActingUserId`. **The key's authority remains its `scopes[]` (BFLA-enforced) — the acting
user is an ATTRIBUTION FK only, NEVER a permission source** (an executor MUST NOT read actingUserId to
authorize anything). Audit still records `actorType:'API_KEY', actorId: ctx.apiKeyId` for
non-repudiation, plus `metadata.actingUserId` for attribution.

- `actingUserId` **defaults to `createdByUserId`** at key creation; it is **rebindable** (Developer UI)
  to any other active org member, so a key survives the departure of the human who created it.
- **Bind-time guard:** `actingUserId` MUST reference a `User` that is an **ACTIVE member of the key's
  org** — reject cross-org / removed / inactive users (IDOR defense).
- Hardens the latent bug in `core/api-key.ts:68` (`createdByUserId: ctx.user?.id ?? ''` — an empty
  string violates the FK); creation now requires a real member id.

**Rejected alternative — synthetic per-org "API service `User`":** a real `User` row flagged as a
service account, auto-provisioned per org. Rejected for blast radius: needs Better Auth membership
wiring, pollutes member/permission UIs, and adds synthetic identities to a table other product surfaces
enumerate. The acting-user binding satisfies the FK + audit with a one-column migration and no auth
changes. (Revisit only if orgs demand key identities fully decoupled from any human.)

### D-02 (locked) — write entities: 6 fully planned + compliance_document.create flagged
The **on-existing-row / optional-FK writes need NO actor** (only the audit-actor swap + sourceIp/UA):
`contractor.create` (`Contractor.ownerUserId` optional), `contractor.update`, `invoice.create`
(`Invoice.createdByUserId` optional), `invoice.void`, `payment.update` (PaymentRunItem),
`paymentRun.transition`, `workflowTask.transition` (`completedByUserId` optional). The **actor is the
enabler specifically for** `paymentRun.create`, `payment.create` (seeded by run creation), and
`workflow.create` / `workflow.execute` (non-null `startedByUserId`).

`compliance_document.create` is a **decision flag**: `ClassificationDocument` is a system artifact
(append-only guard in `packages/db/src/tenant.ts`; `sha256Hash`/`byteSize`/`rendererVersion`/
`ruleSetVersion` are engine-generated), and the **requirement scope (INTEG-AUTH-02) lists
`compliance:read` only** — no compliance write scope. **Recommended: compliance_documents stay
READ-ONLY externally in Phase 99** (no create endpoint), matching the read-only classification posture
and the GTM classification-liability stance. The task framing names it as a 7th write entity; if product
confirms external upload is wanted, 99-04 Task 2 documents the safe variant (server-COMPUTED
`sha256Hash`/`byteSize` from uploaded bytes, never client-supplied; `generatedByUserId =
actingUserId`). See Open Questions. **classifications + audit_log remain read-only** (Phase 98).

### D-03 (locked) — writes stay DOUBLE-DARK; the flag flip is Phase 100
Every write procedure is built under the shared `apiKeyTenantProcedure` (per-org `module.public-api`
gate ⇒ 404 when off) with a mandatory scope, and every write Hono route carries `hide:true` (absent from
the derived 3.1 spec / Scalar portal / Speakeasy SDK). **Phase 99 does NOT flip `module.public-api` on
and does NOT un-hide the writes.** The flip + un-hide + SDK-1.0 promotion happen in **Phase 100** after
the INTEG-SEC-01 OWASP-Top-10 review gate. No unscoped mutating endpoint ever exists.

### D-04 (locked) — per-tier limits = post-auth monthly quota + kept burst limiter
The existing limiter (`apps/public-api/src/lib/rate-limiter.ts`) is a flat **100/min burst** keyed by
key-prefix, running **before** auth (org/tier unknown). Keep it as coarse DoS protection. Add a
**per-tier monthly request quota** as a tRPC middleware (`enforceApiTierQuota`) **inside**
`apiKeyTenantProcedure` (post-auth: org + tier known via the Redis-cached `getSubscription`), backed by
an Upstash fixed-window monthly counter keyed by `org + YYYY-MM`. Limits: **Starter 1 000 / Pro 10 000 /
Enterprise unlimited** requests per calendar month; 429 + `Retry-After`/`X-RateLimit-*` on exceed. The
**webhook-subscription caps** (1 / 5 / unlimited) are defined as tier config here but **enforced in
Phase 100** (subscriptions do not exist until then). NB: today all public keys require ENTERPRISE tier
(`requireTier('ENTERPRISE')` in the chain) — Phase 99 introduces the tier-limits table so the quota is
correct once/if Starter/Pro keys are enabled; keep the ENTERPRISE gate unless product opens lower tiers.

### D-05 (locked) — source-IP + userAgent capture end-to-end
`writeAuditLog` already accepts `ipAddress` + `userAgent` (`audit-writer.ts:76-77`). Capture the client
IP (`x-forwarded-for` left-most / `x-real-ip`, trusting the Render proxy) + `user-agent` at the Hono
boundary, thread them through `createPublicCaller` into `ctx`, and pass them into every public write's
`writeAuditLog`. Persist a bounded **per-key source-IP log** (new `ApiKeyIpEvent` child model, or a
capped JSON column) for the Developer page's "source-IP log" + the Phase-100 ">3 IPs in 24h" leak alarm.

### D-06 (locked) — reuse, do not reimplement
Reuse the Phase-98 primitives verbatim: `PUBLIC_API_SCOPES` + `permissionToScopes` +
`requirePermission` (apiKey-mode), `generateApiKey`/`hashKey`/`resolveApiKey`, `assertPublicApiEnabled`
dark gate, the invariant helpers (`payment-shared`, `workflow-shared`, `invoice-shared`,
`doc-link-service`), and `writeAuditLog({actorType:'API_KEY'})`. No business rule is reimplemented; the
only session-coupling replaced is the actor (session `USER` → `API_KEY` + `actingUserId` FK).

### Claude's Discretion
- `actingUserId` column vs reusing `createdByUserId` directly (lean: a dedicated mutable column so
  provenance `createdByUserId` stays immutable while the operational actor is rebindable).
- Source-IP log shape (child `ApiKeyIpEvent` model vs capped JSON) + retention window.
- Monthly-quota counter key grammar + reset semantics (calendar-month fixed window).
- Rotation grace-window default (lean: 24h, org-configurable within a bounded max).
- Developer-page IA (extend the existing `ApiKeysTab` vs a dedicated Developer route).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — INTEG-AUTH-01..05 (lines 169-173) verbatim; INTEG-API-01 (161) write
  half; line 24 (HMAC-SHA256 supersedes bcrypt).
- `.planning/ROADMAP.md` (Phase 99 entry, lines 558-572) — goal + 4 success criteria + the note that
  `OrganizationApiKey.scopes` + `permissionToScopes` already bridge to RBAC and per-tier buckets extend
  the existing Redis limiter.
- `.../98-theme-c-public-rest-api-surface-foundation-gate/98-09-HANDOFF.md` — the write-half actor
  blocker + the cleanly-implementable first slice vs the FK-requiring creates.
- `.../98-.../98-09-PLAN.md`, `98-10-PLAN.md` — the deferred write-procedure + hidden-route plans this
  phase absorbs (reuse their write-verb-per-entity table + threat models).

### Key management + auth (reuse; Phase 98)
- `packages/api/src/services/api-key-service.ts` — `generateApiKey`/`hashKey` (HMAC-SHA256, `co_live_`,
  256-bit)/`verifyKey` (timingSafeEqual)/`resolveApiKey`+`resolveByPrefix`/`touchLastUsed`. **Rotation
  grace must extend `resolveByPrefix`** (a superseded key stays valid until `graceExpiresAt`).
- `packages/api/src/routers/core/api-key.ts` — `apiKeyRouter` create/list/update/revoke +
  `apiKeyAdminProcedure` (`organization:update` + ENTERPRISE tier) + lifecycle `writeAuditLog`. **Add
  `rotate` + `actingUserId` on create/update + source-IP-log query here.**
- `packages/api/src/middleware/api-key-auth.ts` — `apiKeyAuthMiddleware` (enriches `apiKeyId`,
  `apiKeyScopes`) + `publicApiFlagGate` + `apiKeyTenantProcedure` chain. **Enrich `apiKeyActingUserId`,
  `sourceIp`, `userAgent`; insert `enforceApiTierQuota`.**
- `packages/api/src/middleware/rbac.ts` — `requirePermission` (apiKey-mode `permissionToScopes ⊆ scopes`)
  — the mandatory BFLA guard on every write.
- `packages/api/src/lib/scope-utils.ts` — `PUBLIC_API_SCOPES` (already has all read + write scopes) +
  `permissionToScopes`. No taxonomy change needed; verify the write-DTO gates match the strings.
- `packages/db/prisma/schema/api-key.prisma` — `OrganizationApiKey` (no rotation / actingUserId /
  source-IP fields yet). **Migration target.**
- `packages/api/src/middleware/tier.ts` + `services/billing-service.ts` `getSubscription` (Redis-cached
  `Subscription.tier` ∈ STARTER|PRO|ENTERPRISE) — the per-tier quota basis.
- `apps/public-api/src/lib/rate-limiter.ts` — flat 100/min burst limiter (Upstash sliding-window +
  in-memory fallback, fail-closed in prod). **Compose with, do not replace.**

### Write reuse (invariant helpers; Phase 98 CONTEXT §"Domain reuse for writes")
- `finance/payment-shared.ts` (`VALID_TRANSITIONS`, `autoCompleteRunIfTerminal`, `loadEligibleInvoices`,
  `validateInvoicesForRun`, `seedRunItems`, `allocateRunNumber`, `applyWithholdingToRun`,
  `_generateExportFileForFormat`) + `payment-run-ops.ts` (inline FSM to mirror) + services
  `payment-export.ts`/`payment-settlement.ts`. **Do NOT expose `_initiatePayoutForRun`** (payout init —
  Phase 98 RESEARCH A7; needs its own review).
- `workflow/workflow-shared.ts` (`validateTransition`, `unblockDependentsAndRecomputeRun`) +
  `workflow-execution-tasks.ts` (inline mutation).
- `finance/invoice-shared.ts` (`validateInvoiceAmounts`, `recomputeDuplicateHash`, …) +
  `invoice-actions.ts:19` (void inline).
- `services/audit-writer.ts` — `writeAuditLog` (accepts `ipAddress`+`userAgent`; API_KEY actor;
  lint-enforced by `scripts/lint-audit-log.mjs`).

### Public write surface (from Phase 98, currently absent — build here)
- `packages/api/src/routers/public-api/*.ts` — read sub-routers exist (98-08); **add write procedures**.
- `apps/public-api/src/routes/*.ts` — read `createRoute`s exist (98-07/08); **add hidden write routes**.
- `packages/validators/src/public-api/index.ts` — read DTOs exist; **add `.strict()` write DTOs**.

### Wave-0 tests already scaffolded (turn GREEN / repoint)
- `packages/api/src/__tests__/security/public-api-write-scope.security.test.ts` — `WRITE_SCOPE_MATRIX`
  (14 rows) + `describe.skip('HOLD-until-98-09')` live-403 block. **Split DELIVERED vs DEFERRED, un-skip
  delivered rows.**
- `packages/api/src/__tests__/security/public-api-flag.security.test.ts` — write-half `describe.skip`.
- `apps/public-api/src/__tests__/strict-dto.test.ts` — repoint money-rejection to `paymentRun` (money
  server-derived) + org/workerType to `contractor` (see handoff).
- `apps/public-api/src/__tests__/write-routes-dark.test.ts` (98-10) — double-dark contract.
- Current suite: `pnpm --filter @contractor-ops/api test public-api` = **80 passed / 15 skipped**
  (the skipped rows are this phase's turn-green target).

### Developer page (extend)
- `apps/web-vite/src/components/settings/api-keys-tab.tsx` + `api-keys/data-table.tsx` +
  `create-api-key-dialog.tsx` / `edit-api-key-dialog.tsx` / `revoke-api-key-dialog.tsx` +
  `hooks/use-api-keys-tab.ts` — CRUD exists (Enterprise-gated). **Add last-used-at, source-IP log, scope
  visualization, rotation-with-grace dialog, per-tier usage/quota display.** Container+hooks +
  loading/empty/error per `apps/web-vite/ARCHITECTURE.md`; i18next (en/de/pl/ar-RTL).

### Documentation-follows-code (update in the SAME change set — 99-08)
- `.planning/brain/wiki/domains/public-api.md`, `wiki/patterns/{rate-limit, tenant-and-audit,
  feature-flags}.md`, `wiki/structure/{api-routers-catalog, key-services}.md`, `wiki/log.md` + `hot.md`;
  `.planning/MEMORY.md` (actor-model + rotation-grace + per-tier-quota + sourceIp/UA-audit invariants);
  `pnpm check:wiki-brain`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **HMAC-SHA256 key service** (`api-key-service.ts`) — extend `resolveByPrefix` for rotation grace.
- **Scope enforcement** (`requirePermission` apiKey-mode) + **full `PUBLIC_API_SCOPES`** — no taxonomy
  work; wire the strings onto writes.
- **Per-org dark gate** (`assertPublicApiEnabled`) — writes inherit it (double-dark).
- **`getSubscription` tier resolution** (Redis-cached) — the per-tier quota basis.
- **`writeAuditLog` with `ipAddress`+`userAgent`+`API_KEY` actor** — mutation audit is a wiring job.
- **Invariant helpers** (`payment-shared`, `workflow-shared`, `invoice-shared`) — reuse under writes.
- **`ApiKeysTab` + dialogs + hook** — extend, don't rebuild.

### Established Patterns
- Tenant from the key, never client input; `.strict()` DTOs block mass-assignment.
- Every external mutation audits as `API_KEY` (lint-enforced).
- Ship-dark behind a flag; writes double-dark (flag + `hide:true`) until Phase 100 flips.
- web-vite container+hooks; the hook is the only tRPC boundary; loading/empty/error mandatory.

### Integration Points
- `OrganizationApiKey` gains `actingUserId` + rotation fields + a source-IP log (one migration).
- `apiKeyTenantProcedure` gains actingUser/sourceIp/UA ctx + the tier-quota gate.
- `publicApiRouter` grows the write procedures; `apps/public-api` grows hidden write routes.
</code_context>

<specifics>
## Specific Ideas
- **The actor model is the load-bearing decision** — one mutable `actingUserId` FK unblocks the
  money-affecting creates without a synthetic-user refactor; scopes stay the authority.
- **BFLA is proven by a LIVE 403 matrix**, not prose — the 15 HOLD tests turn green against real
  procedures.
- **Two limiters, two jobs** — pre-auth burst (DoS) + post-auth monthly tier quota (billing).
- **Writes never go live in 99** — the flip is a Phase-100 act gated on the OWASP review.
</specifics>

<deferred>
## Deferred Ideas
- **Write flag flip + un-hide + SDK 1.0 promotion** → Phase 100 (after INTEG-SEC-01 OWASP gate).
- **Webhook-subscription count enforcement** (the tier caps are defined here) → Phase 100.
- **`_initiatePayoutForRun` (payout initiation)** → deferred; needs its own actor/scoped review.
- **compliance_document.create** → recommended READ-ONLY; revisit if product wants external upload.
- **Synthetic per-org service `User`** → rejected (auth blast radius); revisit only on explicit demand.
- **">3 source IPs in 24h" leak alarm** → the source-IP log lands here; the alarm is Phase 100.

None expand the phase scope — discussion stayed within INTEG-AUTH-01..05 + the inherited INTEG-API-01
write half.

---

*Phase: 99-theme-c-api-keys-scopes-rate-limiting*
*Context gathered: 2026-07-05*
