# Phase 86: Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing - Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 31 new/modified surfaces (services, packages, prisma, routers, cron, web-vite, flags)
**Analogs found:** 29 with in-tree match / 31 total (2 partial — IRIS XSD bundle + dark SOAP A2A)

> Built on `86-CONTEXT.md` (canonical_refs already name analogs), `86-RESEARCH.md` (recommended structure + verbatim safety invariants), `86-UI-SPEC.md` (component inventory). Every analog below was Read and verified — file:line + excerpt are load-bearing for the planner. Do NOT re-search; the per-file table is actionable as-is.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|-------------------|------|-----------|----------------|-------|
| `packages/db/prisma/schema/tax.prisma` (extend: `Form1099Nec`, `IrisSubmission`, `IrisAck`, `Tax1099Threshold`, `StateFilingConfig` + enums) | model/migration | CRUD/transform | `tax.prisma` `TaxFormSubmission:86-113` + `WhtCertificate:45-68` | exact |
| `packages/db/src/retention-policy.ts` (register `Form1099Nec`) | config | transform | `retention-policy.ts` `MODEL_RETENTION_TYPE:31` | exact |
| `packages/db/src/soft-delete.ts` (add `Form1099Nec` to `softDeleteModels`) | config | transform | `soft-delete.ts:26` | exact |
| `packages/api/src/services/form-1099-nec.service.ts` | service | CRUD/batch | `tax-form.service.ts` (`supersedeAndInsert:181`, `buildFormSnapshot:108`) | exact |
| `packages/api/src/services/tin-match.service.ts` | service | request-response | `tax-form.service.ts` (svc shape) + adapter seam below | role-match |
| `packages/api/src/services/iris-ack-parser.ts` | service | transform | `payment-format-detection.ts` / parser idiom; new structured parser | partial |
| `packages/api/src/services/tax-filing-transmitter.ts` (factory) | service | transform | `payment-export-router.ts` `_generateExportFileForFormat` + `payment-export.ts` | exact |
| `packages/integrations/src/adapters/tin-match/tin-match-client.ts` (interface) | utility | request-response | `base-adapter.ts:42-65` (abstract interface) | role-match |
| `packages/integrations/src/adapters/tin-match/mock-tin-match-client.ts` | service | request-response | `base-adapter.ts` no-op defaults; deterministic mock | partial |
| `packages/integrations/src/adapters/tin-match/eservices-tin-match-client.ts` (dark) | service | request-response | `peppol-adapter-factory.ts:35-64` (SSRF-safe pinned URL) | exact |
| `packages/iris/src/generator.ts` (`buildIrisXml`) — NEW pkg or profile | service | transform | `einvoice/.../xrechnung-de/generator.ts:1-39` (`XMLBuilder`) | exact |
| `packages/iris/src/validator.ts` (`xsdValidate`) | service | transform | `einvoice/.../xrechnung-de/validator.ts:40-160` (libxmljs2, `nonet:true`) | exact |
| `packages/iris/src/schema-bundle/*.xsd` + `checksums.txt` | config/build | file-I/O | `einvoice/.../validator-bundle/` + `recompile-kosit-schematron.ts` guard | partial |
| `packages/api/src/pdf-templates/form-1099-nec-copy-b.tsx` | component | file-I/O | `pdf-templates/late-payment-claim.tsx`, `ir35-sds.tsx`, `drv-defense-bundle.tsx` | exact |
| `packages/api/src/services/form-1099-nec-pdf.ts` (render to buffer + R2) | service | file-I/O | `late-payment-claim-pdf.ts:85-109` (`renderToBuffer`) | exact |
| `packages/api/src/routers/finance/tax-1099-router.ts` (staff batch/filing/TIN-match) | route/controller | request-response | `tax-form-router.ts:26-58` + `payment-export-router.ts` | exact |
| `packages/api/src/routers/portal/portal-tax-1099-router.ts` (e-delivery consent + Copy-B download) | route/controller | request-response | `portal-tax-form-router.ts:53-235` | exact |
| `packages/api/src/root.ts` (conditional spread of staff 1099 routers) | config | — | `root.ts:151-163` (`usExpansionRouters`) | exact |
| `packages/api/src/lib/idempotency.ts` (consumed — reserve/complete/clear) | utility | transform | `idempotency.ts:90-149` | exact (reuse) |
| `packages/api/src/services/audit-writer.ts` (consumed — `writeAuditLog`) | utility | event-driven | used by `portal-tax-form-router.ts:215` | exact (reuse) |
| `apps/cron-worker/src/jobs/handlers/year-end-1099-reminder.ts` | service | event-driven | `apps/cron-worker/src/jobs/handlers/` (`createCronLogger`) | role-match |
| `apps/cron-worker/src/jobs/registry.ts` (register job + env) | config | — | `registry.ts:29-108` (`getJobDefinitions`) | exact |
| `packages/feature-flags/src/...` (CONFIRM `module.iris-efile`, no new flag) | config | — | `signoff-registry-flags.json:114` + `signoff-registry-flags.ts:54,72` | exact (reuse) |
| `apps/web-vite/.../tax-filing/tax-1099-batch-panel.tsx` | component (wired) | request-response | `tax-form-status-card.tsx:157-202` (4-state branch) | exact |
| `apps/web-vite/.../tax-filing/batch-summary.tsx` | component (presentational) | — | `tax-form-status-card.tsx:101-155` (`FormSummary` dl grid) | exact |
| `apps/web-vite/.../tax-filing/tax-1099-filing-card.tsx` | component (wired) | request-response | `tax-form-status-card.tsx` (`STATUS_MAP:42-73`) | exact |
| `apps/web-vite/.../tax-filing/iris-status-pill.tsx` | component (presentational) | — | `tax-form-status-card.tsx` `FormStatusPill:75-99` | exact |
| `apps/web-vite/.../tax-filing/ack-upload-field.tsx` | component (presentational) | file-I/O | `step-attest.tsx` native `<input>` + `<Label htmlFor>` | role-match |
| `apps/web-vite/.../tax-filing/tin-mismatch-list.tsx` | component (wired) | request-response | `tax-form-status-card.tsx` 4-state branch | exact |
| `apps/web-vite/.../tax-filing/correction-dialog.tsx` | component (presentational) | — | repo Dialog body/footer convention (`dialog.tsx` DialogBody/DialogFooter) | role-match |
| `apps/web-vite/.../tax-filing/state-filing-output.tsx` | component (presentational) | file-I/O | `tax-form-status-card.tsx` Card/Button/Badge | role-match |
| `apps/web-vite/.../tax-filing/hooks/use-1099-batch.ts` / `use-iris-filing.ts` / `use-tin-mismatches.ts` | hook | request-response | `tax-forms/hooks/use-tax-form-status.ts` | exact |
| `apps/web-vite/.../portal/tax-forms/step-edelivery-consent.tsx` | component (presentational) | — | `step-attest.tsx:49-172` (affirmative checkbox + audited submit) | exact |
| `apps/web-vite/.../portal/tax-forms/copy-b-download.tsx` | component (presentational) | file-I/O | `tax-form-status-card.tsx` Card/Button/Badge | role-match |
| `apps/web-vite/.../portal/tax-forms/hooks/use-edelivery-consent.ts` | hook | request-response | `portal/tax-forms/hooks/use-tax-form-wizard.ts` | exact |

