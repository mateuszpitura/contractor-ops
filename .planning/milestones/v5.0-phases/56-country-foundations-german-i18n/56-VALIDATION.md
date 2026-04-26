---
phase: 56
slug: country-foundations-german-i18n
status: approved
nyquist_compliant: true
wave_0_complete: true
approved_at: 2026-04-12
deferred_gate: steuerberater-review
created: 2026-04-12
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `56-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` 4.1.4 (unit + integration in both `packages/validators` and `apps/web`); `@playwright/test` 1.59.1 for e2e-like flows |
| **Config file** | `packages/validators/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/web/playwright.*.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/validators test` |
| **Full suite command** | `pnpm turbo run test` |
| **Estimated runtime** | ~2–3s quick (validators only); ~45–90s full monorepo |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/validators test` (validators + locked-phrase guard) — fast (~2–3s).
- **After every plan wave:** Run `pnpm turbo run test --filter=@contractor-ops/validators --filter=@contractor-ops/web`.
- **Before `/gsd-verify-work`:** Full `pnpm turbo run test` must be green **plus** one manual smoke-pass of `/en/legal/privacy/gb`, `/de/legal/privacy/de`, `/en/legal/privacy/eu` routes **plus** DE locale switch exercise **plus** Steuerberater review incorporated.
- **Max feedback latency:** 3 seconds per task commit.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | FOUND-01 | — | UTR valid/invalid vectors | unit | `pnpm --filter @contractor-ops/validators test -- uk-validators` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-01 | — | Companies House SC/NI/OC variants | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-01 | V5 | GB VAT mod-97 + mod-9755 + GBGD/GBHA; reject invalid | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-01 | V13 | Country Compliance section renders UK group for `countryCode=GB` | integration (vitest + RTL) | `pnpm --filter @contractor-ops/web test -- country-compliance-section` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-02 | V5 | USt-IdNr MOD-11-10 valid/invalid vectors | unit | `pnpm --filter @contractor-ops/validators test -- de-validators` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-02 | V5 | Steuernummer per-Bundesland regex accepts only matching state | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-02 | V5, V8 | SV-Nummer structural + checksum positive/negative vectors | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-02 | V5 | Handelsregister composite requires all three parts or none | unit (Zod) | `pnpm --filter @contractor-ops/validators test -- country-fields` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-02 | V13 | DE field group renders for `countryCode=DE`; Bundesland drives regex | integration | `pnpm --filter @contractor-ops/web test -- de-compliance-fields` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-03 | — | next-intl resolves `de`; `messages/de.json` loads cleanly | integration | `pnpm --filter @contractor-ops/web test -- i18n-de` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-03 | — | Parity gate: every key in `en.json` exists in `de.json` | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-03 | — | Language switcher cycles through all `routing.locales` (catches `localeOrder` drift) | unit (RTL) | `pnpm --filter @contractor-ops/web test -- user-menu` | ❌ W0 (extend) | ⬜ pending |
| TBD | TBD | 0 | FOUND-04 | V7 | Reserved locked keys absent from any `messages/*.json` | unit | `pnpm --filter @contractor-ops/validators test -- locked-phrases-guard` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-04 | V7 | Every `LOCKED_DE_PHRASES` value appears verbatim in `privacy-notices/de.ts` | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-04 | — | No `Du`/`Dir`/`Dein` in `messages/de.json` (Sie register) | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-04 | — | Rendered UK/DE profile UI contains locked `TAX_STEUERNUMMER_LABEL` verbatim | integration (RTL) | `pnpm --filter @contractor-ops/web test -- de-compliance-fields.locked-phrase` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-05 | V10, V14 | UK GDPR privacy MDX renders all Article 13 required sections | integration | `pnpm --filter @contractor-ops/web test -- privacy-page-gb` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-05 | V12 | UK GDPR PDF yields valid React-PDF document structure | integration | `pnpm --filter @contractor-ops/web test -- privacy-pdf-gb` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-06 | V10 | German Datenschutzerklärung MDX contains all `LOCKED_DE_PHRASES` | integration | `pnpm --filter @contractor-ops/web test -- privacy-page-de` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-06 | V4 | Jurisdiction routing: `organization.countryCode=DE` → `/legal/privacy/de` (session-derived, not query-param) | integration | same | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-06 | V12 | German PDF contains `Verantwortlicher im Sinne der DSGVO` (snapshot) | integration | `pnpm --filter @contractor-ops/web test -- privacy-pdf-de` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | FOUND-01..06 | — | Onboarding consent step shows UK/DE acknowledgement; Continue disabled until checked | integration (RTL) | `pnpm --filter @contractor-ops/web test -- onboarding-consent-step` | ❌ W0 (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs assigned during planning. Threat Ref column maps to ASVS categories in RESEARCH.md §Security Domain.*

---

## Wave 0 Requirements

Test infrastructure to create **before** implementation waves begin:

- [ ] `packages/validators/src/__tests__/uk-validators.test.ts` — FOUND-01 (UTR / GB VAT / Companies House vectors)
- [ ] `packages/validators/src/__tests__/de-validators.test.ts` — FOUND-02 (USt-IdNr / SV-Nr / Steuernummer vectors)
- [ ] `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — FOUND-04 (D-05, D-06 CI guard)
- [ ] `packages/validators/src/__tests__/country-fields.test.ts` — **EXTEND** with UK+DE discriminated-union cases
- [ ] `apps/web/src/i18n/__tests__/de-locale.test.ts` — FOUND-03 (routing, localeSettings, messages parity)
- [ ] `apps/web/src/components/contractors/compliance/__tests__/uk-compliance-fields.test.tsx` — FOUND-01
- [ ] `apps/web/src/components/contractors/compliance/__tests__/de-compliance-fields.test.tsx` — FOUND-02, FOUND-04
- [ ] `apps/web/src/components/layout/__tests__/user-menu.test.tsx` — **EXTEND** with DE in `localeOrder` assertion (catches `routing.locales` ↔ `localeOrder` drift)
- [ ] `apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-gb.test.tsx` — FOUND-05
- [ ] `apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-de.test.tsx` — FOUND-06
- [ ] `apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-eu.test.tsx` — FOUND-05/06 fallback
- [ ] `apps/web/src/components/consent/__tests__/onboarding-consent-step.test.tsx` — **EXTEND** with GB/DE acknowledgement cases

**Framework install:** None needed — `vitest` 4.1.4 already present in every relevant workspace.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sie-register consistency across all DE strings | FOUND-03, FOUND-04 | Natural-language register classification is not reliably automatable beyond Du/Dir/Dein grep | Steuerberater reads `messages/de.json` + `privacy-notices/de.ts` + rendered profile UI screenshots, signs off on register consistency |
| Handelsregister court list completeness | FOUND-02 | Community-sourced ~120-court list (Wikipedia) needs one-time verification against `justiz.de` Registerportal | Maintainer cross-references `packages/validators/src/handelsregister-courts.ts` against the Gemeinsames Registerportal list, removes dead entries, appends missing |
| SV-Nummer checksum algorithm | FOUND-02 | Algorithm is community-known but DRV does not officially publish — marked Assumption A3 in research | Steuerberater validates against 5 real SV-Nummern (with owner consent) or synthetic DRV test vectors if obtainable |
| German legal phrasing correctness | FOUND-04, FOUND-06 | Legal compliance is not automatable; requires qualified review | Steuerberater reviews every `LOCKED_DE_PHRASES` string + full DE Datenschutzerklärung text against BfDI Mustertexte and current Art. 13 DSGVO guidance |
| Privacy PDF render fidelity | FOUND-05, FOUND-06 | React-PDF visual output cannot be reliably asserted via snapshot alone | Maintainer opens generated PDFs for GB/DE/EU, verifies layout matches Phase 51 style + all locked phrases visible + correct jurisdiction merged |
| DE locale formal register in rendered UI | FOUND-03 | Some strings only appear under specific user states (error flows, empty states) | Manual exercise: switch app to DE, run golden-path smoke on contractor create + onboarding + privacy page + language switch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ W0 references
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 3s for quick command (validators only)
- [ ] Every requirement FOUND-01..06 has at least one automated test row
- [ ] `nyquist_compliant: true` set in frontmatter once planner assigns task IDs and all rows resolve

**Approval:** pending — to be set `approved YYYY-MM-DD` once plans land and task IDs fill the TBD column.
