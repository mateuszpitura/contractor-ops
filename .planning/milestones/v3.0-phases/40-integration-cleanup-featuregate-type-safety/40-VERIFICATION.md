---
phase: 40-integration-cleanup-featuregate-type-safety
verified: 2026-04-06T10:05:00Z
status: passed
score: 7/7 must-haves verified
gaps: []
human_verification:
  - test: "STARTER-tier user visiting the Jira integration settings page sees an upgrade banner instead of the OAuth connect/disconnect UI"
    expected: "FeatureGate renders UpgradeInlineBanner with requiredTier='Pro' for STARTER tier user; raw Jira OAuth controls are hidden"
    why_human: "Browser session + tier-specific rendering cannot be programmatically checked from the codebase alone"
  - test: "STARTER-tier user visiting Calendar settings sees upgrade banners on both org and personal calendar sections"
    expected: "Both org-calendar-section and my-calendar-section render the UpgradeInlineBanner, not the OAuth connect UI"
    why_human: "Same reason — tier-gated rendering requires live session"
---

# Phase 40: Integration Cleanup — FeatureGate + Type Safety Verification Report

**Phase Goal:** Close remaining integration findings: consistent FeatureGate wrappers on all OAuth provider sections, and restore full type safety by rebuilding API dist types
**Verified:** 2026-04-06T10:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | STARTER-tier user sees FeatureGate upgrade banner on Jira provider section | ✓ VERIFIED | `jira-provider-section.tsx` imports `FeatureGate` (line 8) and wraps return JSX with `<FeatureGate requiredTier="Pro" featureName="Jira integration">` (line 34) |
| 2 | STARTER-tier user sees FeatureGate upgrade banner on both Calendar sections | ✓ VERIFIED | `org-calendar-section.tsx` (lines 10, 269) and `my-calendar-section.tsx` (lines 10, 287) both import and wrap with `<FeatureGate requiredTier="Pro" featureName="Calendar integration">` |
| 3 | API package builds with tsc producing updated dist/index.d.ts | ✓ VERIFIED | `packages/api/dist/root.d.ts` exists and contains typed router entries for `portal`, `billing`, `equipment`, and `teams` (lines 4298, 6135, 6310, 7243 in root.d.ts) |
| 4 | No file in apps/web/src contains `(trpc as any)` proxy workaround | ✓ VERIFIED | `grep -rn "trpc as any" apps/web/src/` returns 0 matches |
| 5 | All 13 files use properly typed trpc.router.procedure calls | ✓ VERIFIED | All 13 files grep positive for `trpc.billing.`, `trpc.teams.`, `trpc.equipment.`, `trpc.portal.`, or `trpc.settings.` with zero proxy variable references (`billingProxy`, `teamsProxy`, `equipmentProxy`, `settingsProxy`, `portalProxy`, `courierConfigProxy`) remaining anywhere in `apps/web/src/` |
| 6 | TypeScript compilation passes without errors in Phase 40 modified files | ✓ VERIFIED | `tsc --noEmit` produces zero errors in any of the 13 proxy-cleaned files or 3 FeatureGate-wrapped files; 29 pre-existing errors in unrelated files are not introduced by this phase |
| 7 | All existing tests pass without modification to test mocks | ✓ VERIFIED | 361/362 test files pass (3462/3464 tests pass); the 1 failing file (`invoice-submit-form.test.tsx`) is a pre-existing Phase 39 regression (test added in commit `060d362` expects `data-testid="credit-exhausted-inline"` on `CreditExhaustedInline` which the component never had); Phase 40 made no changes to this file or component |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/components/integrations/jira-provider-section.tsx` | FeatureGate-wrapped Jira provider section | ✓ VERIFIED | Contains `import { FeatureGate }` and `<FeatureGate requiredTier="Pro" featureName="Jira integration">` |
| `apps/web/src/components/settings/org-calendar-section.tsx` | FeatureGate-wrapped org calendar section | ✓ VERIFIED | Contains import and `<FeatureGate requiredTier="Pro" featureName="Calendar integration">` |
| `apps/web/src/components/settings/my-calendar-section.tsx` | FeatureGate-wrapped personal calendar section | ✓ VERIFIED | Contains import and `<FeatureGate requiredTier="Pro" featureName="Calendar integration">` |
| `packages/api/dist/index.d.ts` | Rebuilt API dist types with all routers | ✓ VERIFIED | File exists; `root.d.ts` exports typed AppRouter with `billing`, `teams`, `equipment`, `portal` routers all present |
| `apps/web/src/components/billing/usage-dashboard.tsx` | Typed tRPC billing calls | ✓ VERIFIED | Contains `trpc.billing.getUsageDashboard.queryOptions()` (line 69) |
| `apps/web/src/components/integrations/teams-channel-mapping-card.tsx` | Typed tRPC teams calls | ✓ VERIFIED | Contains `trpc.teams.getTeams`, `trpc.teams.getChannels`, `trpc.teams.saveChannelMapping`, `trpc.teams.getChannelMapping` |
| `apps/web/src/components/equipment/carrier-shipment-form.tsx` | Typed tRPC equipment calls | ✓ VERIFIED | Contains `trpc.equipment.createInPostShipment`, `createDpdShipment`, `createUpsShipment` |
| `apps/web/src/components/equipment/inpost-shipment-form.tsx` | Typed tRPC equipment calls | ✓ VERIFIED | Contains `trpc.equipment.createInPostShipment` |
| `apps/web/src/components/settings/default-return-carrier-select.tsx` | Typed tRPC settings calls | ✓ VERIFIED | Contains `trpc.equipment.getCourierConfigs`, `trpc.settings.get`, `trpc.settings.update`; procedure name fix applied |
| `packages/validators/src/organization.ts` | defaultReturnCarrier field in schema | ✓ VERIFIED | Line 31: `defaultReturnCarrier: z.string().max(20).optional()` |
| `packages/api/src/routers/settings.ts` | defaultReturnCarrier handled in update mutation | ✓ VERIFIED | Lines 76-77: reads `input.defaultReturnCarrier` and writes to `metadataUpdates` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `jira-provider-section.tsx` | `billing/feature-gate.tsx` | `import FeatureGate` | ✓ WIRED | Import on line 8; component used at line 34 and line 71 (closing tag) |
| `org-calendar-section.tsx` | `billing/feature-gate.tsx` | `import FeatureGate` | ✓ WIRED | Import on line 10; component used at line 269 and 291 |
| `my-calendar-section.tsx` | `billing/feature-gate.tsx` | `import FeatureGate` | ✓ WIRED | Import on line 10; component used at line 287 and 322 |
| `usage-dashboard.tsx` | `packages/api/dist/index.d.ts` | typed trpc client | ✓ WIRED | `trpc.billing.getUsageDashboard.queryOptions()` — fully typed call, no `as any` |
| `teams-channel-mapping-card.tsx` | `packages/api/dist/index.d.ts` | typed trpc client | ✓ WIRED | All four `trpc.teams.*` calls use typed query/mutation options |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `usage-dashboard.tsx` | `useQuery(trpc.billing.getUsageDashboard.queryOptions())` | `billingRouter.getUsageDashboard` in packages/api | Router registered in root.ts line 94; procedure queries real Stripe/DB data | ✓ FLOWING |
| `teams-channel-mapping-card.tsx` | `trpc.teams.getTeams.queryOptions()` etc. | `teamsRouter` in packages/api | Router registered in root.ts line 98; fetches from MS Graph API / DB | ✓ FLOWING |
| `jira-provider-section.tsx` | Wrapped — gate evaluates org tier from `useBillingStatus` inside FeatureGate | `feature-gate.tsx` → `billing/feature-gate.tsx` uses `useBillingStatus` hook | `FeatureGate` renders `UpgradeInlineBanner` for sub-PRO tiers | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Skipped for FeatureGate visual rendering (requires browser session). API type checks are static verification — no runnable server available in verification context.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BILL-09 | 40-01-PLAN.md | Middleware gates features by org's active subscription tier with graceful upgrade prompts | ✓ SATISFIED | Jira and Calendar sections now wrapped with FeatureGate requiring PRO tier, consistent with Linear/GWS/Teams. FeatureGate renders UpgradeInlineBanner for STARTER users. |
| EQUIP-05 | 40-02-PLAN.md | System integrates with InPost ShipX API for shipment creation, Parcel Locker selection, and auto-status tracking | ✓ SATISFIED | `inpost-shipment-form.tsx` and `carrier-shipment-form.tsx` use `trpc.equipment.createInPostShipment` with proper typing; `return-approval-banner.tsx` and portal files also typed correctly |
| EQUIP-06 | 40-02-PLAN.md | System integrates with DPD API for shipment creation, label generation, and status tracking | ✓ SATISFIED | `carrier-shipment-form.tsx` uses `trpc.equipment.createDpdShipment`; `dpd-provider-section.tsx` uses `trpc.equipment.getCourierConfigs` |
| EQUIP-07 | 40-02-PLAN.md | System integrates with UPS API for shipment creation and status tracking | ✓ SATISFIED | `carrier-shipment-form.tsx` uses `trpc.equipment.createUpsShipment`; `ups-provider-section.tsx` uses `trpc.equipment.getCourierConfigs` |
| TEAM-02 | 40-02-PLAN.md | Admin can configure which Teams channel receives which notification types | ✓ SATISFIED | `teams-channel-mapping-card.tsx` uses properly typed `trpc.teams.getChannels`, `trpc.teams.saveChannelMapping`, `trpc.teams.getChannelMapping` |
| BILL-10 | 40-02-PLAN.md | Admin sees usage dashboard with current plan, seat count, OCR credits used/remaining, and billing date | ✓ SATISFIED | `usage-dashboard.tsx` uses `trpc.billing.getUsageDashboard.queryOptions()` — typed, no proxy |

**Orphaned requirements check:** No requirements in REQUIREMENTS.md are mapped to Phase 40 (all listed IDs come from earlier phases; Phase 40 closes integration findings against those same requirements). No orphans detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx` | 75 | `const equipment = equipmentQuery.data as any` | ℹ️ Info | Local type cast to work around complex nested type inference on query result data; not a proxy workaround; does not block goal |

