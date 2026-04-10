# Phase 35: Feature Gating + DPD/UPS + Billing Polish - Research

**Researched:** 2026-04-05
**Domain:** Feature gating middleware, courier API integrations (DPD/UPS), billing usage dashboard
**Confidence:** MEDIUM-HIGH

## Summary

Phase 35 covers three distinct areas: (1) subscription tier-based feature gating at both Next.js middleware and tRPC levels, (2) DPD and UPS courier client implementations following the proven CourierClient pattern from Phase 33, and (3) a billing usage dashboard with KPI cards. The codebase is well-prepared for all three -- PLAN_CONFIG already defines features/excludedFeatures per tier, the CourierClient interface and InPostClient reference implementation exist, and billing-service.ts already has seat count sync and credit balance queries.

DPD Poland uses a SOAP-based WebService API (demo WSDL at `dpdservicesdemo.dpd.com.pl`) with HTTP Basic auth, though DPD Group's newer REST API uses JWT Bearer tokens. UPS uses OAuth 2.0 client credentials flow with a modern REST API. Both require org-level credentials stored in the existing CourierConfig model.

**Primary recommendation:** Implement feature gates first (they affect the entire app), then DPD/UPS clients (isolated, testable), then the usage dashboard (read-only, polish).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hybrid gating -- Next.js middleware for page-level gates (redirect to upgrade page) + tRPC `requireTier('PRO')` middleware for API-level gates (inline upgrade prompts)
- **D-02:** Inline banner at trigger point for upgrade prompts -- small banner replaces gated UI element: "This feature requires Pro -- Upgrade" with diamond icon. No modal, no page redirect
- **D-03:** Lazy check on next action for mid-session tier changes -- subscription state cached per-request from DB. No real-time push needed
- **D-04:** Feature gate config lives in code constants -- PLAN_CONFIG already has features/excludedFeatures per tier. Type-safe, changes require deploy
- **D-05:** Carrier-specific param types -- separate InPostParams, DPDParams, UPSParams extending a base interface
- **D-06:** Abstract parcel sizes (small/medium/large) mapped per carrier
- **D-07:** Polling only for DPD/UPS status tracking -- QStash-scheduled polling (every 30-60 min), no webhook registration
- **D-08:** Org-level credentials in credential store -- each org configures own DPD/UPS account in Settings > Integrations
- **D-09:** Carrier dropdown with dynamic form -- dropdown at top of shipment form, form sections adapt to chosen carrier
- **D-10:** Only configured carriers shown in dropdown -- carriers without org-level credentials hidden
- **D-11:** Org sets default return carrier -- configures preferred return carrier in Settings
- **D-12:** KPI cards row + details below layout -- 4 cards (Current Plan, Active Contractors/Seats, OCR Credits, Next Billing Date) + plan comparison table
- **D-13:** OCR credits shown as progress bar with numbers -- green/yellow/red thresholds
- **D-14:** Current billing period only -- no historical usage charts at launch
- **D-15:** Seat count = active contractors, automatically calculated -- no manual seat management
- **D-16:** Seat count syncs to Stripe on contractor create/archive

