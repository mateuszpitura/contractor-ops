---
status: partial
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic
source: [79-VERIFICATION.md]
started: 2026-06-03
updated: 2026-06-03
---

## Current Test

[awaiting human testing — requires running the app with the Gulf feature flags enabled and the deferred ME-region migration applied]

## Tests

### 1. Arabic RTL visual rendering on all Gulf surfaces
expected: Free-zone assignment form, Saudization dashboard (incl. reversed band donut), Nitaqat override dialog, scope-mismatch banner, and offboarding-trajectory banner render correctly mirrored in `ar` locale — no bidi break, no physical-direction leakage, charts axis/direction via useRtlChartConfig. Automated `check:rtl-logical-props` already passes (14 surfaces, 0 offenders) but cannot verify actual visual rendering.
result: [pending]

### 2. German / Polish Gulf translation genuineness
expected: All `Contractors.freeZone.*` and `Saudization.*` keys in `de.json` / `pl.json` are genuine translations (D-16), not English placeholders. i18n:parity confirms key existence only; the heuristic flags only proper-noun zone names as en-identical (expected). A de/pl speaker should confirm wording quality.
result: [pending]

### 3. Arabic statutory copy legal sign-off
expected: `LOCKED_AE_PHRASES` / `LOCKED_SA_PHRASES` Arabic statutory text reviewed/approved by a qualified adviser before any non-local deploy. Deferred post-deploy per LOCAL-ONLY standing constraint — belongs on the v6.0 consolidated legal sign-off list (Phase 80).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
