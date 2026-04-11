---
phase: 45-pluggable-e-invoicing-engine-core
plan: 05
subsystem: [api, ui]
tags: [trpc, compliance, dashboard, react, tailwind]

requires:
  - phase: 45-01
    provides: compliance types, registry
  - phase: 45-02
    provides: KsefProfile
  - phase: 45-03
    provides: pipeline
  - phase: 45-04
    provides: API layer wiring
provides:
  - computeKsefComplianceStatus pure function
  - tRPC einvoice.complianceStatuses endpoint
  - EInvoiceComplianceWidget dashboard component
  - EInvoiceComplianceDetail settings component
affects: [phase-48-zatca, phase-49-peppol, phase-50-arabic-rtl]

tech-stack:
  added: []
  patterns: [compliance-widget, health-score-pattern]

key-files:
  created:
    - packages/einvoice/src/profiles/ksef/compliance.ts
    - packages/api/src/routers/einvoice.ts
    - apps/web/src/components/einvoice/compliance-widget.tsx
    - apps/web/src/components/einvoice/compliance-detail.tsx
  modified:
    - packages/api/src/root.ts
    - apps/web/src/app/[locale]/(dashboard)/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx

key-decisions:
  - "Compliance is computed as pure function (no DB dependency in einvoice package) per D-03"
  - "API layer fetches data and passes to computeKsefComplianceStatus"
  - "Dashboard widget added to right column after activity feed"
  - "Settings detail added above integrations tab"

patterns-established:
  - "Compliance computation: pure function accepting data, returning ComplianceStatus"
  - "Health score: percentage of recent syncs that succeeded"
  - "Color-coded status: green=active, yellow=degraded/sandbox, red=error, gray=not_connected"
---

# Plan 45-05 Summary: Compliance Status & Dashboard UI

## What was built
Per-organization compliance status tracking for e-invoicing profiles. Pure function computeKsefComplianceStatus derives state from IntegrationConnection + sync logs. New tRPC endpoint einvoice.complianceStatuses with tenant isolation. Dashboard widget shows at-a-glance status. Settings detail view shows health bar, capabilities matrix, and error info.

## Tests
- 9 compliance computation tests covering all states
- API compiles with einvoice router registered

## Self-Check: PASSED
- [x] Compliance statuses computed for all KSeF lifecycle states
- [x] tRPC endpoint filters by organizationId (tenant isolation)
- [x] Dashboard widget renders with correct color coding
- [x] Settings detail shows health, capabilities, errors
