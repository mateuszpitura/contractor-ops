# Phase 33: InPost Courier Integration - Research

**Researched:** 2026-04-04
**Domain:** InPost ShipX API integration, Geowidget, courier automation, contractor portal extension
**Confidence:** MEDIUM

## Summary

Phase 33 replaces manual shipment status updates with InPost ShipX API automation for the InPost carrier. The integration covers three domains: (1) shipment creation via ShipX REST API with Paczkomat selection via the Geowidget embeddable map, (2) automatic status tracking via webhooks with QStash-scheduled polling fallback, and (3) contractor portal extension for self-service equipment returns with label/QR delivery.

The existing codebase provides strong foundations: the `Shipment` model with its `carrier` string field, `ShipmentStatus` enum, `SHIPMENT_TO_EQUIPMENT_STATUS` mapping, and workflow auto-completion logic from Phase 30 are all designed for courier API compatibility. The portal authentication middleware (`portalProcedure`) and route group structure are ready for extension with an Equipment tab.

**Primary recommendation:** Build a standalone `CourierClient` interface (not extending `BaseAdapter`) with an `InPostClient` implementation that wraps ShipX REST API calls. Use the existing credential-service AES-256-GCM encryption pattern for API token storage. Embed InPost Geowidget v5 as a web component (`<inpost-geowidget>`) inside a Dialog modal on both admin and portal sides.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Paczkomat picker uses InPost Geowidget in a modal overlay -- admin clicks "Select Paczkomat" button on shipment form, modal opens with embedded map, picks locker, modal closes and populates the form
- **D-02:** InPost = Paczkomat only, no door-to-door courier option. Door delivery uses DPD/UPS in Phase 35
- **D-03:** Store contractor's preferred Paczkomat on their profile. Pre-fill on future shipments, admin can override
- **D-04:** Paczkomat picker (Geowidget modal) available on both admin panel and contractor portal (for returns)
- **D-05:** Primary: webhook endpoint receives status pushes from ShipX in real-time. Fallback: QStash-scheduled hourly polling catches missed webhook events
- **D-06:** Notifications sent on key statuses only: DELIVERED, FAILED, and RETURNED. Intermediate statuses update silently
- **D-07:** Webhook endpoint follows existing integration webhook pipeline pattern. Polling uses QStash scheduled task
- **D-08:** Portal gets a new "Equipment" tab showing assigned items with a "Return" button per item that opens the return flow
- **D-09:** Offboarding-triggered returns also send email/notification with direct link to the return page
- **D-10:** Contractor can request return anytime (self-service) but self-initiated returns require admin approval first. Offboarding-triggered returns skip approval
- **D-11:** Return is all-or-nothing for the equipment set -- contractor returns all assigned items in one shipment, no partial returns
- **D-12:** Admin panel shipment detail page shows label/QR code with download/print button
- **D-13:** Contractor receives return label/QR via portal Equipment tab and email notification after return is approved

### Claude's Discretion
- Label format (QR code for Paczkomat drop-off vs PDF label) -- based on ShipX API capabilities
- CourierClient interface design (separate bounded context, not BaseAdapter)
- ShipX API authentication and credential storage approach
- Webhook signature verification implementation
- Polling batch size and error retry logic
- Return approval notification template design
- Preferred Paczkomat storage field on Contractor model vs separate table
- Shipment creation form layout and field ordering
- Portal Equipment tab layout and responsive behavior

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EQUIP-05 | System integrates with InPost ShipX API for shipment creation, Parcel Locker selection, and auto-status tracking | ShipX REST API endpoints documented, Geowidget embedding pattern researched, webhook + polling architecture established |
| EQUIP-11 | Contractor can initiate equipment return via portal and receive shipping label | Portal extension patterns documented, return flow with approval workflow researched, label/QR delivery via ShipX API confirmed |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Schema validation**: All external inputs validated with Zod -- ShipX API responses, webhook payloads, Geowidget callback data must all be validated
- **Security**: AES-256-GCM encryption for ShipX API credentials, webhook signature verification, no secret exposure
- **Clean architecture**: CourierClient as separate bounded context per STATE.md decision
- **Monorepo/Turborepo**: New courier code likely in `packages/integrations/` or a new `packages/courier/` package
- **Strong typing**: Full TypeScript types for ShipX API request/response, CourierClient interface
- **Fire-and-forget**: Integration side-effects (webhook processing, notifications) never block user mutations
- **Multi-tenant**: All queries scoped by organizationId
- **i18n**: All UI strings through next-intl with pl/en translations
- **Accessibility**: Geowidget modal must be keyboard navigable, focus trapped, semantic HTML

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| InPost ShipX API | v1 | Shipment creation, label generation, status tracking | Official InPost REST API -- no npm SDK exists, build thin HTTP client |
| InPost Geowidget v5 | latest (CDN) | Paczkomat selection map widget | Official InPost embeddable widget via `<inpost-geowidget>` web component |
| @upstash/qstash | 2.10.1 | Scheduled polling, webhook async processing | Already used in project (KSeF sync, webhook pipeline) |
| Resend | 6.10.0 | Email notifications for label/QR delivery | Already used for all project email notifications |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | (project version) | ShipX API response validation, webhook payload validation | Every API boundary |
| next-intl | (project version) | UI translations for Equipment tab, return flow, form labels | All new UI strings |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom ShipX HTTP client | No npm SDK exists for ShipX | Must build thin wrapper; only ~5 endpoints needed |
| InPost Geowidget v5 (CDN) | @majlxrd/inpost-geowidget-next (npm) | NPM package is tiny community wrapper; CDN is official and always up-to-date. Use CDN directly with custom React wrapper |
| InPost Global API | ShipX API v1 | Global API is new (2025+), ShipX v1 is stable and documented. No sunset date announced yet. ShipX v1 is the safe choice for now |