---

## Pattern Assignments

### `packages/db/prisma/schema/tax.prisma` — `Form1099Nec` + IRIS + config tables (model, CRUD)

**Analog:** `packages/db/prisma/schema/tax.prisma` `TaxFormSubmission` (86-113) + `WhtCertificate` (45-68)

**Copy — supersede chain enum + model shape** (`TaxFormSubmission`, lines 80-113):
```prisma
enum TaxFormStatus { DRAFT  ACTIVE  SUPERSEDED }

model TaxFormSubmission {
  id              String        @id @default(cuid())
  organizationId  String
  contractorId    String
  status          TaxFormStatus @default(DRAFT)
  snapshotJson    Json          // immutable record-of-record; never a full SSN
  supersededById  String?       @unique
  createdAt       DateTime      @default(now())
  organization Organization @relation(fields: [organizationId], references: [id])
  supersededBy TaxFormSubmission? @relation("Supersede", fields: [supersededById], references: [id])
  supersedes   TaxFormSubmission? @relation("Supersede")
  @@index([organizationId, contractorId, formType, status])
}
```

**What to copy:** the `DRAFT/ACTIVE/SUPERSEDED` enum + self-relation `supersededById @unique` + `@@index([organizationId, ...])` — `Form1099Nec` mirrors this exactly (CORRECTED = supersede, D-08/D-16). `snapshotJson Json` holds the captured box figures (the immutable record-of-record).
**What differs:** `Form1099Nec` adds `taxYear Int`, `box1AmountMinor Int`, `box4BackupWithholdingMinor Int`, `cfsfStateCode String?`, `currency`, plus a `payerOrgId` axis (aggregation is per recipient per payer-org, D-06). `WhtCertificate` (lines 45-68) is the money-snapshot analog for the box amounts (`grossAmountMinor`, `whtAmountMinor`, `currency @db.Char(3)`, `paymentDate @db.Date`). New `IrisSubmission`/`IrisAck` records also follow this immutable shape (record schema VersionNum/VersionDt, ack status). `Tax1099Threshold` + `StateFilingConfig` are tax-year/state-keyed config tables (`TaxRate`-like `effectiveFrom`/`effectiveTo`, lines 4-21) — NOT constants (Pitfall 1/5).
**Tenant invariant:** every new model carries `organizationId` and a relation to `Organization`; never add to `globalModels`; write a cross-org leak test per new model (CONTEXT discretion + project rule).

