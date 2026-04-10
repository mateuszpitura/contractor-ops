# Phase 36: Wiring Fixes — Webhook Dispatch + UI Mounting + Feature Gate - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all audit gaps from v3.0 milestone audit: wire Linear inbound webhook dispatch to processLinearWebhook, wire all outbound task status transitions to Linear, mount CarrierShipmentForm and CarrierCredentialForm components in their target pages, and apply FeatureGate wrappers + requireTier middleware to STARTER-excluded features. All components/handlers already exist — this phase connects them.

</domain>

<decisions>
## Implementation Decisions

### Feature Gating Strategy
- **D-01:** Hybrid approach — page-level redirects for wholly gated pages (audit log export, API access) + inline `<FeatureGate>` wrappers for sub-features within accessible pages (integrations cards, OCR button, advanced workflows). Per Phase 35 D-01
- **D-02:** Claude's discretion on exact placement — pick the most natural location for each gate based on existing page structure and PLAN_CONFIG excluded features
- **D-03:** Both UI and API gating (defense in depth) — apply `requireTier('PRO')` to tRPC procedures for integrations, OCR, advanced workflows alongside `<FeatureGate>` UI wrappers. Prevents bypass via direct API calls
- **D-04:** Global error boundary catches TIER_REQUIRED errors — a tRPC error handler intercepts `TIER_REQUIRED` JSON errors and renders `UpgradeInlineBanner` automatically. No per-component error handling needed

### Carrier Form Navigation
- **D-05:** "Create Shipment" button on equipment detail page opens `CarrierShipmentForm` in a dialog/sheet. Keeps admin in context of the equipment they're shipping
- **D-06:** DPD and UPS each get an integration card in Settings > Integrations (like Jira/Linear cards). Clicking "Configure" opens `CarrierCredentialForm` in a dialog. Consistent with existing integration settings pattern
- **D-07:** Only carriers with configured credentials appear in the shipment form dropdown. Per Phase 35 D-10

### Linear Webhook Dispatch (Inbound — LIN-04)
- **D-08:** Add `if (provider === "linear")` block in `_process/route.ts` that imports and calls `processLinearWebhook`, mirroring the exact Jira dispatch pattern at lines 74-84. No architectural changes

### Linear Outbound Sync (LIN-05)
- **D-09:** Wire `syncTaskStatusToLinear` for ALL task status transitions — currently only fires for DONE and SKIPPED (in completeTask and skipTask). Add outbound sync triggers for IN_PROGRESS, BLOCKED, and CANCELLED transitions too
- **D-10:** Full bidirectional sync means Linear always reflects the real task state, matching LIN-05 requirement ("status changes on workflow task sync to Linear issue via GraphQL mutation")

### Claude's Discretion
- Exact FeatureGate placement per page/component (which sections to wrap)
- Which tRPC procedures get requireTier middleware (based on PLAN_CONFIG excluded features)
- Dialog vs sheet choice for carrier forms (match existing patterns)
- Error boundary implementation details for TIER_REQUIRED handling
- How to wire outbound sync for IN_PROGRESS/BLOCKED/CANCELLED in workflow router (find the right mutation points)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Linear webhook dispatch (inbound wiring)
- `apps/web/src/app/api/webhooks/_process/route.ts` — Webhook processor with Jira dispatch pattern to replicate for Linear (lines 74-84)
- `packages/api/src/services/linear-webhook-handler.ts` — `processLinearWebhook` function to wire in (already implemented, just not called)
- `packages/integrations/src/adapters/linear-adapter.ts` — Linear adapter with webhook verification

### Linear outbound sync
- `packages/api/src/services/linear-issue-sync.ts` — `syncTaskStatusToLinear` function for outbound sync
- `packages/api/src/services/linear-status-mapping.ts` — `resolveLinearStateId` for mapping internal→Linear states
- `packages/api/src/routers/workflow.ts` — Task status mutation procedures; lines ~1336-1349 and ~1460-1473 show existing outbound sync for DONE/SKIPPED

### Carrier UI mounting
- `apps/web/src/components/equipment/carrier-shipment-form.tsx` — Shipment form to mount in equipment detail dialog
- `apps/web/src/components/equipment/dpd-fieldset.tsx` — DPD-specific fieldset
- `apps/web/src/components/equipment/ups-fieldset.tsx` — UPS-specific fieldset
- `apps/web/src/components/settings/carrier-credential-form.tsx` — Credential form to mount in Settings > Integrations

### Feature gating
- `apps/web/src/components/billing/feature-gate.tsx` — FeatureGate component to wrap gated sections
- `apps/web/src/components/billing/upgrade-inline-banner.tsx` — Upgrade banner rendered by FeatureGate
- `packages/api/src/middleware/tier.ts` — `requireTier` middleware factory for tRPC procedures
- `packages/api/src/routers/billing.ts` — PLAN_CONFIG with tier features/excludedFeatures definitions

### Prior phase decisions
- `.planning/phases/35-feature-gating-dpd-ups-billing-polish/35-CONTEXT.md` — Phase 35 decisions on gating strategy (D-01–D-04), carrier UX (D-05–D-11)
- `.planning/phases/29-linear-integration/29-CONTEXT.md` — Linear integration decisions (status mapping, chip, settings)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FeatureGate` component: fully implemented, accepts requiredTier and featureName props, queries subscription and renders UpgradeInlineBanner when tier is insufficient
- `requireTier` middleware: fully implemented, returns structured TIER_REQUIRED error with requiredTier and currentTier for client-side handling
- `processLinearWebhook`: complete 10-step handler with loop prevention, dedup, status resolution, and sync logging
- `syncTaskStatusToLinear`: complete outbound sync with loop prevention and dedup
- `CarrierShipmentForm`, `DPDFieldset`, `UPSFieldset`, `CarrierCredentialForm`: all fully implemented

### Established Patterns
- Webhook dispatch: provider-specific `if (provider === "...")` blocks in `_process/route.ts` with dynamic import to avoid circular deps
- Outbound sync: fire-and-forget `void (async () => { ... })()` pattern in workflow router mutation procedures
- Integration settings: card per provider in Settings > Integrations with dialog for configuration
- Feature gating: inline FeatureGate wrapper around sub-features, page redirect for wholly gated pages

### Integration Points
- `_process/route.ts` needs a Linear dispatch block (like Jira at lines 74-84)
- Workflow router task mutation procedures need outbound sync calls for IN_PROGRESS/BLOCKED/CANCELLED
- Equipment detail page needs a "Create Shipment" button that opens carrier form dialog
- Settings > Integrations page needs DPD and UPS integration cards
- Various pages/components need FeatureGate wrappers based on PLAN_CONFIG excluded features

</code_context>

<specifics>
## Specific Ideas

No specific requirements — all approaches follow established codebase patterns. Mirror existing Jira dispatch, existing outbound sync, existing integration cards, and existing FeatureGate usage.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-wiring-fixes-webhook-ui-featuregate*
*Context gathered: 2026-04-05*
