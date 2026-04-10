# Phase 36: Wiring Fixes -- Webhook Dispatch + UI Mounting + Feature Gate - Research

**Researched:** 2026-04-05
**Domain:** Integration wiring, UI composition, tRPC middleware gating
**Confidence:** HIGH

## Summary

Phase 36 is a pure wiring phase -- all components, handlers, and middleware already exist and are fully implemented. The work connects existing pieces: (1) add a Linear dispatch block in the QStash webhook processor mirroring the Jira pattern, (2) add outbound Linear sync calls to cancelRun and any future IN_PROGRESS transitions, (3) mount CarrierShipmentForm and CarrierCredentialForm in their target pages, (4) wrap STARTER-excluded features with FeatureGate components and requireTier middleware, and (5) add a global tRPC error handler for TIER_REQUIRED errors.

Every pattern needed already exists in the codebase. The Jira webhook dispatch at lines 74-84 of `_process/route.ts` is the exact template for Linear. The fire-and-forget outbound sync in completeTask/skipTask is the exact template for cancelRun. The IntegrationsTab grid with provider sections is the exact template for DPD/UPS cards. The FeatureGate component and requireTier middleware are production-ready.

**Primary recommendation:** Follow established codebase patterns exactly -- no architectural changes needed. This is copy-adapt wiring work.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hybrid FeatureGate approach -- page-level redirects for wholly gated pages (audit log export, API access) + inline FeatureGate wrappers for sub-features within accessible pages
- **D-02:** Claude's discretion on exact FeatureGate placement per page
- **D-03:** Both UI and API gating (defense in depth) -- requireTier('PRO') on tRPC procedures alongside FeatureGate UI wrappers
- **D-04:** Global error boundary catches TIER_REQUIRED errors -- tRPC error handler intercepts structured JSON errors and renders UpgradeInlineBanner automatically
- **D-05:** "Create Shipment" button on equipment detail page opens CarrierShipmentForm in dialog/sheet
- **D-06:** DPD and UPS each get integration cards in Settings > Integrations with "Configure" dialog for CarrierCredentialForm
- **D-07:** Only carriers with configured credentials appear in shipment form dropdown
- **D-08:** Add `if (provider === "linear")` block in `_process/route.ts` mirroring Jira dispatch at lines 74-84
- **D-09:** Wire syncTaskStatusToLinear for ALL task status transitions (add IN_PROGRESS, BLOCKED, CANCELLED)
- **D-10:** Full bidirectional sync -- Linear always reflects real task state

### Claude's Discretion
- Exact FeatureGate placement per page/component
- Which tRPC procedures get requireTier middleware
- Dialog vs sheet choice for carrier forms (match existing patterns)
- Error boundary implementation details for TIER_REQUIRED handling
- How to wire outbound sync for IN_PROGRESS/BLOCKED/CANCELLED

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIN-04 | Status changes in Linear sync to linked workflow task via webhooks (with loop prevention) | Wire `processLinearWebhook` in `_process/route.ts` -- handler already has full 10-step processing with loop prevention |
| LIN-05 | Status changes on workflow task sync to Linear issue via GraphQL mutation | Add `syncTaskStatusToLinear` calls to cancelRun; completeTask/skipTask already wired |
| EQUIP-06 | System integrates with DPD API for shipment creation, label generation, and status tracking | Mount CarrierShipmentForm (DPD fieldset) in equipment detail + CarrierCredentialForm in Settings |
| EQUIP-07 | System integrates with UPS API for shipment creation and status tracking | Mount CarrierShipmentForm (UPS fieldset) in equipment detail + CarrierCredentialForm in Settings |
| BILL-09 | Middleware gates features by org's active subscription tier with graceful upgrade prompts | Apply requireTier middleware to tRPC procedures + FeatureGate UI wrappers + global TIER_REQUIRED error handler |
</phase_requirements>

## Architecture Patterns

### Pattern 1: Webhook Provider Dispatch (Jira template)
**What:** Provider-specific `if (provider === "...")` block in `_process/route.ts` with dynamic import
**When to use:** Adding inbound webhook processing for a new provider
**Example:**
```typescript
// Source: apps/web/src/app/api/webhooks/_process/route.ts lines 74-84
if (provider === "linear") {
  const { processLinearWebhook } = await import(
    "@contractor-ops/api/services/linear-webhook-handler"
  );
  await processLinearWebhook(
    prisma,
    delivery.organizationId,
    delivery.integrationConnectionId ?? "",
    delivery.payloadJson,
  );
}
```
**Key detail:** Dynamic import avoids circular dependency between packages/integrations and packages/api. processLinearWebhook signature matches processJiraWebhook: `(prisma, organizationId, connectionId, payload)`.

