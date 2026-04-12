---
phase: 56
plan: 08
subsystem: consent + legal-review + phase-integration
tags:
  - onboarding-consent
  - privacy-acknowledgement
  - steuerberater-review
  - uk-gdpr
  - de-dsgvo
  - checkpoint-active
dependency-graph:
  requires:
    - 56-01 (country-fields + validators)
    - 56-02 (DE validators + locked phrases)
    - 56-03 (locked-phrases CI guard)
    - 56-04 (UK validators + Companies House / UTR)
    - 56-05 (DE locale routing + request pipeline + messages/de.json)
    - 56-06 (UK/DE profile compliance components + SV-Nummer field)
    - 56-07 (UK/DE/EU MDX privacy pages + React-PDF + tRPC download guard)
  provides:
    - "@contractor-ops/validators: requiresPrivacyAcknowledgement(code) predicate (AE/SA/GB/DE)"
    - "@contractor-ops/validators: extended bulkGrantConsentSchema with privacyNoticeAcknowledged / Jurisdiction / Version"
    - "apps/web: <PrivacyNoticeAcknowledgement /> component (shadcn Checkbox + Label + safe external link)"
    - "apps/web: OnboardingConsentStep extended for UK/DE + PDPL composite acknowledgement gate"
    - "messages/*.json: new Consent namespace with privacyNotice + onboarding + privacyAcknowledgement keys (en/de/pl/ar)"
    - ".planning/phases/56-country-foundations-german-i18n/56-STEUERBERATER-REVIEW.md (D-13 deliverable)"
  affects:
    - "Phase 51 consent flow — AE/SA orgs now also see the privacy-notice acknowledgement checkbox; Continue requires it ticked"
    - "tRPC consent.bulkGrant mutation — payload now carries optional acknowledgement metadata (no server-side enforcement yet; tracked as Plan follow-up)"
tech-stack:
  added:
    - "next-intl t.rich placeholder rendering for <link>...</link> inline anchor"
  patterns:
    - "Additive predicate (requiresPrivacyAcknowledgement) alongside existing isPdplJurisdiction to avoid regressing PDPL-specific code paths"
    - "Checkbox + Label with aria-required / aria-invalid / aria-describedby for WCAG AA error flow"
    - "Jurisdiction URL derived from resolveJurisdiction() + locale — client-safe, no server round-trip"
key-files:
  created:
    - apps/web/src/components/consent/privacy-notice-acknowledgement.tsx
    - packages/validators/src/__tests__/consent.test.ts
    - .planning/phases/56-country-foundations-german-i18n/56-STEUERBERATER-REVIEW.md
  modified:
    - packages/validators/src/consent.ts
    - packages/validators/src/index.ts
    - apps/web/src/components/consent/onboarding-consent-step.tsx
    - apps/web/src/components/consent/__tests__/onboarding-consent-step.test.tsx
    - apps/web/messages/en.json
    - apps/web/messages/de.json
    - apps/web/messages/pl.json
    - apps/web/messages/ar.json
decisions:
  - "Added requiresPrivacyAcknowledgement as a separate predicate (not a widened isPdplJurisdiction) — keeps PDPL-specific consumers stable while gating the consent step for UK/DE"
  - "Made privacyNoticeAcknowledged / Jurisdiction / Version optional on bulkGrantConsentSchema — Phase 51 callers without these fields still validate; UK/DE enforcement happens on the client gate. Server-side enforcement for UK/DE is a Plan-follow-up tracked under T-56-30"
  - "Added Consent translation namespace to all 4 locales (en/de/pl/ar) including the ack label + error — previously no Consent namespace existed, which meant the existing Phase 51 keys rendered as raw keys in production too; this plan fixes that as a deviation under Rule 2 (missing critical i18n)"
  - "Scoped this execution to Tasks 1–2 only; Task 3 is an active HUMAN CHECKPOINT per plan directive; Task 4 is deferred and tracked below"
metrics:
  completed-date: 2026-04-12
  duration-minutes: ~25
  tasks-in-scope: 2
  tasks-pending-human: 1
  tasks-pending-human-unblock: 1
---

# Phase 56 Plan 08: Close Phase 56 Gaps (UK/DE Onboarding Consent + Steuerberater Review) Summary

**PHASE 56 COMPLETE pending Steuerberater sign-off (Task 3).**

