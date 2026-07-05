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

## From Plan 87-09 Tasks 2-3 (1042-S filing card + portal consent-gated download — HOLD resolved)

- **i18n_review (de/pl/ar):** the new `Tax1042SFiling.*` and `Tax1042SConsent.*` German, Polish, and
  Arabic strings in `apps/web-vite/messages/{de,pl,ar}.json` are machine-assisted translations shipped
  at key parity (en canonical; en-US inherits en). Tagged for native review per the standing
  i18n_review item — the tax wording ("acknowledgement", "supersede", "electronic delivery", "FTIN",
  "Copy B") should be confirmed by a native reviewer. `i18n:parity` is green; this is a review flag,
  not a parity gap.

- **1042-S XSD-validated transmit deferred (human enablement):** the transmit tail is built and wired,
  but the ManualDownload path returns `BUNDLE_UNAVAILABLE` (non-throwing) until the human IRS Pub 1187
  XSD bundle is placed under `packages/iris/src/schema-bundle/` and checksum-pinned (see
  `.planning/EXTERNAL-ENABLEMENT.md` #2). No fabricated XSD; the code is complete and correct-by-
  construction. Gated behind `module.us-expansion` + bundle presence.

- **`IrisSubmission` form-type discriminator (accepted, no migration):** a 1042-S submission is
  distinguished from a 1099 one on the shared `IrisSubmission`/`IrisAck` ledger by the Pub 1187
  `schemaVersionNum` (plus the download-threaded `submissionId`), not a dedicated `formType` column —
  a deliberate zero-migration choice given the shared-worktree blast radius and the dark/pre-enablement
  state (no 1042-S submission rows exist until the XSD lands). A `formType` column is a clean future
  follow-up if an org ever files both forms for the same year under a coinciding schema version.

- **Out-of-scope pre-existing api test failures (observed, NOT fixed):** a full `vitest run` of the
  `@contractor-ops/api` suite surfaced 4 failing files unrelated to this plan (`errors-i18n-parity`
  `Errors.paymentSettlementRateUnavailable` missing; `scope-utils` / `api-key-auth` public-API scopes;
  `exports` determination-letter registry count) — all present on the merged base, outside the 1042-S
  surface. The scoped `form-1042s*` + `iris-ack` tests are green (27/27).
