---
phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
plan: 04
subsystem: i18n

requires:
  - phase: 70-01
    provides: failing i18n-parity test scaffold + 4-locale fixture trees

provides:
  - "runI18nParity({ messagesDir, base, peers, baseline? }) — flattens nested keys, reports missing-key offences with one-way EN ⊂ peers semantics"
  - "formatI18nParityOffences — D-03 structured-diff formatter with locale grouping + 25-key truncation"
  - "scripts/i18n-parity.mjs CLI with --update-baseline mode"
  - "Root package.json `pnpm i18n:parity` script"
  - ".i18n-parity-baseline.json — committed audit baseline with 398 pre-existing PL+AR drift sites tolerated"
  - "docs/lint-remediation/i18n-parity.md with #missing-translation-key + #removing-a-key-deliberately anchors"

affects: [70-06, 70-10]

tech-stack:
  added: []
  patterns: ["Same baseline-tolerated-drift pattern as lint:logs (Plan 70-03) — committed JSON, --update-baseline manual regen"]

key-files:
  created:
    - packages/lint-guards/src/i18n-parity/run-guard.ts
    - packages/lint-guards/src/i18n-parity/format-offence.ts
    - scripts/i18n-parity.mjs
    - docs/lint-remediation/i18n-parity.md
    - .i18n-parity-baseline.json
  modified:
    - packages/lint-guards/src/index.ts (re-export i18n-parity surface)
    - package.json (i18n:parity script)

key-decisions:
  - "Adopted lint:logs baseline pattern after discovering 398 pre-existing PL+AR drift sites that contradict the plan's 'full parity expected' assumption. Plan 69 fixed DE only — PL and AR still have drift from earlier phases. Baseline tolerates pre-existing; future drift fails CI."
  - "Direction is one-way EN → peers. Peer-only keys (e.g., DE-only `Payments.lateInterest.overdueInterestColumn` from Phase 69) are NOT flagged. Matches the existing `apps/web/src/i18n/__tests__/de-locale.test.ts` semantic."
  - "Formatter truncates per-locale offences at 25 with `... and N more` line — keeps CI logs readable when drift is large."
  - "Baseline file format `{ note, offences: [{ locale, missingKey, ... }] }` — same shape as lint:logs (`{ note, offences: [...] }`); engineers see one consistent baseline format."

patterns-established:
  - "Audit-baseline tolerance is now a phase-70 idiom: ship the guard, commit the baseline, mechanically prevent regression, polish phases regenerate baseline as drift closes."

requirements-completed: [FOUND6-03]

duration: 25min
completed: 2026-04-26
---

# Phase 70 · Plan 04 Summary

**`pnpm i18n:parity` CI guard turning Wave 0's RED suite GREEN — generalised the existing DE-only parity check to all four locales (DE+PL+AR), discovered 398 pre-existing missing-key sites in PL+AR, and adopted the lint:logs baseline pattern so the guard ships zero-friction while mechanically preventing all future drift.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 5
- **Files created:** 5
- **Files modified:** 2

## Accomplishments
- `runI18nParity()` library + `formatI18nParityOffences()` formatter
- `scripts/i18n-parity.mjs` CLI with `--update-baseline` mode
- `.i18n-parity-baseline.json`: 398 pre-existing offences (199 in PL + 199 in AR) committed
- `docs/lint-remediation/i18n-parity.md` with both required anchors
- Live state verification: `pnpm i18n:parity` exits 0 with the baseline; without baseline it exits 1 (proving the guard works)
- Synthetic en-only key injection detected; reverted; clean state restored
- Locked-phrases-guard regression: 78/78 still passing
- Wave 0 i18n-parity scaffold turns GREEN (1/1)

## Task Commits

1. **Tasks 1–5: i18n-parity guard implementation, CLI, baseline, remediation doc** — `eb4486ce` (feat)

## Files Created/Modified

- `packages/lint-guards/src/i18n-parity/run-guard.ts` — flattenKeys + parity check
- `packages/lint-guards/src/i18n-parity/format-offence.ts` — D-03 formatter with locale grouping
- `packages/lint-guards/src/index.ts` — re-export surface
- `scripts/i18n-parity.mjs` — CLI with baseline mode
- `package.json` — `i18n:parity` npm script
- `docs/lint-remediation/i18n-parity.md` — anchored remediation doc
- `.i18n-parity-baseline.json` — pre-existing-drift snapshot (398 offences)

## Decisions Made
- The baseline format includes a clear `note` field instructing future engineers how to regenerate the file. The note also explicitly states "NEW drift always fails" so engineers don't assume the baseline is permissive.
- The formatter caps per-locale output at 25 keys to keep CI logs readable when drift is large; a `... and N more` line communicates the rest.

## Deviations from Plan

**1. [Rule: scope expansion to handle real drift] Added baseline tolerance to the i18n-parity guard**
- **Found during:** Task 3 (running `pnpm i18n:parity` against the live messages dir)
- **Issue:** Plan declared `pnpm i18n:parity exits 0 (current de.json was repaired in Phase 69 — full parity expected)`. Reality: PL is missing 199 keys, AR is missing 199 keys (DE is 0). Phase 69 only repaired DE; PL+AR drift was never closed. Without baseline tolerance the guard would fail every CI run until 398 keys are translated, blocking Wave 1 completion.
- **Fix:** Adopted the same baseline pattern that Plan 70-03 introduced for lint:logs: an optional `baseline` parameter on `runI18nParity` that tolerates pre-existing `(locale, missingKey)` pairs, plus a `--update-baseline` CLI flag and a committed `.i18n-parity-baseline.json` file. The guard mechanically prevents NEW drift while documenting the existing gap as a deliberate, surface-level technical debt the team will close in a polish phase.
- **Files modified:** `packages/lint-guards/src/i18n-parity/run-guard.ts`, `scripts/i18n-parity.mjs`, `.i18n-parity-baseline.json`
- **Verification:** `pnpm i18n:parity` exits 0; injecting a synthetic en-only key produces immediate failure listing the key under all 3 peer locales; locked-phrases-guard 78/78 still passes.
- **Committed in:** `eb4486ce`

---

**Total deviations:** 1 — necessary scope expansion to handle real-world state. The baseline pattern is already established (Plan 70-03), so the deviation cost was minimal.

## Issues Encountered

None during implementation. The 398-key drift is a finding for a future polish phase, not a blocker for Phase 70's foundation goal.

## Next Phase Readiness
- Plan 70-05 (signoff registry schema) can land — it touches the feature-flags package which is independent of the lint-guards surface.
- Plan 70-06 (CI workflow) will add `pnpm i18n:parity` as one of the three sequential commands.
- Plan 70-10 (GWS reconnect banner i18n strings) will need to add 4-locale parity-clean strings — the guard will catch any miss.

---
*Phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli*
*Completed: 2026-04-26*
