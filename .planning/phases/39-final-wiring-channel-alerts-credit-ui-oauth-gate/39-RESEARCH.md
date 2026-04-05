# Phase 39: Final Wiring -- Channel Alerts + Credit Exhaustion UI + OAuth FeatureGate - Research

**Researched:** 2026-04-06
**Domain:** Notification dispatch wiring, billing UI integration, feature gating
**Confidence:** HIGH

## Summary

Phase 39 closes three integration gaps identified in the v3.0 re-audit (MISSING-04, MISSING-05, MISSING-06). All three are "last mile" wiring problems where components exist but are not connected. No new libraries, services, or infrastructure are needed -- this is purely about calling existing code from the right places and wrapping existing UI with existing components.

The three workstreams are independent: (1) wire `sendChannelAlert` into `notification-service.ts` dispatch loop using the `channelMapping` already stored in `configJson`, (2) catch `PRECONDITION_FAILED` / `credits_exhausted` errors in OCR-triggering UI and render the existing `CreditExhaustedInline` component, (3) wrap OAuth connect buttons in `FeatureGate` for Linear, Google Workspace, and Teams provider sections.

**Primary recommendation:** Three small, independent plans -- one per gap. Each modifies 2-4 files. No new packages or architecture changes required.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEAM-02 | Admin can configure which Teams channel receives which notification types | Channel mapping UI exists (TeamsChannelMappingCard stores to configJson.channelMapping). Gap: dispatch loop never reads channelMapping. Wire sendChannelAlert call into notification-service.ts. |
| TEAM-03 | System sends activity alerts to configured Teams channels via Adaptive Cards | sendChannelAlert is implemented in both TeamsMessagingProvider and SlackMessagingProvider. Gap: never called. Same fix as TEAM-02 -- add dispatch branch. |
| BILL-06 | System hard-blocks OCR when credits exhausted (with upgrade/top-up prompt) | Backend hard-blocks correctly (PRECONDITION_FAILED with reason: credits_exhausted). CreditExhaustedInline component exists. Gap: never imported/rendered in OCR-triggering UI. |
| BILL-09 | Middleware gates features by org's active subscription tier with graceful upgrade prompts | requireTier middleware exists. FeatureGate component exists. Gap: OAuth connect buttons in 3 provider sections not wrapped with FeatureGate. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation (not applicable -- no new libraries)
- Schema validation for all external inputs (Zod already used throughout)
- Clean architecture, SOLID, DRY, separation of concerns
- Strong typing, avoid unsafe shortcuts
- Accessibility: keyboard navigation, focus states, semantic HTML, screen-reader friendliness
- Observability: proper logging, error handling, avoid silent failures
- Production-grade code, not demo-grade shortcuts

## Standard Stack

No new libraries needed. This phase exclusively uses existing project infrastructure:

### Core (Already Installed)
| Library | Purpose | Used By |
|---------|---------|---------|
| `@trpc/server` | API layer, error codes (PRECONDITION_FAILED) | ocr.ts router |
| `@tanstack/react-query` | Client-side data fetching, mutation error handling | All UI components |
| `sonner` | Toast notifications | Error feedback |
| `botbuilder` | Teams Adaptive Cards via continueConversation | TeamsMessagingProvider |
| `next-intl` | i18n translations | All UI components |

### Supporting (Already Installed)
| Library | Purpose | Used By |
|---------|---------|---------|
| `lucide-react` | AlertTriangle icon in CreditExhaustedInline | Billing components |
| `@contractor-ops/validators` | NOTIFICATION_TYPES enum | notification-service.ts |

## Architecture Patterns

### Pattern 1: Notification Dispatch with Channel Alert Routing

**What:** Extend the existing `dispatch()` function in `notification-service.ts` to also call `sendChannelAlert` when a notification type maps to a configured channel.

**Current dispatch loop (lines 244-278):**
```
for provider of connectedProviders:
  if APPROVAL_REQUEST -> sendApprovalCard(recipientId)
  else -> sendReminderDM(recipientId)
```

**Required addition -- channel alert routing:**
After the per-recipient loop, add a per-provider channel alert dispatch that:
1. Reads `configJson.channelMapping` from the integration connection
2. Maps notification type to a category (approvals, invoices, contracts, tasks, equipment)
3. If a channelId is configured for that category, calls `provider.sendChannelAlert()`

**Critical design decision:** Channel alerts are broadcast to a channel, not per-recipient. They should fire once per provider per dispatch, not once per recipient. Place the channel alert logic OUTSIDE the `for (userId of recipientUserIds)` loop but INSIDE the provider iteration.

