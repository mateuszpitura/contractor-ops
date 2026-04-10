# Phase 38: Tier Gate Expansion + CourierClient Type Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 38-tier-gate-courier-type-fix
**Areas discussed:** Tier gate scope for onboarding import, CourierClient type restructure approach, UI-side FeatureGate wrappers

---

## Tier Gate Scope for Onboarding Import

| Option | Description | Selected |
|--------|-------------|----------|
| All 6 endpoints | Matches audit finding. Prevents STARTER orgs from even browsing connected sources. Clean boundary — entire feature is PRO-only | ✓ |
| Mutations only (startImport + retryFailedItem) | Matches Linear/Jira pattern where only writes are gated. Risk: confusing UX if users can browse but not act | |
| All except getProgress | Gate wizard flow but let progress queries through for mid-downgrade edge case | |

**User's choice:** All 6 endpoints (Recommended)
**Notes:** Clean PRO-only boundary for the entire onboarding import wizard.

---

## CourierClient Type Restructure Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Generic base type | Extract BaseShipmentParams with shared fields. Each carrier extends with specifics. CourierClient.createShipment accepts BaseShipmentParams. Clean and type-safe | ✓ |
| Generic type parameter on CourierClient | Make CourierClient generic: CourierClient<T extends BaseShipmentParams>. Most type-safe but requires updating all call sites and carrier-factory return type | |
| Keep union, rename base | Rename CreateShipmentParams → InPostShipmentParams. Minimal change but CourierClient still accepts union — no per-carrier type safety | |

**User's choice:** Generic base type (Recommended)
**Notes:** BaseShipmentParams with shared fields, each carrier extends. CourierClient.createShipment accepts BaseShipmentParams.

---

## UI-side FeatureGate Wrappers

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add UI gates too | Defense in depth per Phase 36 D-03. Wrap Teams mapping, GWS import, onboarding import with FeatureGate. STARTER users see upgrade banner | ✓ |
| API-only, no UI changes | Backend gates sufficient to prevent action. Users see UI but get error on submit. Global error boundary handles it | |
| UI gates only where not already gated | Check which pages already have FeatureGate. Only add where missing | |

**User's choice:** Yes, add UI gates too (Recommended)
**Notes:** Defense in depth. First actual usage of FeatureGate component in the app — it exists but was never applied anywhere.

---

## Claude's Discretion

- Exact placement of FeatureGate wrappers per component
- Whether to keep or remove CourierShipmentCreateParams union type
- Whether AddressShipmentParams intermediate type should be preserved
- Test strategy for tier gate additions

## Deferred Ideas

None — discussion stayed within phase scope.