**No installation needed** -- ShipX is a REST API (HTTP calls only). Geowidget loads from CDN. All other dependencies already exist in the project.

## Architecture Patterns

### Recommended Project Structure

```
packages/api/src/
  services/
    courier/
      courier-client.ts          # CourierClient interface
      inpost-client.ts           # InPost ShipX API implementation
      inpost-status-mapper.ts    # Map ShipX statuses to ShipmentStatus enum
      inpost-webhook-handler.ts  # Process incoming ShipX webhook events
      inpost-polling-service.ts  # QStash-triggered polling for missed webhooks
  routers/
    equipment.ts                 # Extended: InPost shipment creation, label retrieval
    portal.ts                    # Extended: Equipment tab, return request, return approval

apps/web/src/app/
  api/
    webhooks/inpost/route.ts     # Dedicated InPost webhook endpoint (not through [provider] route)
    cron/inpost-status-poll/route.ts  # QStash-scheduled polling endpoint
  [locale]/(portal)/portal/
    equipment/page.tsx           # New portal Equipment tab

apps/web/src/components/
  equipment/
    paczkomat-picker.tsx         # Geowidget modal wrapper
    paczkomat-display.tsx        # Selected locker display
    inpost-shipment-form.tsx     # InPost shipment creation form
    shipment-label-view.tsx      # Label/QR display with download/print
  portal/
    portal-equipment-tab.tsx     # Contractor equipment list
    portal-return-flow.tsx       # Multi-step return flow
    return-approval-banner.tsx   # Admin approval actions
```

### Pattern 1: CourierClient Interface

**What:** Abstract interface for courier integrations, separate from BaseAdapter
**When to use:** All courier API interactions (InPost now, DPD/UPS in Phase 35)

```typescript
// packages/api/src/services/courier/courier-client.ts
export interface CourierClient {
  createShipment(params: CreateShipmentParams): Promise<CourierShipmentResult>;
  getLabel(shipmentExternalId: string, format: LabelFormat): Promise<Buffer>;
  getStatus(shipmentExternalId: string): Promise<CourierStatusResult>;
  cancelShipment(shipmentExternalId: string): Promise<void>;
}

export interface CreateShipmentParams {
  organizationId: string;
  direction: "OUTBOUND" | "RETURN";
  receiver: { name: string; email: string; phone: string; address?: Address };
  sender: { name: string; email: string; phone: string; address?: Address };
  targetPoint?: string;       // Paczkomat ID (e.g., "KRA012")
  parcels: ParcelDimensions[];
  reference?: string;
}

export interface CourierShipmentResult {
  externalId: string;         // ShipX shipment ID
  trackingNumber: string;
  status: string;             // Raw carrier status
  labelUrl?: string;
}

export type LabelFormat = "pdf" | "zpl";
```

### Pattern 2: ShipX HTTP Client (thin wrapper)

**What:** Direct HTTP calls to ShipX REST API, no SDK
**When to use:** All ShipX API interactions

