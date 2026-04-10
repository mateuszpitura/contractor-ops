# Phase 39: Final Wiring -- Channel Alerts + Credit Exhaustion UI + OAuth FeatureGate - Research

**Researched:** 2026-04-06
**Domain:** Notification dispatch wiring, billing UI integration, feature gating
**Confidence:** HIGH

## Summary

Phase 39 is a pure wiring phase -- all building blocks already exist in the codebase. The three workstreams are: (1) Add channel alert dispatch to `notification-service.ts` so `sendChannelAlert` is actually called using `channelMapping` from `configJson`, (2) Mount the existing `CreditExhaustedInline` component in OCR-triggering UI when credits are exhausted, (3) Wrap three OAuth provider sections with the existing `FeatureGate` component.

The gap is well-defined by the v3.0 milestone audit (MISSING-04, MISSING-05, MISSING-06). Every component, interface, and service needed already exists. No new libraries, no new data models, no new API routes. This is exclusively about connecting existing pieces.

**Primary recommendation:** Three independent plans, one per workstream. Each is a small wiring task (1-2 files changed) with test additions to existing test files.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEAM-02 | Admin can configure which Teams channel receives which notification types | Channel mapping UI and storage already exist (TeamsChannelMappingCard + teams router). Missing: dispatch loop consuming the mapping. |
| TEAM-03 | System sends activity alerts to configured Teams channels via Adaptive Cards | TeamsMessagingProvider.sendChannelAlert exists with Adaptive Card support. Missing: notification-service.ts never calls it. |
| BILL-06 | System hard-blocks OCR when credits exhausted (with upgrade/top-up prompt) | Backend hard-blocks correctly (PRECONDITION_FAILED). CreditExhaustedInline exists. Missing: component never mounted in invoice-upload-area.tsx or portal/invoice-submit-form.tsx. |
| BILL-09 | Middleware gates features by org's active subscription tier with graceful upgrade prompts | requireTier middleware works. FeatureGate component works. Missing: Linear, Google Workspace, Teams provider sections not wrapped with FeatureGate. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **UI quality:** Use `frontend-design` plugin for all UI work. High-quality, polished, production-ready interfaces.
- **Architecture:** Monorepo with Turborepo. Clean architecture, SOLID, DRY, separation of concerns.
- **Library docs:** Always use `ctx7` CLI for library documentation.
- **Validation:** Schema validation for all external inputs. Never trust client input.
- **Security:** Least-privilege access, rate limiting, secure defaults.
- **Code quality:** Strong typing, no unsafe shortcuts. Explicitness over magic.
- **Accessibility:** WCAG compliance, keyboard navigation, semantic HTML, screen-reader friendliness.

## Standard Stack

No new libraries needed. All dependencies are already installed.

### Core (Already in Project)
| Library | Purpose | Used In |
|---------|---------|---------|
| `botbuilder` | Teams Adaptive Cards via CloudAdapter | teams-messaging-provider.ts |
| `@slack/web-api` | Slack channel message posting | slack-messaging-provider.ts |
| `@tanstack/react-query` | Client-side data fetching | All UI components |
| `next-intl` | i18n translations | All UI components |
| `lucide-react` | Icons (AlertTriangle, Gem) | CreditExhaustedInline, UpgradeInlineBanner |
| `sonner` | Toast notifications | Invoice upload area |

### No New Installations Required

This phase adds zero new dependencies. All work is wiring existing code.

## Architecture Patterns

### Workstream 1: Channel Alert Dispatch (TEAM-02, TEAM-03)

**Current state of notification-service.ts dispatch loop:**
```typescript
// Current: Per-recipient loop (lines 187-279)
for (const userId of event.recipientUserIds) {
  // ... dedup, in-app, email, then:
  for (const provider of providers) {
    // Only calls sendApprovalCard or sendReminderDM
    // NEVER calls sendChannelAlert
  }
}
```

**What needs to happen:**
After the per-recipient loop, add a channel alert dispatch block that:
1. Maps `event.type` (NotificationType) to a channel category string
2. For each connected messaging provider, looks up `configJson.channelMapping`
3. If a channelId is mapped for that category, calls `provider.sendChannelAlert()`

