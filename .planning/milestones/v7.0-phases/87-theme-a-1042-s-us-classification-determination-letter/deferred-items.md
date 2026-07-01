# Phase 87 — Deferred Items

Out-of-scope discoveries logged during plan execution (not fixed — belong to other plans / owners).

## From Plan 87-04 (1042-S deterministic core)

- **`lint:no-breadcrumbs` decision-ID comments in sibling-plan RED scaffolds** — the
  `lint:no-breadcrumbs` CI gate flags decision-ID breadcrumbs in two scaffolds authored by
  Plan 87-01 that are outside Plan 87-04's file scope:
  - `packages/api/src/pdf-templates/__tests__/us-determination-letter.test.tsx:5` — `// ... the D-01 / D-05 contract ...`
  - `packages/api/src/services/__tests__/form-1099k-tracker.service.test.ts:5` — `// ... the D-10 / D-11 contract ...`

  These are owned by the determination-letter plan and the 1099-K tracker plan respectively.
  Plan 87-04 fixed only the breadcrumb in its own file (`form-1042s.service.test.ts`). The two
  above should be cleaned by their owning plans (keep the WHY, drop the decision ID).
