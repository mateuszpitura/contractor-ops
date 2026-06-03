---
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
verified: 2026-06-03T11:02:04Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Per-engagement isSaudi is wired through the offboarding workflow surface to the trajectory banner"
    addressed_in: "Phase 79 follow-up / offboarding workflow wiring"
    evidence: "79-07-SUMMARY.md explicitly documents this gap: 'per-engagement isSaudi not on the contractor profile object — the banner container therefore receives isSaudi via an optional prop (currently null)'. The banner is fully built and the gate is honest (returns null when isSaudi !== true); the data path from ContractorAssignment.isSaudi into the contractor detail query is deferred post-deploy. Noted in user-approved DEFERRED_AND_KNOWN_GAPS."
  - truth: "DB migration applied to both EU and ME regions"
    addressed_in: "Post-deploy (deferred by user at 79-02 BLOCKING gate)"
    evidence: "deferred-items.md: GENERATE-ONLY decision — schema committed, Prisma client regenerated, both db:migrate:dev and db:migrate:all explicitly deferred post-deploy. Standing LOCAL-ONLY constraint; precedented by Phases 72/73/74/76."
  - truth: "Arabic statutory legal sign-off (LOCKED_AE/SA phrases) approved"
    addressed_in: "Post-deploy legal review"
    evidence: "deferred-items.md + REQUIREMENTS.md decision table: legal sign-off deferred; every locked phrase is PENDING in signoff-registry-flags.json. Ship dark; flip to APPROVED post legal review."
human_verification:
  - test: "Arabic RTL layout renders correctly across all Gulf surfaces"
    expected: "Free-zone assignment form, Saudization dashboard, nitaqat override dialog, and offboarding trajectory banner all render right-to-left in the ar locale with no visual mis-alignment, text overflow, or direction-physical spacing artefacts"
    why_human: "RTL logical-property guard (check:rtl-logical-props) confirms no ml-/mr- classes are used in Gulf surfaces, but correct visual rendering under an RTL document direction cannot be verified programmatically"
  - test: "German and Polish Gulf translations are genuine (not English placeholders)"
    expected: "All 126 Gulf keys in de.json and pl.json contain real German/Polish text, not English copy-paste. Key samples: Gulf.freeZone.form.title (de: should say something like 'Freizonen-Zuweisung'), Saudization.heading (de/pl locale-specific wording)"
    why_human: "i18n:parity checks key existence only; value distinctness from en is a review discipline per 79-VALIDATION.md and D-16"
  - test: "Arabic statutory copy (authority names, Nitaqat band labels, Qiwa-auth status) is accurate"
    expected: "LOCKED_AE_PHRASES and LOCKED_SA_PHRASES contain correct Arabic statutory names for the 10 UAE free zones and Nitaqat band labels matching the official Qiwa/HRSD terminology"
    why_human: "UAE/KSA legal review pending per REQUIREMENTS.md Standing Constraints and 79-VALIDATION.md Manual-Only Verifications"
---

# Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL Verification Report

