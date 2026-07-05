---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 09
subsystem: ui
tags: [web-vite, 1042-s, us-tax-forms, treaty-rate, i18n, tanstack-query, trpc, cross-phase-hold]

# Dependency graph
requires:
  - phase: 87-04
    provides: form1042s router (list + generateBatch) + Form1042S immutable/supersede model
  - phase: 87-07
    provides: 1042-S IRIS transmit tail (form-type-parameterized) — required by the HELD filing card
  - phase: 87-08
    provides: UsClassification + Form1099KTracker i18n namespaces (09 appends Tax1042SBatch to the same files)
provides:
  - Staff 1042-S batch review surface MOUNTED and reachable (page /tax-filing + route + flag-gated Finance nav)
  - Tax1042SBatch i18n namespace at en/de/pl/ar parity (en-US inherits en) + Navigation.taxFiling
  - Review-before-file + never-hard-block (30% statutory = amber advisory) + FTIN last-4 only, proven on the mounted surface
affects: [us-tax-forms, portal-1042s, 87-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin page (Suspense + flag gate + permission gate) → existing wired section → sole use-* hook; no *-container"
    - "Dark US surface gated in the UI by module.us-expansion (mirrors the router's per-request assertUsExpansionEnabled)"

key-files:
  created:
    - apps/web-vite/src/pages/dashboard/tax-filing.tsx
  modified:
    - apps/web-vite/src/router/dashboard-routes.tsx
    - apps/web-vite/src/lib/navigation.ts
    - apps/web-vite/messages/{en,de,pl,ar}.json
  pre-existing (recovered commit d6f12e2cd — Task 1 components, not rebuilt):
    - apps/web-vite/src/components/contractors/tax-filing/tax-1042s-batch-panel.tsx
    - apps/web-vite/src/components/contractors/tax-filing/tax-1042s-batch-summary.tsx
    - apps/web-vite/src/components/contractors/tax-filing/treaty-rate-caption.tsx
    - apps/web-vite/src/components/contractors/tax-filing/hooks/use-1042s-batch.ts

key-decisions:
  - "Task 1 components already existed on disk (recovered commit d6f12e2cd) and typechecked but were unmounted (no route/nav/i18n). This execution completes Task 1 by adding the Tax1042SBatch i18n namespace and mounting the surface — the components were NOT rebuilt."
  - "Mounted as a standalone Finance-group page /tax-filing (org-wide foreign-recipient list, not per-contractor) gated on module.us-expansion + contractor:read — matches the list procedure's permission and the router's dark-ship flag."
  - "i18n keys live at apps/web-vite/messages/*.json (real path); the plan's src/messages/ list was stale (same correction as Plan 08)."
  - "Only the Tax1042SBatch namespace landed. Tax1042SFiling + Tax1042SConsent are deferred WITH the Tasks 2-3 cross-phase HOLD — authoring them now would mean guessing key names for components that do not exist, risking drift against the real P86-reused components when they land."

requirements-completed: [US-FORM-06 (UI, Task 1 only — Tasks 2-3 HOLD)]

# Metrics
completed: 2026-07-05
---

# Phase 87 Plan 09: Staff 1042-S filing surface + portal recipient PDF Summary

**Task 1 (staff 1042-S batch review) is COMPLETE and now MOUNTED: the recovered wired panel + summary + treaty-rate caption + hook are reachable via a new flag-gated `/tax-filing` page, and the `Tax1042SBatch` i18n namespace landed at en/de/pl/ar parity. Tasks 2-3 (the P86-reusing filing card + portal consent-gated download) are a recorded CROSS-PHASE HOLD — the P86 UI seam is not on disk and is reused-not-rebuilt.**

## Cross-phase HOLD (Tasks 2-3) — the load-bearing outcome

Plan 09 Tasks 2-3 reuse the P86 `tax-1099-*` filing seam VERBATIM (never rebuilt). At execution time **none** of the required P86 components are on disk (verified: 0 matches each for `iris-status-pill`, `ack-upload-field`, `step-edelivery-consent`, `use-edelivery-consent`, `copy-b-download`, `use-iris-filing`, `tax-1099-batch-panel`, `correction-dialog`). Per the plan's blocking-soft gate, both P86-dependent surfaces HOLD:

- **Task 2 — `tax-1042s-filing-card.tsx` + `use-1042s-filing.ts`:** HELD. Reuses P86 `iris-status-pill` + `ack-upload-field` over the same 6 IRIS ack states; not built. When P86 lands the pill + ack-upload, the filing card reuses them verbatim (download validated XML / upload ack / supersede correction) and completes.
- **Task 3 — `copy-1042s-download.tsx` (portal):** HELD. Reuses the SAME P86 `step-edelivery-consent` + `use-edelivery-consent` + `copy-b-download` consent gate; not built. The consent step is NEVER rebuilt for a second form type — it lands once P86 is on disk.
- **Task 3 i18n sub-step (`Tax1042SFiling` / `Tax1042SConsent`):** deferred with the HOLD. Only `Tax1042SBatch` (the mounted surface) landed; the filing/consent namespaces are authored alongside their consuming components when P86 lands, so the key structure matches the real reused components rather than being guessed now.

Task 1 ships independently of the P86 seam (it reuses only the generic 4-state idiom + the Plan 04/07 `form1042s` router), exactly as the plan's conditional-delivery clause specifies.

## Accomplishments (Task 1 — GREEN)

- **Mounted the surface.** New thin page `pages/dashboard/tax-filing.tsx` (Suspense + `module.us-expansion` flag gate + `contractor:read` permission gate → `<Navigate to unauthorized>`), composing the existing wired `Tax1042SBatchPanel` via `AnimateIn` + `WorkbenchPageHeader`. No `*-container.tsx` (per ARCHITECTURE.md — the wired panel is the container-equivalent and already calls `useForm1042sBatch`).
- **Route + nav.** Registered `{ path: 'tax-filing' }` in `dashboard-routes.tsx` (lazy) and a flag-gated Finance nav entry (`Landmark` icon, `contractor:read`, `flag: 'module.us-expansion'`) in `navigation.ts` — the dark US surface only appears when the flag is on, mirroring the router's per-request `assertUsExpansionEnabled`. The page-header icon auto-resolves from the new nav entry.
- **i18n.** Added the `Tax1042SBatch` namespace (page title/description, batch heading, generate/regenerate CTAs, 4-state copy, `columns.*`, `summary.*`, `treaty.*`) + `Navigation.taxFiling` across en/de/pl/ar at parity; en-US inherits en (no US-divergent copy). de/pl/ar are machine-translated, tagged for native review (deferred-items.md).
- **Invariants proven on the mounted surface.** Review-before-file (Generate produces a reviewable summary; filing is separate/HELD). Never-hard-block: the 30% statutory branch renders an amber `warning` caption (`treaty-rate-caption.tsx`, `data-basis="statutory"`), never a disabled/blocked filing control. FTIN is last-4 only via the gated `SsnMaskedReveal`; the full foreign TIN never reaches the DOM (the hook selects `ssnLast4` only; the full reveal is a separate `contractorPii:read` procedure).

## Task Commits

1. **Task 1 components (recovered, pre-existing)** — `d6f12e2cd` (feat, prior) — wired panel + summary + treaty caption + `use-1042s-batch` hook.
2. **Task 1 mount + Tax1042SBatch i18n** — `b42ccee34` (feat) — page `/tax-filing` + route + flag-gated nav + i18n namespace across en/de/pl/ar.

## Deviations from Plan

- **Task 1 components pre-existed (recovered commit).** The plan authors them; they were already on disk and typechecking (recovered `d6f12e2cd`). This execution did NOT rebuild them — it completed Task 1 by adding the missing i18n and mounting the (previously unreachable) surface. This is the "mount the orphaned UI" completion, analogous to the Plan-08 correction that these namespaces were deferred to 09.
- **Tasks 2-3 HELD (cross-phase), not executed.** See the HOLD section above — the blocking-soft gate fired because the P86 seam is absent. No P86 component was rebuilt.
- **i18n scope narrowed to Tax1042SBatch.** `Tax1042SFiling` / `Tax1042SConsent` deferred with the HOLD (rationale: avoid guessing key names for non-existent components).

## Verification

- `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/web-vite` (turbo, deps built) — 17/17 tasks green.
- `check:web-vite-data-layer` / `check:web-vite-page-shells` / `check:web-vite-presentational` / `check:web-vite-dialog-pattern` — OK.
- `pnpm i18n:parity` — OK (en covered in de/pl/ar; en-US fallback-aware).
- All five message files valid JSON; `Tax1042SBatch` present in en/de/pl/ar.
- Grep invariant: the 30% statutory branch is amber `warning` (`treaty-rate-caption.tsx`), no disabled/blocked filing control on the statutory path; the batch hook selects `ssnLast4` only.

## User Setup Required

None. The surface stays dark behind `module.us-expansion` (server + UI gated); enabling the flag for an org surfaces the `/tax-filing` nav entry and page.

## Next Phase Readiness

- **Blocked (cross-phase):** Tasks 2-3 (filing card + portal consent download) + their `Tax1042SFiling`/`Tax1042SConsent` i18n resume once the P86 `iris-status-pill` / `ack-upload-field` / `step-edelivery-consent` / `use-edelivery-consent` / `copy-b-download` land — reused verbatim, never rebuilt.
- Plan 10 (wiki) can proceed — it documents the shipped Task 1 surface + records the Tasks 2-3 HOLD.
- `ar`/`de`/`pl` strings tagged for native review (deferred-items.md); does not block.

## Self-Check: PASSED

- `pages/dashboard/tax-filing.tsx` present; route + nav + i18n verified in the mount commit `b42ccee34`.
- P86 seam absence verified (0 matches for all 8 components) → Tasks 2-3 HOLD is correct, not a skipped build.

---
*Phase: 87-theme-a-1042-s-us-classification-determination-letter*
*Completed: 2026-07-05*
