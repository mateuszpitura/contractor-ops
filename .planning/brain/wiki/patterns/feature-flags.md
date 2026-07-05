---
title: Feature flags
type: pattern
tags: [feature-flags, unleash]
source_commit: 18d6df46b
verify_with:
  - packages/feature-flags/src/registry.ts
  - packages/feature-flags/src/flags-core.ts
  - packages/feature-flags/README.md
  - packages/api/src/services/ocr-extraction.ts
  - packages/api/src/middleware/require-workforce-flag.ts
  - packages/api/src/services/personnel-classifier.ts
updated: 2026-07-01
---

# Feature flags

## Purpose

Self-hosted Unleash OSS behind `@contractor-ops/feature-flags` wrapper. Keys declared in code registry, toggled in Unleash UI.

## Entry points

| Piece | Path |
|-------|------|
| Registry | `packages/feature-flags/src/registry.ts` (flag table in `flags-core.ts`) |
| Server evaluate | `evaluate()` from package |
| Client | `useFlag()`, `<Feature>` |
| tRPC introspection | `featureFlags` router |
| Classification gate | `module.classification-engine` in `root.ts` |
| OCR kill-switch consumer | `services/ocr-extraction.ts` evaluates `killswitch.ai-invoice-parser` |
| Personnel-classifier kill-switch | `killswitch.ai-personnel-classifier` (`default: true`, `killWhenUnknown: true`, owner ops, **non-gated** — `killswitch.` is not a gated namespace so no signoff-registry entry) gates the Claude-Vision section classifier in `services/personnel-classifier.ts` (`defaultEvaluateKillSwitch`); off/unreachable → route the document straight to the `PENDING_REVIEW` admin classify-step, **never block the upload**. Cloned from `killswitch.ai-invoice-parser`. See [[domains/personnel-file]] |
| Workforce gate | `module.workforce-employees` — `middleware/require-workforce-flag.ts` (`assertWorkforceEnabled` / `isWorkforceRegistered`) + `root.ts` conditional-spread of `worker`/`employee`; mirrors `module.us-expansion`. See [[domains/worker-foundation]] |
| Programmatic-ACH gate | `payments.ach-payouts` (default OFF, signoff PENDING→APPROVED) — **REUSED**, not re-minted, to gate the opt-in `payment.initiatePayout` programmatic-ACH path; the NACHA/Fedwire file export stays GA. See [[domains/us-payment-rail]], [[integrations/modern-treasury]] |
| Plaid live-client gate | `payments.plaid-verification` (default OFF, **non-gated**) — gates ONLY the live Plaid Identity client; the deterministic mock advisory default is always on (fail-open). Non-gated because the only gated payments prefix is `payments.ach-`, so it needs no signoff-registry entry and is not in the v7.0 cohort. See [[integrations/plaid]] |
| IRIS A2A transmit gate | `module.iris-efile` (default OFF, dark) — the **single** gate for the automated IRS IRIS A2A (SOAP/MTOM) transmit path in `tax-filing-transmitter.ts` (`selectTaxFilingTransmitter` returns `IrisA2A` only when enabled). **REUSED**, not re-minted — there is no `iris-a2a-transmit` flag. ManualDownload is the default GA path (no TCC). See [[domains/us-tax-year-end-filing]], [[integrations/irs-iris]] |

## Invariants

- **Never** call Unleash SDK directly from apps
- Jurisdiction defaults live in registry — not Prisma
- Module load evaluation in `root.ts` for classification — server restart needed for router registration change; middleware does per-request defense-in-depth
- **Kill-switches use `killWhenUnknown: true`** so an Unleash outage forces them OFF rather than falling through to their `default`. `killswitch.ai-invoice-parser` (`default: true`, owner ops) gates Claude Vision in `processOcrExtraction`: when disabled (or Unleash unreachable) the AI call is skipped, the upload stays persisted, and the `OcrExtraction` row is marked **`SKIPPED`** with a manual-entry message + `ocr.skipped` metric — see [[domains/documents-and-ocr]]
- **A killed flag is not a failure:** kill semantics must land the consumer in a dedicated non-error state, never a reused error/failure status. The OCR kill-switch maps to `OcrExtractionStatus.SKIPPED` (manual entry, no `resultJson`), distinct from `FAILED`, so retry/alert/red-badge paths don't fire and the row stays eligible for a later retrigger once the flag is re-enabled.

## Related

- [[integrations/unleash-flags]]
- [[domains/classification-ir35]]
- [[structure/api-routers-catalog]]

## Verify live

```bash
grep module.classification-engine packages/feature-flags/src/registry.ts
```

## Agent mistakes

- Adding flag keys only in Unleash UI without registry entry
- Using flags for domain config that belongs in Prisma
