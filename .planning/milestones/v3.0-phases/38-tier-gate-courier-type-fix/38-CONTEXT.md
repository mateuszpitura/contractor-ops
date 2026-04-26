# Phase 38: Tier Gate Expansion + CourierClient Type Fix - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Close MISSING-01 and MISSING-03 from v3.0 milestone audit. Apply `requireTier("PRO")` middleware to all ungated mutation/query endpoints in Teams, Google Workspace, and Onboarding Import routers. Fix the `CourierClient` interface type contract so `createShipment` uses a generic base type instead of InPost-specific `CreateShipmentParams`.

</domain>

<decisions>
## Implementation Decisions

### Tier Gate — Teams Router
- **D-01:** Add `requireTier("PRO")` to `saveChannelMapping` mutation, matching the existing pattern in Linear/Jira routers (`.use(requireTier("PRO"))` chained after permission middleware)

### Tier Gate — Google Workspace Router
- **D-02:** Add `requireTier("PRO")` to `bulkImport`, `triggerSync`, and `listUserGroups` mutation procedures

### Tier Gate — Onboarding Import Router
- **D-03:** Gate ALL 6 endpoints with `requireTier("PRO")` — listSources, fetchPeople, fetchProjects, startImport, getProgress, retryFailedItem. The entire onboarding import feature is PRO-only. STARTER orgs cannot browse connected sources or trigger imports
- **D-04:** Both queries and mutations gated — clean boundary where the whole wizard is behind the paywall, not just the write operations

### CourierClient Type Restructure
- **D-05:** Extract `BaseShipmentParams` with shared fields: organizationId, direction, receiver (name/email/phone), sender (name/email/phone), parcelSize, reference. No carrier-specific fields in the base type
- **D-06:** Rename `CreateShipmentParams` → `InPostShipmentParams extends BaseShipmentParams` with `targetPoint: string`
- **D-07:** `DPDShipmentParams` and `UPSShipmentParams` already extend `AddressShipmentParams` — re-parent them to extend `BaseShipmentParams` instead (with deliveryAddress and AddressSender as carrier-specific additions)
- **D-08:** `CourierClient.createShipment` accepts `BaseShipmentParams` — each implementation internally narrows to its specific subtype. Union type `CourierShipmentCreateParams` can be removed or kept as convenience alias

### UI Feature Gates
- **D-09:** Add `<FeatureGate requiredTier="PRO">` wrappers to: Teams channel mapping card, Google Workspace directory import wizard, and onboarding import wizard. STARTER users see `UpgradeInlineBanner` instead of the gated UI
- **D-10:** Defense in depth — UI gates alongside API `requireTier` gates, per Phase 36 D-03. This is the first actual usage of the `FeatureGate` component in the app (component exists but was never applied)

### Claude's Discretion
- Exact placement of FeatureGate wrappers in each component (wrap the whole section vs specific interactive elements)
- Whether to keep `CourierShipmentCreateParams` union type or remove it
- Whether `AddressShipmentParams` intermediate type is still useful or should be inlined into DPD/UPS params
- Test strategy for tier gate additions (unit tests on middleware chain vs integration tests)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tier gating middleware and pattern
- `packages/api/src/middleware/tier.ts` — `requireTier` middleware factory
- `packages/api/src/routers/linear.ts` — Reference pattern for `.use(requireTier("PRO"))` on mutations (lines 194-196, 261-263)
- `packages/api/src/routers/billing.ts` — PLAN_CONFIG with tier features/excludedFeatures definitions

### Target routers for tier gates
- `packages/api/src/routers/teams.ts` — Teams router, `saveChannelMapping` needs gating
- `packages/api/src/routers/google-workspace.ts` — GWS router, `bulkImport`/`triggerSync`/`listUserGroups` need gating
- `packages/api/src/routers/onboarding-import.ts` — All 6 procedures need gating (listSources, fetchPeople, fetchProjects, startImport, getProgress, retryFailedItem)

### CourierClient type contract
- `packages/api/src/services/courier/courier-client.ts` — Current interface with InPost-specific `CreateShipmentParams`
- `packages/api/src/services/courier/dpd-client.ts` — DPD implementation using `DPDShipmentParams`
- `packages/api/src/services/courier/ups-client.ts` — UPS implementation using `UPSShipmentParams`
- `packages/api/src/services/courier/inpost-client.ts` — InPost implementation using `CreateShipmentParams`
- `packages/api/src/services/courier/carrier-factory.ts` — `getCourierClient()` factory returning `CourierClient`

### UI FeatureGate component
- `apps/web/src/components/billing/feature-gate.tsx` — FeatureGate component (exists, never applied)
- `apps/web/src/components/billing/upgrade-inline-banner.tsx` — Upgrade banner rendered by FeatureGate
- `apps/web/src/components/integrations/teams-channel-mapping-card.tsx` — Needs FeatureGate wrapper
- `apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx` — Needs FeatureGate wrapper

### Audit gaps being closed
- `.planning/v3.0-MILESTONE-AUDIT.md` — MISSING-01 (tier gate gaps), MISSING-03 (CourierClient type contract)

### Prior phase decisions
- `.planning/phases/35-feature-gating-dpd-ups-billing-polish/35-CONTEXT.md` — D-01 (hybrid gating), D-05 (carrier-specific param types)
- `.planning/phases/36-wiring-fixes-webhook-ui-featuregate/36-CONTEXT.md` — D-03 (defense in depth), D-04 (global error boundary)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireTier` middleware: fully implemented, accepts tier string, returns tRPC middleware. Pattern: `.use(requireTier("PRO"))` chained after `tenantProcedure` and permission middleware
- `FeatureGate` component: fully implemented with `requiredTier` and `featureName` props, renders `UpgradeInlineBanner` when tier insufficient
- `BaseShipmentParams` pattern: `AddressShipmentParams` already partially serves as base for DPD/UPS — can be refactored into the true generic base

### Established Patterns
- Tier gate chaining: `tenantProcedure.use(requirePermission({...})).use(requireTier("PRO"))` — consistent across Linear, Jira, Calendar, OCR, Audit routers
- Carrier-specific params: each carrier client's `createShipment` internally casts/validates its own param type
- Global TIER_REQUIRED error boundary catches unhandled tier errors at tRPC level (Phase 36 D-04)

### Integration Points
- `carrier-factory.ts` returns `CourierClient` — its return type will reflect the new `BaseShipmentParams` signature
- `equipment.ts` router calls courier clients via factory — call sites may need param type adjustments
- Settings > Integrations page hosts Teams and GWS cards — FeatureGate wraps at card level

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard pattern application and type refactoring.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 38-tier-gate-courier-type-fix*
*Context gathered: 2026-04-05*