---

### `packages/api/src/services/form-1099-nec.service.ts` (service, batch/CRUD)

**Analog:** `packages/api/src/services/tax-form.service.ts`

**Copy — supersede-then-insert in one transaction** (`supersedeAndInsert`, lines 181-223):
```typescript
export async function supersedeAndInsert(tx: TaxFormTxClient, input: SupersedeAndInsertInput) {
  await tx.taxFormSubmission.updateMany({
    where: { organizationId, contractorId, formType, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED' },
  });
  return tx.taxFormSubmission.create({
    data: { organizationId, contractorId, formType, status: 'ACTIVE', snapshotJson, ... },
  });
}
```

**Copy — immutable snapshot builder + PII sanitizer** (`buildFormSnapshot:108`, `sanitizeFields:76`, `FORBIDDEN_FIELD_KEYS:69`): build a JSON record-of-record; `sanitizeFields` strips any `ssn`/`fulltin` key so a forged payload cannot leak a full TIN — the 1099 snapshot keeps **last-4 only**.
**What to copy:** the supersede-before-insert ordering inside `$transaction`; the `TaxFormTxClient` minimal-tx-surface interface (lines 148-158); the full-identifier sanitizer.
**What differs:** the CORRECTED supersede key is `(organizationId, payerOrgId, recipientId, taxYear)` not `(contractorId, formType)`. Aggregation (box-1 by **payment/settlement date**, FX-converted to USD at payment-date rate, per recipient per payer-org — D-06) is new logic that reads settled payments + `ExchangeRate` (FX source: `packages/api/src/services/exchange-rate.ts`). Threshold gate reads `Tax1099Threshold` ($600 TY2025 / $2,000 TY2026, Pitfall 1) — never a constant. US TIN/EIN validation: reuse `packages/validators/src/us-validators.ts` (`isValidEin`/`isValidSsn`), do not duplicate.

---

### `packages/api/src/services/tin-match.service.ts` + `packages/integrations/src/adapters/tin-match/*` (service + adapter seam, request-response)

**Analogs:** `packages/integrations/src/adapters/base-adapter.ts` (interface seam), `packages/api/src/services/peppol-adapter-factory.ts` (SSRF-safe live client)

**Copy — SSRF-safe pinned-URL credential factory** (`peppol-adapter-factory.ts:35-64`):
```typescript
// SSRF-safety: the base URL is one of two pinned literal strings, selected by
// the credential blob's `environment` field (validated via Zod upstream).
const blob = decryptCredentials(connection.credentialsRef, 'peppol');
const baseUrl = env === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
return new StorecoveAdapter({ apiKey, baseUrl });
```

**What to copy:** the `decryptCredentials(connection.credentialsRef, '<provider>')` + **pinned literal base URL** (never user-influenced) for the live `EServicesTinMatchClient`; the abstract-interface pattern from `base-adapter.ts:42-65` for the `TinMatchClient` interface. Ship a deterministic `MockTinMatchClient` (default) returning the IRS numerical response indicator; the live client sits dark behind a flag (D-11) — same posture as classification adapters.
**What differs:** TIN-match service owns the **24h cache + retry + admin-escalation** logic (D-10/D-11). Mismatch → set the recipient backup-withholding flag + create an escalation, **never hard-block** (D-12 — mirror the reverse-charge/P85 D-10 auto-record-and-escalate shape). The seam may live in `packages/integrations` (base-adapter) OR as a finance-local factory (peppol-style) — planner's call per CONTEXT discretion.

