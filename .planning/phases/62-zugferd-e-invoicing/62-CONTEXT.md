# Phase 62: ZUGFeRD E-Invoicing - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two capabilities on top of the Phase 61 XRechnung CII foundation:

1. **Outbound ZUGFeRD generation (EINV-02):** ZUGFeRD PDF/A-3 documents at EN 16931 (COMFORT) profile level, each containing a visually-rendered invoice PDF with an embedded CII XML file (AFRelationship=Alternative). The PDF/A-3 output passes veraPDF conformance validation.
2. **Inbound parsing & intake (EINV-03):** Users can upload an XRechnung (.xml) or a ZUGFeRD (.pdf) received from a counterparty; the platform extracts the structured CII data, validates it via the existing KoSIT 3-layer harness, runs heuristic matching against existing Contractor/Contract rows, and presents the result as a staging `InvoiceIntakeRequest` that requires explicit human confirmation before becoming an `Invoice`.

**Explicitly out of scope:** email intake, Peppol inbound via Storecove polling, automated retention policies for intake artifacts, any Factur-X / FatturaPA / other country profiles, auto-posting of untrusted inbound invoices to payment or VAT flows without human gate.

</domain>

<decisions>
## Implementation Decisions

### Profile layout & CII reuse
- **D-01:** **New profile `packages/einvoice/src/profiles/zugferd-de/`** mirroring the `xrechnung-de/` layout: `constants.ts` (ZUGFeRD conformance levels, XMP extension schema URIs, AFRelationship constants), `pdf-wrapper.ts` (PDF/A-3 post-processor), `invoice-template.tsx` (React-PDF visual template), `generator.ts` (orchestrator: generate CII → render visual PDF → wrap to PDF/A-3), `parser.ts` (inbound PDF+XML extraction), `validator.ts` (delegates to xrechnung-de validator for the XML layer), `schemas.ts`, `index.ts`. Registry registration in `packages/einvoice/src/registry.ts` as `ZUGFERD_DE_PROFILE_ID`.
- **D-02:** **Reuse the xrechnung-de CII generator verbatim.** `zugferd-de/generator.ts` imports `buildXrechnungCii` from `../xrechnung-de/generator.js` and uses the same locked `XRECHNUNG_VERSION = '3.0.2'` + `XRechnung 3.0` CustomizationID + Peppol BIS 3.0 ProfileID (Phase 61 D-02). No fork, no duplication. The XML embedded in a ZUGFeRD PDF is bit-identical to a standalone XRechnung XML for the same `EInvoice` envelope, so one codepath serves both outbound contracts.
- **D-03:** **ZUGFeRD conformance levels:**
  - **Outbound:** EN 16931 (COMFORT) only — locked. Generator refuses to emit MINIMUM/BASIC WL/BASIC (they omit line items) and EXTENDED (non-standard, no schematron coverage).
  - **Inbound parser:** accepts COMFORT + XRECHNUNG (ZUGFeRD's XRechnung-profile variant — functionally equivalent to our outbound) + EXTENDED (field-map best-effort, no schematron validation — surfaces a `LEVEL_EXTENDED_BEST_EFFORT` warning on the intake report).
  - **Inbound rejections:** MINIMUM and BASIC WL are rejected at upload time with `LEVEL_TOO_LOW` error — they lack line items required to become a usable `Invoice`.
  - Level detection comes from parsing `/rsm:CrossIndustryInvoice/rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID` against a constant map of known GuidelineDocumentContext URNs.

### PDF/A-3 wrapping pipeline (EINV-02)
- **D-04:** **Pipeline: React-PDF visual render → pdf-lib post-process.**
  - Step 1: Render the human-readable invoice layout via a new `zugferd-de/invoice-template.tsx` using `@react-pdf/renderer` 4.4.1 (already on `apps/web` and `packages/api` — bump/add to `packages/einvoice` as dep). Template shares design tokens (colors, typography, spacing) with existing templates (`ir35-sds.tsx`, `drv-defense-bundle.tsx`).
  - Step 2: Pipe the rendered buffer through `packages/einvoice/src/profiles/zugferd-de/pdf-wrapper.ts` (new). Wrapper uses `pdf-lib` (new dev+runtime dep on `packages/einvoice`) to:
    - Load the PDF into a `PDFDocument`.
    - Attach the CII XML as an embedded file with name `factur-x.xml` (ZUGFeRD mandates this exact filename per the spec), `MimeType=application/xml`, and `AFRelationship=Alternative`.
    - Write the ZUGFeRD-required XMP metadata (namespace `urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#`: `DocumentType=INVOICE`, `DocumentFileName=factur-x.xml`, `Version=1.0`, `ConformanceLevel=EN 16931`) plus PDF/A-3 extension schema description (`pdfaid:part=3`, `pdfaid:conformance=B`).
    - Set `/Names /EmbeddedFiles` dictionary + `/AF` entry on the root page pointing to the embedded file.
    - Embed an sRGB ICC profile as `/OutputIntent` (required for PDF/A conformance). We bundle a minimal `sRGB2014.icc` file in `zugferd-de/assets/` (~3kB, ICC permissively-licensed).
    - Strip transparency, embed all fonts as subsets (`react-pdf` emits `Helvetica` by default — PDF/A-3 requires embedded fonts; wrapper re-embeds `Helvetica` via a bundled `.afm` or swaps to a bundled `Noto Sans` subset if Helvetica embedding fails).
  - Step 3: Verify structural invariants with a small pure-JS `zugferd-structural-check` util that asserts XMP presence, attachment presence, AFRelationship correctness, and OutputIntent presence. This is a sanity check, not a replacement for veraPDF — it runs on every generated PDF (cheap) and throws a typed error if any invariant fails. Prevents shipping obviously-broken PDF/A-3s without waiting for CI.

### veraPDF validation (EINV-02 success criterion)
- **D-05:** **CI-only veraPDF gate via GitHub Actions Docker image.**
  - New job in `.github/workflows/ci.yml` (or whichever existing CI file runs on PRs touching `packages/einvoice/**`): uses `verapdf/cli:1.26` Docker image. Runs against 3 golden fixture ZUGFeRD PDFs generated at test time: (a) minimal COMFORT invoice (1 line, standard VAT), (b) reverse-charge invoice with Leitweg-ID attached, (c) Kleinunternehmer §19 invoice (no VAT).
  - Fixtures generated by a `packages/einvoice/scripts/generate-zugferd-fixtures.ts` script using deterministic fixture inputs committed under `packages/einvoice/src/profiles/zugferd-de/__fixtures__/`. Outputs go to a tmp dir, veraPDF runs against them.
  - On failure: CI job emits the full veraPDF XML report as a GitHub Action artifact (30-day retention) and prints the first 40 failing rules inline in the job log. PR blocks merge.
  - **No runtime veraPDF on Render** — matches Phase 61 KoSIT decision (bundle offline; no remote government service, no JVM sidecar).
- **D-06:** **No in-app surface for PDF/A-3 conformance.** PDF/A-3 is a CI-time engineering contract. End-users never see a "PDF/A-3 conformance" status — the invoice either generates (passes the `zugferd-structural-check` sanity util) or throws `ZUGFERD_WRAPPING_FAILED`. Rationale: users can't act on a PDF/A rule ID, and a runtime gate would require bundling veraPDF. The XML validation layer (KoSIT) is the user-visible compliance gate — it's reused unchanged from Phase 61.

### Inbound parsing (EINV-03 — core parser)
- **D-07:** **Implement `zugferd-de/parser.ts` + flesh out `xrechnung-de/parser.ts` stub.**
  - `xrechnung-de/parser.ts` becomes a real implementation: accepts a CII XML string, uses `fast-xml-parser` `XMLParser` (already a dep), walks the `rsm:CrossIndustryInvoice` tree, and maps elements back into the canonical `EInvoice` envelope (inverse of `xrechnung-de/generator.ts`). Returns `{ invoice: EInvoice, profileLevel: 'COMFORT' | 'XRECHNUNG' | 'EXTENDED', warnings: ParserWarning[] }`. Throws `CII_PARSE_FAILED` on malformed XML.
  - `zugferd-de/parser.ts` accepts a PDF buffer, uses `pdf-lib` to locate and extract the `factur-x.xml` attachment (case-insensitive match; falls back to scanning AF entries for `AFRelationship=Alternative` + `.xml` filename), then delegates the XML to the XRechnung parser. Returns `{ invoice, profileLevel, warnings, rawPdfBuffer, extractedXml }`. Throws `ZUGFERD_NO_XML_ATTACHMENT` if none found, `ZUGFERD_LEVEL_UNSUPPORTED` if level is MINIMUM/BASIC_WL.
- **D-08:** **KoSIT validation re-used on inbound XML.** After the parser returns, the intake pipeline pipes the extracted XML through the existing `xrechnung-de/validator.ts` (all 3 KoSIT layers) and stores the normalized `XRechnungValidationReport` on the `InvoiceIntakeRequest` row. No new validator code; only a new call site.

### Intake lifecycle (EINV-03 — staging entity)
- **D-09:** **New Prisma model `InvoiceIntakeRequest`:**
  - Fields: `id`, `organizationId`, `uploadedByUserId`, `sourceKind` enum (`'UPLOAD_XML' | 'UPLOAD_PDF'` — future: `'PEPPOL_INBOUND' | 'EMAIL'`), `rawFileKey` (R2 key — raw upload: PDF or XML), `extractedXmlKey` (R2 key — for PDF uploads, the extracted CII; for XML uploads, same as `rawFileKey`), `validationReportKey` (R2 key — full KoSIT HTML report), `profileLevel` enum (`'COMFORT' | 'XRECHNUNG' | 'EXTENDED'`), `parsedInvoiceJson Json` (the canonical `EInvoice` envelope from parser), `extractedSupplierName`, `extractedSupplierVatId`, `extractedSupplierLeitwegId`, `extractedInvoiceNumber`, `extractedInvoiceDate`, `extractedTotalMinor` (bigint — currency-agnostic total stored in minor units), `extractedCurrency` (ISO 4217 char(3)), `matchedContractorId` (nullable FK — set after user confirms), `matchedContractId` (nullable FK), `convertedInvoiceId` (nullable FK — set when user clicks "Convert to Invoice"), `status` enum (`'PARSED' | 'NEEDS_REVIEW' | 'MATCHED' | 'CONVERTED' | 'REJECTED'`), `validationStatus` enum (`'VALID' | 'WARNINGS' | 'INVALID'`), `validationAcknowledgedAt` (nullable Date — timestamp when user accepted warnings), `validationAcknowledgedByUserId` (nullable FK), `rejectionReason` (nullable Text), `createdAt`, `updatedAt`.
  - Multi-tenant scoped via Prisma client extension (same pattern as `EInvoiceLifecycle`).
  - Unique constraint: `(organizationId, rawFileSha256)` — prevents accidental duplicate imports of the same document. Requires storing `rawFileSha256` (char(64)).
  - Indexed on `(organizationId, status)` and `(organizationId, extractedSupplierVatId)`.
- **D-10:** **Staging entity — no Invoice row until explicit convert-to-Invoice.**
  - Uploading, parsing, and validating create / mutate only `InvoiceIntakeRequest` rows. The `Invoice` table is untouched.
  - `invoiceIntake.convertToInvoice({ intakeId })` tRPC mutation creates the `Invoice` + `InvoiceLine`s atomically inside a Prisma `$transaction`, copying parsed + user-confirmed matched fields, then updates `InvoiceIntakeRequest.status = 'CONVERTED'` + `convertedInvoiceId`. Idempotent — if `convertedInvoiceId` is already set, returns the existing invoice.
  - Unmatched-to-Contractor intakes cannot be converted — UI surfaces a "Match or create Contractor" affordance first. Rationale: dangling Invoice rows without a Contractor would break downstream VAT/payment-run logic.
  - Rationale vs. "just make an Invoice draft": keeps untrusted externally-sourced data out of `Invoice` until human approval, matches the audit/compliance posture established for Classification phases (58-60) where assessments are first-class entities distinct from Invoices.
- **D-11:** **Heuristic auto-matching — user confirms.**
  - On parse completion, the intake service runs `packages/api/src/services/invoice-intake-matcher.ts` (new) which returns ranked Contractor candidates based on:
    1. Exact match on extracted supplier VAT ID vs `Contractor.vatIdentifier` (DE USt-IdNr / UK VAT number).
    2. Exact match on extracted supplier Leitweg-ID vs any `LeitwegId` row owned by the org (buyer-side Leitweg-IDs — note the sender's Leitweg-ID is different, but we record it for review).
    3. Exact match on extracted supplier name (case + whitespace normalized).
    4. Fuzzy match on supplier name (Levenshtein ≤ 3 on normalized names), ranked by distance + VAT country compatibility.
  - Candidates (0 to N) are attached to the `InvoiceIntakeRequest` as a transient computed value returned from a `invoiceIntake.getMatchCandidates({ intakeId })` query. They are NOT persisted — they're recomputed on page load so newly-created Contractors appear immediately. Only the final confirmed `matchedContractorId` is persisted.
  - UI surface: intake detail page shows each candidate with match reasons ("VAT ID match", "Fuzzy name match (distance 2)") and a "Use this contractor" button, plus a "Create new contractor from this data" fallback that prefills the Contractor form with parsed supplier data.
  - No auto-conversion without explicit user click. A single unambiguous match is pre-selected in the UI but still requires the "Confirm match" action.

### Inbound validation behavior
- **D-12:** **Soft-gate on schematron warnings; hard-reject on XSD (layer-1) failures.**
  - **Layer 1 (XSD CII D16B) failure on upload:** hard reject at the `invoiceIntake.upload` mutation boundary. No `InvoiceIntakeRequest` row is created. Error surfaces a user-readable message ("The XML does not conform to the CII schema — ask the sender to re-issue.") plus the first 5 XSD errors for forensics.
  - **Layer 2 or 3 (EN 16931 or XRechnung schematron) failure:** `InvoiceIntakeRequest.status = 'NEEDS_REVIEW'`, `validationStatus = 'WARNINGS'` (for warnings) or `'INVALID'` (for errors). The row is created; the report is visible in the UI. The "Convert to Invoice" button is disabled with tooltip "Acknowledge validation issues first", unblocked by clicking an explicit "Accept despite issues" CTA which sets `validationAcknowledgedAt` + `validationAcknowledgedByUserId`. Rationale: some real-world XRechnung sends carry schematron warnings but are legally valid; blocking conversion wholesale would force users to ask senders for corrections on every minor deviation.
  - **Parser-level failures** (no XML attachment in PDF, unsupported level, malformed XML): hard reject at upload. No row created, user sees typed error.
- **D-13:** **`LEVEL_EXTENDED_BEST_EFFORT` warning:** when parser detects EXTENDED profile, it still maps recognized fields (from the subset that overlaps with COMFORT) into the `EInvoice` envelope, flags unmapped EXTENDED-specific fields in `parsedInvoiceJson._unmappedFields: string[]`, and the intake UI shows a banner: "This invoice uses the EXTENDED ZUGFeRD profile. Some sender-specific fields could not be mapped. Review the data carefully before converting."

### UI placement (EINV-03 — upload surface)
- **D-14:** **Invoices list gets a split-button "Import" action + dedicated `/invoices/intake` route.**
  - Top-right of `/[locale]/(dashboard)/invoices/` page header gains a split-button: primary action `+ New invoice` (existing), secondary menu item `Import e-invoice` (new) which opens a drop-zone dialog accepting `.xml` + `.pdf` (size cap 5MB, matching existing attachment caps).
  - New route `/[locale]/(dashboard)/invoices/intake/` lists all `InvoiceIntakeRequest` rows with filter chips: `All` / `Needs review` / `Matched` / `Converted` / `Rejected`. Badge style matches Phase 60 compliance pill palette (reuse `CompliancePill` component if it exists, otherwise a new one in `apps/web/src/components/ui/` with the same tokens).
  - Per-intake detail page `/[locale]/(dashboard)/invoices/intake/[id]/`: shows rendered ZUGFeRD PDF preview (via `react-pdf` viewer, already a web dep) alongside parsed structured fields (supplier, invoice #, date, totals, lines), matched-candidate panel, validation report section, CTAs: "Accept despite issues" (if warnings), "Match to contractor X", "Create new contractor from this data", "Convert to Invoice" (enabled only when matched + validation-acknowledged), "Reject import".
  - Sidebar entry under "Invoices" section: `Imports` (only shown when org has feature-flag `EINVOICE_IMPORT_ENABLED` on, matching the feature-flag strategy from project memory).

### Storage (EINV-03 — R2 layout + retention)
- **D-15:** **Content-addressed R2 keys matching outbound pattern, indefinite retention.**
  - Raw upload: `einvoice-intake/{organizationId}/{sha256[0:16]}.{pdf|xml}` — content-addressed for dedup (same document re-uploaded returns the same key).
  - Extracted XML (PDF uploads only): `einvoice-intake/{organizationId}/{sha256[0:16]}-extracted.xml` (sha256 of the extracted XML bytes, not the PDF).
  - Full KoSIT HTML report: `einvoice-intake/{organizationId}/{sha256[0:16]}-{ruleSetVersion}-report.html` — content-addressed on report hash, mirrors Phase 61 D-14 outbound layout.
  - Signed URL TTL 300s for download actions (matches Phase 56/59/61).
  - **Retention:** indefinite for v5.0. A project-wide e-invoice retention policy is a future phase that will cover outbound + inbound uniformly. Discarding rejected intakes after N days was considered but rejected — forensics on "why did user reject this?" matters for audit, and content-addressed storage keeps the incremental cost trivial.

### tRPC router layout
- **D-16:** **New `packages/api/src/routers/invoice-intake.ts`** with procedures:
  - `upload({ orgId, fileKind: 'xml' | 'pdf', fileBase64 })` — returns `{ intakeId, profileLevel, validationStatus, warnings }` or throws typed errors (`CII_PARSE_FAILED` / `ZUGFERD_NO_XML_ATTACHMENT` / `LEVEL_TOO_LOW` / `CII_XSD_INVALID`). File is decoded server-side; no direct R2 upload from the browser (security: we validate before persisting).
  - `listByOrg({ status?, cursor? })` — paginated list for the intake route.
  - `getById({ intakeId })` — full detail view including parsed invoice JSON + validation report.
  - `getMatchCandidates({ intakeId })` — returns the heuristic-ranked Contractor list (recomputed per call — NOT persisted).
  - `confirmMatch({ intakeId, contractorId, contractId? })` — sets `matchedContractorId` / `matchedContractId`, transitions `status` to `MATCHED`.
  - `acknowledgeValidation({ intakeId })` — sets `validationAcknowledgedAt` + `validationAcknowledgedByUserId`.
  - `convertToInvoice({ intakeId })` — atomic `$transaction` create of `Invoice` + lines; requires `MATCHED` + (valid OR acknowledged). Idempotent on `convertedInvoiceId`.
  - `reject({ intakeId, reason })` — sets `status` to `REJECTED`; retains all R2 artifacts per D-15.
  - `downloadRawFile({ intakeId })`, `downloadExtractedXml({ intakeId })`, `downloadValidationReport({ intakeId })` — return 300s signed URLs.
- **D-17:** **Extend `packages/api/src/routers/einvoice.ts`** with a `generateZugferdPdf({ invoiceId })` mutation: builds the `EInvoice` envelope (same as `finalize` in Phase 61 D-04), pipes through `zugferd-de/generator.ts` to produce the PDF buffer, uploads to R2 at `einvoice-pdf/{organizationId}/{invoiceId}/{sha256[0:16]}.pdf`, writes a new `EInvoiceLifecycleEvent` of type `ZUGFERD_GENERATED`, returns `{ pdfKey, signedUrl }`. Extends Phase 61's `EInvoiceLifecycle` with a new optional `zugferdPdfKey` field (nullable, only populated when user generates a ZUGFeRD PDF for an invoice). The invoice detail page E-invoice tab (Phase 61 D-15) gains a "Download ZUGFeRD PDF" CTA.

### Claude's Discretion
- Exact pdf-lib call sequence for XMP writing (library-specific low-level API) — finalize during planning after re-reading pdf-lib docs via `ctx7` CLI.
- The specific bundled ICC profile choice (sRGB2014 vs sRGB IEC61966-2.1) — pick the one with the cleanest permissive license at planning time.
- Font embedding strategy when Helvetica cannot be subset (some React-PDF versions embed Helvetica via reference only; if so, swap to bundled Noto Sans) — determine empirically during implementation.
- React-PDF visual template exact design — produce a first pass during implementation that shares tokens with `ir35-sds.tsx`; defer visual polish to the `frontend-design` plugin during UI phase or follow-up.
- Whether the intake detail page should show a full KoSIT-style HTML report inline via iframe or just link to the R2-signed URL — start with link; upgrade to inline iframe if usability feedback demands.
- Exact Levenshtein distance threshold for fuzzy contractor matching (3 is a starting point; tune based on fixture testing).
- Whether to expose `downloadRawFile` to regular users or admin-only — probably regular users (they uploaded it); revisit if PII review surfaces concerns.
- Whether the parser's `_unmappedFields` list is exposed in the UI or kept as a developer-debugging detail — lean toward a collapsed "Advanced / technical" section on the intake detail.
- File-size cap tuning (5MB starting point; ZUGFeRD PDFs can be 1-3MB typical) — raise if legitimate use cases exceed.

### Folded Todos
No todos folded — `gsd-tools todo match-phase 62` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` line 36 — EINV-02: ZUGFeRD PDF/A-3 with embedded CII COMFORT
- `.planning/REQUIREMENTS.md` line 37 — EINV-03: inbound XRechnung + ZUGFeRD parsing into the invoice intake flow
- `.planning/ROADMAP.md` §Phase 62 — Goal, 2 success criteria (veraPDF-valid PDF/A-3 + automatic structured-data extraction), `Depends on Phase 61`

### Standing project constraints
- `.planning/STATE.md` §"Standing Project Constraints" — app is local-only; legal/regulatory verification deferred post-deploy

### Prior phase context (foundations this phase extends)
- `.planning/phases/61-xrechnung-e-invoicing/61-CONTEXT.md` — XRechnung CII generator (D-01-D-04), KoSIT 3-layer validator (D-03), `EInvoiceLifecycle` + `EInvoiceLifecycleEvent` tables (D-12-D-13), R2 content-addressed storage pattern (D-14), e-invoice tab on invoice detail page (D-15), einvoice tRPC router (D-16). **All Phase 61 decisions are load-bearing — Phase 62 reuses, does not fork.**
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — VAT validation, reverse-charge flag, Kleinunternehmer flag — same data model feeds both Phase 61 XML + Phase 62 PDF visual template
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — locked DE legal phrases pattern, `next-intl` DE locale — any new UI strings (intake page labels, validation-warning copy) follow this

### Existing code (reusable infrastructure)
- `packages/einvoice/src/profiles/xrechnung-de/generator.ts` — CII generator (REUSED by `zugferd-de/generator.ts`; imports `buildXrechnungCii`)
- `packages/einvoice/src/profiles/xrechnung-de/parser.ts` — stub to be replaced with a real implementation in this phase (D-07)
- `packages/einvoice/src/profiles/xrechnung-de/validator.ts` — KoSIT 3-layer (REUSED for inbound validation D-08)
- `packages/einvoice/src/profiles/xrechnung-de/constants.ts` — `XRECHNUNG_VERSION`, CustomizationID, ProfileID constants (reused verbatim)
- `packages/einvoice/src/registry.ts` — profile registry; new `ZUGFERD_DE_PROFILE_ID` registered
- `packages/einvoice/src/engine/xml-utils.ts` — shared XML-building primitives
- `packages/einvoice/src/types/invoice.ts` — `EInvoice`, `EInvoiceLine`, `EInvoiceTaxSubtotal` envelope (neutral, same for ZUGFeRD)
- `packages/einvoice/package.json` — dependency list to extend: add `pdf-lib` (runtime), `@react-pdf/renderer` (runtime — already in api/web)
- `packages/api/src/routers/einvoice.ts` — extended with `generateZugferdPdf({ invoiceId })` mutation (D-17)
- `packages/api/src/pdf-templates/` — existing React-PDF templates (ir35-sds, drv-defense-bundle, gdpr-privacy-notice) — reference for visual token consistency; new `zugferd-de/invoice-template.tsx` follows the same palette + typography conventions
- `packages/api/src/services/r2.ts` — `putObjectAndSignDownload`, `signExistingDownload` (REUSED for all PDF + XML + report persistence)
- `packages/db/prisma/schema/invoice.prisma` — add new `InvoiceIntakeRequest` model with the fields in D-09; extend `EInvoiceLifecycle` with optional `zugferdPdfKey` per D-17
- `packages/db/prisma/schema/contractor.prisma` — existing `Contractor` with `vatIdentifier` — referenced by matcher D-11
- `packages/validators/src/legal/de.ts` — locked DE phrases (if intake UI surfaces statutory copy, follow pattern)
- `apps/web/src/app/[locale]/(dashboard)/invoices/` — existing list + detail page extended per D-14 (split-button, new `/intake/` subroute)
- `apps/web/src/app/[locale]/(dashboard)/invoices/intake/` — NEW route (list + `[id]/` detail)
- `apps/web/messages/*.json` — extend the `EInvoice` namespace with new strings for intake UI, validation warnings, and import-action labels (DE + EN + GB)
- `packages/feature-flags/` — new flag `EINVOICE_IMPORT_ENABLED` controlling intake nav + upload action

### External regulatory & technical references
- ZUGFeRD 2.3.2 specification — https://www.ferd-net.de/standards/zugferd-2.3.2 (current ZUGFeRD spec covering COMFORT/EN 16931 profile + PDF/A-3 XMP extension)
- Factur-X 1.0.07 specification — https://fnfe-mpe.org/factur-x/factur-x_en/ (French equivalent; spec defines the XMP extension schema and `factur-x.xml` attachment naming that ZUGFeRD reuses)
- ISO 19005-3:2012 (PDF/A-3) — PDF/A-3 conformance requirements (Part 3 permits embedded files with AFRelationship)
- veraPDF Industry Validator — https://verapdf.org/ (PDF/A conformance checker; Docker image `verapdf/cli`)
- pdf-lib documentation — https://pdf-lib.js.org/ (used for PDF/A-3 post-processing — XMP + embedded file API)
- @react-pdf/renderer — https://react-pdf.org/ (visual rendering layer)
- EN 16931-1:2017+A1:2019 — European semantic model (inherited from Phase 61; same model for both CII XML and ZUGFeRD visual)
- UN/CEFACT CII D16B schema — https://unece.org/trade/uncefact/xml-schemas (CII syntax; inherited)
- KoSIT Validator artifacts — https://github.com/itplr-kosit/validator-configuration-xrechnung (inherited from Phase 61 — bundled locally)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **XRechnung CII generator (Phase 61):** `packages/einvoice/src/profiles/xrechnung-de/generator.ts` — directly imported and reused, no fork. Produces bit-identical XML whether emitted standalone or embedded in ZUGFeRD.
- **KoSIT 3-layer validator (Phase 61):** `packages/einvoice/src/profiles/xrechnung-de/validator.ts` with bundled `validator-bundle/` — reused for inbound XML validation on every upload.
- **`EInvoiceLifecycle` + event table (Phase 61 D-12/D-13):** extended with `zugferdPdfKey` column + a `ZUGFERD_GENERATED` event type; no schema rethink.
- **Pluggable profile pattern** (peppol-ae, ksef, zatca, xrechnung-de): `zugferd-de/` slots in via `registry.ts` with zero refactor of existing profiles.
- **`@react-pdf/renderer` 4.4.1** already on `packages/api` + `apps/web`; added to `packages/einvoice` for the visual template.
- **`fast-xml-parser` 5.5.11** already a dep of `packages/einvoice` — used by the new parser (inverse of generator).
- **R2 content-addressed storage** (Phase 56/59/61): `putObjectAndSignDownload` + signed URL TTL 300s pattern reused verbatim for all intake + outbound PDF artifacts.
- **Multi-tenant Prisma extension:** new `InvoiceIntakeRequest` model inherits org-scoping with zero additional code.
- **`CompliancePill` / compliance-pill palette (Phase 60):** reused for intake-status chips on the new `/intake` page.
- **Phase 57 tax logic:** `Invoice.isReverseCharge`, `Invoice.vatRate`, Kleinunternehmer flag — feed identically into the ZUGFeRD visual template and into match-candidate VAT compatibility.

### Established Patterns
- **Profile-per-country** in `packages/einvoice/src/profiles/` — ZUGFeRD follows.
- **Dual-tier audit model** (Phase 60: mutable parent + append-only events; Phase 61: `EInvoiceLifecycle` + `EInvoiceLifecycleEvent`): `InvoiceIntakeRequest` follows the mutable-parent tier; lifecycle events on the Phase 61 table cover the append-only audit trail.
- **Content-addressed R2 keys with SHA-256** (Phases 56/59/61): reused for all intake artifacts + ZUGFeRD PDFs.
- **Signed URL TTL 300s** matching prior phases.
- **Zod at tRPC boundary** for all new router inputs.
- **Locked DE legal phrases** (Phase 56): any new UI copy with statutory meaning goes through `packages/validators/src/legal/de.ts` with CI-guard coverage.
- **No `console.*` in source** — `@contractor-ops/logger` (Pino).
- **Feature flag gate** (project-wide strategy): `EINVOICE_IMPORT_ENABLED` controls the import UI surface per-org via the Unleash wrapper (see project memory).
- **Hard reject unsafe inbound data at the boundary** (Phase 61 D-07 Leitweg-ID validation pattern): extends to CII XSD + ZUGFeRD-level validation on upload.

### Integration Points
- **Invoices list page** (`apps/web/src/app/[locale]/(dashboard)/invoices/`): gains the split-button Import action + the E-invoice tab already carries the Phase 61 compliance info; Phase 62 adds a "Download ZUGFeRD PDF" CTA when a ZUGFeRD PDF exists for the invoice.
- **New nested route** `/[locale]/(dashboard)/invoices/intake/` + `/[locale]/(dashboard)/invoices/intake/[id]/` — the intake surface.
- **tRPC appRouter** (`packages/api/src/routers/root.ts`): register the new `invoiceIntake` router; `einvoice` router gains `generateZugferdPdf`.
- **Sidebar nav** (`apps/web/src/components/layout/`): `Imports` entry under `Invoices` section gated on feature flag.
- **Existing contractor create form** (Phase 56): reused by the "Create new contractor from this data" fallback — prefilled from parsed supplier fields.
- **CI workflow** (`.github/workflows/*.yml`): new `verapdf-check` job on einvoice-touching PRs.

</code_context>

<specifics>
## Specific Ideas

- ZUGFeRD reuses the Phase 61 XRechnung CII generator verbatim — the embedded XML is bit-identical to what ships standalone. One generator, two distribution formats (raw XML via Peppol, PDF/A-3 via email/portal).
- PDF/A-3 conformance is a CI-time engineering contract, not a user-visible compliance pill. Users see "Download ZUGFeRD PDF" or "Generation failed" — never "passes veraPDF" or "failed veraPDF rule 6.4.3".
- The staging `InvoiceIntakeRequest` entity keeps untrusted externally-sourced invoice data out of the `Invoice` table until an explicit human convert action. Mirrors the classification/assessments pattern (Phase 58–60) where assessments are first-class entities distinct from invoices.
- `factur-x.xml` is the exact filename ZUGFeRD (and Factur-X) spec mandates for the embedded XML attachment — not `xrechnung.xml`, not `invoice.xml`.
- PDF/A-3 allows embedded files with arbitrary AFRelationships; ZUGFeRD requires `Alternative` specifically. veraPDF rule 6.9 enforces this.
- Heuristic matcher is not persisted — recomputed every time the intake detail page loads so newly-created Contractors appear immediately. Only the final user-confirmed `matchedContractorId` is persisted.
- The inbound parser accepts EXTENDED profile with best-effort field mapping + warning banner rather than hard-rejecting — real counterparties send EXTENDED and blocking them would push users back to manual data entry.
- "Accept despite issues" CTA records the acknowledging user + timestamp; this creates an audit trail for why validation warnings were accepted (useful if a tax adviser reviews the intake flow later).
- Content-addressed R2 keys dedup repeat uploads of the same document automatically — a user accidentally uploading the same PDF twice returns the same intake (idempotent via the `(orgId, sha256)` unique constraint).
- veraPDF runs against 3 fixture scenarios (minimal, reverse-charge + Leitweg-ID, Kleinunternehmer) — covers the three main German invoicing tax postures without balloon CI runtime.

</specifics>

<deferred>
## Deferred Ideas

- **Peppol inbound via Storecove polling** — future phase; infrastructure (peppol-orchestrator.ts) exists in stub form but processing + dead-letter + monitoring deferred
- **Email inbox intake** (e.g., `invoices+{orgId}@...`) — future phase; requires SES/DKIM/attachment extraction infra
- **Retention policy** — uniform e-invoice retention (outbound + inbound) deferred to a future phase; v5.0 is indefinite
- **Bulk import** (zip of multiple XML/PDF) — out of scope; v5.0 is per-file upload
- **Factur-X / FatturaPA / other country profiles** — market-driven future phases
- **Auto-conversion of intakes to Invoice without human gate** — explicitly rejected; human gate is load-bearing for trust + audit
- **Runtime veraPDF gate** — CI-only suffices for v5.0; revisit if enterprise customers demand runtime proof
- **Inline KoSIT HTML report iframe on intake detail page** — start with R2 link; upgrade if usability feedback demands
- **Auto-create Contractor from parsed data without user confirmation** — explicitly rejected; user always confirms/creates
- **Signature verification on inbound ZUGFeRD PDFs** — German XRechnung has no signature mandate; inbound signature verification is not a Phase 62 requirement
- **OCR fallback for scanned PDFs without embedded XML** — out of scope; ZUGFeRD by definition carries XML. Non-ZUGFeRD scanned invoices belong in a separate "scan-to-invoice" future phase
- **"Preferred supplier" tagging for heuristic matching** — not needed for v5.0; revisit when matcher false positives become a complaint
- **Cross-org duplicate detection** (same document sent to multiple orgs in a tenancy) — sha256 dedup is per-org by design
- **PDF/A-3 conformance level A** (tagged PDF for accessibility) — Conformance Level B is the ZUGFeRD mandate and the industry norm; A is optional and deferred

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 62` returned 0 matches.

</deferred>

---

*Phase: 62-zugferd-e-invoicing*
*Context gathered: 2026-04-15*