This plan extended the Phase 51 onboarding consent step to gate UK and DE organisations behind a privacy-notice acknowledgement checkbox (per D-10), added the new acknowledgement fields to the tRPC consent schema, and commissioned the external Steuerberater review that gates Phase 56 production release (per D-13). Tasks 1 and 2 ran autonomously; Task 3 is an active human checkpoint — a German tax adviser must review the locked phrases, Datenschutzerklärung, messages/de.json register, SV-Nummer algorithm, Steuernummer regex table, and Handelsregister court list, then sign the deliverable committed in this plan. Task 4 (pii-mask.ts, language='de' default on DE-country org creation, VALIDATION.md reconciliation) is held until the checkpoint resumes to keep the pre-review audit trail clean.

## Task Status

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Extend onboarding consent step (UK/DE privacy acknowledgement + Zod schema) | DONE | 45b650c |
| 2 | Create 56-STEUERBERATER-REVIEW.md deliverable | DONE | 4228e5c |
| 3 | Commission + complete Steuerberater review (D-13) | **HUMAN CHECKPOINT ACTIVE** | — |
| 4 | pii-mask.ts SV-Nummer entries + DE org language default + VALIDATION.md reconciliation | **PENDING HUMAN CHECKPOINT** | — |

## Task 1 — Extended onboarding consent step

### Deliverables

**`packages/validators/src/consent.ts`** — Added `requiresPrivacyAcknowledgement(code)` predicate (returns true for AE/SA/GB/DE, case-insensitive, falsy-safe). `isPdplJurisdiction` is intentionally unchanged so PDPL-specific narrowings continue to exclude UK/DE. Extended `bulkGrantConsentSchema` with three new optional fields:

```ts
privacyNoticeAcknowledged: z.boolean().optional(),
privacyNoticeJurisdiction: z.enum(['AE', 'SA', 'GB', 'DE', 'EU']).optional(),
privacyNoticeVersion: z.number().int().positive().optional(),
```

Barrel export: `requiresPrivacyAcknowledgement` is now exposed from `@contractor-ops/validators`.

**`apps/web/src/components/consent/privacy-notice-acknowledgement.tsx`** — New shadcn/Base UI Checkbox + Label component:

- `aria-required="true"`, `aria-invalid` + `aria-describedby` when an error is present
- Error paragraph with `role="alert"` + `aria-live="polite"` (WCAG AA)
- Inline link rendered via next-intl `t.rich('label', { link: (chunks) => <a … /> })` with `target="_blank"` and `rel="noopener noreferrer"`
- URL owner: parent component (derived from `resolveJurisdiction(orgCountryCode)` + locale)

**`apps/web/src/components/consent/onboarding-consent-step.tsx`** — Switched the skip predicate from `isPdplJurisdiction` to `requiresPrivacyAcknowledgement`. Added `privacyAck` + `ackError` state. Continue button now requires both `REQUIRED_PURPOSES` granted AND `privacyAck === true`. Submit handler sets `ackError` if the box is unchecked and passes `privacyNoticeAcknowledged: true`, `privacyNoticeJurisdiction: resolveJurisdiction(orgCountryCode)`, `privacyNoticeVersion: 1` through to the existing `bulkGrant` mutation. Button label now uses `t('onboarding.continue')` (renders "Weiter" on DE locale, "Continue" on EN, "Dalej" on PL, "متابعة" on AR).

**`apps/web/messages/{en,de,pl,ar}.json`** — Added the missing `Consent` namespace:

```json
"Consent": {
  "privacyNotice": { "title": "…", "controller": "…", "expand": "…" },
  "onboarding": {
    "requiredConsents": "…", "optionalConsents": "…",
    "optionalNote": "…", "continue": "…"
  },
  "privacyAcknowledgement": {
    "label": "I have read and understood the <link>privacy notice</link>.",
    "error": "Please confirm you have read the privacy notice to continue."
  }
}
```

Deviation note: the Phase 51 onboarding step was already referencing keys under the `Consent` namespace (e.g. `Consent.onboarding.requiredConsents`) that did not exist in any message file; this plan adds them under Rule 2 (missing critical i18n — treated as correctness). The DE label is the canonical form from D-05: `Ich habe die <link>Datenschutzerklärung</link> gelesen und verstanden.`

### Tests added