---

### `packages/iris/src/generator.ts` + `validator.ts` (service, transform — IRIS XML build + XSD)

**Analogs:** `packages/einvoice/src/profiles/xrechnung-de/generator.ts` + `validator.ts`

**Copy — `XMLBuilder`, never string templates** (`generator.ts:1-39`):
```typescript
import { XMLBuilder } from 'fast-xml-parser';
// never string templates — concat XML produces entity-escape bugs that surface
// as unhelpful layer-1 XSD failures.
```

**Copy — XXE/SSRF-safe XSD validation + lazy bundle dir** (`validator.ts:40-160`):
```typescript
// Lazy — turbopack/tsx strips import.meta.dirname at module load.
function getBundleDir(): string {
  return path.join(path.dirname(new URL(import.meta.url).pathname), 'validator-bundle');
}
// SSRF: { nonet: true, baseUrl } blocks external <xs:import schemaLocation="http://...">
// XXE: default noent:false means entities are NOT expanded
const xsdDoc = libxmljs.parseXml(ciiXsd, { baseUrl: getXsdDir() + path.sep, nonet: true });
const instanceDoc = libxmljs.parseXml(xml, { nonet: true });
const valid = instanceDoc.validate(xsdDoc); // never throws on validation failure
```

**What to copy verbatim (RESEARCH Pattern 1 + Pitfall 7):** `XMLBuilder` (never concat); `{ nonet: true, baseUrl }` + default `noent:false`; lazy `getBundleDir()` (resolve schema paths inside a function, not at module top); memoised bundle-load promise (`loadBundle:83-101`); typed `ValidationReport` with per-layer `errors[]` that never throws on validation failure (only on a corrupt bundle); bundle the XSDs + pin SHA-256 in a CI guard (mirror `recompile-kosit-schematron.ts`).
**What differs:** IRIS has ONE XSD layer (no schematron Layers 2/3). The XML payload structure (Transmission Manifest with `VersionNum`/`VersionDt`, B-record payee with CFSF state code) is IRS-specific and **MEDIUM confidence — re-derive element names from the downloaded TY2025/TY2026 schema package** (RESEARCH Open Q1, Pitfall 4). Record the schema VersionNum/VersionDt the submission was built against on `IrisSubmission`.

---

### `packages/api/src/services/tax-filing-transmitter.ts` (service factory, transform)

**Analog:** `packages/api/src/routers/finance/payment-export-router.ts` (`_generateExportFileForFormat`) + `packages/api/src/services/payment-export.ts`

**What to copy:** the format-factory shape — one generation pipeline, swappable tail. `payment-export.ts` selects `generateElixir | generateSepaXml | generateSwiftXml | generateBacsStandard18` by format; the `TaxFilingTransmitter` factory selects `ManualDownload (default) | IrisA2A (flag-gated dark) | Vendor (stub)` (D-03). Copy the **export-lock + compliance-snapshot writer** idiom from `payment-export-router.ts` `writeExportAndComplianceRows:30` (atomic state transition won → rows written exactly once + `writeAuditLog` lock-and-export entry) for the transmit/lock record.
**What differs:** `ManualDownload` returns the XSD-validated `.xml` buffer for admin download (D-01, the GA default — no TCC). `IrisA2A` (SOAP/MTOM) is dark behind `module.iris-efile` (RESEARCH A1 — reuse, do NOT mint `iris-a2a-transmit`). One ack parser (`iris-ack-parser.ts`) consumes BOTH the manual-uploaded ack file AND the A2A poll result (D-04), mapping all 6 IRIS statuses (Accepted / Rejected / Processing / Partially Accepted / Accepted with Errors / Not Found) + Error Information Group.

---

### `packages/api/src/pdf-templates/form-1099-nec-copy-b.tsx` + `form-1099-nec-pdf.ts` (component + service, file-I/O)

**Analog:** `packages/api/src/pdf-templates/late-payment-claim.tsx` (+ `ir35-sds.tsx`, `drv-defense-bundle.tsx`) + `packages/api/src/services/late-payment-claim-pdf.ts`

**Copy — lazy `renderToBuffer`** (`late-payment-claim-pdf.ts:85-107`):
```typescript
const { renderToBuffer } = await import('@react-pdf/renderer');
const { LatePaymentClaimTemplate } = await import('../pdf-templates/late-payment-claim');
const pdfBuffer = await renderToBuffer(LatePaymentClaimTemplate({ /* snapshot figures */ }));
const pdfKey = `late-interest-claims/${orgId}/${invoiceId}/${id}.pdf`;
```

