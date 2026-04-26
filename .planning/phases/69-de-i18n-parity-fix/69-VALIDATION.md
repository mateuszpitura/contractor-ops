---
phase: 69
slug: de-i18n-parity-fix
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-26
---

# Phase 69 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 69 is a translation-only fix; no Wave 0 install needed (all three test commands rely on existing infrastructure from Phase 56).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (apps/web + packages/validators) + GNU grep |
| **Config file** | `apps/web/vitest.config.ts`, `packages/validators/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/web exec vitest run de-locale` |
| **Full suite command** | `pnpm --filter @contractor-ops/web exec vitest run de-locale && pnpm --filter @contractor-ops/validators exec vitest run locked-phrases-guard && [ "$(grep -cE '\b(Du\|Dir\|Dein[a-z]*)\b' apps/web/messages/de.json)" = "0" ]` |
| **Estimated runtime** | ~6 seconds (R-06 ≈ 2s + locked-phrases-guard ≈ 3s + grep ≈ <1s) |

---

## Sampling Rate

- **After every task commit:** Run quick command (`vitest run de-locale`) — proves R-06 still green.
- **After every plan wave:** Run full suite (R-06 + locked-phrases-guard + R-14 grep) — proves no regression in any of the three invariants.
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 6 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 69-01-01 | 01 | 1 | FOUND-03 | T-69-01 (informal-register injection via translation) | All 32 EN-only keys appear in `de.json`; R-14 grep returns 0; locked-phrases-guard 78/78 still green | unit (parity) | `pnpm --filter @contractor-ops/web exec vitest run de-locale` | ✅ | ⬜ pending |
| 69-01-02 | 01 | 1 | FOUND-03 | — | Atomic commit recorded; FOUND-03 traceability flipped from `Pending` to `Complete` in REQUIREMENTS.md | unit (regression) | `git log -1 --pretty=format:'%s' \| grep -E '^fix\(69-01\)'` AND `grep -E '^\| FOUND-03 \|.*\| Complete \|' .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No Wave 0 install needed.

- ✅ `apps/web/src/i18n/__tests__/de-locale.test.ts` — R-06 parity test (Phase 56, lines 55-72) — already exists.
- ✅ `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — 78-locked-phrase guard (Phase 56 + Phase 58 extensions) — already exists.
- ✅ GNU grep — system tooling; R-14 informal-register check is a one-liner shell command.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LPCDA legal-terminology correctness across the 25 `Payments.lateInterest.*` keys | FOUND-03 | Requires Steuerberater review of LPCDA-vs-BGB framing per D-02 + Plain operations review of customer-facing copy per D-10. Standing Project Constraint: legal sign-off DEFERRED for LOCAL-ONLY deploy (recorded in 69-SUMMARY.md "Manual-Only Verifications" — does NOT block ship; does NOT create a STATE.md blocker). | (1) Forward final `de.json` LPCDA copy to commissioned Steuerberater post-deploy; (2) Forward to Plain operations for customer-experience review; (3) Record sign-off (or change requests) in a follow-on phase before any production rollout. |
| Visual rendering of the new DE copy in the LateInterestSection / WaiveDialog / ClaimDialog (Phase 63) and ClassificationEngineFlagPanel (Phase 64) under the DE locale | FOUND-03 | Requires `PAY_LATE_INTEREST_ENABLED` flag ON (Phase 63 D-19) and a super-admin role for the ClassificationEngineFlag panel; smoke-screenshot QA is human-only. | Switch app locale to `de`, enable `PAY_LATE_INTEREST_ENABLED`, walk through: invoice → late-payment-interest section → claim dialog → waive dialog. Then super-admin → Classification Engine Flag panel. Confirm copy renders without `MISSING_MESSAGE` warnings in browser console. |

---

## Threat Model (Validation-relevant)

- **T-69-01 — Informal-register injection via translation.** Risk: a translator (human or model) accidentally drops a "Du"/"Dir"/"Dein" form into one of the 32 new translations, breaking the formal-Sie invariant Phase 56 D-04 established. Mitigation: R-14 grep check is run as a hard gate in Plan 01 Task 1 acceptance criteria; plan task action embeds the D-04 examples explicitly so the executor uses neutral-formal phrasings.
- **T-69-02 — Locked-phrase drift via copy/paste.** Risk: a locked-phrase from `packages/validators/src/legal/de.ts` is accidentally copy/pasted into one of the runtime UI keys (creating two sources of truth for the same legal phrase). Mitigation: locked-phrases-guard 78/78 run as a hard gate; phrase boundaries are conceptually distinct anyway (LPCDA UK statute terms vs locked DE-tax-locked phrases — no overlap by design).
- **T-69-03 — ICU placeholder rename via translation.** Risk: a translator translates the placeholder name itself (e.g., `{percent}` → `{prozent}`) breaking call-site interpolation. Mitigation: D-06 locks placeholder names; Plan 01 Task 1 acceptance criteria explicitly grep that each EN placeholder name (`{date}`, `{percent}`, `{discountDays}`, `{netDays}`, `{amount}`, `{name}`, `{revokeLink}`, `{count}`) appears verbatim in the corresponding DE value.
- **T-69-04 — JSON validity break.** Risk: a stray comma, unescaped quote, or unmatched brace in the 32-key insertion breaks `JSON.parse(de.json)` at startup, rendering every DE locale page un-loadable. Mitigation: R-06's first sub-test (line 56-58) explicitly does `expect(() => JSON.parse(raw)).not.toThrow()`; this catches the failure before commit.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (existing infra)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only 2 tasks in Plan 01; both automated)
- [x] Wave 0 covers all MISSING references (no Wave 0 needed — all infra exists)
- [x] No watch-mode flags (`vitest run`, not `vitest`)
- [x] Feedback latency < 10s (estimated ~6s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-26