```typescript
// packages/api/src/services/courier/inpost-client.ts
const SHIPX_SANDBOX_URL = "https://sandbox-api-shipx-pl.easypack24.net";
const SHIPX_PRODUCTION_URL = "https://api-shipx-pl.easypack24.net";

export class InPostClient implements CourierClient {
  constructor(
    private apiToken: string,
    private organizationId: string,  // ShipX org ID
    private sandbox: boolean = false,
  ) {}

  private get baseUrl() {
    return this.sandbox ? SHIPX_SANDBOX_URL : SHIPX_PRODUCTION_URL;
  }

  async createShipment(params: CreateShipmentParams): Promise<CourierShipmentResult> {
    const response = await fetch(
      `${this.baseUrl}/v1/organizations/${this.organizationId}/shipments`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.buildShipmentPayload(params)),
      },
    );
    // validate response with zod schema
  }
}
```

### Pattern 3: Geowidget React Wrapper

**What:** Dynamic script loading of InPost Geowidget web component in a Dialog modal
**When to use:** Paczkomat selection on admin and portal

```typescript
// apps/web/src/components/equipment/paczkomat-picker.tsx
"use client";

// Load InPost Geowidget script and CSS dynamically
// Listen for 'onpointselect' custom event from the web component
// Return selected point data (name, address) to parent via callback

function PaczkomatPicker({ onSelect, open, onOpenChange }: Props) {
  useEffect(() => {
    // Dynamically inject script + CSS if not already loaded
    const script = document.createElement("script");
    script.src = "https://geowidget.inpost.pl/inpost-geowidget.js";
    script.defer = true;
    document.head.appendChild(script);
    // ... CSS link similarly
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      onSelect({ name: e.detail.name, address: e.detail.address });
    };
    document.addEventListener("onpointselect", handler);
    return () => document.removeEventListener("onpointselect", handler);
  }, [onSelect]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[600px] p-0">
        {/* @ts-expect-error -- web component */}
        <inpost-geowidget
          token={geowidgetToken}
          language="pl"
          config="parcelcollect"
        />
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 4: Webhook + Polling Dual Strategy (D-05)

**What:** Real-time webhooks as primary, hourly polling as fallback
**When to use:** Status tracking for all InPost shipments

```
Webhook flow:
  ShipX -> POST /api/webhooks/inpost -> verify signature -> create ShipmentEvent -> auto-advance equipment

Polling flow (QStash cron, hourly):
  QStash -> POST /api/cron/inpost-status-poll -> fetch active shipments -> GET status from ShipX -> create missing events
```

### Pattern 5: Return Approval Flow (D-10)

**What:** Self-initiated returns require admin approval; offboarding-triggered returns skip approval
**When to use:** All contractor return requests

```
Self-initiated:
  Contractor clicks "Return" -> Creates return request (PENDING_APPROVAL) -> Admin notified
  -> Admin approves -> Shipment created via ShipX -> Label/QR sent to contractor

Offboarding-triggered:
  Workflow sets equipment RETURN_REQUESTED -> Shipment created via ShipX immediately
  -> Label/QR sent to contractor