### Claude's Discretion
- DPD/UPS API client implementation details (authentication methods, API version selection)
- DPD/UPS status mapping to unified ShipmentStatus enum
- Exact abstract size to carrier dimension/weight mappings
- Feature gate error response format and frontend error boundary design
- Usage dashboard responsive layout and card styling
- Progress bar color threshold breakpoints
- Polling frequency tuning (30 vs 60 min)
- Carrier credential setup form design in Settings > Integrations
- Default return carrier setting location within Settings

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-09 | Middleware gates features by org's active subscription tier with graceful upgrade prompts | PLAN_CONFIG already defines features/excludedFeatures per tier. tRPC middleware chain supports adding requireTier layer. Next.js middleware has existing auth guard pattern to extend |
| BILL-10 | Admin sees usage dashboard with current plan, seat count, OCR credits used/remaining, and billing date | billing-service.ts getSubscription + credit-service.ts getCreditBalance already return all needed data. New tRPC endpoint combines them |
| EQUIP-06 | System integrates with DPD API for shipment creation, label generation, and status tracking | CourierClient interface exists. DPD Poland SOAP WebService or DPD Group REST API. CourierConfig model ready for dpd credentials |
| EQUIP-07 | System integrates with UPS API for shipment creation and status tracking | CourierClient interface exists. UPS OAuth 2.0 REST API well-documented. Shipping API v2409 for creation, Tracking API v1 for status |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tRPC | existing | Feature gate middleware via procedure chain | Already used; requireTier follows adminProcedure pattern |
| Next.js middleware | existing | Page-level feature gates | Already has auth guards and rate limiting |
| Zod | existing | Carrier-specific param validation schemas | Already used for all input validation |
| globalThis.fetch | built-in | DPD/UPS API HTTP calls | Same pattern as InPostClient -- no HTTP library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| QStash | existing | DPD/UPS polling schedule | Replicate InPost polling pattern |
| Prisma | existing | CourierConfig + Subscription queries | All DB access |
| next-intl | existing | i18n for upgrade banners and dashboard copy | en/pl translations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw fetch for UPS | ups-api npm package | Package exists but is thin wrapper; raw fetch matches InPost pattern and keeps consistent |
| SOAP client for DPD | soap npm package | DPD Poland still uses SOAP but a thin JSON-over-HTTP wrapper matching courier-client pattern is cleaner |

**Installation:**
No new packages needed. All dependencies already in the monorepo.

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
  middleware/
    tier.ts                    # requireTier() tRPC middleware factory
  services/courier/
    courier-client.ts          # Extended with carrier-specific param types
    dpd-client.ts              # DPDClient implements CourierClient
    dpd-status-mapper.ts       # DPD status -> ShipmentStatus mapping
    dpd-polling-service.ts     # QStash polling for DPD
    ups-client.ts              # UPSClient implements CourierClient
    ups-status-mapper.ts       # UPS status -> ShipmentStatus mapping
    ups-polling-service.ts     # QStash polling for UPS
    __tests__/
      dpd-client.test.ts
      dpd-status-mapper.test.ts
      ups-client.test.ts
      ups-status-mapper.test.ts
  routers/
    billing.ts                 # Extended with getUsageDashboard, feature gate config
    equipment.ts               # Extended with createDpdShipment, createUpsShipment

packages/validators/src/
  equipment.ts                 # Extended with dpdShipmentCreateSchema, upsShipmentCreateSchema

apps/web/src/
  middleware.ts                # Extended with page-level tier gates
  components/billing/
    feature-gate.tsx           # Client wrapper checking tier
    upgrade-inline-banner.tsx  # Inline upgrade prompt
    usage-dashboard.tsx        # KPI cards + plan comparison
    credit-progress-bar.tsx    # Green/yellow/red progress bar
    ...
```

### Pattern 1: requireTier tRPC Middleware
**What:** Factory function creating middleware that checks org subscription tier against required tier
**When to use:** For API-level feature gating on tRPC procedures
**Example:**
```typescript
// packages/api/src/middleware/tier.ts
import { TRPCError } from "@trpc/server";
import { t } from "../init.js";
import { tenantProcedure } from "./tenant.js";
import { getSubscription } from "../services/billing-service.js";
import type { SubscriptionTier } from "@contractor-ops/db/generated/prisma/client";

const TIER_RANK: Record<SubscriptionTier, number> = {
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

export function requireTier(minimumTier: SubscriptionTier) {
  return t.middleware(async ({ ctx, next }) => {
    const sub = await getSubscription(ctx.organizationId);
    
    if (!sub || (sub.status !== "ACTIVE" && sub.status !== "TRIALING")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: JSON.stringify({
          type: "TIER_REQUIRED",
          requiredTier: minimumTier,
          currentTier: null,
        }),
      });
    }

    if (TIER_RANK[sub.tier] < TIER_RANK[minimumTier]) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: JSON.stringify({
          type: "TIER_REQUIRED",
          requiredTier: minimumTier,
          currentTier: sub.tier,
        }),
      });
    }

    return next({ ctx: { ...ctx, subscription: sub } });
  });
}

