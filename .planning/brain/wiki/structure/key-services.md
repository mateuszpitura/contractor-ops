---
title: Key API services catalog
type: structure
tags: [structure, services, api]
source_commit: 52012027d6d66885d746d018d5d8db422195e2fb
verify_with:
  - packages/api/src/services/
  - packages/api/src/services/onboarding-import-service.ts
  - packages/db/src/worker-type.ts
  - packages/db/scripts/backfill-worker.ts
  - packages/api/src/services/personnel-classifier.ts
  - packages/db/src/retention-policy.ts
  - packages/compliance-policy/src/personnel-registry.ts
  - .planning/intel/file-roles.json
updated: 2026-07-01
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
| API key service | `services/api-key-service.ts` | [[domains/public-api-surface]] — HMAC-SHA256 `co_live_*` gen/hash/verify + `resolveByPrefix` (grace-aware: a superseded key resolves only until `graceExpiresAt`) + `appendApiKeyIpEvent` (bounded per-key source-IP log) |
| API tier limits | `lib/api-tier-limits.ts` | [[patterns/rate-limit]] — single source: monthly request quota (Starter 1k/Pro 10k/Ent ∞) + webhook-sub caps (defined; consumed in Phase 100) |
| API quota counter | `services/api-quota-counter.ts` | [[patterns/rate-limit]] — Upstash calendar-month counter `api-quota:{org}:{YYYY-MM}` (+ month-end TTL); in-memory non-prod fallback; `incrementMonthlyRequestCount` / read-only `getMonthlyRequestCount` |
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
| US 1099-NEC engine | `services/form-1099-nec.service.ts` | box-1 aggregated by payment-date + FX-to-USD per recipient/payer-org; tax-year-keyed `Tax1099Threshold` gate (never a constant); box-4 backup withholding; CORRECTED = supersede in one tx; idempotent batch + audit; snapshot keeps TIN last-4 only |
| US 1099-NEC Copy-B PDF | `services/form-1099-nec-pdf.ts` + `pdf-templates/form-1099-nec-copy-b.tsx` | lazy `renderToBuffer` substitute Copy B (Pub 1179 §4.6) from the immutable snapshot, last-4 TIN, adviser-verify; R2 archive `1099-nec/<orgId>/<id>.pdf` with a `pdfArchiveKey` CAS guard; Copy B only |
| Couriers | `services/courier/` | [[integrations/couriers]] |
| Outbox | `services/outbox/` | async delivery |
| Onboarding import | `services/onboarding-import-service.ts` | [[domains/onboarding-and-import]] — mergeByEmail, templates |
| Tenant find | `lib/tenant-find.ts` | scoped lookups |
| Audited mutation | `lib/audited-mutation.ts` | audit + tx wrapper |
| Worker backfill | `packages/db/scripts/backfill-worker.ts` | [[domains/worker-foundation]] — idempotent (`WHERE workerId IS NULL`) + reversible (`--rollback`) + per-region one-time backfill; create+link a `Worker` per contractor atomically per `$transaction`, batched; one system-actor `worker.backfill.apply` audit row per org (written directly via Prisma — db sits below api, no `writeAuditLog` import) |
| workerType extension | `packages/db/src/worker-type.ts` | [[domains/worker-foundation]] — `withWorkerTypeDefault` chained outermost in the tenant client (`withWorkerTypeDefault(withSoftDelete(withTenantScope(...)))`); injects `workerType='CONTRACTOR'` on Worker reads unless the caller sets it (explicit-where-wins) |
| Personnel retention resolver | `packages/db/src/retention-policy.ts` (`getPersonnelRetentionCutoff`) + `personnel-retention.ts` facade | [[domains/personnel-file]] — event-anchored resolver on the SHARED retention primitive (no parallel engine): per-rule anchor `HIRE_DATE\|TERMINATION_DATE\|DOCUMENT_DATE`, `anchor + RETENTION_YEARS[token]`, `max()` combinator (US I-9 `max(hire+3y, term+1y)`, 8 CFR 274a.2), indefinite-while-active (missing anchor → `retainUntil` null, never erasable — fail-closed). Years live only on `RETENTION_YEARS` (single source, 8 akta tokens); the section+rule registry is `packages/compliance-policy/src/personnel-registry.ts` (register-on-import, PL/DE/UK/US, `resolveSectionForDocumentType`). Both deletion chokepoints route personnel rows (soft-delete guard + data-purge cron akta-hold-aware sweep) |
| Personnel document classifier | `packages/api/src/services/personnel-classifier.ts` | [[domains/personnel-file]] — `classifyPersonnelDocument`: deterministic taxonomy → `killswitch.ai-personnel-classifier`-gated Claude-Vision seam → `PENDING_REVIEW` admin step; thresholds `PERSONNEL_CLASSIFY_MIN_CONFIDENCE`=85 / `_MARGIN`=15; kill-switch off/unreachable → admin (no model call), **never blocks the persisted upload**; concrete Claude adapter injected as a seam (deferred → AI tail degrades to admin queue) |

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
