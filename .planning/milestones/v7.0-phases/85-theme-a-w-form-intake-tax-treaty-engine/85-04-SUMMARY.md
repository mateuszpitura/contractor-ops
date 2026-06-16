---
phase: 85-theme-a-w-form-intake-tax-treaty-engine
plan: 04
subsystem: web-vite
tags: [w-form, w-9, w-8ben, portal-wizard, esign, treaty, i18n, rtl, staff-status, wcag, ui]

# Dependency graph
requires:
  - phase: 85-03
    provides: "Portal procedures (getTaxFormDetermination/saveTaxFormDraft/submitTaxForm/getMyTaxForms) + staff taxForm.listFormSubmissions/requestTaxForm; tax-form.service; module.us-expansion gate"
  - phase: 85-02
    provides: "taxFormSubmissionSchema (discriminated union, no full-SSN field), determineFormType, applyTreaty"
provides:
  - "Portal W-9/W-8BEN/W-8BEN-E self-cert wizard (determination → form → attestation → receipt) on route portal/tax-form — page→container→hook→component, treaty auto-populate announced via aria-live, four states + RTL"
  - "Attestation gate: real <input type=checkbox> perjury + typed legal-name match + legal-signature affirmation gates Sign & submit; submit-failure role=alert region preserves data"
  - "Staff tax-form status card — UspsAddressStatusPill idiom (ACTIVE/DRAFT/SUPERSEDED/expiring) + SsnMaskedReveal verbatim (PII-gated)"
  - "TaxFormWizard/TaxFormStaff i18n namespaces across en/de/pl/ar (en-US via fallback)"
  - "Documentation-follows-code: new domains/us-tax-forms.md + structure pages + hot/log + MEMORY invariant"
