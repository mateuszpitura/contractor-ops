# Phase 35: Feature Gating + DPD/UPS + Billing Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 35-feature-gating-dpd-ups-billing-polish
**Areas discussed:** Feature gating strategy, DPD/UPS delivery model, Courier selection UX, Usage dashboard

---

## Feature Gating Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| tRPC middleware layer | Reusable requireTier('PRO') middleware on tRPC procedures. Throws typed FEATURE_GATED error. | |
| Route-level config map | Central config mapping route paths to required tiers. Checked in Next.js middleware. | |
| Hybrid — both layers | Next.js middleware for page-level gates + tRPC middleware for API-level gates. | ✓ |

**User's choice:** Hybrid — both layers
**Notes:** Most thorough approach with page-level redirects and procedure-level inline prompts.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline banner at trigger point | Small inline banner replaces gated UI element. Matches Phase 28 D-16. | ✓ |
| Modal overlay | Clicking gated feature opens modal with plan comparison. | |
| Redirect to billing page | Gated action redirects to Settings > Billing. | |

**User's choice:** Inline banner at trigger point

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy check on next action | Subscription state cached per-request from DB. Next action gets upgrade prompt. | ✓ |
| Real-time push via webhook | Active sessions notified via SSE or polling on Stripe webhook. | |
| Periodic client-side poll | Frontend polls subscription status every N minutes. | |

**User's choice:** Lazy check on next action

| Option | Description | Selected |
|--------|-------------|----------|
| Code constants | PLAN_CONFIG already has features/excludedFeatures per tier. Type-safe. | ✓ |
| Database/Stripe metadata | Feature gates stored in Stripe product metadata or DB table. | |

**User's choice:** Code constants

---

## DPD/UPS Delivery Model

| Option | Description | Selected |
|--------|-------------|----------|
| Extend with address fields | Add optional deliveryAddress to CreateShipmentParams. One field or the other required. | |
| Carrier-specific param types | Separate InPostParams, DPDParams, UPSParams extending a base. More type-safe. | ✓ |
| Generic key-value extras | Keep params minimal, add Record<string, unknown> extras bag. | |

**User's choice:** Carrier-specific param types
**Notes:** Preferred type safety over simplicity — each carrier has its own typed params.

| Option | Description | Selected |
|--------|-------------|----------|
| Same abstract sizes, mapped per carrier | Keep small/medium/large, each client maps to carrier-specific dimensions. | ✓ |
| Carrier-specific size options | DPD/UPS show their own size categories. | |
| Weight-based input | User enters actual weight/dimensions. | |

**User's choice:** Same abstract sizes, mapped per carrier

| Option | Description | Selected |
|--------|-------------|----------|
| Polling only | QStash-scheduled polling every 30-60 min. No webhook registration. | ✓ |
| Webhook primary + polling fallback | Same pattern as InPost — register webhook callbacks. | |
| Manual status updates only | Admin manually updates shipment status. | |

**User's choice:** Polling only
**Notes:** DPD/UPS webhook setup is more complex; polling is sufficient for door-to-door timelines.

| Option | Description | Selected |
|--------|-------------|----------|
| Org-level credentials in credential store | Each org configures own DPD/UPS account in Settings > Integrations. | ✓ |
| Platform-level env vars | Single platform account in env vars, shared by all orgs. | |

**User's choice:** Org-level credentials in credential store

---

## Courier Selection UX

| Option | Description | Selected |
|--------|-------------|----------|
| Carrier dropdown, dynamic form | Dropdown at top of form, sections adapt to chosen carrier. | ✓ |
| Carrier tabs on form | Tab bar with carrier-specific forms. | |
| Separate create flows per carrier | Separate buttons/routes per carrier. | |

**User's choice:** Carrier dropdown, dynamic form

| Option | Description | Selected |
|--------|-------------|----------|
| Show only configured carriers | Carriers without credentials are hidden. | ✓ |
| Show all with setup prompt | Disable unconfigured carriers with setup link. | |
| Show all, fail on create | Show all, error on missing credentials. | |

**User's choice:** Show only configured carriers

| Option | Description | Selected |
|--------|-------------|----------|
| Use original carrier automatically | Return uses same carrier as outbound. | |
| Contractor picks carrier | Contractor chooses carrier for return. | |
| Org sets default return carrier | Org configures preferred return carrier in Settings. | ✓ |

**User's choice:** Org sets default return carrier
**Notes:** Admin control over return logistics regardless of outbound carrier.

---

## Usage Dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| KPI cards row + details below | 4 cards (Plan, Seats, OCR Credits, Billing Date) + plan comparison table. | ✓ |
| Single-column summary | Vertical stack of sections. | |
| Two-column split | Left: plan + seats. Right: OCR + billing. | |

**User's choice:** KPI cards row + details below

| Option | Description | Selected |
|--------|-------------|----------|
| Progress bar with numbers | Visual bar with used/total, color shifting green → yellow → red. | ✓ |
| Simple text counter | Plain text with top-up link. | |
| Circular gauge | Donut/ring chart showing percentage. | |

**User's choice:** Progress bar with numbers

| Option | Description | Selected |
|--------|-------------|----------|
| Current period only | No historical usage charts at launch. | ✓ |
| Current + last 3 months chart | Current stats + bar chart trend. | |
| Full billing history table | Current stats + past period table. | |

**User's choice:** Current period only

**Seat management clarification:** User noted that seats should be automatically calculated from active contractors — not manually managed. Seat count = active contractor count, synced to Stripe on contractor create/archive. Dashboard shows "X active contractors / Y included, Z billed".

| Option | Description | Selected |
|--------|-------------|----------|
| On contractor create/archive | Auto-update Stripe quantity on contractor add/archive. | ✓ |
| Nightly batch sync | Scheduled job reconciles count once per day. | |
| On billing period start | Sync only on new billing period start. | |

**User's choice:** On contractor create/archive

---

## Claude's Discretion

- DPD/UPS API client implementation details
- DPD/UPS status mapping to unified ShipmentStatus enum
- Abstract size → carrier dimension/weight mappings
- Feature gate error response format and frontend error boundary design
- Usage dashboard responsive layout and card styling
- Progress bar color thresholds
- Polling frequency tuning
- Carrier credential setup form design
- Default return carrier setting location

## Deferred Ideas

None — discussion stayed within phase scope