**Notification type to category mapping:**
```typescript
const NOTIFICATION_TYPE_TO_CATEGORY: Record<string, string> = {
  APPROVAL_REQUEST: "approvals",
  APPROVAL_DECISION: "approvals",
  INVOICE_RECEIVED: "invoices",
  CONTRACT_EXPIRING: "contracts",
  TASK_ASSIGNED: "tasks",
  TASK_OVERDUE: "tasks",
  EQUIPMENT_RETURN_REQUESTED: "equipment",
  EQUIPMENT_RETURN_APPROVED: "equipment",
  EQUIPMENT_RETURN_REJECTED: "equipment",
};
```

Types like `CREDIT_EXHAUSTED`, `TRIAL_ENDING`, `PAYMENT_FAILED`, `SUBSCRIPTION_CHANGED`, `DIRECTORY_NEW_HIRE`, `DIRECTORY_DEPARTURE`, `KSEF_SYNC_COMPLETE`, `PAYMENT_ACTION_REQUIRED` are admin-only billing/system notifications -- do NOT route to channels.

### Pattern 2: Credit Exhaustion Error Interception in OCR UI

**What:** Detect `PRECONDITION_FAILED` with `credits_exhausted` reason in OCR mutation error handlers and render `CreditExhaustedInline` instead of generic error.

**Current error path:**
- `ocr.ts` throws `TRPCError({ code: "PRECONDITION_FAILED", message: "OCR credits exhausted", cause: { reason: "credits_exhausted" } })`
- `invoice-upload-area.tsx` line 236: bare `catch {}` swallows the error with `console.warn("OCR trigger failed")`
- `portal/invoice-submit-form.tsx`: similar OCR trigger with generic error handling

**Required change:**
- In OCR trigger catch blocks, check if the error is `PRECONDITION_FAILED` with `credits_exhausted` reason
- If so, set a state flag `creditExhausted = true`
- Render `<CreditExhaustedInline onUpgrade={...} onBuyCredits={...} />` when flag is true
- `onUpgrade` navigates to `/settings?tab=billing`
- `onBuyCredits` opens the top-up dialog or navigates to billing

**Error shape to detect:**
```typescript
// tRPC error shape on client
const isCreditExhausted = (error: unknown): boolean => {
  const trpcErr = error as { data?: { code?: string }; message?: string };
  return (
    trpcErr?.data?.code === "PRECONDITION_FAILED" &&
    trpcErr?.message === "OCR credits exhausted"
  );
};
```

### Pattern 3: FeatureGate Wrapping OAuth Connect Buttons

**What:** Wrap the `ProviderConnectionCard` in each provider section with `<FeatureGate requiredTier="Pro">` so STARTER users see an upgrade banner instead of the connect button.

**Current state:** The `FeatureGate` component is already imported and used in `TeamsChannelMappingCard` (line 10, 159). This is the exact same pattern needed for the provider sections.

**Where to wrap:**
1. `linear-provider-section.tsx` -- wrap the entire return JSX with `<FeatureGate requiredTier="Pro" featureName="Linear integration">`
2. `google-workspace-provider-section.tsx` -- same pattern with `featureName="Google Workspace integration"`
3. `teams-provider-section.tsx` -- same pattern with `featureName="Microsoft Teams integration"`

**Important nuance from Phase 38 decision:** "FeatureGate wraps at component return level for dedicated feature components." The entire provider section should be gated, not just the connect button, because even viewing connection status for a gated feature is misleading for STARTER users.

### Anti-Patterns to Avoid
- **Channel alert inside per-recipient loop:** Channel alerts are channel-wide broadcasts, not per-user messages. Sending once per recipient would spam the channel.
- **Swallowing credit exhaustion errors silently:** The current `catch {}` blocks must distinguish credit exhaustion from transient OCR failures.
- **Gating only the connect button:** If only the button is gated but the card still renders, STARTER users see a broken-looking UI with a card but no action.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Channel alert routing | Custom event bus | Extend existing `dispatch()` in notification-service.ts | Infrastructure already exists, just needs one more branch |
| Credit exhaustion UI | Custom error banner | Existing `CreditExhaustedInline` component | Already built, tested, and styled in Phase 28 |
| Tier gating UI | Custom upgrade prompt | Existing `FeatureGate` component | Already built and used in 4+ places across the app |
| Error type detection | Custom error parser | Check tRPC error shape (data.code + message) | Standard tRPC error format, no parsing needed |

