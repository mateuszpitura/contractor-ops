# Phase 40: Integration Cleanup — FeatureGate + Type Safety - Research

**Researched:** 2026-04-06
**Domain:** React component wrappers, tRPC type generation, monorepo build pipeline
**Confidence:** HIGH

## Summary

Phase 40 closes two low-severity integration findings from the v3.0 milestone audit. FINDING-01 requires wrapping Jira and Calendar OAuth provider sections with the existing `FeatureGate` component (PRO tier), matching the pattern already applied to Linear, Google Workspace, and Teams in Phase 39. FINDING-02 requires rebuilding the `@contractor-ops/api` dist types via `tsc` and then removing all `(trpc as any)` proxy workarounds across 13 files in the web app.

Both tasks are mechanical: the FeatureGate component and pattern are established (Phase 35/39), and the API root router already registers all sub-routers. The only risk is that rebuilding dist types could surface latent type errors in recently added routers, which would need to be fixed before the proxies can be removed.

**Primary recommendation:** Rebuild API dist types first (unblocks type safety cleanup), then wrap Jira/Calendar with FeatureGate, then remove all `as any` proxies and verify TypeScript compilation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-09 | Middleware gates features by org's active subscription tier with graceful upgrade prompts | FeatureGate wrapper on Jira/Calendar sections provides UI-level gating consistent with server-side requireTier |
| EQUIP-05 | InPost ShipX API integration | Removing `as any` proxy in inpost-shipment-form.tsx restores type safety for InPost tRPC calls |
| EQUIP-06 | DPD API integration | Removing `as any` proxy in carrier-shipment-form.tsx (DPD path) restores type safety |
| EQUIP-07 | UPS API integration | Removing `as any` proxy in carrier-shipment-form.tsx (UPS path) and ups-provider-section.tsx restores type safety |
| TEAM-02 | Admin can configure Teams channel notification types | Removing `as any` proxy in teams-channel-mapping-card.tsx restores type safety |
| BILL-10 | Admin sees usage dashboard with current plan, seat count, OCR credits | Removing `as any` proxy in usage-dashboard.tsx restores type safety |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI when gathering library documentation (not applicable -- this phase is internal cleanup)
- Write clean, readable, maintainable, well-structured code
- Use strong typing and avoid unsafe shortcuts (directly relevant -- removing `as any` proxies)
- Schema validation for all external inputs
- Prefer explicitness over magic
- Deliver production-grade code

## Architecture Patterns

### FINDING-01: FeatureGate Wrapping Pattern

The established pattern from Phases 35/38/39 wraps the entire provider section return value:

```tsx
// Source: apps/web/src/components/integrations/linear-provider-section.tsx
import { FeatureGate } from "@/components/billing/feature-gate";

export function LinearProviderSection() {
  // ... hooks and state ...

  return (
    <FeatureGate requiredTier="Pro" featureName="Linear integration">
      <div className="space-y-4">
        {/* provider content */}
      </div>
    </FeatureGate>
  );
}
```

**Files needing FeatureGate wrapper:**

| File | Current State | Action |
|------|---------------|--------|
| `apps/web/src/components/integrations/jira-provider-section.tsx` | No FeatureGate, returns bare `<div>` | Wrap return with `<FeatureGate requiredTier="Pro" featureName="Jira integration">` |
| `apps/web/src/components/settings/org-calendar-section.tsx` | No FeatureGate, returns bare `<div>` | Wrap return with `<FeatureGate requiredTier="Pro" featureName="Calendar integration">` |
| `apps/web/src/components/settings/my-calendar-section.tsx` | No FeatureGate, returns bare `<div>` | Wrap return with `<FeatureGate requiredTier="Pro" featureName="Calendar integration">` |

**Note on Calendar sections:** Both `OrgCalendarSection` (admin, in integrations tab) and `MyCalendarSection` (personal, in calendar settings page) need gating. The calendar page at `/settings/calendar` renders `MyCalendarSection` directly, and `OrgCalendarSection` is rendered in the integrations tab.

### FINDING-02: API Dist Type Rebuild + Proxy Removal

**Root cause:** The API package (`@contractor-ops/api`) exports types from `dist/index.d.ts` which was last fully built before routers like `teams`, `equipment` (newer procedures), `billing` (newer procedures), and `portal` were added or updated. The web app consumes `AppRouter` type from this dist, so new router procedures are invisible to TypeScript.

