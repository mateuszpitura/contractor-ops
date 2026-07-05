---
phase: 94-theme-b-payroll-integration-adapters
plan: 10
subsystem: payroll-docs-follow-code
tags: [wiki, docs, external-enablement, memory, bm25]
requirements: [PAYROLL-PL-01, PAYROLL-PL-02, PAYROLL-PL-03, PAYROLL-DE-01, PAYROLL-DE-02, PAYROLL-UK-01, PAYROLL-US-01]
dependency_graph:
  requires:
    - "94-09 (the shipped package + feed + router + UI to document)"
  provides:
    - "domains/payroll-export.md + packages/key-services/api-routers-catalog/feature-flags/web-vite-domains updates"
    - "MEMORY invariants + log/hot refresh + rebuilt BM25 index"
  affects: []
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - ".planning/brain/wiki/domains/payroll-export.md"
  modified:
    - ".planning/brain/wiki/structure/{packages,key-services,api-routers-catalog,web-vite-domains}.md"
    - ".planning/brain/wiki/patterns/feature-flags.md"
    - ".planning/brain/wiki/{log,hot}.md"
    - ".planning/MEMORY.md"
decisions:
  - "EXTERNAL-ENABLEMENT rows 11-15 (Gusto/QuickBooks/ADP-native/DATEVconnect/RTI-XSD) already present from the phase-plan commit — verified, not duplicated"
  - "check:wiki-brain requires the (gitignored) BM25 index locally — rebuilt via the sanctioned contextual-prefix + bm25 pipeline; graph rebuild left to the husky post-commit hook (WARN-only)"
metrics:
  tasks_completed: 3
  files_changed: 9
  completed_date: "2026-07-05"
---

# 94-10 Summary — documentation follows code

Closed the docs-follow-code loop for Phase 94 in the same change set as the code.

## Shipped
- **New `domains/payroll-export.md`** — Purpose, Flow, the 10-target table, Entry points,
  UI surface, and an "Agent mistakes" section (terminatedAt on PersonnelFile; don't overload
  payment-export; profiles pure over PayrollFeed; last-4 PII; native paths flag-deferred),
  with `verify_with` pointing at the real profile/registry/engine/feed/router/adapter files.
- **Structure/pattern pages** — `packages.md` (`@contractor-ops/payroll` row), `key-services.md`
  (payroll-feed + register-payroll-profiles section), `api-routers-catalog.md` (`payrollExport`
  namespace; workforce count 6→8), `feature-flags.md` (the 9 `payroll.*` gates incl. the new
  `payroll.sage-de`), `web-vite-domains.md` (`payroll/` folder row).
- **MEMORY** — three Phase-94 invariants (payroll = einvoice clone not payment-export factory;
  feed = 3-model join with anchors on PersonnelFile + last-4 PII; file-export floor with
  flag-deferred native/strict paths). `log.md` appended; `hot.md` discovery block prepended.
- **EXTERNAL-ENABLEMENT** rows 11-15 (Gusto/QuickBooks/ADP-native/DATEVconnect/RTI-XSD) verified
  already present (each with a buildable-now fallback).

## Verification
- `pnpm check:wiki-brain` — 0 errors (the multi-source_commit WARN is pre-existing/normal).
- BM25 index rebuilt (264 docs) via the contextual-prefix + bm25 pipeline; `.vault-meta` is
  gitignored. The graphify graph rebuild is handled by the `.husky/post-commit` hook.