affects: ["Phase 86 (1099-NEC consumes the W-9 record)", "Phase 87 (1042-S consumes the W-8 treaty claim)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wizard as page→container→hook→component: the hook is the sole tRPC/RHF boundary; container owns Stepper + loading/empty/error; steps are presentational"
    - "Discriminated-union RHF: a useEffect syncs the formType discriminant so the zodResolver picks the W-9/W-8BEN/W-8BEN-E variant even without a manual override"
    - "ESIGN attestation gate: real native checkboxes + typed-name-match + affirmation as intentional friction (not a delete dialog); server still re-derives identity/timestamp"
    - "Advisory status pill via the UspsAddressStatusPill VARIANT_MAP idiom; gated PII via SsnMaskedReveal verbatim (control absent without contractorPii:read)"
    - "Locale-leak guard in tests: reset applyLocale('en') in afterEach so an ar render never poisons later English assertions"

key-files:
  created:
    - "apps/web-vite/src/components/portal/tax-forms/hooks/use-tax-form-wizard.ts"
    - "apps/web-vite/src/components/portal/tax-forms/tax-form-wizard.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/step-determination.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/step-w9.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/step-w8ben.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/step-w8ben-e.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/step-attest.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/step-receipt.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/step-types.ts"
    - "apps/web-vite/src/components/portal/tax-forms/treaty-claim-caption.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/w8-foreign-fields.tsx"
    - "apps/web-vite/src/components/portal/tax-forms/__tests__/tax-form-wizard.test.tsx"
    - "apps/web-vite/src/components/contractors/tax-forms/tax-form-status-card.tsx"
    - "apps/web-vite/src/components/contractors/tax-forms/hooks/use-tax-form-status.ts"
    - "apps/web-vite/src/pages/portal/tax-form-page.tsx"
    - ".planning/brain/wiki/domains/us-tax-forms.md"
  modified:
    - "apps/web-vite/src/router/portal-routes.tsx (route portal/tax-form)"
    - "apps/web-vite/messages/{en,de,pl,ar}.json (TaxFormWizard + TaxFormStaff namespaces)"
    - ".planning/brain/wiki/structure/{web-vite-domains,prisma-schema-areas,packages}.md"
    - ".planning/brain/wiki/domains/contractors-engagements.md"
    - ".planning/brain/wiki/{hot,log}.md"
    - ".planning/MEMORY.md"

key-decisions:
  - "i18n message files were committed in Task 1 (not Task 3 as the plan grouped them) because Tasks 1-2 component tests assert on rendered en strings — the keys had to exist for those commits to be green. Task 3 kept the wiki + MEMORY documentation-follows-code work."
  - "step-attest + step-receipt were created in Task 1's commit (not Task 2) because the container imports them — splitting them out would have left Task 1 non-compiling. The substantive attestation-gate logic + tests landed in Task 2."
  - "Native <input type=checkbox> for the perjury items (not the shadcn Checkbox, which is a Base-UI div) — the threat model + acceptance grep require real checkboxes for a genuine affirmative attestation act."
  - "A useEffect syncs the RHF formType discriminant from the resolved determination so the discriminated-union resolver works even when the contractor never touches the override Select."

requirements-completed: [US-FORM-01, US-FORM-02, US-LOC-02, US-LOC-03]

# Metrics
duration: ~26min
completed: 2026-06-16
---

# Phase 85 Plan 04: Portal W-Form Wizard + Staff Status Card + i18n Summary

**The contractor-facing surface that makes the US W-form intake real: a portal-primary W-9/W-8BEN/W-8BEN-E self-certification wizard (determination → form → attestation → receipt) with the treaty article/rate auto-populated and announced via `aria-live`, an ESIGN attestation gate (real perjury checkboxes + typed legal-name match + signature affirmation), a PII-safe staff read/track status card, full en/de/pl/ar + RTL parity, and the documentation-follows-code wiki/MEMORY updates — all on the established page→container→hook→component layering.**

## Performance

- **Duration:** ~26 min
- **Completed:** 2026-06-16T20:10:54Z
- **Tasks:** 3
- **Files:** 16 created + 12 modified (incl. 4 message files + 7 wiki pages + MEMORY)

## Accomplishments

- **Portal wizard** (`components/portal/tax-forms/`): `use-tax-form-wizard.ts` is the SOLE tRPC/RHF boundary — it reads `portal.getTaxFormDetermination` (routing + treaty prefill), drives the `taxFormSubmissionSchema` zodResolver, owns multi-step state, and submits via `portal.submitTaxForm`. `tax-form-wizard.tsx` (container) owns the reui Stepper + `AnimateIn` + the loading skeleton / load-error+reload / determination-render states and dispatches to the presentational steps. Determination (confirm/override), W-9, W-8BEN, W-8BEN-E, attestation, and receipt steps are props-in/JSX-out; the W-8 steps auto-populate the treaty article/rate from the determination and announce it via `aria-live="polite"`.
- **Attestation gate** (`step-attest.tsx`): real `<input type="checkbox">` perjury certifications (verbatim IRS domain strings per form) + a typed legal-name field whose value must match the on-file legal name (Label-in-Name) + an explicit "I understand this is a legal signature" affirmation. `Sign & submit` is disabled until all three are satisfied. A submit failure renders an inline `role="alert" aria-live="polite"` region and preserves the entered data (the wizard is never wiped). On success the lightweight receipt renders with the signed date.
- **Staff status card** (`contractors/tax-forms/tax-form-status-card.tsx` + `hooks/use-tax-form-status.ts`): reads `taxForm.listFormSubmissions` (status/treaty/expiry only); the status pill maps ACTIVE→success, DRAFT→info, SUPERSEDED→secondary, expiring/expired→warning via a `UspsAddressStatusPill`-style VARIANT_MAP; the full SSN stays behind `SsnMaskedReveal` reused **verbatim** (control ABSENT without `contractorPii:read`); the adviser-deferred note is `text-muted-foreground` + info icon, never destructive.
- **i18n**: `TaxFormWizard` + `TaxFormStaff` namespaces added to en/de/pl/ar at exact parity (en-US inherits via fallback); `pnpm i18n:parity` green.
- **Documentation-follows-code**: NEW `domains/us-tax-forms.md` (Purpose/Flow/Entry points/UI surface/Invariants/Agent mistakes); `web-vite-domains.md`, `prisma-schema-areas.md`, `packages.md`, `contractors-engagements.md` updated; `hot.md` overwritten; `log.md` Wave-4 entry; MEMORY invariant appended; contextual-prefix + BM25 rebuilt.

## Task Commits

1. **Task 1: Wizard hook + container + determination/W-9/W-8 steps + page + i18n** — `3a3a3c9ee` (feat)
2. **Task 2: Attestation gate + receipt + staff status card + component tests** — `c89762ffe` (feat)
3. **Task 3: i18n parity verified + documentation-follows-code (wiki + MEMORY)** — `3ce9c44eb` (docs)

_(`step-attest.tsx` + `step-receipt.tsx` landed in Task 1's commit because the container imports them; the substantive attestation logic + the 12-assertion test landed in Task 2. The i18n message files landed in Task 1 because the Task 1-2 tests assert on rendered en strings.)_

## Verification

| Gate | Result |
|------|--------|
| `pnpm --filter @contractor-ops/web-vite test src/components/portal/tax-forms` | 12/12 GREEN (4 states + RTL, attestation gate, submit-failure preserves data, receipt, staff pill mapping + PII gating) |
| `pnpm check:web-vite-data-layer` | OK — only `use-tax-form-wizard.ts` / `use-tax-form-status.ts` touch tRPC |
| `pnpm i18n:parity` | OK — TaxFormWizard/TaxFormStaff at en/de/pl/ar parity |
| `pnpm typecheck --filter @contractor-ops/web-vite` | 16/16 successful |
| `pnpm lint:no-breadcrumbs` | OK |
| `pnpm check:wiki-brain` (my drift) | Resolved — no tax-form drift; only pre-existing branch drift remains (see Deferred) |
| grep gates | 0 physical RTL props, 0 `font-medium`, 3 real `type="checkbox"` in step-attest, `SsnMaskedReveal` reused verbatim, no stray `bg-primary`/`text-primary` |

## Decisions Made

- **i18n + the two referenced step files landed earlier than the plan's task grouping** to keep every commit independently green/compiling (the container imports `step-attest`/`step-receipt`; the Task 1-2 tests assert on rendered en strings). No scope change — every artifact the plan lists exists; Task 3 owns the wiki/MEMORY work.
- **Native checkboxes, not the shadcn `Checkbox`.** The repo's `Checkbox` is a Base-UI div-based control; the threat model (T-85-04-02) and the acceptance grep require real `<input type="checkbox">` for a genuine affirmative attestation. The W-9 `backupWithholding` flag still uses the shadcn Checkbox (it is a data field, not an attestation).
- **`formType` discriminant synced via `useEffect`.** The discriminated-union resolver needs `formType` set even when the contractor never touches the override Select; an effect mirrors the resolved determination into RHF.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Discriminated-union submit silently blocked**
- **Found during:** Task 2 (the submit-success/failure tests never fired `onValid`)
- **Issue:** The RHF `formType` discriminant was only written when the contractor changed the determination Select; on the default path it was never set, so `zodResolver(taxFormSubmissionSchema)` could not resolve a variant and blocked submit with no surfaced error.
- **Fix:** Added a `useEffect` that syncs `formType` (and a `backupWithholding: false` default) into the form whenever the resolved determination is known.
- **Files modified:** `hooks/use-tax-form-wizard.ts`
- **Committed in:** `3a3a3c9ee` / verified in `c89762ffe`

**2. [Rule 1 - Bug] Locale leak across component tests**
- **Found during:** Task 1-2 (the RTL test's `applyLocale('ar')` poisoned later English assertions because i18next is a shared instance)
- **Fix:** Reset `applyLocale('en')` in `afterEach`; rewrote the RTL assertion to `findByText` an Arabic string (matching the `demo-banner` convention) + assert the logical `rtl:rotate-180` arrow.
- **Files modified:** `__tests__/tax-form-wizard.test.tsx`
- **Committed in:** `c89762ffe`

**3. [Rule 3 - Blocking] Doc-drift on the new staff hook**
- **Found during:** Task 3 (`check:wiki-brain` flagged `use-tax-form-status.ts` under `contractors-engagements.md`'s `verify_with`)
- **Fix:** Updated `contractors-engagements.md` + the mandated structure pages + the new domain page in the same change set; bumped `source_commit` on touched frontmatter.
- **Files modified:** 7 wiki pages + MEMORY
- **Committed in:** `3ce9c44eb`

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking). No architectural changes; no scope creep.

## Threat Model Mitigations Honored

| Threat ID | Mitigation |
|-----------|------------|
| T-85-04-01 (full SSN in staff DOM) | `SsnMaskedReveal` reused verbatim — control ABSENT without `contractorPii:read`; no full SSN in props; test asserts the reveal control is absent without the flag. |
| T-85-04-02 (premature signature) | Attestation gate disables `Sign & submit` until all perjury checkboxes + a matching typed legal name + the legal-signature affirmation; server re-derives ip/ts/identity (Plan 03). Test proves the gate. |
| T-85-04-03 (silent re-cert replace) | Append-only on the server (Plan 03); the UI never hard-deletes — re-cert supersedes. (Inline re-cert AlertDialog copy is available for an existing-ACTIVE form path.) |
| T-85-04-04 (client-trusted determination) | accept — the wizard only displays the server-resolved determination/treaty claim; resolution + persistence are server-side. |
| T-85-04-SC (package installs) | accept — ZERO package or registry installs this plan. |

## Known Stubs

None. The wizard wires real portal procedures; the staff card wires the real `taxForm` namespace. No empty/mock data flows to a rendered surface. The submission receipt is the lightweight human-readable summary explicitly permitted by the phase (the pixel-accurate IRS PDF is deferred to the filing phase).

## Deferred Issues

- **Pre-existing branch doc-drift (out of scope).** `check:wiki-brain` still reports 6 drift errors for source files changed by EARLIER unstaged branch work — `routers/integrations/{jira,linear,teams}.ts`, `routers/core/contractor-core.ts`, `packages/api/src/errors.ts`, `packages/validators/src/legal/de.d.ts.map`. None is in any 85-04 commit; all the drift 85-04 *caused* (the tax-form wizard/hook/card files) is resolved in the same change set. Consistent with the 85-03 SUMMARY's same finding — only NEW drift vs the branch base retro-bricks; these predate the plan and belong to the unrelated working-tree changes.
- **`re-cert AlertDialog` for an existing-ACTIVE form** — the copy is contracted in the UI-SPEC and the server is append-only; wiring the dialog onto a "you already have an ACTIVE {formName}" path can layer on when the expiry/re-cert reminder surface lands (itself a deferred phase concern per 85-CONTEXT D-05).

## Self-Check: PASSED

- All 16 created files + the modified router/messages/wiki/MEMORY present on disk.
- All 3 plan commits in `git log` (`3a3a3c9ee`, `c89762ffe`, `3ce9c44eb`).
- 12 scoped component tests GREEN; data-layer + i18n:parity + typecheck + no-breadcrumbs GREEN; my wiki drift resolved.

---
*Phase: 85-theme-a-w-form-intake-tax-treaty-engine*
*Completed: 2026-06-16*