**Build command:**
```bash
pnpm --filter @contractor-ops/api build
```
This runs `tsc` per `package.json` build script, outputting to `dist/`.

**Full list of files with `(trpc as any)` proxy workarounds (13 files):**

| File | Proxy Target | Router |
|------|-------------|--------|
| `components/billing/usage-dashboard.tsx` | `billing.getUsageDashboard` | billing |
| `components/integrations/teams-channel-mapping-card.tsx` | `teams.getTeams`, `teams.getChannels`, `teams.saveChannelMapping`, `teams.getChannelMapping` | teams |
| `components/equipment/carrier-shipment-form.tsx` | `equipment.createInPostShipment`, `equipment.createDpdShipment`, `equipment.createUpsShipment` | equipment |
| `components/equipment/inpost-shipment-form.tsx` | `equipment.createInPostShipment` | equipment |
| `components/equipment/shipment-label-view.tsx` | `equipment.getShipmentLabel` | equipment |
| `components/equipment/return-approval-banner.tsx` | `equipment.approveReturnRequest`, `equipment.rejectReturnRequest` | equipment |
| `components/portal/portal-equipment-tab.tsx` | `portal.listEquipment`, `portal.getReturnStatus` | portal |
| `components/portal/portal-return-flow.tsx` | `portal.requestReturn`, `portal.getReturnStatus` | portal |
| `components/settings/carrier-credential-form.tsx` | `equipment.saveCourierConfig`, `equipment.getCourierConfigs` | equipment |
| `components/settings/default-return-carrier-select.tsx` | `equipment.getCourierConfigs`, `settings.updateOrgSettings`, `settings.getOrgSettings` | equipment, settings |
| `components/settings/dpd-provider-section.tsx` | `equipment.getCourierConfigs` | equipment |
| `components/settings/ups-provider-section.tsx` | `equipment.getCourierConfigs` | equipment |
| `app/[locale]/(dashboard)/equipment/[id]/page.tsx` | `equipment.listReturnRequests`, `equipment.getCourierConfigs` | equipment |

**After rebuild, each file needs:**
1. Remove the `const xxxProxy = (trpc as any).xxx as { ... }` block
2. Remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment
3. Replace all `xxxProxy.procedure.queryOptions(...)` calls with `trpc.xxx.procedure.queryOptions(...)`
4. Verify TypeScript compilation passes

### Anti-Patterns to Avoid

- **Partial proxy removal:** Do not remove proxy from some files but leave others. All 13 must be cleaned in the same phase to prevent confusion about which proxies are still "needed".
- **Skipping the build step:** The proxies exist because dist types are stale. Without rebuilding first, removing proxies causes compile errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier gating UI | Custom tier check logic | Existing `FeatureGate` component | Already handles loading state, tier ranking, upgrade banner |
| Type generation | Manual type definitions | `pnpm --filter @contractor-ops/api build` (tsc) | AppRouter type is inferred from the root router definition |

## Common Pitfalls

### Pitfall 1: tsc Build Failure Due to Latent Type Errors
**What goes wrong:** Running `tsc` on the API package after many phases of changes may surface type errors in recently added code that were never caught because the build was not run.
**Why it happens:** The project has been adding routers without rebuilding dist types, using `as any` proxies as a workaround.
**How to avoid:** Run the build first, fix any errors, then proceed with proxy removal.
**Warning signs:** `pnpm --filter @contractor-ops/api build` exits with non-zero status.

### Pitfall 2: Calendar FeatureGate Placement
**What goes wrong:** Wrapping at the wrong level (e.g., wrapping the entire calendar settings page instead of the section components).
**Why it happens:** Calendar has two separate section components (`OrgCalendarSection` and `MyCalendarSection`) rendered in different pages.
**How to avoid:** Wrap at the section component level, consistent with how Linear/GWS/Teams sections are wrapped. Each section's `return` gets the FeatureGate wrapper.
**Warning signs:** FeatureGate renders upgrade banner for the entire page instead of just the calendar section.