**Notification type to category mapping:**
| NotificationType | Category |
|-----------------|----------|
| `APPROVAL_REQUEST`, `APPROVAL_DECISION` | `approvals` |
| `INVOICE_RECEIVED` | `invoices` |
| `CONTRACT_EXPIRING` | `contracts` |
| `TASK_ASSIGNED`, `TASK_OVERDUE` | `tasks` |
| `EQUIPMENT_RETURN_REQUESTED`, `EQUIPMENT_RETURN_APPROVED`, `EQUIPMENT_RETURN_REJECTED` | `equipment` |
| All others (`TRIAL_ENDING`, `PAYMENT_FAILED`, etc.) | No channel alert (billing/system notifications) |

These categories match exactly what `channelMappingSchema` accepts in `teams.ts`:
```typescript
z.enum(["approvals", "invoices", "contracts", "tasks", "equipment"])
```

**Channel mapping storage pattern:**
- Teams: `IntegrationConnection.configJson.channelMapping` (Record<category, channelId>)
- Slack: No channelMapping stored currently. Slack can use the same pattern if needed, but the audit only calls out Teams. Slack's sendChannelAlert already works -- it just needs a channelId.

**Key design decision:** The channel alert dispatch should happen AFTER the per-recipient loop, not inside it. Channel alerts are org-level, not per-user. One alert per channel per event, not one per recipient.

**Implementation location:** `packages/api/src/services/notification-service.ts`

**Channel reference lookup:** TeamsMessagingProvider.sendChannelAlert already handles looking up `teamConversationReferences[channelId]` from configJson. SlackMessagingProvider.sendChannelAlert already takes a channelId and posts to it. No changes needed in providers.

### Workstream 2: Credit Exhaustion UI (BILL-06)

**Current state:**
- `invoice-upload-area.tsx` catches OCR errors generically (line 236: `catch { console.warn(...) }`)
- `portal/invoice-submit-form.tsx` also catches OCR errors generically
- Server returns `TRPCError({ code: "PRECONDITION_FAILED", message: "OCR credits exhausted" })`

**What needs to happen:**
1. Add `creditExhausted` boolean state to both components
2. In the OCR trigger catch block, detect the specific error:
   ```typescript
   function isCreditExhaustedError(error: unknown): boolean {
     return (
       error instanceof TRPCClientError &&
       error.data?.code === "PRECONDITION_FAILED" &&
       error.message === "OCR credits exhausted"
     );
   }
   ```
3. When detected, set `creditExhausted = true`
4. Render `<CreditExhaustedInline>` below the upload area when state is true
5. Wire `onUpgrade` and `onBuyCredits` to navigate to `/settings?tab=billing`

**CreditExhaustedInline props:**
```typescript
interface CreditExhaustedInlineProps {
  onUpgrade: () => void;
  onBuyCredits: () => void;
}
```

**Implementation locations:**
- `apps/web/src/components/invoices/invoice-upload-area.tsx`
- `apps/web/src/components/portal/invoice-submit-form.tsx`

### Workstream 3: FeatureGate on OAuth Provider Sections (BILL-09)

**Current state:**
- `LinearProviderSection`, `GoogleWorkspaceProviderSection`, `TeamsProviderSection` render ProviderConnectionCard directly
- STARTER users can see and click Connect, start OAuth, then hit API-level tier gate (bad UX)

**What needs to happen:**
Wrap the return JSX of each provider section with `<FeatureGate>`:
```typescript
return (
  <FeatureGate requiredTier="Pro" featureName="Linear integration">
    <div className="space-y-4">
      {/* existing JSX */}
    </div>
  </FeatureGate>
);
```

**FeatureGate behavior (already implemented):**
- During loading: renders children (no flash per Phase 35 decision)
- STARTER tier: renders `UpgradeInlineBanner` instead of children
- PRO/ENTERPRISE: renders children normally

**Feature names per UI-SPEC:**
- Linear: `"Linear integration"`
- Google Workspace: `"Google Workspace integration"`
- Teams: `"Microsoft Teams integration"`

**Implementation locations:**
- `apps/web/src/components/integrations/linear-provider-section.tsx`
- `apps/web/src/components/integrations/google-workspace-provider-section.tsx`
- `apps/web/src/components/integrations/teams-provider-section.tsx`

**Note:** `TeamsChannelMappingCard` already imports `FeatureGate` and wraps its save functionality. The provider section wrapper is at a higher level -- it gates the entire section including the connect button.

### Anti-Patterns to Avoid

