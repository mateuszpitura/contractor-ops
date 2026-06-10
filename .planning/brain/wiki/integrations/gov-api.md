---
title: Government APIs and registries
type: integration
tags: [gov-api, vies, hmrc, gus, vat]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/gov-api/
  - packages/api/src/gov-api-clients.ts
  - packages/integrations/src/adapters/bir1-company-registry-adapter.ts
updated: 2026-06-10
---

# Government APIs & company registries

## Purpose

VAT validation (VIES, HMRC), USPS address cache, Polish GUS / company registry lookups for contractor onboarding — via `@contractor-ops/gov-api` and integration adapters.

## Flow

```mermaid
flowchart LR
  contractor[contractor CRUD] --> tax[tax-id-validation]
  tax --> govClients[gov-api-clients]
  govClients --> vies[ViesClient]
  govClients --> hmrc[HmrcVatClient]
  lookup[GUS lookup] --> bir1[bir1 adapter]
```

## Entry points

| Piece | Path |
|-------|------|
| Package | `packages/gov-api/` |
| Client factory | `packages/api/src/gov-api-clients.ts` |
| Tax validation | `packages/api/src/services/tax-id-validation.service.ts` |
| Contractor shared | `routers/core/contractor-shared.ts` (USPS, VIES, HMRC) |
| BIR1 / GUS | `packages/integrations/src/adapters/bir1-company-registry-adapter.ts` |
| Dataport | `dataport-company-registry-adapter.ts` |
| tRPC tax | `tax` router |
| Secrets gap | [[infisical-secrets]] — HMRC creds stub |

## Invariants

- Rate limiting via `GovApiRateLimiter` — do not bypass
- External responses: Zod/safeParse at boundary

## Related

- [[domains/contractors-engagements]]
- [[domains/tax-and-wht]]
- [[infisical-secrets]]

## Verify live

```bash
semble search "gov-api-clients"
semble search "bir1-company-registry"
```

## Agent mistakes

- Assuming production gov credentials without Infisical wiring
- Unsafe `as` on registry API JSON responses
