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
  - RESOLVED in 87-05: the `us-determination-letter.test.tsx:5` breadcrumb was rewritten
    (kept the WHY, dropped `D-01 / D-05`). The `form-1099k-tracker.service.test.ts` one is
    still owned by the 1099-K tracker plan.

## From Plan 87-05 (Determination Letter)

- **Pre-existing `pnpm typecheck --filter=@contractor-ops/api` failures (11 errors)** — present on
  the merged base (`ad0383023`) before any 87-05 edits; in two files this plan never touched:
  - `packages/api/src/routers/compliance/classification-override.ts` (87-03): missing
    `@contractor-ops/classification` exports `resolveUsWorkState` / `withUsWorkState`, and the
    `Outcome` union resolves without the `US_CLASSIFICATION` member (stale classification build).
  - `packages/api/src/services/form-1099k-tracker.service.ts` (87-06): `tax.form_1099k_approaching`
    / `tax.form_1099k_over` not assignable to the notification-type union.

  87-05's own files are all typecheck-clean. Owner: the originating plans (87-03 / 87-06).

## From Plan 87-08 (US classification result + determination letter + 1099-K band UI)

- **i18n_review (ar):** the new `UsClassification.*` and `Form1099KTracker.*` Arabic strings in
  `apps/web-vite/messages/ar.json` are machine-assisted translations shipped at key parity. They are
  tagged here for native Arabic review per the standing i18n_review deferred item — the tax/legal
  wording (`§530`, `AB5`, `1099-K`, "settlor") should be confirmed by a native reviewer. `i18n:parity`
  is green; this is a review flag, not a parity gap.

- **Out-of-scope pre-existing web-vite test failures (observed, NOT fixed):** a full `vitest run` of
  the web-vite suite surfaced ~5 failing test files unrelated to this plan's scope (e.g.
  `src/components/integrations/__tests__/okta-provider-section.test.tsx`). They are outside the
  classification / tax-forms / 1099-K surface this plan touched and were present on the merged base.
  Not fixed here (scope boundary). The classification + classification-documents + contractors test
  dirs and the two new test files (`us-classification-result.test.tsx`, `form-1099k-band.test.tsx`)
  are all green.