- **Calling sendChannelAlert inside the per-recipient loop:** Channel alerts are org-level, dispatched once per event per channel, not per recipient.
- **Re-implementing credit check on the client:** The server already returns `PRECONDITION_FAILED`. Detect the error message, don't add a separate `getCreditBalance` query.
- **Wrapping individual buttons with FeatureGate:** Wrap the entire provider section. Showing a disconnected card with a disabled connect button is worse UX than showing the upgrade banner.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credit exhaustion UI | New error banner component | `CreditExhaustedInline` (exists) | Already built, tested, accessible (role=alert) |
| Tier gating UI | Custom subscription check + banner | `FeatureGate` component (exists) | Already handles loading states, tier comparison, renders UpgradeInlineBanner |
| Channel alert sending | Custom channel post logic | `provider.sendChannelAlert()` (exists) | Both Slack and Teams providers implement this method |
| Notification type categorization | Ad-hoc if/else chains | Const mapping object | Matches channelMappingSchema enum exactly |

## Common Pitfalls

### Pitfall 1: Channel Alert Double-Dispatch
**What goes wrong:** If sendChannelAlert is placed inside the per-recipient loop, the same channel gets alerted N times (once per recipient).
**Why it happens:** The dispatch loop iterates recipientUserIds for DMs/in-app. Channel alerts are broadcast, not per-user.
**How to avoid:** Place channel alert dispatch AFTER the for-of recipientUserIds loop, as a separate block.
**Warning signs:** Multiple identical messages in a Teams/Slack channel for one event.

### Pitfall 2: TRPCClientError Detection
**What goes wrong:** Catching generic errors and checking `error.message` without verifying it's a TRPCClientError.
**Why it happens:** The catch block in invoice-upload-area.tsx currently catches all errors.
**How to avoid:** Import `TRPCClientError` from `@trpc/client` and use `instanceof` check before accessing `.data?.code`.
**Warning signs:** Runtime errors when accessing `.data` on non-TRPCClientError objects.

### Pitfall 3: FeatureGate Import Path
**What goes wrong:** Importing FeatureGate from wrong path or forgetting "use client" directive.
**Why it happens:** FeatureGate uses hooks (useQuery) so it must be in a client component.
**How to avoid:** Import from `@/components/billing/feature-gate`. All three provider sections are already "use client".
**Warning signs:** "useQuery can only be used in a Client Component" build error.

### Pitfall 4: Channel Mapping Lookup for Slack
**What goes wrong:** Assuming Slack has channelMapping in configJson. Currently only Teams stores this.
**Why it happens:** The dispatch code needs to look up channel mapping per provider.
**How to avoid:** Look up channelMapping from the MICROSOFT_TEAMS IntegrationConnection specifically. For Slack, either skip channel alerts (if no mapping exists) or add a Slack channel mapping UI later. The audit specifically calls out Teams channel alerts.
**Warning signs:** Attempting to read channelMapping from Slack's IntegrationConnection.configJson and getting undefined.

### Pitfall 5: Portal Route Navigation
**What goes wrong:** Using `router.push("/settings?tab=billing")` in portal context where that route doesn't exist.
**Why it happens:** Portal users have a different route structure.
**How to avoid:** In portal context, the CreditExhaustedInline onUpgrade/onBuyCredits should either show a message directing the user to contact their admin, or navigate to the portal's billing-relevant page. Check how portal routing works.
**Warning signs:** 404 after clicking "Upgrade plan" in portal.

## Code Examples

### Channel Alert Dispatch Addition (notification-service.ts)