**What to copy:** the lazy dynamic `import('@react-pdf/renderer')` (keeps react-pdf out of cold paths); render from the **stored immutable snapshot** ("values AS CLAIMED", not a live recompute); the R2 archive key shape `<feature>/<orgId>/<id>.pdf`; the CAS guard (`updateMany ... where status='PENDING_RENDER'`) so a render isn't double-run.
**What differs (NOTE — version):** the installed version is `@react-pdf/renderer@4.5.1` (RESEARCH verified), NOT 3.4.5 (CONTEXT.md stale). Render **Copy B only** (substitute, black ink, Pub 1179 §4.6) — never IRS Copy A (that goes via IRIS XML). TIN renders **last-4 only** (Pub 1179 masking + P84/P85 SsnMaskedReveal invariant). Adviser-verify annotation on the artifact (D-18). Archive to the US R2 tax bucket either way; **furnishing** (portal download) is consent-gated (D-09).

---

### `packages/api/src/routers/finance/tax-1099-router.ts` (staff) + `portal-tax-1099-router.ts` (portal) — routers, request-response

**Analogs:** `packages/api/src/routers/core/tax-form-router.ts` (staff), `packages/api/src/routers/portal/portal-tax-form-router.ts` (portal)

**Copy — per-request flag guard + RBAC + audit** (`portal-tax-form-router.ts:171-234`, `tax-form-router.ts:31-58`):
```typescript
// EVERY procedure, first line — defense-in-depth (D-15):
assertUsExpansionEnabled(ctx.organizationId, ctx.region);
// staff: tenantProcedure.use(requirePermission({ contractor: ['read'] }))  (reuse, no new permission)
// portal: portalProcedure scoped to ctx.contractorId (IDOR guard — never trust client contractorId)

// server-derived audit identity (never client-supplied):
const ip = deriveClientIp(ctx.headers);            // portal-tax-form-router.ts:41
const signedAt = new Date();                        // server clock
await writeAuditLog({ tx, organizationId, actorType, actorId, action, resourceType, resourceId, ipAddress: ip, metadata });
```

**What to copy:** `assertUsExpansionEnabled` as the first line of every procedure; Zod input on every procedure; `$transaction` wrapping mutate + `writeAuditLog`; `deriveClientIp` + server clock for the e-delivery-consent timestamp (mirror the ESIGN attestation — client schema omits ip/actorId/timestamp); the consent capture mirrors the `submitTaxForm` attestation idiom (lines 171-234).
**What differs:** staff router adds batch-generate / build-XML / download / upload-ack / escalate / file-correction procedures (wrap batch + transmit in `idempotency.ts` reserve/complete/clear, D-19). Portal router adds `recordEdeliveryConsent` / `withdrawConsent` / `downloadCopyB` (download gated on stored consent; no consent → paper/manual flag, D-09).

---

### `packages/api/src/root.ts` — conditional staff router spread (config)

**Analog:** `packages/api/src/root.ts:151-163`

```typescript
const usExpansionRouters = { taxForm: taxFormRouter } as const;
const conditionalUsExpansionRouters = isUsExpansionRegistered()
  ? usExpansionRouters
  : ({} as typeof usExpansionRouters);   // const keeps the spread TYPE constant across branches
```
**What to copy:** add the new staff 1099/filing/TIN-match router(s) into the existing `usExpansionRouters` const so they're absent from `appRouter` when the flag is OFF (clients get METHOD_NOT_FOUND), with the per-request guard as belt-and-braces. Portal router cannot be conditionally spread (flat merge) — the per-request `assertUsExpansionEnabled` is the load-bearing gate there (see `require-us-expansion-flag.ts:8-16` comment).

---

### `apps/cron-worker/src/jobs/handlers/year-end-1099-reminder.ts` + `registry.ts` (cron, event-driven)

**Analog:** `apps/cron-worker/src/jobs/registry.ts:29-108`