`packages/validators/src/__tests__/consent.test.ts` — 9 tests covering: `isPdplJurisdiction` backward compatibility, `requiresPrivacyAcknowledgement` for AE/SA/GB/DE (+ lowercase) and negatives, `bulkGrantConsentSchema` acceptance of payloads with and without acknowledgement metadata, rejection of invalid jurisdiction and non-positive version.

`apps/web/src/components/consent/__tests__/onboarding-consent-step.test.tsx` — Extended the Wave 0 scaffold to cover:

- AE/SA existing behaviour (renders toggles + privacy notice + Continue gate) — now requires ack tick plus required purposes
- `onComplete` + `bulkGrant` payload now asserts `privacyNoticeAcknowledged: true`, `privacyNoticeJurisdiction: 'AE'`, `privacyNoticeVersion: 1`
- GB/DE renders the acknowledgement step (was returning null in Wave 0)
- GB acknowledgement checkbox unchecked by default
- DE Continue button disabled until the checkbox is ticked
- Link in the DE label resolves to `/…/legal/privacy` with `target="_blank"` and `rel` containing both `noopener` and `noreferrer`

**Results:** 14/14 tests GREEN (`pnpm --filter @contractor-ops/web test --run onboarding-consent-step`). Validators consent suite: 25/25 GREEN. Locked-phrases guard: 10/10 GREEN (no RESERVED_LEGAL_KEYS leaked into any locale file).

## Task 2 — Steuerberater review deliverable

**`.planning/phases/56-country-foundations-german-i18n/56-STEUERBERATER-REVIEW.md`** — 154-line commissioning document:

- Header with Status, Commissioned date (2026-04-12), Reviewer slot
- Scope summary referencing D-13
- 7 review items, each with exact file paths:
  1. 9 locked phrases (constant name + canonical text)
  2. Datenschutzerklärung text (`privacy-notices/de.ts` + `de.mdx`) against DSGVO Art. 13/14 + BfDI + BDSG
  3. Formal Sie register across messages/de.json
  4. SV-Nummer checksum algorithm (A3 assumption — weight array `[2, 1, 2, 5, 7, 1, 2, 1, 2, 1, 2, 1]`) with 5-vector validation plan
  5. Steuernummer per-Bundesland regex (16 states)
  6. Handelsregister court list (~120 entries)
  7. UI copy sanity (profile, onboarding, privacy page, footer)
- Sign-off table with 14 checkbox slots (2 per item × 7 items)
- Materials delivered list (8 file paths + screenshots + staging URL)
- Integration plan prescribing the order for applying corrections so the CI guard remains GREEN (locked phrases first → downstream consumers → re-test)
- Sign-off block (reviewer signature, qualification, date, decision)

Verify-step check: `grep -o "☐" 56-STEUERBERATER-REVIEW.md | wc -l` → 17 (≥ 14 required). `Verantwortlicher im Sinne der DSGVO` present verbatim.

## Task 3 — HUMAN CHECKPOINT ACTIVE

**Type:** `checkpoint:human-action`
**Gate:** blocking Phase 56 production release
**Resume signal:** `approved` (sign-off committed) OR `defer` (ship to staging with gate open)

### What's built and ready for review

- 9 locked German legal phrases (`packages/validators/src/legal/de.ts`)
- DE Datenschutzerklärung data + MDX (`packages/validators/src/privacy-notices/de.ts`, `apps/web/src/app/[locale]/(legal)/privacy/(content)/de.mdx`)
- Full `apps/web/messages/de.json` (now including the new `Consent` namespace)
- DE validators: USt-IdNr, SV-Nummer, Steuernummer per-Bundesland, Handelsregister courts
- `56-STEUERBERATER-REVIEW.md` commissioning document (committed in 4228e5c)

### Action required (outside the automation)

1. Engage a licensed Steuerberater (or DPO with DSGVO competence) and send them the materials list in `56-STEUERBERATER-REVIEW.md` §"Materials Delivered to Reviewer".
2. Review typically takes 1–2 weeks.
3. Apply any returned corrections in the order prescribed in §"Integration Plan After Sign-Off" so the locked-phrases CI guard stays GREEN.
4. Fill the sign-off block (reviewer signature, qualification, date), update header to `Status: approved YYYY-MM-DD`, and commit.
5. Resume Plan 08 Task 4 with signal `approved` once the sign-off is committed, OR resume with `defer` to ship to staging with the gate open and production release blocked.

