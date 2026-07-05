---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 07
subsystem: web-vite
tags: [ui, 1099-nec, iris, portal-consent, i18n, rtl, wcag, us-expansion]
requirements-completed: [US-FORM-04, US-FORM-05, US-FORM-07]
completed: 2026-07-05
autonomous: false
checkpoint: visual-verification-deferred-to-us-enablement
---

# Phase 86 Plan 07: Year-end-loop UI (staff tax-filing + portal consent)

**Built the full staff `tax-filing/` surface (1099-NEC batch panel, IRIS filing
card with a 6-status pill, TIN-mismatch amber-advisory list, correction dialog,
per-state output) and the portal IRS electronic-delivery consent step gating the
Copy-B download — strictly web-vite layered (hook = sole tRPC boundary → wired
4-state section → presentational), full i18n parity (en/en-US/de/pl/ar RTL), and
WCAG. The human visual-QA gate is recorded deferred to US-enablement (the surface
is dark behind `module.us-expansion`).**

## What was built

### Staff `contractors/tax-filing/` (11 files)
- **Hooks (sole tRPC boundary):** `use-1099-batch` (`useTax1099Batch` — list +
  generate), `use-iris-filing` (build/validate query + download / upload-ack /
  file-correction mutations + on-demand per-state output), `use-tin-mismatches`
  (list + escalate/resolve).
- **Wired 4-state sections** (loading `aria-busy`/`aria-live` → `role="alert"` +
  Reload → empty `py-12` → loaded), no `*-container.tsx`, no direct tRPC:
  `tax-1099-batch-panel` (review-before-file; Generate never files),
  `tax-1099-filing-card` (6-status pill, ManualDownload only when the XML
  validates, ack upload, per-recipient correction, per-state output;
  `BUNDLE_UNAVAILABLE` renders as a muted pending state, never an error),
  `tin-mismatch-list` (**amber `warning` only — zero `destructive`; no control
  blocks generation**).
- **Presentational:** `batch-summary` (font-mono amounts + threshold counts),
  `iris-status-pill` (the 6 IRIS statuses + VALID/INVALID/BUNDLE_UNAVAILABLE with
  the status colour map — Rejected/INVALID the only red), `ack-upload-field`
  (native `<input type=file>` + Label; parsing happens server-side),
  `correction-dialog` (DialogBody scroll + sticky DialogFooter; supersede-confirm
  copy), `state-filing-output` (CFSF-handled indicator vs per-state CSV download).

### Portal `portal/tax-forms/` (3 files)
- `use-edelivery-consent` (sole portal tRPC boundary; consent ip/actorId/timestamp
  100% server-derived — the mutation inputs are empty).
- `step-edelivery-consent` — a REAL native `<input type="checkbox">` (unchecked by
  default) with the Pub 1179 §4.6 consent language; the affirm button is disabled
  until checked.
- `copy-b-download` — with consent → the Copy-B download + withdraw (explicit
  confirm); without consent → the paper-copy message and NO download offered. TIN
  shown last-4 only (masked; a full TIN never reaches the DOM).

### i18n (5 locales)
- Added the four namespaces `Tax1099Batch` / `Tax1099Filing` / `TinMismatch` /
  `Tax1099Consent` to en / de / pl / ar at full parity + thin en-US overrides,
  using the UI-SPEC Copywriting Contract as the canonical en source. de/pl/ar are
  machine-translated (flagged for native review — standing deferral).

## Verification
- `pnpm i18n:parity` — OK (no new drift).
- `check:web-vite-data-layer` / `-presentational` / `-dialog-pattern` /
  `-page-shells` / `check:rtl-logical-props` — all OK.
- `pnpm --filter @contractor-ops/web-vite typecheck` — green (after the standard
  `@contractor-ops/ui` build + `pnpm i18n:types` codegen).
- `pnpm exec biome check` on the new files — 0 errors (19 nursery warnings:
  inline-handler / cognitive-complexity, consistent with the existing wired-section
  pattern). `lint:no-breadcrumbs` + `lint:i18n-casts` — OK.

## Checkpoint (Task 3 — human visual-verify) — deferred, authorized
Per the phase operating model, the surface was built through the visual-QA gate
under the flag-defer model. Human eyeball confirmation of the status-pill colours,
the amber-advisory mismatch, the consent gate, and ar RTL is **deferred to
US-enablement** (recorded in `deferred-items.md`), consistent with the standing
de/pl/ar native-review deferral. Nothing ships unverified — the whole surface is
dark behind `module.us-expansion`.

## Deferred / follow-up
- **Route mounting:** the components are complete and typecheck-clean but are not
  yet mounted on a route/page (mirrors P87, where the 1042-S surface was mounted
  in a separate plan). Mounting behind the `module.us-expansion` gate is a
  follow-up wiring step.
- Human visual QA + de/pl/ar native review at US-enablement.