### Pattern 2: Fire-and-Forget Outbound Sync
**What:** `void (async () => { ... })()` pattern after transaction completes
**When to use:** Syncing task status to external system (Linear, Jira) without blocking the mutation response
**Example:**
```typescript
// Source: packages/api/src/routers/workflow.ts lines 1336-1349
void (async () => {
  try {
    const { syncTaskStatusToLinear } = await import(
      "../services/linear-issue-sync.js"
    );
    await syncTaskStatusToLinear(prisma, result.id, "CANCELLED");
  } catch (err) {
    console.error(
      "[workflow/cancelRun] Outbound Linear sync failed:",
      err,
    );
  }
})();
```
**Key detail:** `syncTaskStatusToLinear` accepts `(prisma, taskRunId, targetStatus)`. It internally handles loop prevention, dedup, and checking whether the task has a linked Linear issue.

### Pattern 3: Integration Card in Settings
**What:** Provider-specific section component rendered in IntegrationsTab grid
**When to use:** Adding a new provider config UI to Settings > Integrations
**Example:** See `LinearProviderSection`, `TeamsProviderSection` in integrations-tab.tsx. Each is a self-contained component with its own connection query and config dialog. DPD/UPS cards should follow this pattern but use `CarrierCredentialForm` in a dialog instead of OAuth flow.

### Pattern 4: FeatureGate Wrapper
**What:** `<FeatureGate requiredTier="Pro" featureName="...">` wraps gated content
**When to use:** Inline gating of sub-features within accessible pages
**Example:**
```typescript
<FeatureGate requiredTier="Pro" featureName="Integrations">
  <IntegrationsTab />
</FeatureGate>
```
**Key detail:** FeatureGate renders children during loading (isLoading state) to avoid flashing upgrade banner. Props use title-case tier names ("Pro", "Enterprise").

### Pattern 5: requireTier Middleware on tRPC Procedures
**What:** Chain `.use(requireTier("PRO"))` on tenant procedures
**When to use:** API-level defense in depth alongside UI gating
**Example:**
```typescript
// Source: packages/api/src/routers/equipment.ts line 1104
createDpdShipment: tenantProcedure
  .use(requirePermission({ equipment: ["update"] }))
  .use(requireTier("PRO"))
  .input(...)
  .mutation(...)
```
**Key detail:** `requireTier` uses Prisma enum values ("STARTER", "PRO", "ENTERPRISE"), not title-case. Already imported in equipment router. Returns structured JSON error with `type: "TIER_REQUIRED"`.

### Anti-Patterns to Avoid
- **Custom webhook dispatch architecture:** Do NOT refactor the if/else chain -- it is intentional to avoid circular deps
- **Blocking outbound sync:** Do NOT await sync inside the transaction -- always fire-and-forget after
- **Per-component TIER_REQUIRED handling:** D-04 specifies a global error boundary, not per-component catch blocks
- **Redundant tier checks:** Do NOT add requireTier to procedures that already use proProcedure or enterpriseProcedure

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feature tier gating UI | Custom subscription check per component | `<FeatureGate>` component | Already handles loading states, tier comparison, upgrade banner |
| API tier gating | Custom middleware per router | `requireTier("PRO")` or `proProcedure` | Already handles subscription lookup, caching, structured error |
| Webhook dispatch | New dispatch architecture | Existing if/else chain in `_process/route.ts` | Matches Jira pattern, avoids circular deps |
| Outbound sync | New sync orchestrator | Existing fire-and-forget pattern | Proven pattern with error isolation |
| Carrier credential UI | New settings page | CarrierCredentialForm in IntegrationsTab grid | Component fully implemented, just needs mounting |

## Common Pitfalls

### Pitfall 1: cancelRun Bulk Update Loses Individual Task Context
**What goes wrong:** cancelRun uses `updateMany` to set all non-terminal tasks to CANCELLED. After the bulk update, you don't have individual task IDs with their externalRefType.
**Why it happens:** updateMany returns a count, not individual records.
**How to avoid:** Before the bulk cancel, query the tasks that have Linear links (`externalRefType: "LINEAR_ISSUE"`), then after the transaction, fire outbound sync for each.
**Warning signs:** outbound sync call with undefined taskRunId.

