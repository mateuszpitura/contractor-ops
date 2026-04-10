# Phase 38: Tier Gate Expansion + CourierClient Type Fix - Research

**Researched:** 2026-04-05
**Domain:** tRPC middleware gating, TypeScript interface refactoring, React component composition
**Confidence:** HIGH

## Summary

This phase applies two well-established patterns to close audit gaps MISSING-01 and MISSING-03. The tier gating work is mechanical: chain `.use(requireTier("PRO"))` on 10 ungated procedures across 3 routers, matching the exact pattern already in production on Linear, Jira, Calendar, OCR, and Audit routers. The CourierClient type refactoring extracts a `BaseShipmentParams` from the existing `CreateShipmentParams` and `AddressShipmentParams`, then re-parents all carrier-specific types. The UI work wraps 3 component sections with the existing `FeatureGate` component.

All building blocks exist and are production-tested. No new libraries, no new patterns, no external dependencies. The only risk is ensuring type narrowing in each courier client's `createShipment` method continues to work after the base type change, and that all `createShipment` call sites in `equipment.ts` and `equipment-workflow.ts` remain type-safe.

**Primary recommendation:** Split into 3 plans: (1) tier gate all 3 routers + tests, (2) CourierClient type refactoring + test updates, (3) UI FeatureGate wrappers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Add `requireTier("PRO")` to `saveChannelMapping` mutation in Teams router
- D-02: Add `requireTier("PRO")` to `bulkImport`, `triggerSync`, and `listUserGroups` in Google Workspace router
- D-03: Gate ALL 6 onboarding import endpoints with `requireTier("PRO")` (listSources, fetchPeople, fetchProjects, startImport, getProgress, retryFailedItem)
- D-04: Both queries and mutations gated in onboarding import -- entire wizard behind paywall
- D-05: Extract `BaseShipmentParams` with shared fields: organizationId, direction, receiver, sender, parcelSize, reference
- D-06: Rename `CreateShipmentParams` to `InPostShipmentParams extends BaseShipmentParams` with `targetPoint: string`
- D-07: Re-parent `DPDShipmentParams` and `UPSShipmentParams` to extend `BaseShipmentParams` (not `AddressShipmentParams`)
- D-08: `CourierClient.createShipment` accepts `BaseShipmentParams` -- implementations internally narrow
- D-09: Add `<FeatureGate requiredTier="PRO">` to Teams channel mapping card, Google Workspace directory import wizard, and onboarding import wizard
- D-10: Defense in depth -- UI gates alongside API `requireTier` gates

### Claude's Discretion
- Exact placement of FeatureGate wrappers in each component (wrap whole section vs specific elements)
- Whether to keep `CourierShipmentCreateParams` union type or remove it
- Whether `AddressShipmentParams` intermediate type is still useful or should be inlined
- Test strategy for tier gate additions (unit tests on middleware chain vs integration tests)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-09 | Middleware gates features by org's active subscription tier with graceful upgrade prompts | Tier gating pattern fully established; `requireTier` middleware exists; `FeatureGate` component exists; D-01 through D-04 and D-09/D-10 cover remaining ungated endpoints |
| EQUIP-05 | System integrates with InPost ShipX API for shipment creation, Parcel Locker selection, and auto-status tracking | CourierClient type fix (D-05 through D-08) corrects the InPost-specific `CreateShipmentParams` to generic `BaseShipmentParams` |
| EQUIP-06 | System integrates with DPD API for shipment creation, label generation, and status tracking | DPD client re-parented from `AddressShipmentParams` to `BaseShipmentParams` with `deliveryAddress` as carrier-specific addition |
| EQUIP-07 | System integrates with UPS API for shipment creation and status tracking | UPS client re-parented same as DPD, with `serviceCode` as carrier-specific addition |
</phase_requirements>

## Architecture Patterns

### Pattern 1: Tier Gate Chaining (Established)

**What:** Chain `.use(requireTier("PRO"))` after permission middleware on tRPC procedures.
**When to use:** Any mutation or query that should be restricted to PRO+ subscribers.

