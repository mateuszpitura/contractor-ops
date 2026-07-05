# Plan 93-06 Summary — Statutory cert PDFs (render → snapshot → R2 CAS)

**Wave:** 2 · **Status:** complete

## What shipped

- **Locked adviser-verify disclaimers** (`validators/src/legal/disclaimers.ts`): `CERT_ADVISER_VERIFY_EN/DE/PL` — each states the document is a DRAFT, not adviser-verified, and not legal/tax advice. Registered in BOTH `RESERVED_DISCLAIMER_KEYS` and `LOCKED_DISCLAIMERS`, added a PENDING entry per key to `signoff-registry.json`, and exported from the validators barrel. The locked-phrases-guard now enforces their absence from `messages/*.json`.
- **`statutory-cert-pdf.ts` service** (mirrors `form-1099-nec-pdf.ts`): `renderStatutoryCert(snapshot)` sanitizes the snapshot (recursive strip of full national-ID keys — pesel/ssn/nino/steuerId/iqama/emiratesId — keeping `*Last4` only), lazily imports `@react-pdf/renderer` + the per-cert template, and renders. `renderAndArchiveStatutoryCert(db, certId)` claims the archive slot via a CAS `updateMany({ where: { id, pdfArchiveKey: null } })` (skip on count 0 or an already-set key), then uploads to the org-scoped R2 key `emp-cert/<orgId>/<certId>.pdf`.
- **6 react-pdf templates** on a shared `statutory-cert-shell.tsx` (DRAFT band on every page + fixed adviser-verify footer, stable `renderedAt`, reads only from the immutable snapshot): PL świadectwo pracy + PIT-11, DE simple Arbeitszeugnis + Lohnsteuerbescheinigung, UK P45, US W-2. Each imports the jurisdiction-appropriate `CERT_ADVISER_VERIFY_*`.

## Verification

- `pnpm -F @contractor-ops/api test statutory-cert-pdf employee-lifecycle-cross-org` → **GREEN** (8/8: snapshot `*Last4`-only, CAS skip on count 0 + already-archived, disclaimer embedded, org-scoped `emp-cert/` key, cross-org isolation).
- `pnpm -F @contractor-ops/validators test locked-phrases` → **GREEN** (102/102; disclaimers absent from messages + registered PENDING).
- `pnpm typecheck --filter=@contractor-ops/validators` + `--filter=@contractor-ops/api` → green.

## v7.5 deferrals

Qualified (free-text) Arbeitszeugnis, P11D, COBRA packet, and 401(k) packet PDFs are deferred — those steps remain manual (per Plan 05 seed content).
