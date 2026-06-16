---
title: Key API services catalog
type: structure
tags: [structure, services, api]
source_commit: 336516f5da666c16acff84e412a3d338db8bbbb8
verify_with:
  - packages/api/src/services/
  - packages/api/src/services/onboarding-import-service.ts
  - .planning/intel/file-roles.json
updated: 2026-06-17
---

# Key API services catalog

> High-signal services only. Full list → `semble search` under `packages/api/src/services/`.

## Purpose

Shared business logic lives in `packages/api/src/services/` — routers should delegate here, not duplicate rules.

## Flow

```mermaid
flowchart TB
  routers[tRPC routers] --> services[services/]
  services --> db[tenant Prisma]
  services --> integrations[packages/integrations]
```

## Entry points

| Service | Path | Domain |
|---------|------|--------|
| Invoice intake | `services/invoice-intake/` | [[domains/invoice-to-payment]] |
| Invoice matching | `services/invoice-matching.ts` | [[domains/invoice-to-payment]] |
| Approval engine | `services/approval-engine.ts` | [[domains/approvals-engine]] |
| Compliance payment gate | `services/compliance-payment-gate.ts` | [[domains/compliance-dashboard]] |
| Audit writer | `services/audit-writer.ts` | [[patterns/tenant-and-audit]] |
| Portal session | `services/portal-session.ts` | [[patterns/portal-auth]] |
| Notification dispatch | `services/notification-service.ts` | [[domains/notifications-and-reminders]] |
| E-sign orchestrator | `services/esign-orchestrator.ts` | [[integrations/docusign-esign]] |
| OCR extraction | `services/ocr-extraction.ts` | [[domains/documents-and-ocr]] — `processOcrExtraction` gated by `killswitch.ai-invoice-parser`; `resolveOrgRegion(orgId)` reads `Organization.dataRegion` (default EU) to pick the regional Unleash client (QStash callback carries no tenant ctx) |
| Peppol orchestrator | `services/peppol-orchestrator.ts` | [[integrations/peppol]] |
| Tax ID validation | `services/tax-id-validation.service.ts` | [[integrations/gov-api]] |
| US treaty rate | `services/treaty-rate.service.ts` | US treaty rate + article resolution (mirrors reverse-charge; 30% statutory default + reasoned override) |
| US W-form record | `services/tax-form.service.ts` | immutable W-9/W-8BEN/W-8BEN-E snapshot builder + supersede chain + expiry; full SSN never in snapshot |
| US form routing | `services/tax-form-routing.ts` | pure W-9 vs W-8BEN/W-8BEN-E determination from country + contractor type |
| US TIN-Matching | `services/tin-match.service.ts` | 24h cache + retry over the `TinMatchClient` seam; mismatch sets backup-withholding flag + escalates + audits, never hard-blocks; full TIN never logged/cached (mock default, live e-Services client dark) |
| Couriers | `services/courier/` | [[integrations/couriers]] |
| Outbox | `services/outbox/` | async delivery |
| Onboarding import | `services/onboarding-import-service.ts` | [[domains/onboarding-and-import]] — mergeByEmail, templates |
| Tenant find | `lib/tenant-find.ts` | scoped lookups |
| Audited mutation | `lib/audited-mutation.ts` | audit + tx wrapper |

## Invariants

- New domain logic → service first, thin router procedure
- Pass `tx` to `writeAuditLog` inside transactions

## Related

- [[api-router-groups]]
- [[meta/graphify]] — call graph for cross-service paths

## Verify live

```bash
node .claude/get-shit-done/bin/gsd-tools.cjs intel query invoice
ls packages/api/src/services/
```

## Agent mistakes

- 200-line business rules inline in router handler
- Duplicating compliance-gate checks outside `compliance-payment-gate.ts`