## Common Pitfalls

### Pitfall 1: Channel Alert Fires Inside Per-Recipient Loop
**What goes wrong:** If `sendChannelAlert` is called inside the `for (userId of recipientUserIds)` loop, a notification with 5 recipients sends 5 identical channel alerts.
**Why it happens:** The existing dispatch structure iterates recipients first.
**How to avoid:** Place channel alert logic in a separate block after the recipient loop, iterating only providers.
**Warning signs:** Multiple identical Adaptive Cards appearing in the same Teams channel.

### Pitfall 2: channelMapping Lookup Returns Stale Data
**What goes wrong:** The `getConnectedMessagingProviders()` function only returns provider instances, not the connection's `configJson`. A separate DB query is needed to read `channelMapping`.
**Why it happens:** The provider factory (messaging/index.ts) strips configJson for simplicity.
**How to avoid:** Either pass configJson through the provider factory, or query the IntegrationConnection separately in the channel alert branch. The TeamsMessagingProvider already does a connection lookup in `sendChannelAlert` (lines 172-179) -- Slack needs the same lookup for channelMapping but a different query for the channel ID.
**Warning signs:** Channel alerts only working for Teams but not Slack, or vice versa.

### Pitfall 3: tRPC Error Shape Differences Between Client and Server
**What goes wrong:** The `cause` field set in `TRPCError` on the server is not directly accessible on the client. The client sees `data.code` and `message`.
**Why it happens:** tRPC serializes errors differently between server and client contexts.
**How to avoid:** Detect credit exhaustion via `error.data.code === "PRECONDITION_FAILED"` and `error.message === "OCR credits exhausted"` (the message string). Do NOT rely on `error.cause.reason`.
**Warning signs:** Error detection works in tests but not in the browser.

### Pitfall 4: FeatureGate Loading Flash
**What goes wrong:** FeatureGate shows upgrade banner briefly while subscription data loads.
**Why it happens:** `useQuery` for billing.getSubscription starts in loading state.
**How to avoid:** FeatureGate already handles this (line 48: renders children during loading). No action needed, but verify this behavior in tests.
**Warning signs:** Flash of upgrade banner on page load before subscription resolves.

### Pitfall 5: Portal OCR Path Uses Different Router
**What goes wrong:** Portal invoice submission uses `ocr.portalTrigger` (line 182-203 of ocr.ts), not `ocr.trigger`. Both throw the same PRECONDITION_FAILED but the portal component also needs CreditExhaustedInline.
**Why it happens:** Portal and admin use separate tRPC procedures.
**How to avoid:** Apply credit exhaustion UI to BOTH `invoice-upload-area.tsx` (admin) AND `portal/invoice-submit-form.tsx` (contractor portal).
**Warning signs:** Admin sees credit exhaustion prompt but portal contractors see generic error.

## Code Examples

### Channel Alert Dispatch Addition (notification-service.ts)

```typescript
// After the per-recipient loop, add channel alert dispatch
// This runs once per provider, not once per recipient
const providers = await getConnectedMessagingProviders(event.organizationId);
const category = NOTIFICATION_TYPE_TO_CATEGORY[event.type];

if (category) {
  for (const provider of providers) {
    try {
      // Look up channelMapping from the integration connection
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: event.organizationId,
          provider: provider.platform === "slack" ? "SLACK" : "MICROSOFT_TEAMS",
          status: "CONNECTED",
        },
        select: { configJson: true },
      });

      const config = (connection?.configJson as Record<string, unknown>) ?? {};
      const channelMapping = (config.channelMapping as Record<string, string>) ?? {};
      const channelId = channelMapping[category];

      if (channelId) {
        await provider.sendChannelAlert({
          organizationId: event.organizationId,
          channelId,
          title: event.title,
          body: event.body,
          entityType: event.entityType,
          entityId: event.entityId,
          details: [], // Build from event.metadata
          viewUrl: buildEntityUrl(event.entityType, event.entityId),
        });
      }
    } catch (error) {
      console.error(
        `[notification-service] ${provider.platform} channel alert failed:`,
        error,
      );
    }
  }
}
```

### Credit Exhaustion Detection (invoice-upload-area.tsx)

