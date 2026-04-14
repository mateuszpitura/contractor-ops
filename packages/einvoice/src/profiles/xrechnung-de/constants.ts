// Phase 61 — XRechnung (CIUS on EN 16931) profile constants.
//
// Mirrors the peppol-ae/constants.ts layout: one named `as const` export per
// load-bearing value, no default export.
//
// CustomizationID / ProfileID pair (D-02) is dual: XRechnung CIUS for KoSIT
// validation + Peppol BIS 3.0 profile so the SAME CII XML is also valid on
// the Peppol network UK B2G route.

// ---------------------------------------------------------------------------
// XRechnung version pin + profile IDs
// ---------------------------------------------------------------------------

/** Pinned XRechnung release — CIUS on EN 16931 v1.3. */
export const XRECHNUNG_VERSION = '3.0.2' as const;

/** Stable profile identifier used by the einvoice registry (CONTEXT D-01). */
export const XRECHNUNG_DE_PROFILE_ID = 'xrechnung-de' as const;

/** Human-readable rule-set version label — persisted on EInvoiceLifecycle. */
export const KOSIT_RULE_SET_VERSION =
  'XRechnung 3.0.2 / KoSIT release-2026-01-31' as const;

/** Document-level `CustomizationID` — identifies XRechnung CIUS 3.0. */
export const XRECHNUNG_CUSTOMIZATION_ID =
  'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0' as const;

/** Document-level `ProfileID` — Peppol BIS 3.0 billing (D-02 dual-profile). */
export const XRECHNUNG_PROFILE_ID =
  'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0' as const;

// ---------------------------------------------------------------------------
// Storecove document_type_id for XRechnung-CII submissions
// ---------------------------------------------------------------------------

/**
 * Storecove sandbox `document_type_id` literal for XRechnung-CII document
 * submissions. Consumed by the Storecove adapter (Plan 05) when routing
 * XRechnung payloads through the existing `/document_submissions` endpoint.
 *
 * STATUS (2026-04-14): PENDING sandbox verification. STORECOVE_API_KEY was
 * not available during Plan 61-01 execution (see 61-01-SUMMARY.md). The
 * literal below is the Peppol poacc codelist form for CII XRechnung, which
 * Storecove accepts for both sandbox and production routes per its public
 * document-type catalogue. Plan 61-05 owns final confirmation via a live
 * sandbox round-trip and updates this constant if the API rejects the
 * current form.
 */
export const STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID =
  'urn:cen.eu:en16931:2017::CrossIndustryInvoice##urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0::2.1' as const;

// ---------------------------------------------------------------------------
// UN/CEFACT CII D16B namespace constants
// ---------------------------------------------------------------------------

/** Root element namespace — rsm:CrossIndustryInvoice. */
export const RSM_NS =
  'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100' as const;

/** Reusable Aggregate Business Information Entity namespace. */
export const RAM_NS =
  'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100' as const;

/** Unqualified Data Type namespace. */
export const UDT_NS =
  'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100' as const;

/** Qualified Data Type namespace. */
export const QDT_NS =
  'urn:un:unece:uncefact:data:standard:QualifiedDataType:100' as const;

// ---------------------------------------------------------------------------
// Attachments / CIUS quality attributes (Plan 02 expands)
// ---------------------------------------------------------------------------

/** BT-23 business process type — standard commercial invoice. */
export const XRECHNUNG_BUSINESS_PROCESS_TYPE =
  'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0' as const;

/** BT-24 invoice document type — commercial invoice code. */
export const CII_DOCUMENT_TYPE_COMMERCIAL_INVOICE = '380' as const;