**What to copy:** add a `{ meta: { name: 'year-end-1099-reminder', schedule: env.CRON_YEAR_END_1099_REMINDER_SCHEDULE }, handler }` entry to `getJobDefinitions` (lines 43-107) + add the new `CRON_*_SCHEDULE` field to the env param type (lines 29-42); handler uses `createCronLogger` (mirror `trial-notifications`/`reminders` handlers). New env → `.env.example` + cron-worker package env schema.
**What differs:** **notify-only** (D-05) — the handler ONLY notifies that the batch is due; it MUST NOT auto-generate or auto-transmit (Anti-Pattern: "Auto-filing from the cron"). Human reviews before any immutable archive + IRS file.

---

### `apps/web-vite/.../tax-filing/*` + `portal/tax-forms/*` (web-vite — components + hooks)

**Analogs:** `apps/web-vite/src/components/contractors/tax-forms/tax-form-status-card.tsx`, `portal/tax-forms/step-attest.tsx`, `tax-forms/hooks/use-tax-form-status.ts`

**Copy — mandatory 4-state branch in every wired section** (`tax-form-status-card.tsx:165-201`):
```tsx
{isPending ? (
  <div className="space-y-3" aria-busy aria-live="polite"><Skeleton .../></div>
) : error ? (
  <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
  /* + outline "Reload" Button onClick={refetch} — data preserved on retry */
) : isEmpty || !latest ? (
  <div className="space-y-2 py-6 text-center">{/* font-display heading + muted body */}</div>
) : ( <Loaded/> )}
```

**Copy — `STATUS_MAP` badge/icon/tooltip pill** (`tax-form-status-card.tsx:42-99`): a `Record<Status, { labelKey, tooltipKey, badgeVariant, icon }>` driving `FormStatusPill` (Badge + Tooltip + `aria-label`). Reuse verbatim for `iris-status-pill.tsx` over the 6 IRIS ack states (UI-SPEC color table: Accepted=success, Rejected=destructive, Partial/Accepted-with-Errors=warning, Processing=info, etc.).

**Copy — affirmative consent checkbox** (`step-attest.tsx:88-118`): real native `<input type="checkbox">` (unchecked default) + `<Label htmlFor>`; affirm button `disabled` until checked; server re-derives ip/timestamp/actorId. `step-edelivery-consent.tsx` mirrors this exactly (Pub 1179 §4.6 consent, UI-SPEC consent contract).

**Copy — hook = sole tRPC boundary** (`use-tax-form-status.ts`): returns `{ isPending, error, isEmpty, latest, refetch }`; the wired section branches on these. New hooks (`use-1099-batch`, `use-iris-filing`, `use-tin-mismatches`, `use-edelivery-consent`) are the ONLY tRPC/React-Query layer.
**What differs:** web-vite layering — **Page (thin composer) → wired section (4-state, no direct tRPC) → hook (sole tRPC boundary) → presentational**. NO `*-container.tsx` (project moved off that name — UI-SPEC). RTL logical props (`ps-`/`pe-`, `me-`/`ms-`), never `pl-`/`pr-` (UI-SPEC). All strings i18n keys at en/en-US/de/pl/ar parity (D-20). TIN mismatch + backup-withholding render **amber `warning`, never red** (D-12 — never a hard block). `correction-dialog.tsx` uses the repo DialogBody (scroll) + DialogFooter (sticky) convention. `ack-upload-field` is a native file input; `safeParse` runs in the hook/server, not the component.

---

## Shared Patterns

### Authentication / Flag-gating
**Source:** `packages/api/src/middleware/require-us-expansion-flag.ts:29-58`
**Apply to:** every staff + portal 1099/IRIS/TIN-match procedure (D-15)
```typescript
assertUsExpansionEnabled(ctx.organizationId, ctx.region); // first line of every procedure
// root.ts uses isUsExpansionRegistered() for the conditional staff spread
```

### Audit logging
**Source:** `packages/api/src/services/audit-writer.ts` (`writeAuditLog`), consumed at `portal-tax-form-router.ts:215`
**Apply to:** sign / transmit / correct / reveal / escalate / consent actions (D-19)
```typescript
await writeAuditLog({ tx, organizationId, actorType, actorId, action, resourceType, resourceId, ipAddress, metadata });
// pass `tx` inside $transaction so the audit row commits atomically with the mutation
```

### Idempotency
**Source:** `packages/api/src/lib/idempotency.ts:90-149`
**Apply to:** batch-generation + transmit (D-19) — a retried batch never double-files
```typescript
const hit = await reserve<Result>(key, ttl);   // MISS | PENDING | HIT
// MISS → proceed, then complete(key, result, ttl); on failure → clear(key)
```