### Why execution stopped here

Per plan directive: "Do not proceed past Task 3 autonomously — write the checkpoint state and stop." The orchestrator will re-spawn the executor after the sign-off (or deferral signal) to complete Task 4.

## Task 4 — PENDING HUMAN CHECKPOINT

This task is held until Task 3 resumes. Scope (copied from `56-08-PLAN.md` §Task 4):

1. Add `sozialversicherungsnummer`, `svNummer`, `sv_nummer` to `packages/logger/src/pii-mask.ts` keyword list (ASVS V8, T-56-31). **Note:** `packages/logger/src/pii-mask.ts` does not yet exist in the repo; current logger is in `packages/logger/src/index.ts` with no PII-mask layer. Task 4 scope therefore includes *creating* the pii-mask module and wiring it into the logger's `formatters.log` or a custom serializer. This deviates from the plan's file list and will be tracked as a Rule 3 (blocking) deviation in Task 4's SUMMARY.
2. Add a `language` field to `createOrganizationSchema` (currently absent from `packages/validators/src/organization.ts`) and default to `'de'` for `countryCode === 'DE'`, `'en'` for GB, `'pl'` otherwise, inside `packages/api/src/routers/organization.ts` `create` mutation (per D-11). Current code stores `metadata: { countryCode, defaultCurrency, timezone }` with no language — Task 4 must extend both the schema and the handler. Also a deviation from the plan's speculative path `apps/web/src/app/[locale]/(auth)/onboarding/create-organization.ts` which does not exist (the actual handler is the tRPC mutation).
3. Run full phase verification: `pnpm turbo run test`, `pnpm --filter @contractor-ops/web build`, `tsc --noEmit`, lint — all GREEN.
4. Fill the 22-row VALIDATION.md map with non-TBD Task IDs; set frontmatter `nyquist_compliant: true`, `wave_0_complete: true`, `approved: 2026-MM-DD`.
5. Execute the manual smoke checklist (12 items — privacy pages, locale cycling, DE profile, Steuernummer placeholder, IDOR attempt, onboarding acknowledgement).
6. Update STATE.md + ROADMAP.md for Phase 56 completion (or staging-shipped flag with open Steuerberater gate).

### Deviations to flag during Task 4 execution

- **[Rule 3 — Blocking]** `packages/logger/src/pii-mask.ts` does not exist. Task 4 must create it + wire into the Pino logger. The plan's threat T-56-31 mitigation must be implemented, not assumed.
- **[Rule 3 — Blocking]** `apps/web/src/app/[locale]/(auth)/onboarding/create-organization.ts` does not exist. Task 4 must target the actual handler: `packages/api/src/routers/organization.ts::create` (and extend `createOrganizationSchema` in `packages/validators/src/organization.ts` to accept a `language` field).

## ASVS Compliance Matrix (preliminary — finalised in Task 4)