```typescript
// Helper to detect credit exhaustion from tRPC error
function isCreditExhaustedError(error: unknown): boolean {
  const trpcErr = error as { data?: { code?: string }; message?: string };
  return (
    trpcErr?.data?.code === "PRECONDITION_FAILED" &&
    trpcErr?.message === "OCR credits exhausted"
  );
}

// In the OCR trigger catch block:
} catch (ocrError) {
  if (isCreditExhaustedError(ocrError)) {
    setCreditExhausted(true);
  } else {
    console.warn("OCR trigger failed, manual entry available");
  }
}

// In JSX:
{creditExhausted && (
  <CreditExhaustedInline
    onUpgrade={() => { window.location.href = "/settings?tab=billing"; }}
    onBuyCredits={() => { window.location.href = "/settings?tab=billing"; }}
  />
)}
```

### FeatureGate Wrapping (linear-provider-section.tsx)

```typescript
import { FeatureGate } from "@/components/billing/feature-gate";

export function LinearProviderSection() {
  // ... existing hooks ...

  return (
    <FeatureGate requiredTier="Pro" featureName="Linear integration">
      <div className="space-y-4">
        {/* ... existing JSX unchanged ... */}
      </div>
    </FeatureGate>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct Slack calls in notification-service | MessagingProvider abstraction | Phase 32 | Channel alerts use the same abstraction |
| Generic error toasts for all tRPC errors | handleTierError in query-client.ts | Phase 36 | Credit exhaustion needs similar pattern but inline, not toast |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `packages/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| Quick run command | `npx vitest run --reporter verbose` (from package dir) |
| Full suite command | `npx turbo run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEAM-02 | Channel alert dispatch reads channelMapping and calls sendChannelAlert | unit | `cd packages/api && npx vitest run src/services/__tests__/notification-service.test.ts -x` | Exists -- needs new test cases |
| TEAM-03 | Activity alerts delivered to Teams channels via Adaptive Cards | unit | Same as above (sendChannelAlert already tested in messaging-provider.test.ts) | Exists |
| BILL-06 | CreditExhaustedInline renders when OCR trigger returns credits_exhausted | unit | `cd apps/web && npx vitest run src/components/invoices/__tests__/invoice-upload-area.test.ts -x` | Exists -- needs credit exhaustion case |
| BILL-09 | OAuth connect buttons gated by FeatureGate for STARTER users | unit | `cd apps/web && npx vitest run src/components/integrations/__tests__/linear-provider-section.test.tsx -x` | Exists -- needs FeatureGate assertion |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run src/services/__tests__/notification-service.test.ts -x`
- **Per wave merge:** `npx turbo run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- None -- existing test infrastructure covers all phase requirements. New test cases need to be added to existing test files.

## Open Questions

1. **Slack channelMapping storage location**
   - What we know: TeamsChannelMappingCard saves to configJson.channelMapping on the MICROSOFT_TEAMS connection. The Slack integration predates this pattern.
   - What's unclear: Does Slack have an equivalent channel mapping UI, or does it use a single channel? The current SlackMessagingProvider.sendChannelAlert takes a channelId but there may be no UI to configure it.
   - Recommendation: Check if Slack has a channelMapping in configJson. If not, channel alerts for Slack can be deferred (Teams is the primary target for TEAM-02/TEAM-03). For MVP, only wire Teams channel alerts; add Slack channel mapping UI in a future phase if needed.

2. **Portal invoice form OCR trigger location**
   - What we know: portal/invoice-submit-form.tsx is a large form component (350+ lines). The OCR trigger is somewhere within it.
   - What's unclear: Exact location of the OCR trigger catch block in the portal form.
   - Recommendation: Read the full file during planning/execution to locate the catch block.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all files listed in this research
- `packages/api/src/services/notification-service.ts` -- dispatch loop (lines 187-280)
- `packages/api/src/services/messaging/types.ts` -- MessagingProvider interface with sendChannelAlert
- `packages/api/src/routers/ocr.ts` -- PRECONDITION_FAILED throw (lines 72-79)
- `apps/web/src/components/billing/credit-exhausted-inline.tsx` -- existing component
- `apps/web/src/components/billing/feature-gate.tsx` -- existing component
- `.planning/v3.0-MILESTONE-AUDIT.md` -- gap definitions (MISSING-04/05/06)

### Secondary (MEDIUM confidence)
- `apps/web/src/components/integrations/teams-channel-mapping-card.tsx` -- channelMapping categories (line 45-51)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing codebase components
- Architecture: HIGH -- extending existing dispatch pattern with one additional branch
- Pitfalls: HIGH -- identified from direct code inspection of error handling paths

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- internal wiring, no external dependency changes)