### Pitfall 2: IN_PROGRESS Has No Explicit Mutation
**What goes wrong:** There is no `startTask` mutation in the workflow router. TODO->IN_PROGRESS transition is allowed by the transition map but currently has no dedicated procedure.
**Why it happens:** The UI may implicitly start tasks or this transition may be deferred.
**How to avoid:** For D-09, focus on transitions that actually occur: DONE (completeTask), SKIPPED (skipTask), CANCELLED (cancelRun). If a startTask procedure exists elsewhere or is added, wire it then. Do NOT create a new startTask procedure -- that is out of scope.
**Warning signs:** Attempting to add outbound sync for a transition that never fires.

### Pitfall 3: FeatureGate Placement Needs PLAN_CONFIG Reference
**What goes wrong:** Gating the wrong features or missing features that STARTER excludes.
**Why it happens:** The excluded features list is in PLAN_CONFIG, not obvious from page structure.
**How to avoid:** Reference PLAN_CONFIG.tiers[0].excludedFeatures: "Integrations (Jira, Linear, Calendar)", "OCR invoice parsing", "Advanced workflows", "Audit log export", "API access".
**Warning signs:** STARTER users seeing PRO features, or PRO users seeing upgrade banners.

### Pitfall 4: Global Error Handler Must Parse Structured JSON
**What goes wrong:** The TIER_REQUIRED error is a JSON string inside `error.message`, not a direct property.
**Why it happens:** tRPC FORBIDDEN errors carry the structured payload as `JSON.stringify({type, requiredTier, currentTier})` in the message field.
**How to avoid:** The global error handler must `JSON.parse(error.message)` and check `parsed.type === "TIER_REQUIRED"`. Handle parse failures gracefully (not all FORBIDDEN errors are tier-related).
**Warning signs:** Raw JSON error shown to user, or upgrade banner on non-tier errors.

### Pitfall 5: Equipment Detail Already Has ShipmentForm Dialog
**What goes wrong:** Adding CarrierShipmentForm as a second dialog conflicts with existing ShipmentForm.
**Why it happens:** Equipment detail page already imports and mounts `ShipmentForm` (InPost manual entry) with `shipmentOpen` state.
**How to avoid:** CarrierShipmentForm should either replace ShipmentForm or be a separate dialog triggered by a different button (e.g., "Ship via Carrier" vs "Manual Shipment"). Check D-05: "Create Shipment" button opens CarrierShipmentForm. The existing ShipmentForm handles manual carrier entry. CarrierShipmentForm handles DPD/UPS API shipments. They serve different purposes -- likely need a "Ship via DPD/UPS" button alongside the existing "Create Shipment".
**Warning signs:** Two overlapping shipment dialogs, or removing the manual shipment capability.

### Pitfall 6: Carrier Credential Form Needs Integration Card Pattern
**What goes wrong:** Rendering CarrierCredentialForm without a card wrapper looks inconsistent.
**Why it happens:** Other providers (Jira, Linear, Teams) each have a dedicated `*ProviderSection` component wrapping a card + dialog.
**How to avoid:** Create DPD and UPS provider section components (similar to TeamsProviderSection) that render a card with carrier icon, connection status badge, and "Configure" button that opens CarrierCredentialForm in a Dialog.
**Warning signs:** Naked form fields in the integrations grid without a card container.

## Code Examples

### Linear Webhook Dispatch (to add in _process/route.ts after Jira block)
```typescript
// Add after line 84 (after Jira dispatch block)
if (provider === "linear") {
  const { processLinearWebhook } = await import(
    "@contractor-ops/api/services/linear-webhook-handler"
  );
  await processLinearWebhook(
    prisma,
    delivery.organizationId,
    delivery.integrationConnectionId ?? "",
    delivery.payloadJson,
  );
}
```

### Outbound Linear Sync in cancelRun
```typescript
// After the transaction in cancelRun, before return:
// Get tasks that had Linear links before bulk cancel
const linearTasks = run.tasks.filter(
  (t) => t.externalRefType === "LINEAR_ISSUE" && t.externalRefId,
);
for (const task of linearTasks) {
  void (async () => {
    try {
      const { syncTaskStatusToLinear } = await import(
        "../services/linear-issue-sync.js"
      );
      await syncTaskStatusToLinear(prisma, task.id, "CANCELLED");
    } catch (err) {
      console.error(
        "[workflow/cancelRun] Outbound Linear sync failed:",
        err,
      );
    }
  })();
}
```