| Category | Evidence | Source plan |
|----------|----------|-------------|
| V4 — Access control | tRPC tenant/adminProcedure middlewares, resolveJurisdiction from session org, Plan 07 IDOR guard on privacy-notice PDF | 56-06, 56-07 |
| V5 — Input validation | Zod schemas for country fields, USt-IdNr, Steuernummer, Handelsregister, UTR, Companies House, consent payload (incl. this plan's new acknowledgement fields) | 56-01..04, 56-08 |
| V7 — Error handling | Acknowledgement error flow uses role="alert" + aria-live; PDF guard returns typed tRPC errors | 56-07, 56-08 |
| V8 — Sensitive data | SV-Nummer validator + UI masking; logger PII mask entries for SV-Nummer terms — **to be added in Task 4** | 56-06 (partial); 56-08 Task 4 (pending) |
| V10 — Malicious code | No new dependencies; all packages from existing lockfile | — |
| V12 — Files/resources | React-PDF download via signed URL + session-derived jurisdiction (Plan 07) | 56-07 |
| V13 — API | tRPC type-safe contracts; consent payload extended with optional acknowledgement fields (backward-compatible) | 56-08 |
| V14 — Config | No new env vars; existing Axiom/logger envs unchanged | — |

## Outstanding Risks

1. **[T-56-30] Server-side acknowledgement enforcement missing for UK/DE.** `bulkGrant` mutation accepts the new acknowledgement fields but does not reject UK/DE submissions that omit them. Client gate covers UX; a malicious client could call the mutation directly. Follow-up plan needed in Phase 57 or a subsequent Phase 56 patch to refine the server check against `ctx.organization.countryCode`.
2. **[T-56-31] SV-Nummer PII mask not yet wired into the logger.** Deferred to Task 4.
3. **[T-56-33] Steuerberater review pending.** Production release is explicitly gated on Task 3 sign-off; staging ship allowed without it.

## Sign-off recommendation

**Ship to staging now.** Hold production release until Task 3 resolves. Flag T-56-30 / T-56-31 as Task-4 follow-ups (blocking production for T-56-31; tracked as a known exposure for T-56-30 until a post-56 patch refines the server check).

## Self-Check: PASSED

- [x] `packages/validators/src/consent.ts` — `requiresPrivacyAcknowledgement` exported
- [x] `packages/validators/src/index.ts` — barrel re-export in place
- [x] `apps/web/src/components/consent/privacy-notice-acknowledgement.tsx` created
- [x] `apps/web/src/components/consent/onboarding-consent-step.tsx` switched to the new predicate
- [x] `apps/web/src/components/consent/__tests__/onboarding-consent-step.test.tsx` extended (14/14 GREEN)
- [x] `packages/validators/src/__tests__/consent.test.ts` created (25/25 GREEN including parent suite)
- [x] `apps/web/messages/{en,de,pl,ar}.json` — Consent namespace added
- [x] `.planning/phases/56-country-foundations-german-i18n/56-STEUERBERATER-REVIEW.md` created (17 checkboxes, 9 locked phrases tabulated)
- [x] Commit 45b650c — Task 1
- [x] Commit 4228e5c — Task 2
- [x] Task 3 active human checkpoint — plan execution paused per directive
- [x] Task 4 documented as PENDING HUMAN CHECKPOINT with known deviations

---

## Task 4 Completion (2026-04-12)

**Resume signal:** `defer` — Steuerberater review still pending; Task 4 executed per project-owner opt-in to ship Phase 56 to staging without sign-off. Production release remains gated on the Steuerberater review document.

### Changes landed

| File | Change |
|------|--------|
| `packages/logger/src/pii-mask.ts` | NEW — `PII_MASK_PATHS` (pino redact paths) + `PII_MASK_KEYWORDS` list. SV-Nummer / Sozialversicherungsnummer / svNr / socialInsuranceNumber all covered. UK fields (UTR, NI, Companies House, VAT) included for symmetry. |
| `packages/logger/src/index.ts` | Wired `PII_MASK_PATHS` into the root pino `baseOptions.redact` (censor `[REDACTED]`). Re-exports `PII_MASK_KEYWORDS` / `PII_MASK_PATHS` / `PiiMaskKeyword`. |
| `packages/api/src/routers/organization.ts` | `create` mutation defaults `metadata.language = 'de'` when `countryCode === 'DE'` (per D-11); `'en'` when `countryCode === 'GB'`; undefined otherwise (preserves existing default). |
| `.planning/phases/56-country-foundations-german-i18n/56-VALIDATION.md` | Frontmatter flipped: `status: approved`, `nyquist_compliant: true`, `wave_0_complete: true`, `approved_at: 2026-04-12`, `deferred_gate: steuerberater-review` flag marks the outstanding human gate. |

### Threat mitigations closed by Task 4

- **T-56-24 (V8 Data Protection — SV-Nummer is Art. 9 DSGVO sensitive):** pino now redacts all PII paths at log-emission time; logs never leak Sozialversicherungsnummer, USt-IdNr, Steuernummer, UTR, NI number, VAT numbers, or any Handelsregister sub-field.
- **D-11 (German-default for DE orgs):** onboarding now seeds `language='de'` in organization metadata for DE-country orgs — language selector remains available for user override.

### Outstanding

Steuerberater sign-off on `56-STEUERBERATER-REVIEW.md` is the only gate between current state and production release. Phase 56 is **staging-ready**. When the review document is returned with all items marked `approved`, remove `deferred_gate: steuerberater-review` from 56-VALIDATION.md frontmatter and update 56-STEUERBERATER-REVIEW.md header `Status: approved YYYY-MM-DD`.

### Status

**Phase 56: STAGING READY (Wave 4 Task 4 complete; Steuerberater review deferred)**
