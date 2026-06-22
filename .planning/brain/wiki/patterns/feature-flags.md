---
title: Feature flags
type: pattern
tags: [feature-flags, unleash]
source_commit: cbe299a91a59179244c0085ea8c65dbf40ab654c
verify_with:
  - packages/feature-flags/src/registry.ts
  - packages/feature-flags/README.md
  - packages/api/src/services/ocr-extraction.ts
  - packages/api/src/middleware/require-workforce-flag.ts
updated: 2026-06-22
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
| Workforce gate | `module.workforce-employees` — `middleware/require-workforce-flag.ts` (`assertWorkforceEnabled` / `isWorkforceRegistered`) + `root.ts` conditional-spread of `worker`/`employee`; mirrors `module.us-expansion`. See [[domains/worker-foundation]] |

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
