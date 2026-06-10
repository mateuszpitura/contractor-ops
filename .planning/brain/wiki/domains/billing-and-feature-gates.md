---
title: Billing and feature gates
type: domain
tags: [billing, stripe, tiers]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/finance/billing.ts
  - packages/billing/
updated: 2026-06-09
---

# Billing and feature gates

## Purpose

Stripe 3-tier subscriptions (Starter/Pro/Enterprise), checkout, customer portal, AI credit metering, `requireTier` middleware on premium routers.

## Entry points

| Piece | Path |
|-------|------|
| tRPC | `billing` router |
| Package | `packages/billing/src/webhook/` |
| Webhook wiring | `packages/api/src/services/billing-webhook.ts` |
| UI | `apps/web-vite/src/components/billing/` |

## Related

- [[integrations/stripe-billing]]
- [[patterns/feature-flags]]

## Verify live

```bash
semble search "requireTier"
semble search "billingRouter"
```

## Agent mistakes

- Gating features only in UI without server tier check
