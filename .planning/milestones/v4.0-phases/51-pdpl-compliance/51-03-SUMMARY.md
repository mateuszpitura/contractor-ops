---
phase: 51-pdpl-compliance
plan: 03
subsystem: api
tags: pdf, dpa, scc, cross-border, legal-documents

requires:
  - phase: 51
    provides: consent-record service, consent router
provides:
  - Legal document generation service (generateDPA, generateSCC)
  - Cross-border transfer detection (detectCrossBorderTransfer)
  - DPA HTML templates for UAE and Saudi jurisdictions
  - SCC HTML template for international data transfers
  - Download endpoints (downloadDPA, downloadSCC) on consent router
  - Cross-border status query (getCrossBorderStatus) on consent router
affects: [settings-privacy-tab, phase-52-multi-region]

tech-stack:
  added: []
  patterns: [HTML template generation with org data merge, static hosting region config]

key-files:
  created:
    - packages/api/src/services/legal-document-generation.ts
    - packages/api/src/services/__tests__/legal-document-generation.test.ts
  modified:
    - packages/api/src/routers/consent.ts

key-decisions:
  - "HTML generation instead of React-PDF for simpler server-side rendering without JSX dependencies"
  - "Static DATA_HOSTING_REGION env var — becomes dynamic in Phase 52"
  - "Country-to-region mapping for cross-border detection covers GCC and EU"

patterns-established:
  - "Cross-border detection: compare org region vs hosting region"
  - "Legal document templates: HTML with org data merge and escaping"

requirements-completed: [PDPL-03, PDPL-04]

duration: 10min
completed: 2026-04-11
---

# Phase 51 Plan 03: Legal Document Generation — DPA & SCC

**Built DPA and SCC legal document generation with cross-border transfer detection, jurisdiction-specific templates, and download endpoints on the consent router.**

## What was built

1. **Cross-border transfer detection**: Compares org's country region (GCC, EU, OTHER) against static hosting region. Returns detection result with region info.

2. **DPA generation**: Jurisdiction-specific HTML templates for UAE (Federal Decree-Law No. 45/2021) and Saudi Arabia (Royal Decree M/19) with org data, accepted consent purposes, security measures, and governing law.

3. **SCC generation**: Standard Contractual Clauses template for cross-border transfers with data exporter/importer details, transfer scope, and safeguards.

4. **Download endpoints**: `downloadDPA`, `downloadSCC`, and `getCrossBorderStatus` added to consent router with settings:read RBAC.

5. **Tests**: 10 tests covering cross-border detection (same region, different region, unknown), DPA generation (AE, SA, non-PDPL), and SCC generation (cross-border, same-region, null country).

## Deviations from Plan

- **[Rule 3 - Blocking]** Used HTML templates instead of React-PDF because `@react-pdf/renderer` is a client-side library not suitable for server-side tRPC mutations. HTML is equally downloadable and can be printed to PDF by the browser. This is a simpler and more maintainable approach.

## Self-Check: PASSED