// Usage: chain after tenantProcedure
export const proProcedure = tenantProcedure.use(requireTier("PRO"));
```

### Pattern 2: CourierClient Extension for Carrier-Specific Params
**What:** Extend CreateShipmentParams with carrier-specific sub-types
**When to use:** DPD/UPS need address fields instead of targetPoint (Paczkomat)
**Example:**
```typescript
// Extended courier-client.ts types
interface BaseShipmentParams {
  organizationId: string;
  direction: "OUTBOUND" | "RETURN";
  receiver: { name: string; email: string; phone: string };
  sender: { name: string; email: string; phone: string };
  parcelSize: "small" | "medium" | "large";
  reference?: string;
}

interface InPostShipmentParams extends BaseShipmentParams {
  targetPoint: string; // Paczkomat ID
}

interface DPDShipmentParams extends BaseShipmentParams {
  deliveryAddress: {
    street: string;
    city: string;
    postalCode: string;
    countryCode: string;
  };
}

interface UPSShipmentParams extends BaseShipmentParams {
  deliveryAddress: {
    street: string;
    city: string;
    postalCode: string;
    countryCode: string;
  };
  serviceCode: string; // "11" Standard, "65" Saver, "07" Express
}
```

### Pattern 3: Carrier Factory
**What:** Factory function that returns correct CourierClient based on carrier string
**When to use:** Equipment router dispatches to correct client
**Example:**
```typescript
export function getCourierClient(
  carrier: string,
  config: unknown,
): CourierClient {
  switch (carrier) {
    case "inpost":
      return new InPostClient(config as InPostClientConfig);
    case "dpd":
      return new DPDClient(config as DPDClientConfig);
    case "ups":
      return new UPSClient(config as UPSClientConfig);
    default:
      throw new Error(`Unknown carrier: ${carrier}`);
  }
}
```

### Anti-Patterns to Avoid
- **Single mega-procedure for all carriers:** Each carrier should have its own tRPC procedure with carrier-specific Zod schema (different required fields)
- **Sharing CreateShipmentParams across all carriers:** InPost needs targetPoint, DPD/UPS need address -- don't use optional fields on single type
- **Feature gate checks in components only:** Always gate on the server (tRPC middleware). Client-side FeatureGate is UX polish, not security
- **Hardcoded feature-to-tier mappings scattered across code:** Use PLAN_CONFIG.tiers[].excludedFeatures as single source of truth

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feature name-to-tier lookup | Manual if/else chains | Derive from PLAN_CONFIG.tiers[].excludedFeatures | Single source of truth, already exists |
| OCR credit balance | Custom aggregation | getCreditBalance() from credit-service.ts | Already handles period scoping, caching, allowance calc |
| Seat count sync | Manual Stripe API calls | syncSeatCountForOrg() from billing-service.ts | Already integrated into contractor create/archive |
| Polling infrastructure | Custom cron jobs | QStash scheduled tasks | Existing pattern from InPost, KSeF sync |
| OAuth token caching (UPS) | Manual token management | Simple in-memory cache with expiry check | UPS tokens last 4 hours; cache until 5 min before expiry |

**Key insight:** The billing and courier foundations are already built. This phase is about extending existing patterns, not creating new infrastructure.

## Common Pitfalls

### Pitfall 1: Feature Gate Race Condition on Tier Change
**What goes wrong:** User downgrades, but cached subscription still shows old tier for in-flight requests
**Why it happens:** getSubscription() uses Redis cache with 15-minute TTL (CacheTTL.SUBSCRIPTION)
**How to avoid:** D-03 explicitly accepts lazy checking. The cache invalidation already happens via Stripe webhook handler. Accept that there's a brief window where a downgraded user can still access features
**Warning signs:** User complaints about features disappearing mid-session -- this is expected behavior per D-03

### Pitfall 2: DPD Poland SOAP vs REST Confusion
**What goes wrong:** Building against wrong API version or endpoint format
**Why it happens:** DPD has multiple API versions across regions. Poland traditionally uses SOAP WebServices, but DPD Group offers newer REST endpoints
**How to avoid:** Use DPD Poland's SOAP WebService (demo WSDL: `dpdservicesdemo.dpd.com.pl`) if REST is unavailable. Wrap SOAP calls in a thin HTTP layer that returns JSON matching CourierClient interface. Alternatively, if DPD Group REST API (`shipping.geopost.com`) supports Poland, prefer REST
**Warning signs:** 404s or auth failures -- verify endpoint region support

### Pitfall 3: UPS OAuth Token Expiry Mid-Request
**What goes wrong:** Token expires between obtaining it and making the API call
**Why it happens:** UPS tokens expire after ~4 hours; edge case when token is near expiry
**How to avoid:** Cache token with 5-minute buffer before expiry. Re-fetch if < 5 minutes remaining. Simple: `if (Date.now() > expiresAt - 5 * 60_000) { refresh(); }`
**Warning signs:** Intermittent 401 errors from UPS API

### Pitfall 4: Parcel Size Mapping Inconsistency
**What goes wrong:** Abstract "small/medium/large" maps to wrong carrier dimensions, causing rejected shipments
**Why it happens:** Each carrier has different dimension/weight limits and naming conventions
**How to avoid:** Define explicit mapping constants per carrier. Test with carrier sandbox. InPost uses "small"/"medium"/"large" templates directly; DPD/UPS need explicit weight/dimensions
**Warning signs:** Carrier API returns validation errors about parcel dimensions

### Pitfall 5: Next.js Middleware Cannot Access Database
**What goes wrong:** Trying to query Prisma from Next.js Edge middleware for page-level gates
**Why it happens:** Next.js middleware runs on Edge Runtime which cannot use Node.js APIs (no Prisma, no DB)
**How to avoid:** Page-level gates must check subscription tier via a cookie or JWT claim set during login/session, OR redirect to an API route that checks and redirects. Alternatively, use client-side redirect by fetching subscription in a layout component (server component can query DB)
**Warning signs:** Build errors about Node.js APIs not available in Edge Runtime

### Pitfall 6: Missing Carrier in Dropdown After Credential Save
**What goes wrong:** Admin saves DPD credentials but carrier doesn't appear in shipment form dropdown
**Why it happens:** Configured carriers query is cached or the carrier string doesn't match expected value
**How to avoid:** Use consistent carrier identifiers: "inpost", "dpd", "ups" (lowercase) in CourierConfig. Cache invalidation on credential save. Frontend refetches carrier list after save

## Code Examples

### Feature Gate on tRPC Procedure
```typescript
// Source: extends existing adminProcedure pattern in rbac.ts
// In equipment router:
createDpdShipment: tenantProcedure
  .use(requirePermission({ equipment: ["create"] }))
  .use(requireTier("PRO")) // Gates DPD to Pro+ tiers
  .input(dpdShipmentCreateSchema)
  .mutation(async ({ ctx, input }) => {
    // ... DPD shipment creation logic
  }),