### Pitfall 3: Loading State in FeatureGate with Calendar's Own Loading
**What goes wrong:** Both FeatureGate and the calendar sections have their own loading states. Double skeleton/loading could appear.
**Why it happens:** FeatureGate renders children during loading (by design, per Phase 35 decision). Calendar sections render their own Skeleton UI during data fetch.
**How to avoid:** This is actually fine -- FeatureGate shows children while loading subscription, then calendar shows its own loading for connection data. No action needed.

### Pitfall 4: Missed Proxy References in Tests
**What goes wrong:** Test files may mock the proxy pattern. After removing proxies, test mocks must also be updated to mock the proper tRPC paths.
**Why it happens:** Tests mock `trpc` object structure which changes when proxies are removed.
**How to avoid:** Search for proxy references in test files after updating source files.

## Code Examples

### FeatureGate Wrapper for Jira (target state)
```tsx
// apps/web/src/components/integrations/jira-provider-section.tsx
import { FeatureGate } from "@/components/billing/feature-gate";

export function JiraProviderSection() {
  // ... existing hooks ...

  return (
    <FeatureGate requiredTier="Pro" featureName="Jira integration">
      <div className="space-y-4">
        {/* existing content unchanged */}
      </div>
    </FeatureGate>
  );
}
```

### Proxy Removal Pattern (before/after)
```tsx
// BEFORE (current state in usage-dashboard.tsx):
const billingProxy = (trpc as any).billing as {
  getUsageDashboard: { queryOptions: () => any };
};
// usage:
const { data } = useQuery(billingProxy.getUsageDashboard.queryOptions());

// AFTER (target state):
// No proxy needed -- trpc.billing.getUsageDashboard is now typed
const { data } = useQuery(trpc.billing.getUsageDashboard.queryOptions());
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `apps/web/vitest.config.ts`) |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test -- --run` |
| Full suite command | `pnpm --filter web test -- --run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-09 (Jira) | Jira section wrapped with FeatureGate showing upgrade for STARTER | unit | `pnpm --filter web test -- --run apps/web/src/components/integrations/__tests__/jira-provider-section.test.tsx` | No -- Wave 0 |
| BILL-09 (Calendar) | Calendar sections wrapped with FeatureGate | unit | `pnpm --filter web test -- --run apps/web/src/components/settings/__tests__/org-calendar-section.test.tsx` | Exists (needs FeatureGate assertions) |
| EQUIP-05 | InPost form uses typed tRPC (no proxy) | unit (compile check) | `pnpm --filter @contractor-ops/api build && pnpm --filter web tsc --noEmit` | N/A (type check) |
| TEAM-02 | Teams mapping card uses typed tRPC | unit | `pnpm --filter web test -- --run apps/web/src/components/integrations/__tests__/teams-channel-mapping-card.test.tsx` | Exists (mock update needed) |
| BILL-10 | Usage dashboard uses typed tRPC | unit | `pnpm --filter web test -- --run apps/web/src/components/billing/__tests__/usage-dashboard.test.tsx` | Exists (mock update needed) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/api build && pnpm --filter web tsc --noEmit`
- **Per wave merge:** `pnpm --filter web test -- --run`
- **Phase gate:** Full suite green + `tsc --noEmit` clean

### Wave 0 Gaps
- [ ] `apps/web/src/components/integrations/__tests__/jira-provider-section.test.tsx` -- covers BILL-09 (Jira FeatureGate)
- [ ] Update existing calendar section tests with FeatureGate mock assertions
- [ ] Update existing test mocks for all 13 proxy-removal files (remove proxy mock patterns, use proper tRPC paths)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/web/src/components/billing/feature-gate.tsx` -- FeatureGate component API
- Codebase analysis: `apps/web/src/components/integrations/linear-provider-section.tsx` -- established wrapping pattern
- Codebase analysis: `packages/api/src/root.ts` -- all routers registered, build will produce complete types
- Codebase analysis: `packages/api/package.json` -- build script is `tsc`
- Codebase analysis: 13 files with `(trpc as any)` proxy identified via grep

### Secondary (MEDIUM confidence)
- `.planning/v3.0-MILESTONE-AUDIT.md` -- FINDING-01 and FINDING-02 definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, purely internal cleanup
- Architecture: HIGH -- established patterns from Phases 35/38/39, exact code examples in codebase
- Pitfalls: HIGH -- root causes are clear (stale dist types, consistent wrapping pattern)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- internal codebase patterns)
