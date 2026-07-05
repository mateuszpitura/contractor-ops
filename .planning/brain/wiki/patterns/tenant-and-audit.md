---
title: Tenant scope and audit
type: pattern
tags: [tenant, audit, security]
source_commit: 52012027d6d66885d746d018d5d8db422195e2fb
source_commit: a691aface4b1b0f4ec333f2f69d9705e0c0338fa
verify_with:
  - packages/api/src/middleware/tenant.ts
  - packages/api/src/services/audit-writer.ts
updated: 2026-07-05
---

# Tenant scope and audit

## Purpose

Multi-tenant isolation from session context; append-only audit trail on sensitive mutations.

## Flow

```mermaid
flowchart LR
  session[Better Auth session] --> tenant[tenantProcedure]
  tenant --> handler[mutation handler]
  handler --> audit[writeAuditLog in tx]
```

## Entry points

| Concern | Path |
|---------|------|
| Staff tenant | `packages/api/src/middleware/tenant.ts` |
| Context | `packages/api/src/context.ts` |
| Audit writer | `packages/api/src/services/audit-writer.ts` |
| Audited wrapper | `packages/api/src/lib/audited-mutation.ts` |
| Audit reads | `packages/api/src/routers/core/audit.ts` |

## Invariants

- `organizationId` from `ctx.session.session.activeOrganizationId` — **never** client alone
- Pass `tx` to `writeAuditLog` inside `$transaction`
- **No-tx audit writes are region-pinned, not global**: `writeAuditLog` resolves the org's region from `tenantStore` (or explicit `region` / the global `Organization.dataRegion` directory) and writes via `getRegionalClient` — it throws rather than fall back to the global `DATABASE_URL`, so ME/US rows stay in-region. See [[audit-log]]
- AuditLog append-only — enforced at the DB level (UPDATE always rejected by trigger; DELETE only inside a tx that calls `allowAuditPurge`, used solely by GDPR erasure). See [[audit-log]]
- `pnpm lint:audit-log` on sensitive models

## API-key actor (public REST writes)

`apiKeyTenantProcedure` has no `ctx.user`. Public writes audit as **`actorType:'API_KEY'`, `actorId = ctx.apiKeyId`**, plus the captured `ipAddress` (sourceIp) + `userAgent` and `metadata.actingUserId` — a single path via `routers/public-api/write-shared.ts` → `writeAuditLog`. The `actingUserId` is a mutable, membership-guarded **attribution FK** on the key (fills non-null user FKs on write-creates); it is **never an authorization source** — scopes are. `sourceIp`/`userAgent` are captured at the Hono boundary (`createPublicCaller`, `x-forwarded-for` left-most / `x-real-ip`) and threaded into `ctx`. See [[domains/public-api-surface]].

## Related

- [[audit-log]] — mutation checklist + `pnpm lint:audit-log`
- [[multi-region-db]]
- [[trpc-procedure-stack]]
- [[domains/invoice-to-payment]]
- [[domains/public-api-surface]]

## Verify live

```bash
pnpm lint:audit-log
semble search "writeAuditLog"
```

## Agent mistakes

- Trusting `organizationId` from tRPC input without session check
- Payment mutations without audit — see [[decisions/tech-debt-hotspots]]
