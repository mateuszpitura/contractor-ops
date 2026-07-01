---
title: Domains index
type: domain
tags: [domains, index]
updated: 2026-06-09
---

# Domains — business flows

> Domain context and pipelines. Code symbols → `semble search`. Hub: [[meta/dashboard]] · Tables: [[meta/wiki-tables]] (Domains tab).

## Finance core

| Page | Flow |
|------|------|
| [[invoice-to-payment]] | intake → match → approval → payment |
| [[payments-and-bank-files]] | runs, BACS, export/import, skonto, LPC |
| [[us-payment-rail]] | NACHA/Fedwire, USD settlement, withholding deduction, programmatic ACH + Plaid seams |
| [[billing-and-feature-gates]] | Stripe tiers + feature gating |

## People & engagements

| Page | Flow |
|------|------|
| [[contractors-engagements]] | contractor CRUD, lifecycle, compliance health |
| [[worker-foundation]] | worker-model union (Worker root + workerType), backfill, per-type RBAC |
| [[employee-registry]] | per-market employee onboarding — validators, encrypted national-ID PII, seeded reference lists |
| [[personnel-file]] | jurisdiction-correct akta osobowe / Personalakte — 4 sections + per-section RBAC, retention clock, RODO erasure, doc classifier |
| [[contracts-lifecycle]] | wizard, esign, amendments, health |
| [[portal-external]] | contractor portal (separate router) |

## Platform shell

| Page | Flow |
|------|------|
| [[staff-dashboard]] | KPI home, widgets, approval queue tile |

## Operations

| Page | Flow |
|------|------|
| [[notifications-and-reminders]] | in-app, email, Slack/Teams, reminder rules |
| [[approvals-engine]] | chains, queue, operators |
| [[workflows-and-roles]] | templates, runs, KT roles, calendar |
| [[documents-and-ocr]] | upload, virus scan, OCR |
| [[equipment-logistics]] | assignment, shipments, carriers |
| [[time-and-reconciliation]] | timesheets, Clockify sync |

## Compliance & jurisdiction

| Page | Flow |
|------|------|
| [[compliance-dashboard]] | KPIs, gate, renewals, blocked payments |
| [[classification-ir35]] | IR35, DRV, SDS (flag-gated) |
| [[consent-gdpr-pdpl]] | consent, GDPR erasure/portability |
| [[gulf-saudization]] | UAE free-zone, Saudization |
| [[tax-and-wht]] | VAT, WHT certificates |

## Platform

| Page | Flow |
|------|------|
| [[onboarding-and-import]] | cross-tool import wizard |
| [[settings-and-org-admin]] | org, users, definitions |
| [[search-and-reports]] | global search, reports, docs helper |
| [[idp-deprovisioning]] | Okta/Entra/GitHub deprovision |
| [[public-api-surface]] | Hono REST + apiKey |

## UI-only subsets (see parent domain)

| Folder | Parent page |
|--------|---------------|
| `admin/`, `organization/` | [[settings-and-org-admin]] |
| `peppol/`, `zatca/`, `einvoice/` | [[integrations/_index]] + [[invoice-to-payment]] |
| `saudization/` | [[gulf-saudization]] |
| `wht/` | [[tax-and-wht]] |

## Related

- [[integrations/_index]]
- [[patterns/_index]]