**Phase Goal:** F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL — 10-zone free-zone enum, Saudization manual-band entry, pre-offboarding impact banner, Qiwa-auth, ms-/me-/ps-/pe- RTL guard.
**Verified:** 2026-06-03T11:02:04Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All 11 GULF-* requirements are substantively implemented in the codebase. Automated checks pass. Three items require human verification (Arabic RTL visual rendering, de/pl translation genuineness, Arabic legal sign-off). One deferred item (isSaudi wiring to trajectory banner) is correctly documented and the UI is non-gating.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | 10-zone UaeFreeZoneCode enum exists (DIFC/DMCC/IFZA/DUBAI_INTERNET_CITY/DUBAI_MEDIA_CITY/MEYDAN_FZ/JAFZA/SHAMS/RAKEZ/ADGM + MAINLAND) | ✓ VERIFIED | `packages/db/prisma/schema/gulf.prisma:129-141` — 11 UPPER_SNAKE values |
| 2 | FreeZoneAssignment/SaudizationConfig/SaudiHeadcount/UaeFreeZone models exist with organizationId-first tenant scoping + ME-region doc-comment annotations | ✓ VERIFIED | `gulf.prisma:17-111`; all 4 models carry `// REGION: ME` comments; 3 org-scoped have `organizationId String` first; UaeFreeZone global-lookup allowlisted |
| 3 | ContractorAssignment gains isSaudi/nationality/qiwaContractAuthenticated; Contract gains activityIsicCodes | ✓ VERIFIED | `contractor.prisma:176-181`; `contract.prisma:52` |
| 4 | Expired free-zone BLOCKING item hard-blocks payment (C1, GULF-02) | ✓ VERIFIED | `services/free-zone-compliance.ts` — writeFreeZoneComplianceItem creates severity:'BLOCKING', policyRuleId:'uae.free_zone_license@v2', status derived from isExpired(). C1 test GREEN (10/10 in free-zone-* test files) |
| 5 | MAINLAND assignment writes no compliance item and is not blocked (C2) | ✓ VERIFIED | `free-zone-compliance.ts:113-115` — early return `{ written: false, reason: 'MAINLAND' }` before any DB write |
| 6 | Reminder scan fans out over SUPPORTED_REGIONS so ME-region BLOCKING items enter the cascade (C3, GULF-02, Pitfall 18) | ✓ VERIFIED | `compliance-reminder-scan.ts:158-177` — `for (const region of SUPPORTED_REGIONS)` loop; regional client threaded through `runComplianceReminderScanForClient`; C3 test GREEN |
| 7 | Free-zone compliance row survives policy supersession (not orphaned/WAIVED) (C4) | ✓ VERIFIED | `compliance-policy/src/policies/uae.ts:21-41` — free_zone_license@v2 is a standalone rule written out-of-band from the classification path; C4 test GREEN |
| 8 | ISIC-code overlap miss fires advisory + auto-creates NOC item; uncoded contract → no advisory (C5, GULF-03) | ✓ VERIFIED | `services/permitted-activity-check.ts:80-139`; invoked at contract-create (`routers/core/contract.ts:258-261`); C5 test GREEN (10/10) |
| 9 | Saudization band is NEVER auto-computed; manual entry only; last-updated timestamp + quarterly re-prompt (C6, GULF-05) | ✓ VERIFIED | `saudization-dashboard.ts:114-115` — `band = config.band` (read-through, no derivation); `saudization.ts:66-80` — upsertConfig takes band from input verbatim; C6 test GREEN (14/14) |
| 10 | Offboarding band-trajectory is live, ephemeral, advisory-only, non-gating (C7, GULF-07) | ✓ VERIFIED | `saudization-dashboard.ts:179-180` — `advisory: true; authoritative: false` constants; projectOffboardingTrajectory never sets a band; C7 test GREEN; UI banner container gates on isSaudi and returns null on error (never blocks) |
| 11 | Drift override is audit-logged with metadata.custom=true + 'Custom — verify with adviser' badge (C9, GULF-10) | ✓ VERIFIED | `routers/gulf/saudization.ts:247-258, 291-304` — both overrideNitaqatThresholds and overridePermittedActivityCatalogue call writeAuditLog({ metadata: { custom: true } }); C9 test GREEN (14/14) |
| 12 | Gulf models accessed only via ctx.db — no cross-region leakage (C8, GULF-11) | ✓ VERIFIED | `pnpm lint:region-leakage` → "no default-client reads of the 4 Gulf models in 614 scanned files"; lint-region-leakage.ts in lint:ci chain |
| 13 | RTL logical-property guard (ms-/me-/ps-/pe-) covers Gulf surfaces; no ml-/mr- (GULF-08) | ✓ VERIFIED | `pnpm check:rtl-logical-props` → "14 Gulf surface files scanned; no physical-direction Tailwind utilities found"; wired in lint:ci |
| 14 | All 4 locales (en/de/pl/ar) have full Gulf key coverage (GULF-08/09, C10) | ✓ VERIFIED | `pnpm i18n:parity` → OK; 126 Gulf EN keys; 0 missing in de/pl/ar |
| 15 | LOCKED_AE_PHRASES + LOCKED_SA_PHRASES exist, are exported from validators, and are guarded out of messages/*.json | ✓ VERIFIED | `validators/src/legal/ae.ts` + `sa.ts`; re-exported from `validators/src/index.ts:312-316,415-424`; RESERVED_AE_LEGAL_KEYS/RESERVED_SA_LEGAL_KEYS in locked-phrases-guard spread (line 75-76); all Gulf-specific locked-phrase tests GREEN |
| 16 | Gulf tRPC namespace mounted on root.ts appRouter | ✓ VERIFIED | `packages/api/src/root.ts:211` — `gulf: gulfRouter` |

**Score:** 11/11 GULF requirements verified (16 observable truths all VERIFIED)

### Deferred Items

Items not yet met but documented as intentionally deferred.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | isSaudi wiring from ContractorAssignment to offboarding trajectory banner prop | Phase 79 follow-up (offboarding workflow surface) | 79-07-SUMMARY.md: "per-engagement isSaudi not on the contractor profile object — banner receives null; stays inert until wired"; non-gating by design (D-12) |
| 2 | DB migration SQL file generated and applied to EU + ME regions | Post-deploy (user-approved at 79-02 BLOCKING gate) | deferred-items.md; schema committed; Prisma client regenerated via db:generate; additive DDL only (safe to apply) |
| 3 | Arabic statutory copy legal sign-off | Post-deploy legal review | signoff-registry-flags.json: gulf.free-zone-tracking and gulf.saudization-dashboard PENDING; shipped dark |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema/gulf.prisma` | 4 Gulf models + enums | ✓ VERIFIED | 142 lines; FreeZoneAssignment/SaudizationConfig/SaudiHeadcount/UaeFreeZone + NitaqatBand/UaeFreeZoneCode |
| `packages/validators/src/legal/ae.ts` | LOCKED_AE_PHRASES + RESERVED_AE_LEGAL_KEYS | ✓ VERIFIED | exists; exported from validators/src/index.ts |
| `packages/validators/src/legal/sa.ts` | LOCKED_SA_PHRASES + RESERVED_SA_LEGAL_KEYS | ✓ VERIFIED | exists; exported from validators/src/index.ts |
| `packages/api/src/services/free-zone-compliance.ts` | BLOCKING item write + Mainland gate | ✓ VERIFIED | 222 lines; writeFreeZoneComplianceItem + reEvaluateFreeZoneStatus |
| `packages/api/src/services/permitted-activity-check.ts` | ISIC overlap check + auto-NOC | ✓ VERIFIED | 141 lines; skip-on-uncoded, set-overlap only, WARNING NOC |
| `packages/api/src/services/saudization-dashboard.ts` | Rate from manual headcount + ephemeral trajectory | ✓ VERIFIED | 219 lines; computeSaudizationDashboard + projectOffboardingTrajectory |
| `packages/api/src/routers/gulf/free-zone.ts` | freeZoneRouter — CRUD + Saudi fields | ✓ VERIFIED | getAssignment + upsertAssignment + setSaudiAssignmentFields; all Zod-validated, region-aware via ctx.db |
| `packages/api/src/routers/gulf/saudization.ts` | saudizationRouter — config/headcount/dashboard/overrides | ✓ VERIFIED | getConfig/upsertConfig/upsertHeadcount/dashboard/offboardingTrajectory/overrideNitaqatThresholds/overridePermittedActivityCatalogue |
| `packages/api/src/routers/gulf/index.ts` | gulfRouter barrel | ✓ VERIFIED | exports gulfRouter combining freeZoneRouter + saudizationRouter |
| `packages/db/scripts/lint-region-leakage.ts` | GULF-11 no-leakage CI script | ✓ VERIFIED | 614 files scanned; 0 violations |
| `packages/db/scripts/check-rtl-logical-props.mjs` | GULF-08 ml-/mr- ban guard | ✓ VERIFIED | 14 Gulf surface files scanned; passes |
| `apps/web-vite/src/components/contractors/free-zone/hooks/use-free-zone-assignment.ts` | tRPC boundary for free-zone form | ✓ VERIFIED | 63 lines; useTRPC → trpc.gulf.freeZone.getAssignment + upsertAssignment |
| `apps/web-vite/src/components/contractors/free-zone/free-zone-assignment-form.tsx` | Presentational free-zone form | ✓ VERIFIED | 283 lines |
| `apps/web-vite/src/components/contractors/free-zone/free-zone-assignment-container.tsx` | Container calling hook | ✓ VERIFIED | 112 lines; uses useFreeZoneAssignment |
| `apps/web-vite/src/components/saudization/saudization-dashboard.tsx` | Presentational dashboard (hero rate, band, charts) | ✓ VERIFIED | 378 lines; useRtlChartConfig used |
| `apps/web-vite/src/components/saudization/offboarding-trajectory-banner.tsx` | Advisory non-gating banner | ✓ VERIFIED | 62 lines; receives trajectory prop; never gates |
| `apps/web-vite/src/components/saudization/nitaqat-override-dialog.tsx` | Drift override dialog with badge | ✓ VERIFIED | exists; thresholdsCustom/permittedActivityCatalogueCustom props wired |
| `apps/web-vite/messages/ar.json` | Real Arabic Gulf translations | ✓ VERIFIED | 126 Gulf keys; genuine Arabic text (not en-placeholders); all 11 zone names in Arabic |
| `packages/api/src/__tests__/__fixtures__/gulf-fixtures.ts` | ME-region fixture factory | ✓ VERIFIED | exports makeMeOrg/makeFreeZoneAssignment/makeFreeZoneComplianceItem |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/root.ts` | `gulfRouter` | `gulf: gulfRouter` at line 211 | ✓ WIRED | Confirmed in root.ts |
| `free-zone-assignment-container.tsx` | `use-free-zone-assignment.ts` | `useFreeZoneAssignment(contractorId)` at line 25 | ✓ WIRED | Container calls hook |
| `use-free-zone-assignment.ts` | `trpc.gulf.freeZone` | `trpc.gulf.freeZone.getAssignment.queryOptions` + `upsertAssignment.mutationOptions` | ✓ WIRED | Confirmed |
| `saudization-dashboard-container.tsx` | `use-saudization-dashboard.ts` | `useSaudizationDashboard()` at line 30 | ✓ WIRED | Confirmed |
| `use-saudization-dashboard.ts` | `trpc.gulf.saudization.dashboard` | `trpc.gulf.saudization.dashboard.queryOptions()` | ✓ WIRED | Confirmed |
| `routers/gulf/saudization.ts` | `writeAuditLog` | `metadata: { custom: true }` in both override mutations | ✓ WIRED | Lines 247-258, 291-304 |
| `routers/core/contract.ts` | `checkPermittedActivityScope` | invoked at contract-create lines 258-261 | ✓ WIRED | Confirmed |
| `free-zone-compliance.ts` | `ContractorComplianceItem` | creates with policyRuleId `uae.free_zone_license@v2`, severity BLOCKING | ✓ WIRED | Line 32 constant + create call lines 145-159 |
| `compliance-reminder-scan.ts` | `SUPPORTED_REGIONS` / `getRegionalClient` | `for (const region of SUPPORTED_REGIONS)` + `getRegionalClient(region)` | ✓ WIRED | Lines 158, 161 |
| `package.json` (root) | `check-rtl-logical-props.mjs` | `"check:rtl-logical-props": "node packages/db/scripts/check-rtl-logical-props.mjs"` + appended to `lint:ci` | ✓ WIRED | Lines 47, 16 |
| `package.json` (root) | `lint-region-leakage.ts` | `"lint:region-leakage"` in lint:ci chain | ✓ WIRED | Lines 16, 33 |
| `offboarding-trajectory-banner-container.tsx` | `OffboardingTrajectoryBannerContainer` | mounted in `profile-header-container.tsx:27` with `isSaudi={contractor.isSaudi ?? null}` | ⚠️ PARTIAL | Banner component wired, but `contractor.isSaudi` is always null (ContractorAssignment.isSaudi not included in `contractor.getById` select). Documented deferred gap — banner is advisory/non-gating and stays silent until wired. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `saudization-dashboard.tsx` | `nationalisationRate`, `band`, `qiwaGapCount` | `trpc.gulf.saudization.dashboard` → `computeSaudizationDashboard(SaudiHeadcount + SaudizationConfig + platformContractors + iqamaItems)` | Yes — derives from manual DB rows | ✓ FLOWING |
| `free-zone-assignment-form.tsx` | `defaultValues` assignment data | `trpc.gulf.freeZone.getAssignment` → `ctx.db.freeZoneAssignment.findFirst` | Yes — real DB read via region-aware ctx.db | ✓ FLOWING |
| `offboarding-trajectory-banner.tsx` | `trajectory` (currentRate, projectedRate) | `trpc.gulf.saudization.offboardingTrajectory` → `projectOffboardingTrajectory(SaudiHeadcount, offboardingContractorIsSaudi)` | Computes real rates; but isSaudi prop is null (see deferred gap) — banner stays silent | ⚠️ STATIC until isSaudi wired |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| free-zone C1/C2/C4 tests (payment block + Mainland exclusion + supersession) | `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/free-zone-*.test.ts` | 3 files, 10 tests PASSED | ✓ PASS |
| saudization + gulf-override C6/C7/C9 tests | `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/saudization-derivation.test.ts src/__tests__/gulf-override-audit.test.ts` | 2 files, 14 tests PASSED | ✓ PASS |
| C3/C5 reminder fan-out + permitted-activity-noc tests | `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/reminder-region-fanout.test.ts src/__tests__/permitted-activity-noc.test.ts` | 2 files, 10 tests PASSED | ✓ PASS |
| Backfill pure-logic tests (C8 complement) | `pnpm --filter @contractor-ops/db exec vitest run src/__tests__/free-zone-assignment-backfill.test.ts` | 1 file, 5 tests PASSED | ✓ PASS |
| RTL logical-property guard | `pnpm check:rtl-logical-props` | 14 Gulf surface files scanned; no physical-direction utilities | ✓ PASS |
| i18n parity (4 locales) | `pnpm i18n:parity` | OK — en.json keys covered in de.json, pl.json, ar.json | ✓ PASS |
| Region-leakage lint (C8/GULF-11) | `pnpm lint:region-leakage` | 614 files scanned; 0 violations | ✓ PASS |

### Probe Execution

No phase-declared probes (probe-*.sh pattern). Step 7c: SKIPPED (no applicable probe scripts for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GULF-01 | 79-02, 79-05, 79-06 | Admin can record UAE free-zone assignment (10-zone enum + license + ISIC codes) | ✓ SATISFIED | UaeFreeZoneCode enum (11 values); FreeZoneAssignment model; freeZoneRouter.upsertAssignment; free-zone-assignment-form.tsx |
| GULF-02 | 79-03 | Free-zone license expiry tracked as BLOCKING ContractorComplianceItem (F1 cascade + payment block) | ✓ SATISFIED | free-zone-compliance.ts; uae.ts BLOCKING@v2 rule; C1/C2/C3/C4 tests GREEN |
| GULF-03 | 79-04, 79-05, 79-06 | Permitted-activity scope mismatch advisory + auto-NOC on contract create | ✓ SATISFIED | permitted-activity-check.ts; contract.ts invocation; scope-mismatch-banner.tsx; C5 GREEN |
| GULF-04 | 79-02, 79-05 | Per-engagement Saudi nationality + isSaudi boolean + qiwaContractAuthenticated | ✓ SATISFIED | ContractorAssignment columns; freeZoneRouter.setSaudiAssignmentFields |
| GULF-05 | 79-04, 79-05, 79-07 | Manual Nitaqat band entry (never auto-computed); band + industry segment; last-updated + quarterly prompt | ✓ SATISFIED | SaudizationConfig model; saudizationRouter.upsertConfig; computeSaudizationDashboard (read-through band); C6 GREEN |
| GULF-06 | 79-04, 79-05, 79-07 | Saudization dashboard: rate, band, Qiwa gap, Iqama roll-up | ✓ SATISFIED | saudization-dashboard.ts; saudizationRouter.dashboard; saudization-dashboard.tsx (378 lines) |
| GULF-07 | 79-04, 79-05, 79-07 | Pre-offboarding impact banner showing projected Saudization-band trajectory | ✓ SATISFIED (UI + logic complete; data gate deferred) | projectOffboardingTrajectory(advisory:true,authoritative:false); offboarding-trajectory-banner.tsx; container mounted in profile-header-container; isSaudi wiring deferred (documented) |
| GULF-08 | 79-01, 79-08 | All GULF surfaces ship full Arabic + RTL logical properties (ms-/me-/ps-/pe- only) | ✓ SATISFIED (automated) / ? HUMAN (visual render) | check:rtl-logical-props PASS; i18n:parity PASS; 126 AR keys with genuine Arabic text; human RTL visual review required |
| GULF-09 | 79-02, 79-08 | Locked-phrase registry extends with UAE/KSA Arabic statutory terms | ✓ SATISFIED | ae.ts + sa.ts; exported from validators; RESERVED_AE/SA_LEGAL_KEYS in locked-phrases guard spread; Gulf AE/SA tests in locked-phrases-guard all GREEN (the 1 failure is pre-existing count drift in Phase 64 assertion, documented in deferred-items.md) |
| GULF-10 | 79-05, 79-07 | Admin can override Nitaqat thresholds / permitted-activity catalogues per-org with audit log + 'Custom — verify with adviser' badge | ✓ SATISFIED | saudizationRouter overrideNitaqatThresholds + overridePermittedActivityCatalogue with writeAuditLog(custom:true); nitaqat-override-dialog.tsx; saudization-dashboard.tsx badge prop; C9 GREEN (14/14) |
| GULF-11 | 79-03 | ME-region data routes to ME DB; new gulf models carry regional-routing annotations; schema-lint test asserts no cross-region leakage | ✓ SATISFIED | gulf.prisma REGION:ME doc-comments on all 4 models; lint-region-leakage.ts in lint:ci; C8 GREEN (0 violations in 614 files) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No Gulf-surface anti-patterns found | — | — | — | check:rtl-logical-props, i18n:parity, lint:region-leakage all GREEN |

Pre-existing debt in non-Gulf files (documented, not attributable to Phase 79):
- `locked-phrases-guard.test.ts:588` — getAllPending() count assertion 29 vs actual 48 (Phase 64 hardcoded count not updated as registry grew; documented in deferred-items.md)
- `classification-supersession.test.ts:176,241-243` — UK/DE count drift (phases 75-78 added rules without updating Phase 71 assertions; documented in deferred-items.md)
- `contract.test.ts` / `contractor.test.ts` — MODULE LOAD failure on missing `prismaRaw` db-mock export (documented in deferred-items.md; pre-dates Phase 79; not caused by Phase 79 changes)
- `apps/web-vite/src/components/layout/hooks/use-dashboard-shell.ts:42` — 4 pre-existing TS2339 errors in concurrent demo-read-only workstream (not Phase 79; documented in deferred-items.md)

### Human Verification Required

#### 1. Arabic RTL Visual Rendering

**Test:** Load the Gulf surfaces (free-zone assignment form, Saudization dashboard, nitaqat override dialog, offboarding trajectory banner) in the app with the `ar` locale set.
**Expected:** All surfaces render right-to-left — labels/buttons flush right, form fields extend left, direction-sensitive spacing uses logical sides correctly, zone dropdown options are right-aligned, no truncated or overflowing Arabic text.
**Why human:** The `check:rtl-logical-props` guard confirms no physical-direction Tailwind classes are used in Gulf surfaces, but correct visual RTL rendering under a live RTL document direction requires visual inspection.

#### 2. German and Polish Gulf Translation Quality

**Test:** Open `apps/web-vite/messages/de.json` and `apps/web-vite/messages/pl.json` and spot-check 10+ Gulf keys (form titles, zone labels, Saudization headings, error messages).
**Expected:** All values are genuine German/Polish translations — not English copy-paste. Example: `Gulf.freeZone.form.title` should be "UAE-Freizonenauftrag" or equivalent in German, not "UAE free-zone assignment".
**Why human:** `pnpm i18n:parity` checks key existence only. Value distinctness from English is a review discipline (D-16, 79-VALIDATION.md Manual-Only Verifications). The Gulf keys cover 126 user-facing strings.

#### 3. Arabic Statutory Copy (UAE/KSA Legal Terms)

**Test:** Review `LOCKED_AE_PHRASES` in `packages/validators/src/legal/ae.ts` and `LOCKED_SA_PHRASES` in `packages/validators/src/legal/sa.ts` with a UAE/KSA legal or compliance adviser.
**Expected:** Free-zone authority names (DIFC, DMCC, IFZA, JAFZA, ADGM, etc.) and Nitaqat band labels match the official Arabic statutory terminology used by the UAE CBUAE/DIFC Authority and Saudi Qiwa/HRSD.
**Why human:** Arabic statutory legal sign-off is explicitly DEFERRED per the LOCAL-ONLY standing constraint. Gulf feature flags are PENDING in signoff-registry-flags.json; they must remain dark until legal sign-off.

### Gaps Summary

No blocking gaps. All 11 GULF-* requirements have substantive implementation verified in the codebase. The three deferred items (isSaudi wiring, migration apply, legal sign-off) are correctly documented and non-blocking for the phase goal. The human verification items (Arabic RTL visual, de/pl translation quality, statutory copy) are standard pre-deploy review discipline that cannot be automated.

---

_Verified: 2026-06-03T11:02:04Z_
_Verifier: Claude (gsd-verifier)_
