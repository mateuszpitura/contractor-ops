---
title: Stripe billing
type: integration
tags: [stripe, billing]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/finance/billing.ts
  - packages/billing/src/webhook/
updated: 2026-06-10
---

# Stripe billing

## Purpose

SaaS subscriptions: 3-tier plans, Stripe Checkout, customer portal, subscription webhooks, AI credit metering with hard-block, free trial notifications.

## Flow

```mermaid
flowchart LR
  checkout[Checkout session] --> stripe[Stripe]
  stripe --> webhook[billing webhook]
  webhook --> tier[org plan + credits]
  tier --> gate[requireTier on routers]
```

## Entry points

| Piece | Path |
|-------|------|
| tRPC | `billing` router |
| Package | `packages/billing/` |
| Webhooks | `packages/billing/src/webhook/` |
| Wiring | `billing-webhook.ts`, `stripe-client.ts` |
| Landing | `apps/landing` → `@contractor-ops/billing` |
| Cron | `trial-notifications.ts` |
| UI | `components/billing/` |

## Invariants

- `requireTier` middleware on premium routers — server-side gate
- Webhook signature verification on inbound Stripe events

## Related

- [[domains/billing-and-feature-gates]]
- [[framework-core]]

## Verify live

```bash
semble search "billingRouter"
semble search "requireTier"
```

## Agent mistakes

- Feature gating only in UI without `requireTier`
- Missing webhook handler for subscription.deleted