```

### Next.js Page-Level Gate (Server Component Approach)
```typescript
// Since Edge middleware cannot query DB, use server component layout:
// apps/web/src/app/[locale]/(dashboard)/integrations/layout.tsx
import { getSubscription } from "server-side-billing-query";

export default async function IntegrationsLayout({ children }) {
  const sub = await getSubscription(orgId);
  if (!sub || TIER_RANK[sub.tier] < TIER_RANK["PRO"]) {
    return <UpgradePageGate feature="Integrations" requiredTier="PRO" />;
  }
  return children;
}
```

### DPD Client Structure (REST variant)
```typescript
// packages/api/src/services/courier/dpd-client.ts
export class DPDClient implements CourierClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly fid: string;

  constructor(config: DPDClientConfig) {
    this.baseUrl = config.sandbox
      ? "https://dpdservicesdemo.dpd.com.pl"
      : "https://dpdservices.dpd.com.pl";
    this.username = config.username;
    this.password = config.password;
    this.fid = config.fid;
  }

  async createShipment(params: DPDShipmentParams): Promise<CourierShipmentResult> {
    // Map abstract size to DPD dimensions
    const parcelDimensions = DPD_SIZE_MAP[params.parcelSize];
    // Call DPD API
    // Return normalized CourierShipmentResult
  }
}
```

### UPS Client Structure
```typescript
// packages/api/src/services/courier/ups-client.ts
export class UPSClient implements CourierClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accountNumber: string;
  private readonly sandbox: boolean;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  private get baseUrl(): string {
    return this.sandbox
      ? "https://wwwcie.ups.com"
      : "https://onlinetools.ups.com";
  }

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 5 * 60_000) {
      return this.tokenCache.token;
    }
    const res = await globalThis.fetch(
      `${this.baseUrl}/security/v1/oauth/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      },
    );
    const data = await res.json();
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return this.tokenCache.token;
  }
}
```

### Credit Progress Bar Color Logic
```typescript
// apps/web/src/components/billing/credit-progress-bar.tsx
function getBarColor(used: number, total: number): string {
  if (total === 0) return "var(--destructive)";
  const remaining = total - used;
  const pct = remaining / total;
  if (pct > 0.5) return "var(--success)";     // >50% remaining: green
  if (pct >= 0.2) return "var(--warning)";     // 20-50%: yellow
  return "var(--destructive)";                  // <20%: red
}
```

### Usage Dashboard Data Endpoint
```typescript
// In billing router:
getUsageDashboard: tenantProcedure.query(async ({ ctx }) => {
  const [sub, credits] = await Promise.all([
    getSubscription(ctx.organizationId),
    getCreditBalance(ctx.organizationId),
  ]);

  const activeContractors = await prisma.contractor.count({
    where: { organizationId: ctx.organizationId, status: "ACTIVE" },
  });

  const tierConfig = PLAN_CONFIG.tiers.find(t => t.id === sub?.tier);

  return {
    subscription: sub,
    credits,
    activeContractors,
    includedSeats: tierConfig ? Math.floor(tierConfig.basePriceGrosze / tierConfig.seatPriceGrosze) : 0,
    planConfig: PLAN_CONFIG,
  };
}),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DPD SOAP WebServices | DPD Group REST API (geopost.com) | 2023-2024 | REST preferred but SOAP still works for Poland |
| UPS XML/SOAP APIs | UPS OAuth 2.0 REST APIs | 2023-2024 (mandatory by Dec 2025) | Must use REST; SOAP deprecated |
| Feature flags via LaunchDarkly | Code constants (PLAN_CONFIG) | Project decision D-04 | No external dependency; deploy-time changes |

**Deprecated/outdated:**
- UPS SOAP/XML APIs: Fully deprecated, must use OAuth 2.0 REST
- DPD legacy SOAP: Still functional for Poland but REST preferred if available

## Open Questions

1. **DPD Poland API: SOAP or REST?**
   - What we know: DPD Poland traditionally uses SOAP WebService. DPD Group offers REST via geopost.com
   - What's unclear: Whether DPD Group REST API supports Poland specifically, or if Poland requires SOAP
   - Recommendation: Implement DPD client with REST-style interface wrapping SOAP calls. If REST endpoint works for Poland, use it directly. Test with sandbox credentials. The CourierClient interface abstracts this detail from callers

2. **UPS Developer Account Approval Timeline**
   - What we know: STATE.md notes "UPS developer account approval may take calendar time -- start registration during Phase 33"
   - What's unclear: Whether registration was completed
   - Recommendation: Verify UPS developer account status before planning. If not approved yet, UPS client can be implemented against sandbox and tested later

3. **Abstract Size to Carrier Dimension Mappings**
   - What we know: Each carrier has different dimension/weight constraints
   - What's unclear: Exact dimension/weight limits for "small", "medium", "large" per carrier
   - Recommendation: Define reasonable defaults (e.g., small=2kg/30x20x10, medium=5kg/40x30x20, large=10kg/60x40x30) and let org override via CourierConfig if needed

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `cd packages/api && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/api && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-09 | requireTier middleware blocks lower tiers, passes matching/higher | unit | `cd packages/api && npx vitest run src/middleware/__tests__/tier.test.ts -x` | Wave 0 |
| BILL-09 | requireTier returns structured error with requiredTier/currentTier | unit | same as above | Wave 0 |
| BILL-10 | getUsageDashboard returns subscription + credits + seat count | unit | `cd packages/api && npx vitest run src/routers/__tests__/billing-dashboard.test.ts -x` | Wave 0 |
| EQUIP-06 | DPDClient.createShipment sends correct payload and returns CourierShipmentResult | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/dpd-client.test.ts -x` | Wave 0 |
| EQUIP-06 | DPD status mapper maps carrier statuses to ShipmentStatus | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/dpd-status-mapper.test.ts -x` | Wave 0 |
| EQUIP-07 | UPSClient OAuth token caching and refresh | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ups-client.test.ts -x` | Wave 0 |
| EQUIP-07 | UPSClient.createShipment sends correct payload | unit | same as above | Wave 0 |
| EQUIP-07 | UPS status mapper maps type/code to ShipmentStatus | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ups-status-mapper.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/api && npx vitest run && cd ../../packages/validators && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/middleware/__tests__/tier.test.ts` -- covers BILL-09 requireTier middleware
- [ ] `packages/api/src/routers/__tests__/billing-dashboard.test.ts` -- covers BILL-10 usage dashboard endpoint
- [ ] `packages/api/src/services/courier/__tests__/dpd-client.test.ts` -- covers EQUIP-06 DPD client
- [ ] `packages/api/src/services/courier/__tests__/dpd-status-mapper.test.ts` -- covers EQUIP-06 DPD status mapping
- [ ] `packages/api/src/services/courier/__tests__/ups-client.test.ts` -- covers EQUIP-07 UPS client + OAuth
- [ ] `packages/api/src/services/courier/__tests__/ups-status-mapper.test.ts` -- covers EQUIP-07 UPS status mapping
- [ ] `packages/validators/src/__tests__/dpd-ups-equipment.test.ts` -- covers DPD/UPS Zod schemas

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation (not needed this phase -- no new libraries)
- Schema validation for all external inputs (DPD/UPS API responses via Zod)
- Never trust client input (carrier-specific params validated via Zod schemas)
- Use strong typing (carrier-specific param types, not optional union)
- Rate limiting already in middleware (extend, don't replace)
- Follow clean architecture (courier clients in services/, middleware in middleware/)
- Proper error handling and logging (carrier API failures logged, never silent)
- en/pl translations for all UI copy via next-intl
- Security: credentials stored encrypted in CourierConfig.configJson, never exposed to client

## Sources

### Primary (HIGH confidence)
- Existing codebase: `courier-client.ts`, `inpost-client.ts`, `inpost-status-mapper.ts`, `inpost-polling-service.ts` -- proven patterns
- Existing codebase: `billing.ts` PLAN_CONFIG, `billing-service.ts`, `credit-service.ts` -- billing foundation
- Existing codebase: `middleware.ts`, `rbac.ts`, `tenant.ts` -- middleware chain patterns
- Existing codebase: `equipment.prisma` CourierConfig model -- credential storage

### Secondary (MEDIUM confidence)
- [UPS Developer Guide (atoship)](https://atoship.com/blog/ups-shipping-api-integration-developer-guide) -- OAuth 2.0 flow, endpoint URLs, rate limits
- [UPS Service Codes](https://www.ups.com/worldshiphelp/WSA/ENG/AppHelp/mergedProjects/CORE/Codes/UPS_Service_Codes.htm) -- Poland-specific service codes
- [DPD Romania REST API](https://api.dpd.ro/web-api.html) -- REST API structure (similar to DPD Group pattern)
- [DPD PHP Wrapper](https://github.com/msztorc/php-dpd-api) -- DPD Poland SOAP endpoint URLs and methods

### Tertiary (LOW confidence)
- DPD Poland SOAP vs REST availability -- needs verification with sandbox credentials
- UPS developer account approval status -- needs verification
- Exact DPD/UPS tracking status codes -- need sandbox testing to confirm mappings

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing patterns
- Architecture: HIGH -- extends proven CourierClient + middleware patterns
- Feature gating: HIGH -- PLAN_CONFIG already has feature lists, middleware pattern is clear
- DPD integration: MEDIUM -- DPD Poland API access needs sandbox verification, SOAP/REST unclear
- UPS integration: MEDIUM-HIGH -- well-documented REST API, but need dev account verification
- Pitfalls: HIGH -- based on codebase analysis and API documentation review

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable patterns, external APIs may change)