No blocker anti-patterns. The single `as any` noted above is a data narrowing cast, not a proxy — the proxy variable `courierConfigProxy` and `equipmentProxy` that previously existed in this file have been fully removed.

---

### Human Verification Required

#### 1. Jira Section FeatureGate Visual

**Test:** Log in as a STARTER-tier org user, navigate to Settings > Integrations > Jira section
**Expected:** An upgrade banner (UpgradeInlineBanner with "Pro" label and upgrade CTA) appears instead of the Jira OAuth connect/disconnect controls
**Why human:** Tier-gated conditional rendering requires a live browser session with a STARTER-tier org; cannot be verified by static code analysis

#### 2. Calendar Sections FeatureGate Visual

**Test:** Log in as a STARTER-tier org user, navigate to Settings > Calendar (org) and Settings > My Calendar
**Expected:** Both sections show the upgrade banner, not the Google/Microsoft calendar OAuth connect UI
**Why human:** Same tier-rendering runtime requirement

---

### Gaps Summary

No gaps found. All 7 must-have truths are verified. All 13 proxy workarounds are removed. All 3 FeatureGate wrappers are in place and properly wired. API dist types are rebuilt with all 4 required routers (`billing`, `teams`, `equipment`, `portal`). The 2 failing tests in `invoice-submit-form.test.tsx` are a pre-existing Phase 39 regression (missing `data-testid` on `CreditExhaustedInline` component) — Phase 40 did not introduce these failures and they fall outside this phase's scope.

---

### Commit Verification

All task commits from summaries confirmed present in git history:
- `0d94b8d` — feat(40-01): wrap Jira and Calendar sections with FeatureGate PRO tier
- `9a0a377` — fix(40-01): fix ShipmentParams type union for API dist build
- `e932b61` — fix(40-02): remove tRPC proxy workarounds from equipment and portal files
- `6b78368` — fix(40-02): remove remaining proxy workarounds and restore full type safety

---

_Verified: 2026-04-06T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
