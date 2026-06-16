---
title: Classification IR35 and DRV
type: domain
tags: [classification, ir35, drv, germany]
source_commit: 79c1602848e9f0b2c5a6d3e1f4b7a9c0d2e6f813
verify_with:
  - packages/api/src/root.ts
  - packages/classification/
updated: 2026-06-16
---

# Classification (IR35 / DRV)

## Purpose

Engagement classification (IR35 UK, Scheinselbständigkeit DE), SDS PDFs, DRV clearance, economic dependency alerts, reassessment triggers — **flag-gated**.

## Flow

```mermaid
flowchart LR
  flag[module.classification-engine] --> routers[8 classification routers]
  routers --> assess[draft/submit/outcome]
  assess --> docs[SDS PDFs to R2]
```

## Entry points

| Namespace | Role |
|-----------|------|
| `classification` | assessments draft/autosave/submit |
| `classificationDashboard` | per-market health |
| `classificationDocument` | SDS + DRV bundles |
| `ir35Chain` | chain participants |
| `ir35Attestation` | other-client attestation |
| `economicDependencyAlert` | §2 SGB VI scan |
| `reassessmentTrigger` | material-change triggers |
| `statusfeststellungsverfahren` | DRV § 7a clearance |

Scoring: `packages/classification/`. Cron: [[structure/cron-jobs]].

## UI surface

`apps/web-vite/src/components/contractors/classification/`, `classification/`.

## Invariants

- [[patterns/feature-flags]] — `module.classification-engine`
- `classificationProcedure` middleware defense-in-depth
- When OFF: runtime `METHOD_NOT_FOUND`

## Related

- [[contractors-engagements]]
- [[structure/api-routers-catalog]]

## Verify live

```bash
grep CLASSIFICATION_ENABLED packages/api/src/root.ts
semble search "classificationProcedure"
```

## Agent mistakes

- Assuming classification API exists without flag check
- Citing 55 routers — verify root.ts (53 + 8 conditional)