The canonical pattern from `linear.ts` (line 194-196):
```typescript
saveStatusMapping: tenantProcedure
  .use(requirePermission({ settings: ["update"] }))
  .use(requireTier("PRO"))
  .input(schema)
  .mutation(async ({ ctx, input }) => { ... })
```

**Chain order:** `tenantProcedure` -> `requirePermission(...)` -> `requireTier("PRO")` -> `.input()` -> `.query()/.mutation()`

For procedures without explicit permission middleware (like onboarding import `listSources`), chain directly after `tenantProcedure`:
```typescript
listSources: tenantProcedure
  .use(requireTier("PRO"))
  .query(async ({ ctx }) => { ... })
```

### Pattern 2: Type Hierarchy Refactoring (New for This Phase)

**What:** Extract shared fields into `BaseShipmentParams`, make carrier-specific types extend it.
**Current state:**
```
CreateShipmentParams (InPost-specific, has targetPoint)
AddressShipmentParams (DPD/UPS shared, has deliveryAddress + AddressSender)
  DPDShipmentParams extends AddressShipmentParams
  UPSShipmentParams extends AddressShipmentParams (+ serviceCode)
CourierShipmentCreateParams = CreateShipmentParams | DPDShipmentParams | UPSShipmentParams
```

**Target state per D-05 through D-08:**
```
BaseShipmentParams (organizationId, direction, receiver, sender, parcelSize, reference)
  InPostShipmentParams extends BaseShipmentParams (+ targetPoint)
  DPDShipmentParams extends BaseShipmentParams (+ deliveryAddress, sender: AddressSender)
  UPSShipmentParams extends BaseShipmentParams (+ deliveryAddress, sender: AddressSender, serviceCode)
CourierClient.createShipment(params: BaseShipmentParams)
```

**Key consideration:** The `sender` field differs between base and address carriers. `BaseShipmentParams.sender` has `{ name, email, phone }`. DPD/UPS need `AddressSender` which adds `street, city, postalCode, countryCode`. The DPD/UPS types should override `sender` with `AddressSender` (intersection or explicit override).

### Pattern 3: FeatureGate Component Wrapping (Established, First Usage)

**What:** Wrap UI sections with `<FeatureGate>` to show `UpgradeInlineBanner` for insufficient tiers.
**Component API:**
```tsx
<FeatureGate requiredTier="Pro" featureName="Teams channel mapping">
  <TeamsChannelMappingContent />
</FeatureGate>
```

**Behavior:** Shows children during loading (no flash), shows `UpgradeInlineBanner` when tier insufficient.

### Anti-Patterns to Avoid
- **Gating only mutations but not related queries in onboarding import:** D-04 explicitly requires both queries and mutations gated. The entire wizard is PRO-only.
- **Accepting `CourierShipmentCreateParams` union in interface while claiming `BaseShipmentParams`:** The interface signature should use `BaseShipmentParams`. Implementations narrow internally via type guards.

## Specific Implementation Details

### Teams Router (1 procedure to gate)

| Procedure | Type | Current Middleware | Add |
|-----------|------|-------------------|-----|
| `saveChannelMapping` | mutation | `tenantProcedure.use(requirePermission({settings: ["update"]}))` | `.use(requireTier("PRO"))` after permission |

Read-only procedures (`connectionStatus`, `getTeams`, `getChannels`, `getChannelMapping`) remain ungated per Phase 36 decision D-03: "Gate mutations only -- read queries ungated for STARTER upgrade prompts."

### Google Workspace Router (3 procedures to gate)

| Procedure | Type | Current Middleware | Add |
|-----------|------|-------------------|-----|
| `listUserGroups` | mutation | `tenantProcedure.use(requirePermission({member: ["read"]}))` | `.use(requireTier("PRO"))` after permission |
| `bulkImport` | mutation | `tenantProcedure.use(requirePermission({member: ["create"]}))` | `.use(requireTier("PRO"))` after permission |
| `triggerSync` | mutation | `tenantProcedure.use(requirePermission({member: ["read"]}))` | `.use(requireTier("PRO"))` after permission |

