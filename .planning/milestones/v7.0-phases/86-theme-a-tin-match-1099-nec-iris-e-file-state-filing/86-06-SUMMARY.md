---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 06
subsystem: api
tags: [1099-nec, iris, transmitter, state-filing, tax-1099-router, portal-consent, cron, us-expansion, iris-efile]
requirements-completed: [US-FORM-04, US-FORM-05, US-FORM-07]
completed: 2026-07-05
---

# Phase 86 Plan 06: Transmit tail + control surface (staff/portal routers, cron)

**Wired the year-end loop's transmit tail and control surface, all dark behind
`module.us-expansion` (+ `module.iris-efile` for A2A): the `TaxFilingTransmitter`
factory (ManualDownload default | IrisA2A dark | Vendor stub), per-state CFSF /
non-CFSF output, the staff `tax1099` router (batch / build+validate / download /
upload-ack / TIN-mismatch advisory / correction / per-state), the portal
`portalTax1099` consent + Copy-B download scoped to `ctx.contractorId`, root/
portal wiring, and a notify-only year-end reminder cron.**

## What was built

### Task 1 — transmitter factory + per-state output + cross-org leak test
- `tax-filing-transmitter.ts`: `selectTaxFilingTransmitter(flagCtx)` returns
  **ManualDownload by default** (build IRIS XML → `xsdValidate`; on VALID returns
  the XML for download), **IrisA2A only when `module.iris-efile` is enabled**
  (build+validate real; the SOAP/MTOM send is a documented dark seam that
  throws "not configured"), and **Vendor** as a never-selected stub.
  Flag-defer-safe: a missing XSD bundle yields `BUNDLE_UNAVAILABLE` (never
  throws, never `ready`). The single existing dark flag is the only A2A gate —
  no `iris-a2a-transmit` flag minted.
- `state-filing-output.ts`: `buildStateFilingOutput(config, recipients)` —
  CFSF-participating + not-direct-filing → auto-forwarded via the B-record (no
  file); non-CFSF or direct-filing (Maryland) → a formula-injection-safe per-
  state CSV + manual-portal guidance.
- Cross-org leak security test (GREEN): drives the real `appRouter` through two
  org callers; orgB's `tax1099.list` returns none of orgA's `Form1099Nec`, the
  `where` always carries the caller org, and cross-org `fileCorrection` /
  `uploadAck` (`IrisSubmission`) reject NOT_FOUND.

### Task 2 — staff + portal routers + root/portal wiring
- `tax-1099-router.ts` (staff, 10 procedures) — `assertUsExpansionEnabled` is the
  first line of every procedure, Zod `.strict()` inputs (server-derives every tax
  year / amount / status — mass-assignment guard), `contractor:['read'|'update']`
  (no new permission): `list`, `generateBatch` (idempotent + audited via the Plan
  05 service; review-before-file, never transmits), `buildAndValidateXml`,
  `downloadValidatedXml` (ManualDownload; records the `IrisSubmission` once per
  (org, tax year) via idempotency reserve/complete/clear + audit),
  `uploadAck` (XXE-safe `parseIrisAck`, updates submission + appends `IrisAck`),
  `listTinMismatches` / `escalateMismatch` / `resolveMismatch` (**amber advisory,
  never a block**), `fileCorrection` (supersede + audit), `getStateFilingOutput`.
  Added to `usExpansionRouters` in `root.ts` (conditional spread →
  METHOD_NOT_FOUND when the flag is OFF).
- `portal-tax-1099-router.ts` (portal) — every procedure scoped to
  `ctx.contractorId` (IDOR); consent is an affirmative, **server-derived**
  audit-ledger fact (ip/actorId/timestamp derived server-side; the client input
  schemas are empty `.strict()` objects): `getEdeliveryConsent`,
  `recordEdeliveryConsent`, `withdrawConsent`, `downloadCopyB` (furnished **only**
  with stored consent; no consent → `{ paperCopy: true }`, never the PDF; TIN
  last-4 only). Merged into the flat `portalRouter`.

### Task 3 — notify-only year-end reminder cron
- `year-end-1099-reminder.service.ts` + handler — reminds each org's staff (RBAC
  recipients) that the closing tax year's 1099-NEC batch is due, deduped once per
  tax year. **NEVER** aggregates a batch, builds XML, renders a Copy-B, or
  transmits. Ships dark: the handler short-circuits when `module.us-expansion` is
  off. Registered with `CRON_YEAR_END_1099_REMINDER_SCHEDULE` (env + `.env.example`,
  mid-January default). Added the `tax.form_1099_year_end_reminder` notification
  type to `@contractor-ops/validators`.

## Consent storage decision
No dedicated e-delivery-consent model exists in the applied schema (86-02 added
none) and Plan 06 adds no migration. Consent is therefore recorded as an
append-only **AuditLog ledger** (`form1099.edelivery.consent.granted` /
`.withdrawn`); the latest event is the current state. IDOR-scoped, server-derived,
reversible — no schema change required.

## Tests / verification
- `tax-filing-transmitter.test.ts` — 7 pass (factory selection; Manual pipeline
  BUNDLE_UNAVAILABLE-safe; CFSF vs direct-filing CSV).
- `iris-ack-parser.test.ts` — 14 pass.
- `tax-filing-tenant-isolation.security.test.ts` — 4 pass (cross-org leak).
- `pnpm --filter @contractor-ops/api typecheck` — green.
- `pnpm --filter @contractor-ops/cron-worker typecheck` — green.
- `pnpm --filter @contractor-ops/validators typecheck` — green.
- `pnpm lint:no-breadcrumbs` — OK. `portal-idor.security.test.ts` — 11 pass
  (portalAppRouter still builds with the merged router).

## Known limitations (adviser-verify / schema-deferred)
- No structured recipient US-state field on `Contractor`, so `generateBatch` sets
  `cfsfStateCode: null` and `getStateFilingOutput` lists all tax-year recipients
  for the operator to file — CFSF auto-population lands when a recipient-state
  field is added. The CFSF capability itself is fully present in `buildIrisXml` +
  `state-filing-output`.
- Payer EIN is a placeholder in the assembled IRIS input (no org EIN field yet) —
  adviser-verify + captured at US-enablement.
- Box-4 backup-withholding amount is 0 at generation (recorded-amount column is a
  Phase-88 concern); the flag is read from `Contractor.backupWithholdingFlagged`.

## Deferred / external gates
- Prisma migration apply (86-02) remains the deploy-time human step (unchanged).
- Live IRIS A2A transmit stays dark behind `module.iris-efile` until TCC/A2A
  enrollment. ManualDownload is the shipped default (no TCC).
