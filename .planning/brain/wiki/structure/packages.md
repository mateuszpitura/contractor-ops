---
title: Shared packages
type: structure
tags: [structure, packages]
source_commit: 18d6df46b
verify_with:
  - packages/
  - .planning/codebase/STRUCTURE.md
updated: 2026-07-01
---

# Shared packages

## Purpose

`packages/*` holds domain logic, DB, auth, validators, UI primitives, and integration adapters consumed by apps.

## Entry points

| Package | Path | Role |
|---------|------|------|
| `api` | `packages/api` | tRPC routers, middleware, services, PDF templates; standardized error-key registry in `src/errors.ts` (camelCase values → `Errors` i18n namespace) — added `CONTRACTOR_TAX_ID_EXISTS` (`contractorTaxIdExists`), with en/de/pl/ar parity. Employee registry: `services/employee-pii-crypto.ts` (`encryptPii`/`decryptPii`/`maskLast4` on `EMPLOYEE_PII_ENCRYPTION_KEY`) + `services/elstam-stub.ts` (no-network `lookupElstam` seam); see [[domains/employee-registry]] |
| `db` | `packages/db` | Prisma 7 schema, migrations, regional + tenant clients |
| `auth` | `packages/auth` | Better Auth config |
| `validators` | `packages/validators` | Shared Zod inputs (incl. `w-form-validators.ts` — `taxFormSubmissionSchema` W-9/W-8BEN/W-8BEN-E discriminated union, no full-SSN field; see [[domains/us-tax-forms]]). Employee registry: `employee-validators.ts` (8 greenfield statutory ID validators — PESEL/Steuer-IdNr/NI/UK tax-code/Saudi-ID/Emirates-ID/GOSI/WPS; `EmiratesIdResult` advisory checksum), `employee-country-fields.ts` (`employeeCountryFieldsSchemaMap` PL/DE/GB/US/AE/SA `.strict()` + `validateEmployeeCountryFields`, parallel-not-fork of the contractor map), `employee-reference-lists.ts` (inline NFZ/Lohnsteuerklasse/student-loan/W-4/US-state/Saudization enums) + `reference-data/{zus-oddzialy,urzedy-skarbowe,krankenkassen}.ts` (versioned adviser-verify LOCAL-ONLY seeds); `EMPLOYEE_PII_ENCRYPTION_KEY` in `env.ts`. See [[domains/employee-registry]] |
| `ui` | `packages/ui` | shadcn + workbench `DataTable` |
| `feature-flags` | `packages/feature-flags` | Unleash wrapper + `registry.ts` |
| `compliance-policy` | `packages/compliance-policy` | Payment eligibility rules |
| `einvoice` | `packages/einvoice` | Country e-invoice profiles |
| `iris` | `packages/iris` | IRS IRIS e-file XML — `buildIrisXml` (1099-NEC) + `buildIris1042SXml` (sibling builder), fast-xml-parser `XMLBuilder`, masked last-4 TIN + CFSF state code; `xsdValidate` / `xsdValidate1042S` (libxmljs2, SSRF/XXE-safe). A missing pinned-checksum XSD bundle (human-action SOR checkpoint) returns a non-throwing `BUNDLE_UNAVAILABLE` report — nothing files. See [[domains/us-tax-year-end-filing]], [[integrations/irs-iris]] |
| `payroll` | `packages/payroll` | Per-market payroll EXPORT profiles — a structural clone of the `einvoice` registry engine (`PayrollExportProfile` + `PayrollFeed` DTO + registry + engine), NOT the payment-run bank-file factory. 10 targets: PL Symfonia (CSV+XML)/Comarch/Enova, DE DATEV Lohn ASCII (fixed 121-char + dark DATEVconnect seam)/Sage-DE, UK RTI FPS/EPS XML (non-throwing XSD seam), US ADP/Gusto/QuickBooks CSV + Gusto/QuickBooks native OAuth bridges. Pure `PayrollFeed → {buffer,ext,mime}`, golden-fixture tested, last-4 PII only. See [[domains/payroll-export]] |
| `integrations` | `packages/integrations` | Adapter framework (+ `gusto-adapter`/`quickbooks-adapter` native payroll OAuth) |
| `classification` | `packages/classification` | IR35 / Scheinselbständigkeit scoring |
| `billing` | `packages/billing` | Stripe webhook handlers |
| `logger` | `packages/logger` | Pino structured logging |
| `test-utils` | `packages/test-utils` | MSW fixtures |
| `lint-guards` | `packages/lint-guards` | Architecture CI guards |
| `shared` | `packages/shared` | Money helpers, shared types |
| `gov-api` | `packages/gov-api` | Government API schemas |
| `marketplace-manifests` | `packages/marketplace-manifests` | Generates the Zapier/n8n/Make marketplace definitions + Postman/Insomnia collections from the OpenAPI snapshot + the 16-event webhook catalog (triggers→events, actions→write operationIds); `generate --check` drift gate. Consumed by the developer portal's `/collections/*`. See [[domains/developer-experience]] |

## Invariants

- No `@contractor-ops/db` imports in `apps/web-vite` — `lint:architecture`
- Feature flag keys only in `packages/feature-flags/src/registry.ts`
- Legal locked phrases in `packages/validators/src/legal/` — not duplicated in UI

## Related

- [[api-router-groups]]
- [[prisma-schema-areas]]
- [[integrations/framework-core]]
- [[patterns/validators-boundaries]]

## Verify live

```bash
pnpm typecheck --filter=@contractor-ops/api
pnpm lint:architecture
```

## Agent mistakes

- Calling Unleash SDK from apps — use `@contractor-ops/feature-flags`
- Inline `z.object({ id: z.string() })` — use `entityIdSchema`