Read-only procedures (`listDirectory`, `syncStatus`) remain ungated.

### Onboarding Import Router (6 procedures to gate)

| Procedure | Type | Current Middleware | Add |
|-----------|------|-------------------|-----|
| `listSources` | query | `tenantProcedure` | `.use(requireTier("PRO"))` |
| `fetchPeople` | query | `tenantProcedure` | `.use(requireTier("PRO"))` after input |
| `fetchProjects` | query | `tenantProcedure` | `.use(requireTier("PRO"))` after input |
| `startImport` | mutation | `tenantProcedure` | `.use(requireTier("PRO"))` |
| `getProgress` | query | `tenantProcedure` | `.use(requireTier("PRO"))` |
| `retryFailedItem` | mutation | `tenantProcedure` | `.use(requireTier("PRO"))` |

Note: These have no `requirePermission` middleware. Chain `.use(requireTier("PRO"))` directly after `tenantProcedure`.

**Important:** For `fetchPeople` and `fetchProjects`, the `.use(requireTier("PRO"))` should go BEFORE `.input()` to reject early before parsing input.

### CourierClient Type Changes

**Files to modify:**
1. `courier-client.ts` -- Extract `BaseShipmentParams`, rename `CreateShipmentParams` to `InPostShipmentParams`, update interface signature
2. `inpost-client.ts` -- Update import from `CreateShipmentParams` to `BaseShipmentParams`, update type guard
3. `dpd-client.ts` -- Update import, type guard remains similar (`"deliveryAddress" in params`)
4. `ups-client.ts` -- Update import, type guard remains similar
5. `carrier-factory.ts` -- No changes needed (returns `CourierClient`, signature follows)

**Call sites in equipment.ts and equipment-workflow.ts:**
- `equipment.ts` has 4 `client.createShipment({...})` calls (lines ~554, 973, 1174, 1361, 1644)
- `equipment-workflow.ts` has 1 `client.createShipment({...})` call (line ~340)
- These pass carrier-specific params that are already structurally correct. TypeScript will accept them since `InPostShipmentParams`, `DPDShipmentParams`, `UPSShipmentParams` all extend `BaseShipmentParams`.

**Decision on `AddressShipmentParams`:** Recommend KEEPING it as an intermediate type. Both DPD and UPS share `deliveryAddress: DeliveryAddress` and `sender: AddressSender`. Remove it only creates duplication. Re-parent it: `AddressShipmentParams extends BaseShipmentParams` (adding `deliveryAddress` and overriding `sender` to `AddressSender`). Then `DPDShipmentParams extends AddressShipmentParams` and `UPSShipmentParams extends AddressShipmentParams`. This satisfies D-07's intent (generic base) while preserving DRY.

**Decision on `CourierShipmentCreateParams` union:** Recommend REMOVING it. With the interface accepting `BaseShipmentParams`, the union serves no purpose. Each implementation narrows internally. The union was needed when the interface accepted `CourierShipmentCreateParams` -- now it accepts the base type directly.

### UI FeatureGate Placement

| Component | File | Wrap Target |
|-----------|------|-------------|
| Teams channel mapping | `teams-channel-mapping-card.tsx` | Wrap the entire card content (the card is dedicated to channel mapping) |
| GWS directory import | `directory-import-wizard.tsx` | Wrap the wizard component |
| Onboarding import | `import-wizard.tsx` | Wrap at the page/route level (`apps/web/src/app/[locale]/(dashboard)/onboarding/import/page.tsx`) or at the wizard component level |

**Recommendation:** Wrap at the component level rather than route level. This keeps the gate visible in the component tree and allows the page to still render navigation/breadcrumbs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier checking | Custom per-router subscription queries | `requireTier("PRO")` middleware | Already handles caching, error formatting, context enrichment |
| UI upgrade prompts | Custom conditional rendering | `FeatureGate` + `UpgradeInlineBanner` | Consistent UX, handles loading state |