```

### Anti-Patterns to Avoid

- **Do NOT route InPost webhooks through the generic `[provider]` route:** InPost is a CourierClient, not a BaseAdapter integration. Create a dedicated `/api/webhooks/inpost/route.ts` endpoint
- **Do NOT add INPOST to IntegrationProvider enum:** CourierClient is a separate bounded context per STATE.md. Credentials should be stored in org-level config (e.g., `Organization.configJson` or a new `CourierConfig` model)
- **Do NOT use the community npm Geowidget wrappers:** They are tiny, unmaintained, and add a dependency for what amounts to 20 lines of script loading code. Use the official CDN directly
- **Do NOT poll on every request:** Only poll as QStash scheduled fallback. Primary tracking is webhook-driven

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async webhook processing | Custom queue | QStash `publishJSON` | Already established pattern, retry logic built in |
| Credential encryption | Custom crypto | `credential-service.ts` (AES-256-GCM) | Battle-tested, per-provider key pattern |
| Email notifications | Custom SMTP | Resend via `notification-service.ts` + `dispatch()` | Multi-channel dispatch with Slack/Teams support |
| Scheduled polling | Custom cron | QStash `schedules.create()` | KSeF sync precedent, managed cron with retries |
| Paczkomat map | Custom map integration | InPost Geowidget CDN | Official widget maintained by InPost, handles all map/search UX |
| Webhook signature verification | Custom HMAC | Standard HMAC-SHA256 verification | ShipX signs webhooks; verify with shared secret |

**Key insight:** The project already has all the infrastructure patterns needed (QStash, credential encryption, notification dispatch, webhook pipeline). This phase is primarily about wiring a new API client into existing patterns.

## Common Pitfalls

### Pitfall 1: ShipX Status to ShipmentStatus Mapping
**What goes wrong:** ShipX uses granular statuses (confirmed, dispatched_by_sender, collected_from_sender, taken_by_courier, adopted_at_source_branch, sent_from_source_branch, ready_to_pickup, delivered, avizo, claimed, returned_to_sender) that don't map 1:1 to the app's ShipmentStatus enum
**Why it happens:** Courier APIs have carrier-specific intermediary states
**How to avoid:** Create an explicit `INPOST_STATUS_MAP` constant that maps every ShipX status to the nearest ShipmentStatus enum value. Log unmapped statuses as warnings rather than throwing
**Warning signs:** Unknown status errors in logs, shipment status stuck at old value

### Pitfall 2: Geowidget Event Listener Cleanup
**What goes wrong:** The `onpointselect` event fires on the `document` level (not scoped to the component). Multiple picker instances or re-renders can cause stale handlers
**Why it happens:** InPost Geowidget is a web component that dispatches events globally
**How to avoid:** Use `useEffect` cleanup to remove the event listener. Generate unique callback IDs if multiple pickers could exist simultaneously
**Warning signs:** Point selection populates wrong form, duplicate selections

### Pitfall 3: Webhook Idempotency
**What goes wrong:** ShipX may send the same status update webhook multiple times, creating duplicate ShipmentEvent records
**Why it happens:** Webhook retries, network issues, or ShipX internal behavior
**How to avoid:** Before creating a ShipmentEvent, check if an event with the same status already exists for that shipment. The existing `addShipmentEvent` mutation does not check for duplicates -- the webhook handler must deduplicate before calling it
**Warning signs:** Duplicate timeline entries, equipment status flip-flopping

### Pitfall 4: Credential Storage for Non-Adapter Integration
**What goes wrong:** Using `IntegrationConnection` model for InPost despite it being a CourierClient (separate bounded context)
**Why it happens:** Path of least resistance to reuse existing credential storage
**How to avoid:** Store ShipX credentials (API token, organization ID, Geowidget token) in organization-level configuration. Options: (a) new `CourierConfig` model, (b) fields on `Organization.configJson`, or (c) dedicated `Shipment` model fields. Recommend option (a) for clean separation
**Warning signs:** InPost appearing in integration settings page alongside Slack/Jira/etc.

### Pitfall 5: Paczkomat Preferred Locker Race Condition
**What goes wrong:** Storing preferred Paczkomat on contractor profile while multiple shipments are being created concurrently
**Why it happens:** Last-write-wins on the preferred Paczkomat field
**How to avoid:** Update preferred Paczkomat only from explicit user action ("Save as preferred"), not automatically on every shipment creation
**Warning signs:** Preferred Paczkomat changing unexpectedly between form loads

### Pitfall 6: Return Approval State Machine
**What goes wrong:** Return request created but no shipment because admin never approves, or approval triggers duplicate shipment
**Why it happens:** Missing state tracking for return request lifecycle
**How to avoid:** Add a `ReturnRequest` model or status field on Shipment with states: PENDING_APPROVAL -> APPROVED -> SHIPMENT_CREATED (or REJECTED). Only create ShipX shipment on transition to APPROVED
**Warning signs:** Orphaned return requests, duplicate shipments for same return

### Pitfall 7: Sandbox vs Production URL Confusion
**What goes wrong:** Development code hits production API, or production code uses sandbox
**Why it happens:** Environment variable misconfiguration
**How to avoid:** Use separate env vars (`INPOST_SHIPX_API_URL`, `INPOST_SHIPX_SANDBOX`) with clear naming. Default to sandbox. Validate URL at startup
**Warning signs:** 401 errors with valid tokens, shipments appearing in wrong environment

## Code Examples

### ShipX Create Shipment Payload (Paczkomat)

```typescript
// Source: ShipX API documentation + PHP SDK examples
const payload = {
  receiver: {
    name: "Jan Kowalski",
    first_name: "Jan",
    last_name: "Kowalski",
    email: "jan@example.com",
    phone: "500600700",
  },
  parcels: [
    {
      template: "small",     // Options: small, medium, large
      // OR explicit dimensions:
      // dimensions: { length: 380, width: 640, height: 80 },  // mm
      // weight: { amount: 5 },  // kg
    },
  ],
  custom_attributes: {
    target_point: "KRA012",  // Paczkomat ID from Geowidget
    sending_method: "dispatch_order",
  },
  service: "inpost_locker_standard",
  reference: "SHIPMENT-123",
  external_customer_id: "org_abc123",
};
```

### ShipX Status Mapping

```typescript
// packages/api/src/services/courier/inpost-status-mapper.ts
const INPOST_STATUS_MAP: Record<string, string> = {
  // ShipX status -> ShipmentStatus enum
  created: "CREATED",
  offers_prepared: "CREATED",
  offer_selected: "CREATED",
  confirmed: "LABEL_GENERATED",
  dispatched_by_sender: "PICKED_UP",
  collected_from_sender: "PICKED_UP",
  taken_by_courier: "PICKED_UP",
  adopted_at_source_branch: "IN_TRANSIT",
  sent_from_source_branch: "IN_TRANSIT",
  out_for_delivery: "OUT_FOR_DELIVERY",
  ready_to_pickup: "OUT_FOR_DELIVERY",  // At Paczkomat, waiting for pickup
  delivered: "DELIVERED",
  picked_up_by_receiver: "DELIVERED",   // Picked up from Paczkomat
  avizo: "OUT_FOR_DELIVERY",            // Reminder sent to pick up
  claimed: "FAILED",
  returned_to_sender: "RETURNED",
  not_delivered: "FAILED",
};
```

### Geowidget Integration Pattern

```typescript
// Source: https://geowidget.inpost.pl/docs/index.html
// CSS: https://geowidget.inpost.pl/inpost-geowidget.css
// JS:  https://geowidget.inpost.pl/inpost-geowidget.js

