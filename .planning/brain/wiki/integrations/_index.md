---
title: Integrations index
type: integration
tags: [integrations, index]
updated: 2026-06-09
---

# Integrations — external systems

> Canonical detail: `.planning/codebase/INTEGRATIONS.md`. Per-provider paths verified there. Hub: [[meta/dashboard]] · Tables: [[meta/wiki-tables]].

## Framework

| Page | Purpose |
|------|---------|
| [[framework-core]] | registry, adapters, OAuth, credentials, webhooks |

## E-invoicing & government

| Page | Provider |
|------|----------|
| [[ksef]] | Poland KSeF |
| [[peppol]] | Peppol / Storecove ASP |
| [[zatca]] | Saudi ZATCA Fatoorah |
| [[einvoice-profiles]] | XRechnung, ZUGFeRD, country profiles |

## Productivity & IdP

| Page | Provider |
|------|----------|
| [[google-workspace]] | Directory import + calendar |
| [[jira]] | Atlassian Cloud |
| [[linear]] | Linear |
| [[teams]] | Microsoft Teams (Adaptive Cards) |
| [[slack]] | Slack OAuth + user mapping + dispatch |
| [[entra-okta-github]] | IdP deprovisioning |
| [[docusign-esign]] | DocuSign + Autenti |

## Infrastructure & billing

| Page | Provider |
|------|----------|
| [[stripe-billing]] | Stripe subscriptions |
| [[qstash-cron]] | QStash + cron-worker |
| [[neon-r2]] | Neon DB + Cloudflare R2 |
| [[infisical-secrets]] | Secret store (stub gap — see tech-debt) |
| [[unleash-flags]] | Feature flags OSS |

## US payment rail (mock-behind-seam, flag-dark)

| Page | Provider |
|------|----------|
| [[modern-treasury]] | Programmatic ACH origination (opt-in, `payments.ach-payouts`) |
| [[plaid]] | Plaid Identity bank verification (advisory fail-open) |

## Observability, logistics & registries

| Page | Provider |
|------|----------|
| [[sentry]] | Sentry / GlitchTip |
| [[couriers]] | InPost / DPD / UPS |
| [[gov-api]] | VIES, HMRC, GUS / company registry |

## Related

- [[domains/invoice-to-payment]]
- [[patterns/feature-flags]]