### Retention registration (closes the P83 wiring point, D-17)
**Source:** `packages/db/src/retention-policy.ts:31` (`MODEL_RETENTION_TYPE` ships EMPTY) + `soft-delete.ts:26` (`softDeleteModels`)
**Apply to:** `Form1099Nec` (+ any backup-withholding-bearing record)
```typescript
export const MODEL_RETENTION_TYPE: Partial<Record<string, RetainedRecordType>> = {
  Form1099Nec: '1099-NEC',          // 4yr (RETENTION_YEARS already has '1099-NEC':4 + 'backup-withholding':7)
};
// Form1099Nec must ALSO join softDeleteModels (soft-delete.ts:26) for the data-purge chokepoint to enforce it.
```

### SSRF-safe credentialed adapter (dark live clients)
**Source:** `packages/api/src/services/peppol-adapter-factory.ts:35-64`
**Apply to:** live e-Services TIN-Match client + IRIS A2A endpoint (both dark)
```typescript
const blob = decryptCredentials(connection.credentialsRef, '<provider>');
const baseUrl = env === 'production' ? PRODUCTION_LITERAL : SANDBOX_LITERAL; // pinned, never user-influenced
```

### XML/XSD safety (verbatim)
**Source:** `packages/einvoice/src/profiles/xrechnung-de/validator.ts:17-23,40-42,118-132`
**Apply to:** all IRIS XML build + validation
- `XMLBuilder` only — never string-concat XML.
- `libxmljs2.parseXml({ nonet: true, baseUrl })` (SSRF) + default `noent:false` (XXE).
- Lazy `getBundleDir()` (turbopack/tsx strips `import.meta.dirname` at module load).
- Bundle XSDs + pin SHA-256 in a CI guard; never fetch external `<xs:import schemaLocation="http://...">`.

### i18n + WCAG (every UI surface)
**Source:** `tax-form-status-card.tsx` (`useTranslations`/`useFormatter`, `aria-busy`/`aria-live`/`role="alert"`) + `step-attest.tsx` (native inputs + `<Label htmlFor>`)
**Apply to:** all web-vite components — en/en-US/de/pl/ar(RTL) parity (D-20), 4 states, keyboard/focus, 44×44 touch targets, Label-in-Name.

---

## No Analog Found

| File | Role | Data Flow | Reason / planner guidance |
|------|------|-----------|---------------------------|
| `packages/iris/src/schema-bundle/*.xsd` + `checksums.txt` | config/build | file-I/O | The IRS IRIS XSD package does not exist in-tree and is not on npm — **plan-phase download task** from the IRS SOR (RESEARCH Open Q1 / Env Availability). Bundle + checksum-pin mirroring `einvoice/.../validator-bundle/` once obtained. Re-verify TY2026 schema (~Nov 2026). |
| IRIS A2A SOAP/MTOM transport (inside `tax-filing-transmitter.ts` `IrisA2A` branch) | service | request-response | **The repo has no SOAP/MTOM client today** (RESEARCH Supporting stack / Open Q2). Dark + off the GA critical path (manual-upload default). Build against Pub 5718 + WSDL when TCC clears; prefer a hand-built SOAP envelope; any SOAP npm dep needs slopcheck + 7-day-age + `checkpoint:human-verify` before install. |

---

## Metadata

**Analog search scope:** `packages/api/src/{services,routers,pdf-templates,lib,middleware}`, `packages/einvoice/src/profiles/xrechnung-de`, `packages/integrations/src/adapters`, `packages/db/{prisma/schema,src}`, `packages/feature-flags/src`, `apps/cron-worker/src/jobs`, `apps/web-vite/src/components/{contractors,portal}/tax-forms`
**Files scanned / Read:** 16 analog files Read in full or targeted; flag registry + retention chokepoint + hooks dir confirmed via grep
**Pattern extraction date:** 2026-06-17

**Stale-fact corrections carried for the planner:**
- `@react-pdf/renderer` is **4.5.1**, not 3.4.5 (CONTEXT/code_context stale).
- Threshold is tax-year-keyed: **$600 TY2025 / $2,000 TY2026** (OBBBA) — never a constant (Pitfall 1).
- Reuse the existing **`module.iris-efile`** flag (PENDING, `signoff-registry-flags.json:114`); do NOT mint `iris-a2a-transmit` (RESEARCH A1).
- IRIS = primary/mandatory; **FIRE is documentation-only, no code** (Pitfall 2).
