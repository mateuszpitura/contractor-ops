# Phase 36: Wiring Fixes — Webhook Dispatch + UI Mounting + Feature Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 36-wiring-fixes-webhook-ui-featuregate
**Areas discussed:** Feature gate placement, Carrier form navigation, Linear outbound sync trigger

---

## Feature Gate Placement

### Gate UX approach

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap each gated section inline | Use FeatureGate around specific UI sections. STARTER sees upgrade banner exactly where the feature would be. | |
| Gate entire pages via middleware | Redirect STARTER users away from entire pages. Simpler but less discoverable. | |
| Hybrid approach | Page-level redirect for wholly gated pages. Inline FeatureGate for sub-features within accessible pages. | ✓ |

**User's choice:** Hybrid approach
**Notes:** Matches Phase 35 D-01 decision.

### Gate targets

| Option | Description | Selected |
|--------|-------------|----------|
| Inline: integrations, OCR, workflows; Page: audit, API | Specific mapping of features to gate types. | |
| Inline all — no page redirects | Every gated feature gets inline FeatureGate wrapper. | |
| You decide | Claude picks based on existing page structure. | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion on exact placement per feature.

### API gating

| Option | Description | Selected |
|--------|-------------|----------|
| Both UI + API | Apply requireTier to tRPC procedures alongside FeatureGate. Defense in depth. | ✓ |
| UI gates only | Only wrap UI components with FeatureGate. | |

**User's choice:** Both UI + API

### Error handling for tier errors

| Option | Description | Selected |
|--------|-------------|----------|
| Global error boundary catches TIER_REQUIRED | tRPC error handler intercepts and renders UpgradeInlineBanner. | ✓ |
| Per-component error handling | Each component handles TIER_REQUIRED individually. | |
| You decide | Claude picks based on existing patterns. | |

**User's choice:** Global error boundary

---

## Carrier Form Navigation

### Shipment form access

| Option | Description | Selected |
|--------|-------------|----------|
| Button on equipment detail → dialog | "Create Shipment" button opens form in dialog/sheet. Keeps user in context. | ✓ |
| Button on equipment detail → new page | Navigate to dedicated shipment creation page. | |
| You decide | Claude picks based on InPost form pattern. | |

**User's choice:** Button on equipment detail → dialog

### Credential form placement

| Option | Description | Selected |
|--------|-------------|----------|
| Cards per carrier in integrations tab | DPD/UPS each get integration card. Configure opens dialog. Consistent pattern. | ✓ |
| Single courier section with tabs | One "Courier" section with tabs for InPost/DPD/UPS. | |
| You decide | Claude picks based on existing Settings structure. | |

**User's choice:** Cards per carrier in integrations tab

---

## Linear Outbound Sync Trigger

### Outbound sync coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Sync all transitions | Wire for IN_PROGRESS, BLOCKED, CANCELLED too. Full bidirectional sync. | ✓ |
| Only DONE and SKIPPED | Keep current behavior. Track completion only. | |
| You decide | Claude determines which transitions matter. | |

**User's choice:** Sync all transitions

### Inbound dispatch implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Jira pattern exactly | Add if (provider === "linear") block mirroring lines 74-84. | ✓ |
| You decide | Claude picks cleanest implementation. | |

**User's choice:** Mirror Jira pattern exactly

---

## Claude's Discretion

- Exact FeatureGate placement per page/component
- Which tRPC procedures get requireTier middleware
- Dialog vs sheet choice for carrier forms
- Error boundary implementation details
- Outbound sync wiring points in workflow router

## Deferred Ideas

None — discussion stayed within phase scope.