// Web component usage:
// <inpost-geowidget token="PUBLIC_TOKEN" language="pl" config="parcelcollect" />

// Event listener for point selection:
document.addEventListener("onpointselect", (event: CustomEvent) => {
  const point = event.detail;
  // point.name = "KRA012"
  // point.address = { line1: "...", line2: "..." }
  // point.location = { latitude: 50.06, longitude: 19.94 }
  // point.opening_hours = "..."
});
```

### QStash Polling Schedule (following KSeF pattern)

```typescript
// Following packages/api/src/routers/ksef.ts pattern
const qstash = getQStashClient();
const schedule = await qstash.schedules.create({
  destination: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/inpost-status-poll`,
  cron: "0 * * * *",  // Every hour
  body: JSON.stringify({
    organizationId: ctx.organizationId,
  }),
  retries: 2,
});
```

### Webhook Endpoint (dedicated, not through [provider] route)

```typescript
// apps/web/src/app/api/webhooks/inpost/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyInPostSignature } from "@contractor-ops/api/services/courier/inpost-webhook-handler";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  // Verify webhook signature
  if (!verifyInPostSignature(rawBody, headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Queue for async processing via QStash (fire-and-forget)
  // ... same pattern as existing webhook pipeline
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ShipX API only | InPost Global API (new) | 2025 | Global API is newer but no sunset date for ShipX v1. ShipX v1 is safe for now |
| Geowidget v4 | Geowidget v5 | 2023 | v5 uses web component pattern, simpler integration |
| Manual label PDFs | API-generated labels (PDF + QR) | ShipX v1 | Labels auto-generated on shipment confirmation |

**Deprecated/outdated:**
- InPost API v2 (`api.paczkomaty.pl`) -- legacy, fully deprecated
- InPost API v4 (`api-pl.easypack24.net`) -- being migrated to Global API
- Geowidget v4 -- replaced by v5 web component

## Open Questions

1. **ShipX webhook signature verification method**
   - What we know: ShipX sends webhooks with status updates. PHP SDKs reference webhook support but don't document the signature format
   - What's unclear: Whether ShipX uses HMAC-SHA256, a shared secret header, or IP allowlisting for webhook verification
   - Recommendation: Check ShipX sandbox webhook configuration during implementation. If no signature, use IP allowlisting + QStash verification as defense

2. **Production ShipX API base URL**
   - What we know: Sandbox is `https://sandbox-api-shipx-pl.easypack24.net`. Production URL not confirmed in research
   - What's unclear: Whether production is `https://api-shipx-pl.easypack24.net` (pattern match) or different
   - Recommendation: Confirm during InPost account setup. Use env var for URL to make this configurable

3. **Paczkomat parcel size templates vs. explicit dimensions**
   - What we know: ShipX supports both `template: "small|medium|large"` and explicit dimensions. Templates map to Paczkomat locker sizes (A/B/C)
   - What's unclear: Whether templates are sufficient or if weight is always required alongside
   - Recommendation: Use templates (simpler UX) with optional weight field. Validate against ShipX sandbox

4. **Return label type for Paczkomat**
   - What we know: ShipX provides PDF labels and has a separate return_label endpoint. For Paczkomat returns, contractors may just need a QR code to scan at the locker
   - What's unclear: Whether the ShipX API returns a QR code or only PDF label for Paczkomat returns
   - Recommendation: Test in sandbox. If QR available, use QR (mobile-friendly for contractors). Fall back to PDF label

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `cd packages/api && pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm -r --filter api --filter validators --filter integrations run test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EQUIP-05a | InPostClient.createShipment sends correct ShipX payload | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-client.test.ts -x` | No -- Wave 0 |
| EQUIP-05b | InPost status mapper maps all ShipX statuses correctly | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-status-mapper.test.ts -x` | No -- Wave 0 |
| EQUIP-05c | Webhook handler creates ShipmentEvent and auto-advances equipment | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-webhook-handler.test.ts -x` | No -- Wave 0 |
| EQUIP-05d | Polling service fetches active shipments and creates missing events | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-polling-service.test.ts -x` | No -- Wave 0 |
| EQUIP-05e | Webhook deduplication prevents duplicate ShipmentEvents | unit | `cd packages/api && pnpm vitest run src/services/courier/__tests__/inpost-webhook-handler.test.ts -x` | No -- Wave 0 |
| EQUIP-11a | Portal equipment list returns assigned items for contractor | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal-equipment.test.ts -x` | No -- Wave 0 |
| EQUIP-11b | Return request creates pending approval for self-initiated returns | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal-equipment.test.ts -x` | No -- Wave 0 |
| EQUIP-11c | Return approval triggers ShipX shipment creation | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/equipment-return.test.ts -x` | No -- Wave 0 |
| EQUIP-11d | Offboarding return skips approval and creates shipment directly | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/equipment-return.test.ts -x` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `cd packages/api && pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm -r --filter api --filter validators run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/api/src/services/courier/__tests__/inpost-client.test.ts` -- covers EQUIP-05a
- [ ] `packages/api/src/services/courier/__tests__/inpost-status-mapper.test.ts` -- covers EQUIP-05b
- [ ] `packages/api/src/services/courier/__tests__/inpost-webhook-handler.test.ts` -- covers EQUIP-05c, EQUIP-05e
- [ ] `packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` -- covers EQUIP-05d
- [ ] `packages/api/src/routers/__tests__/portal-equipment.test.ts` -- covers EQUIP-11a, EQUIP-11b
- [ ] `packages/api/src/routers/__tests__/equipment-return.test.ts` -- covers EQUIP-11c, EQUIP-11d

## Sources

### Primary (HIGH confidence)
- InPost Geowidget v5 official docs: https://geowidget.inpost.pl/docs/index.html -- embedding, events, token configuration
- Existing codebase: equipment.prisma, equipment.ts router, equipment-workflow.ts, portal-auth.ts, ksef.ts QStash pattern, credential-service.ts
- ShipX PHP SDK (michalbiarda/shipx-php-sdk): API endpoint structure, sandbox URL confirmation

### Secondary (MEDIUM confidence)
- InPost developer migration guide (developers.inpost-group.com): ShipX vs Global API status, deprecation timeline
- ShipX PHP SDK examples (imper86/php-inpost-api, Shoplo/shipx): Shipment creation payload structure, service types, label endpoints
- Akinon ShipX extension docs: target_point requirement for locker shipments, sandbox URL

### Tertiary (LOW confidence)
- ShipX webhook signature verification method -- not documented in any accessible source; needs sandbox testing
- Production ShipX API URL -- inferred from sandbox URL pattern but not confirmed
- Complete ShipX status list -- assembled from multiple sources, may be incomplete

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external libraries needed, REST API + CDN widget
- Architecture: HIGH -- follows established project patterns (QStash, credential-service, webhook pipeline)
- ShipX API details: MEDIUM -- official Confluence docs behind auth wall, reconstructed from SDKs and integration guides
- Pitfalls: MEDIUM -- based on courier integration experience and project pattern analysis

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable -- ShipX v1 has no announced sunset date)
