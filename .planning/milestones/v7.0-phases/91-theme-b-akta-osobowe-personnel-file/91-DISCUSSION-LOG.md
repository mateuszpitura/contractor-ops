# Phase 91: Theme B — Akta Osobowe / Personnel File - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 91-theme-b-akta-osobowe-personnel-file
**Areas discussed:** Section model + RBAC grain, Retention engine + clock, RODO erasure + holds, Upload classification

---

## Section Model

| Option | Description | Selected |
|--------|-------------|----------|
| Canonical A/B/C/D + label map | One internal 4-section enum; per-jurisdiction display labels + doc-type→section from seeded config | |
| Native per-jurisdiction sections | Each jurisdiction defines its own first-class section set; engines branch per country | |
| You decide | Planner picks; constraint = 4-section view + per-section RBAC must hold | ✓ |

**User's choice:** You decide (planner discretion).
**Notes:** Claude's lean recorded in CONTEXT D-01 = canonical enum + seeded per-jurisdiction registry (matches P90 country-fields idiom). Constraint locked: 4-section view + per-section RBAC.

---

## Section RBAC

| Option | Description | Selected |
|--------|-------------|----------|
| Per-section permission grain | New grain `employeeFile:read` × {A,B,C,D}; wire to P89 4 HR roles | ✓ |
| Resource-level + section attr filter | Keep resource-level `employee`; filter sections in app logic (weaker BFLA) | |
| You decide | Planner picks; constraint = per-section enforced + P89 fence intact | |

**User's choice:** Per-section permission grain.
**Notes:** Confirmed by scout as a genuine new build — RBAC is resource-level only today (finest grain = separate resources like `contractorPii`). Must enforce at permission layer, not app filter. Wire into hr_admin/hr_manager/payroll_officer/leave_approver without weakening BFLA fence.

---

## Retention Engine + Clock

| Option | Description | Selected |
|--------|-------------|----------|
| Per-rule anchor (event-typed) | Each rule declares HIRE/TERMINATION/DOCUMENT_DATE anchor; max() for US I-9; active = retained | ✓ |
| Termination-only anchor | All windows start at termination; simpler but loses I-9 hire branch + doc-date precision | |
| You decide | Planner picks; constraint = criterion-2 windows compute right + cited | |

**User's choice:** Per-rule anchor (event-typed) — for the clock.
**Notes:** Retention ENGINE location was not a real choice — scout found `packages/db/src/retention-policy.ts` shared map explicitly invites Phase 91 ("no parallel retention engines"); locked as carried (D-03/D-05: extend shared map + new per-jurisdiction rules registry in compliance-policy; soft-delete + scheduled-archive chokepoints). The clock anchor was the genuine open decision.

---

## RODO Erasure + Holds

| Option | Description | Selected |
|--------|-------------|----------|
| Per-section partial erasure | Erase sections past window; retain held sections + citation; per-section disposition list | |
| All-or-nothing w/ hold block | Any held section blocks whole erasure; over-retains erasable sections | |
| You decide | Planner picks; constraint = criterion-3 exactly (partial-honest, cited, no false "fully erased") | ✓ |

**User's choice:** You decide (planner discretion).
**Notes:** Claude's lean recorded in CONTEXT D-06 = per-section partial erasure. Scout: statutory-hold concept exists in gdpr.ts but only whole-org + whole-model grain → P91 extends to per-employee + per-section + per-jurisdiction (partial new build). Constraint locked: success criterion #3 verbatim.

---

## Upload Classification

| Option | Description | Selected |
|--------|-------------|----------|
| Taxonomy-first, admin fallback | Deterministic doc-type→section map; unmapped → PENDING_REVIEW admin step; no AI | |
| AI-vision classify + threshold | Claude Vision infers section; low-confidence → admin; killswitch-gated; new build | |
| Hybrid (taxonomy → AI fallback) | Map first; miss → AI vision; low-confidence → admin; best coverage, most surface | ✓ |

**User's choice:** Hybrid (taxonomy → AI fallback → admin).
**Notes:** Scout: no doc-category classifier exists today (OCR is invoice-only) → the AI section classifier is a new build extending ocr-extraction.ts. Admin step reuses existing PENDING_REVIEW status + portal upload-approval flow. AI path must gate on a kill-switch (ai-invoice-parser idiom). Planner sets threshold + killswitch key + seed taxonomy.

---

## Claude's Discretion

- Section model shape (D-01) — lean canonical enum + registry.
- Erasure resolution (D-06) — lean per-section partial.
- `PersonnelFile` model shape (FK to workerId vs relation on P90 EmployeeProfile); section/document join shape.
- AI classifier confidence threshold + killswitch registry key + per-jurisdiction doc-type→section seed taxonomy.
- Resource-per-section vs sub-resource/attribute layer for the per-section RBAC grain.
- Staff-side file-viewer composition (reuse of `components/documents/*`).

## Deferred Ideas

- Employee self-service personal akta view → P96 (EMP-PORTAL-02).
- Termination event source → P93 on/offboarding supplies the anchor; P91 consumes where present.
- Live government retention/registry lookups → seeded reference data only (local-only).
- Native per-jurisdiction section model → folded into D-01 discretion.