### FeatureGate Wrapping Integrations Tab
```typescript
// In settings page, wrap IntegrationsTab content
<FeatureGate requiredTier="Pro" featureName="Integrations">
  <IntegrationsTab />
</FeatureGate>
```

### Global TIER_REQUIRED Error Handler (QueryClient onError)
```typescript
// In query-client.ts or a provider wrapper
import { toast } from "sonner";

function handleGlobalError(error: unknown) {
  const trpcErr = error as { message?: string; data?: { code?: string } };
  if (trpcErr?.data?.code === "FORBIDDEN" && trpcErr.message) {
    try {
      const parsed = JSON.parse(trpcErr.message);
      if (parsed.type === "TIER_REQUIRED") {
        // Show upgrade toast or render inline banner via global state
        toast.error(`This feature requires ${parsed.requiredTier} plan.`, {
          action: { label: "Upgrade", onClick: () => window.location.href = "/settings?tab=billing" },
        });
        return; // Suppress default error handling
      }
    } catch { /* not a tier error, fall through */ }
  }
}
```

### Carrier Provider Section for IntegrationsTab
```typescript
// DPD/UPS integration card pattern (like TeamsProviderSection)
function DpdProviderSection() {
  const [configOpen, setConfigOpen] = useState(false);
  return (
    <div className="space-y-4">
      {/* Card with DPD icon, status badge, Configure button */}
      <ProviderConnectionCard
        provider="dpd"
        displayName="DPD"
        icon={<Truck className="size-8 text-red-600" />}
        description="Ship equipment via DPD courier"
      />
      <CarrierCredentialForm
        carrier="dpd"
        carrierLabel="DPD"
        // Wrap in Dialog with open/onOpenChange
      />
    </div>
  );
}
```

## Wiring Inventory

### What Needs Connecting (complete list)

| Item | Source (exists) | Target (wire to) | Pattern |
|------|----------------|-------------------|---------|
| processLinearWebhook | linear-webhook-handler.ts | _process/route.ts | Provider dispatch if-block |
| syncTaskStatusToLinear for CANCELLED | linear-issue-sync.ts | workflow.ts cancelRun | Fire-and-forget after tx |
| syncTaskStatusToLinear for CANCELLED (Jira too) | jira-issue-sync.ts | workflow.ts cancelRun | Fire-and-forget after tx (Jira also missing) |
| CarrierShipmentForm | carrier-shipment-form.tsx | equipment/[id]/page.tsx | Dialog with button trigger |
| CarrierCredentialForm (DPD) | carrier-credential-form.tsx | settings integrations-tab.tsx | Provider card + dialog |
| CarrierCredentialForm (UPS) | carrier-credential-form.tsx | settings integrations-tab.tsx | Provider card + dialog |
| FeatureGate - Integrations | feature-gate.tsx | Settings integrations tab | Inline wrapper |
| FeatureGate - OCR | feature-gate.tsx | OCR trigger button/section | Inline wrapper |
| FeatureGate - Advanced workflows | feature-gate.tsx | Workflow features | Inline wrapper |
| FeatureGate - Audit log export | feature-gate.tsx | Settings audit log tab | Page-level or tab-level redirect |
| FeatureGate - API access | feature-gate.tsx | API access section | Page-level redirect |
| requireTier - integration procedures | tier.ts | jira/linear/calendar routers | Middleware chain |
| requireTier - OCR procedures | tier.ts | ocr router | Middleware chain |
| requireTier - advanced workflow procedures | tier.ts | workflow router (advanced features) | Middleware chain |
| requireTier - audit log export | tier.ts | audit log router | Middleware chain |
| Global TIER_REQUIRED handler | (new) | query-client.ts or provider | QueryClient onError |

### tRPC Procedures Needing requireTier("PRO")

Based on PLAN_CONFIG STARTER excludedFeatures:

| Feature Category | Router | Procedures to Gate |
|-----------------|--------|--------------------|
| Integrations | jira, linear, calendar routers | All mutations (connect, disconnect, sync, save mapping) |
| OCR | ocr router | triggerOcr, retriggerOcr |
| Advanced workflows | workflow router | TBD -- identify which features are "advanced" |