## Common Pitfalls

### Pitfall 1: Middleware Chain Order
**What goes wrong:** Placing `requireTier` before `requirePermission` causes tier errors for unauthorized users instead of permission errors.
**Why it happens:** tRPC middleware executes in chain order.
**How to avoid:** Always chain `requireTier` AFTER `requirePermission` (if present). Auth errors should take priority over billing errors.
**Warning signs:** Users seeing "upgrade your plan" when they should see "permission denied."

### Pitfall 2: TypeScript Structural Narrowing in Courier Clients
**What goes wrong:** After changing `createShipment(params: BaseShipmentParams)`, the `in` operator type guards stop narrowing correctly.
**Why it happens:** TypeScript's `in` operator narrows based on discriminant properties. If `BaseShipmentParams` doesn't have `targetPoint`, then `"targetPoint" in params` narrows to `BaseShipmentParams & Record<"targetPoint", unknown>`, not `InPostShipmentParams`.
**How to avoid:** The current `in` guards already work this way. The key is that `BaseShipmentParams` must NOT include `targetPoint`, `deliveryAddress`, or `serviceCode` -- they are carrier-specific discriminants. Existing guards (`"targetPoint" in params`, `"deliveryAddress" in params`) will continue to work.
**Warning signs:** TypeScript errors on property access after narrowing.

### Pitfall 3: Missing Subscription Mock in Tests
**What goes wrong:** Adding `requireTier` to a router's procedures causes all existing tests for that router to fail with FORBIDDEN errors.
**Why it happens:** The `requireTier` middleware calls `getSubscription` which reads `prisma.subscription.findUnique`. If the test's mock prisma doesn't include `subscription.findUnique`, it returns undefined, triggering the "no subscription" error path.
**How to avoid:** Add `subscription: { findUnique: vi.fn(async () => ({ id: "sub_mock", status: "ACTIVE", tier: "PRO" })) }` to the mocked prisma in each test file for the 3 affected routers.
**Warning signs:** All tests for a router suddenly returning FORBIDDEN.

### Pitfall 4: Onboarding Import Has No Permission Middleware
**What goes wrong:** Assuming all procedures have `requirePermission` and chaining `requireTier` after it.
**Why it happens:** The onboarding import router uses raw `tenantProcedure` without permission checks.
**How to avoid:** For onboarding import, chain `.use(requireTier("PRO"))` directly after `tenantProcedure`: `tenantProcedure.use(requireTier("PRO")).input(...)`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (workspace config) |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `cd packages/api && npx vitest run --reporter=verbose` |
| Full suite command | `npx turbo test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-09 (Teams gate) | `saveChannelMapping` rejects STARTER tier | unit | `cd packages/api && npx vitest run src/routers/__tests__/teams.test.ts -x` | Exists, needs tier test |
| BILL-09 (GWS gate) | `bulkImport`, `triggerSync`, `listUserGroups` reject STARTER | unit | `cd packages/api && npx vitest run src/routers/__tests__/google-workspace.test.ts -x` | Exists, needs tier tests |
| BILL-09 (Onboarding gate) | All 6 procedures reject STARTER | unit | `cd packages/api && npx vitest run src/routers/__tests__/onboarding-import.test.ts -x` | Exists, needs tier tests |
| EQUIP-05/06/07 | `CourierClient.createShipment` accepts `BaseShipmentParams` | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ -x` | Exists, needs type updates |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `npx turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- Existing test files for all 3 routers exist but lack tier-gating assertions
- Existing courier client tests reference `CreateShipmentParams` and `CourierShipmentCreateParams` types that will be renamed/removed
- Need to add `subscription.findUnique` mock to teams, google-workspace, and onboarding-import test files

## Code Examples

### Adding requireTier to a Procedure (Reference: linear.ts line 194-196)
```typescript
// Source: packages/api/src/routers/linear.ts
saveStatusMapping: tenantProcedure
  .use(requirePermission({ settings: ["update"] }))
  .use(requireTier("PRO"))
  .input(saveLinearStatusMappingInputSchema)
  .mutation(async ({ ctx, input }) => { ... })