```typescript
// After the per-recipient loop in dispatch(), add:

// Channel alert dispatch (org-level, not per-user)
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

const category = NOTIFICATION_TYPE_TO_CATEGORY[event.type];
if (category) {
  const providers = await getConnectedMessagingProviders(event.organizationId);
  for (const provider of providers) {
    try {
      // Look up channel mapping from the provider's IntegrationConnection
      const providerKey = provider.platform === "teams" ? "MICROSOFT_TEAMS" : "SLACK";
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: event.organizationId,
          provider: providerKey,
          status: "CONNECTED",
        },
        select: { configJson: true },
      });

      const config = (connection?.configJson as Record<string, unknown>) ?? {};
      const channelMapping = (config.channelMapping as Record<string, string>) ?? {};
      const channelId = channelMapping[category];

      if (!channelId) continue;

      await provider.sendChannelAlert({
        organizationId: event.organizationId,
        channelId,
        title: event.title,
        body: event.body,
        entityType: event.entityType,
        entityId: event.entityId,
        details: [], // Minimal details for now
        viewUrl: buildEntityUrl(event.entityType, event.entityId),
      });
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
import { TRPCClientError } from "@trpc/client";
import { CreditExhaustedInline } from "@/components/billing/credit-exhausted-inline";
import { useRouter } from "@/i18n/navigation";

// Inside component:
const router = useRouter();
const [creditExhausted, setCreditExhausted] = useState(false);

// In the OCR trigger catch block:
} catch (error) {
  if (
    error instanceof TRPCClientError &&
    error.data?.code === "PRECONDITION_FAILED" &&
    error.message === "OCR credits exhausted"
  ) {
    setCreditExhausted(true);
  } else {
    console.warn("OCR trigger failed, manual entry available");
  }
}

// In JSX, after the upload area:
{creditExhausted && (
  <CreditExhaustedInline
    onUpgrade={() => router.push("/settings?tab=billing")}
    onBuyCredits={() => router.push("/settings?tab=billing")}
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
        {/* existing JSX unchanged */}
      </div>
    </FeatureGate>
  );
}
```

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
| TEAM-02/03 | dispatch calls sendChannelAlert for mapped categories | unit | `cd packages/api && npx vitest run src/services/__tests__/notification-service.test.ts -x` | Yes (needs new test cases) |
| BILL-06 | CreditExhaustedInline renders on OCR credit error | unit | `cd apps/web && npx vitest run src/components/invoices/__tests__/invoice-upload-area.test.tsx -x` | Yes (needs new test cases) |
| BILL-09 | FeatureGate wraps provider sections | unit | `cd apps/web && npx vitest run src/components/integrations/__tests__/linear-provider-section.test.tsx -x` | Yes (needs new test cases) |

### Sampling Rate
- **Per task commit:** Quick test of changed file
- **Per wave merge:** `npx turbo run test`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. New test cases added to existing files.

## Open Questions

1. **Slack channel mapping**
   - What we know: Only Teams has a channelMapping UI and storage. Slack does not have configJson.channelMapping.
   - What's unclear: Should channel alerts also fire for Slack if/when mapping is configured?
   - Recommendation: Implement the dispatch to work for any provider that has channelMapping in configJson. If Slack doesn't have it, the code naturally skips it (channelId will be undefined). This is forward-compatible.

2. **Portal credit exhaustion navigation**
   - What we know: Portal uses different routes than the admin app.
   - What's unclear: What happens when portal user clicks "Upgrade plan"? They can't access `/settings?tab=billing`.
   - Recommendation: In portal context, show a modified message like "Contact your organization admin to upgrade" or hide the navigation buttons. Check portal route structure during implementation.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed in this research
- v3.0 Milestone Audit (`.planning/v3.0-MILESTONE-AUDIT.md`) -- defines MISSING-04, MISSING-05, MISSING-06
- Phase 39 UI-SPEC (`.planning/phases/39-final-wiring-channel-alerts-credit-ui-oauth-gate/39-UI-SPEC.md`)
- Phase 39 Validation Strategy (same directory, `39-VALIDATION.md`)

### Key Files Analyzed
- `packages/api/src/services/notification-service.ts` -- dispatch loop, the primary target for channel alert wiring
- `packages/api/src/services/messaging/types.ts` -- MessagingProvider interface with sendChannelAlert
- `packages/api/src/services/messaging/teams-messaging-provider.ts` -- sendChannelAlert implementation
- `packages/api/src/services/messaging/slack-messaging-provider.ts` -- sendChannelAlert implementation
- `packages/api/src/routers/teams.ts` -- channelMapping schema and storage
- `packages/api/src/routers/ocr.ts` -- PRECONDITION_FAILED error for credit exhaustion
- `packages/api/src/services/credit-service.ts` -- checkAndDeductCredit logic
- `apps/web/src/components/invoices/invoice-upload-area.tsx` -- OCR trigger and error handling
- `apps/web/src/components/billing/credit-exhausted-inline.tsx` -- existing component to mount
- `apps/web/src/components/billing/feature-gate.tsx` -- existing FeatureGate component
- `apps/web/src/components/integrations/linear-provider-section.tsx` -- needs FeatureGate wrap
- `apps/web/src/components/integrations/google-workspace-provider-section.tsx` -- needs FeatureGate wrap
- `apps/web/src/components/integrations/teams-provider-section.tsx` -- needs FeatureGate wrap
- `packages/validators/src/notification.ts` -- NOTIFICATION_TYPES enum

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing
- Architecture: HIGH -- all patterns already established in codebase, wiring only
- Pitfalls: HIGH -- gaps are well-documented in milestone audit, code paths clear

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- wiring phase, no external dependencies changing)