**Note:** Equipment DPD/UPS procedures already have `requireTier("PRO")` applied (lines 1104, 1291 in equipment.ts).

### tRPC Procedures Needing requireTier("ENTERPRISE")

| Feature Category | Router | Procedures to Gate |
|-----------------|--------|--------------------|
| Audit log export | audit log router | Export endpoint |
| API access | (if exists) | API key management |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | packages/api/vitest.config.ts, apps/web/vitest.config.ts |
| Quick run command | `pnpm --filter @contractor-ops/api test -- --run` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIN-04 | Linear webhook dispatched to processLinearWebhook | unit | `pnpm --filter @contractor-ops/api test -- --run -t "linear webhook"` | Existing linear-webhook-handler tests cover handler; dispatch wiring needs new test |
| LIN-05 | cancelRun fires outbound Linear sync | unit | `pnpm --filter @contractor-ops/api test -- --run -t "cancelRun"` | No existing test for cancelRun outbound sync |
| EQUIP-06 | DPD credential form renders in Settings | component | `pnpm --filter web test -- --run -t "DPD"` | No -- Wave 0 |
| EQUIP-07 | UPS credential form renders in Settings | component | `pnpm --filter web test -- --run -t "UPS"` | No -- Wave 0 |
| BILL-09 | FeatureGate shows upgrade for STARTER | unit | `pnpm --filter web test -- --run -t "FeatureGate"` | Exists: feature-gate.test.tsx |
| BILL-09 | requireTier rejects STARTER on PRO procedure | unit | `pnpm --filter @contractor-ops/api test -- --run -t "requireTier"` | Exists: tier.test.ts |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/api test -- --run`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- None critical -- existing test infrastructure covers core gating and webhook handler behavior. New wiring is integration-level (connecting tested pieces), testable via existing test patterns.

## Open Questions

1. **What constitutes "Advanced workflows" for STARTER exclusion?**
   - What we know: PLAN_CONFIG excludes "Advanced workflows" from STARTER
   - What's unclear: Which specific workflow features are "advanced" vs basic
   - Recommendation: Gate workflow template creation and conditional logic features, but keep basic task execution ungated. Claude's discretion per D-02.

2. **Does "API access" have a dedicated page/router?**
   - What we know: PLAN_CONFIG excludes "API access" from STARTER and PRO (only ENTERPRISE)
   - What's unclear: Whether an API key management page exists yet
   - Recommendation: If no API access page exists, this gate is a no-op for now. Add requireTier("ENTERPRISE") to any future API key router.

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation lookups
- Schema validation for all external inputs (Zod safeParse for webhook payloads)
- Strong typing, no unsafe shortcuts (except established tRPC proxy workaround pattern)
- Defense in depth: both UI and API tier gating
- Proper error handling and logging (console.error in fire-and-forget blocks)
- i18n: all user-facing strings through next-intl translation files
- Accessibility: FeatureGate/UpgradeInlineBanner already has role="status" and aria-live
- base-ui Button uses render prop for Link composition (not asChild)

## Sources

### Primary (HIGH confidence)
- `apps/web/src/app/api/webhooks/_process/route.ts` -- Jira dispatch pattern (lines 74-84)
- `packages/api/src/routers/workflow.ts` -- completeTask/skipTask outbound sync, cancelRun structure, TASK_TRANSITIONS map
- `packages/api/src/middleware/tier.ts` -- requireTier implementation and proProcedure/enterpriseProcedure
- `apps/web/src/components/billing/feature-gate.tsx` -- FeatureGate component API
- `apps/web/src/components/settings/integrations-tab.tsx` -- IntegrationsTab grid with provider sections
- `apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx` -- Equipment detail with existing ShipmentForm dialog
- `packages/api/src/routers/billing.ts` -- PLAN_CONFIG with tier features/excludedFeatures

### Secondary (MEDIUM confidence)
- `packages/api/src/services/linear-webhook-handler.ts` -- processLinearWebhook function signature
- `packages/api/src/services/linear-issue-sync.ts` -- syncTaskStatusToLinear function signature

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components exist, patterns established
- Architecture: HIGH -- pure wiring, no new architecture
- Pitfalls: HIGH -- identified from direct code inspection

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- internal codebase patterns)