```

### Adding requireTier Without Permission Middleware
```typescript
// For onboarding import procedures
listSources: tenantProcedure
  .use(requireTier("PRO"))
  .query(async ({ ctx }) => { ... })
```

### BaseShipmentParams Type Hierarchy
```typescript
// Source: Derived from courier-client.ts analysis
export interface BaseShipmentParams {
  organizationId: string;
  direction: "OUTBOUND" | "RETURN";
  receiver: { name: string; email: string; phone: string };
  sender: { name: string; email: string; phone: string };
  parcelSize: "small" | "medium" | "large";
  reference?: string;
}

export interface InPostShipmentParams extends BaseShipmentParams {
  targetPoint: string;
}

export interface AddressShipmentParams extends BaseShipmentParams {
  deliveryAddress: DeliveryAddress;
  sender: AddressSender; // Override with address-bearing sender
}

export interface DPDShipmentParams extends AddressShipmentParams {}

export interface UPSShipmentParams extends AddressShipmentParams {
  serviceCode: string;
}

export interface CourierClient {
  createShipment(params: BaseShipmentParams): Promise<CourierShipmentResult>;
  // ... rest unchanged
}
```

### FeatureGate Usage
```typescript
// Source: apps/web/src/components/billing/feature-gate.tsx
<FeatureGate requiredTier="Pro" featureName="Teams channel mapping">
  {/* Existing card content */}
</FeatureGate>
```

### Test Mock for Tier Gating
```typescript
// Source: packages/api/src/routers/__tests__/linear.test.ts pattern
const mockPrisma = {
  // ... existing model mocks ...
  subscription: {
    findUnique: vi.fn(async () => ({
      id: "sub_mock",
      status: "ACTIVE",
      tier: "PRO",
    })),
  },
};
```

## Open Questions

1. **AddressShipmentParams sender override**
   - What we know: `BaseShipmentParams.sender` is `{ name, email, phone }`, `AddressSender` adds `street, city, postalCode, countryCode`. TypeScript allows interface property overrides in extensions when the override is a subtype.
   - What's unclear: Whether `AddressSender` (with extra properties) satisfies TypeScript's interface override rules when extending `BaseShipmentParams`.
   - Recommendation: `AddressSender` is a structural superset of `{ name, email, phone }`, so the override is valid. If TypeScript complains, use `Omit<BaseShipmentParams, "sender"> & { sender: AddressSender }` instead.

## Sources

### Primary (HIGH confidence)
- `packages/api/src/middleware/tier.ts` -- requireTier implementation, TIER_RANK mapping
- `packages/api/src/routers/linear.ts` -- Reference pattern for tier gate chaining (line 194-196)
- `packages/api/src/services/courier/courier-client.ts` -- Current type hierarchy
- `packages/api/src/routers/teams.ts` -- Current Teams router (1 mutation to gate)
- `packages/api/src/routers/google-workspace.ts` -- Current GWS router (3 mutations to gate)
- `packages/api/src/routers/onboarding-import.ts` -- Current import router (6 procedures to gate)
- `apps/web/src/components/billing/feature-gate.tsx` -- FeatureGate component API
- `packages/api/src/routers/__tests__/linear.test.ts` -- Test pattern with subscription mock

### Secondary (MEDIUM confidence)
- `.planning/phases/38-tier-gate-courier-type-fix/38-CONTEXT.md` -- User decisions D-01 through D-10
- `.planning/v3.0-MILESTONE-AUDIT.md` -- MISSING-01 and MISSING-03 gap definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all building blocks exist
- Architecture: HIGH -- established patterns, mechanical application
- Pitfalls: HIGH -- directly observed from codebase analysis (mock requirements, middleware order, type narrowing)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable patterns, no external dependency changes expected)
