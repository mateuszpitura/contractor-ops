# Phase 61: XRechnung E-Invoicing - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Add XRechnung (EN 16931 German CIUS) as a new country profile in `packages/einvoice/`, following the established pluggable profile pattern. Scope: (a) CII XML generator for XRechnung (EINV-01), (b) KoSIT 3-layer validation harness — XSD + EN 16931 Schematron + XRechnung CIUS Schematron (EINV-04), (c) Leitweg-ID data model + format/check-digit validation + per-contractor/per-contract resolution (EINV-05), (d) Peppol BIS Billing 3.0 transmission for UK public sector via the existing Storecove ASP adapter with a new format-discriminator payload path (EINV-06), (e) per-invoice e-invoice lifecycle model + compliance status surfaced on the invoices list and a per-invoice "E-invoice" tab (EINV-07). ZUGFeRD (PDF/A-3 with embedded CII), inbound e-invoice parsing, and the XRechnung-specific invoice-receipt flow are Phase 62 and remain explicitly out of scope.

</domain>

<decisions>
## Implementation Decisions

### CII Generator & KoSIT Validation (EINV-01 / EINV-04)
- **D-01:** **New profile `packages/einvoice/src/profiles/xrechnung-de/`** mirroring the `peppol-ae/` layout: `constants.ts` (XRechnung customization IDs, namespaces, code lists), `generator.ts` (CII/CrossIndustryInvoice builder targeting `rsm:`, `ram:`, `udt:`, `qdt:` namespaces), `parser.ts`, `validator.ts`, `schemas.ts`, `index.ts`. Shares `engine/xml-utils.ts` and core `EInvoice` / `EInvoiceProfile` interfaces — no refactor of peppol-ae's UBL generator. Registry registration in `packages/einvoice/src/registry.ts` (new `XRECHNUNG_DE_PROFILE_ID`).
- **D-02:** **XRechnung version pin: `XRechnung 3.0.2` (CIUS on EN 16931 v1.3)** locked via a single `XRECHNUNG_VERSION` constant. Document-level `CustomizationID = urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0` and `ProfileID = urn:fdc:peppol.eu:2017:poacc:billing:01:1.0` (Peppol BIS 3.0 profile so the XML is simultaneously Peppol-valid for the UK B2G route).
- **D-03:** **KoSIT validation = local execution with bundled schematron XSLTs + `saxon-js`.** New workspace dev-dependency `saxon-js`. Pre-compiled KoSIT artifacts (from a pinned KoSIT release, e.g. `validator-configuration-xrechnung_3.0.2_2024-08-21`) checked into `packages/einvoice/src/profiles/xrechnung-de/validator-bundle/`:
  - `EN16931-CII-validation.xslt` (compiled from `EN16931-CII-validation.sch`)
  - `XRechnung-CII-validation.xslt` (compiled from `XRechnung-CII-validation.sch`)
  - `CII-D16B-schema/` (OASIS/UN-CEFACT CII D16B XSDs)
  - `README.md` documenting the source release, license (Apache-2.0 for KoSIT artifacts), and re-compilation instructions
  - Pre-compile happens ONCE at PR/release time via a one-shot Node script (`scripts/recompile-kosit-schematron.ts`); runtime is pure `saxon-js` XSLT evaluation. No JVM, no child process, no remote HTTP calls. Bundle size ~8MB — acceptable.
  - Validation runs three layers in order, short-circuiting on the first layer's fatal errors:
    1. XSD schema validation via `libxmljs2` (already a transitive dep via existing packages) against bundled CII D16B XSD.
    2. EN 16931 CII Schematron via `saxon-js` applying `EN16931-CII-validation.xslt`.
    3. XRechnung CIUS Schematron via `saxon-js` applying `XRechnung-CII-validation.xslt`.
  - Each layer produces SVRL (Schematron Validation Report Language) output; `validator.ts` normalizes SVRL into a typed `XRechnungValidationReport { layer, status, errors[], warnings[], infos[] }` shape.
- **D-04:** **Validation trigger: on-demand + eager at "finalize e-invoice" action.** New `finalizeEInvoice` tRPC mutation on the invoice router that: (a) builds the `EInvoice` envelope from Invoice + lines + parties + Leitweg-ID resolution, (b) runs XRechnung generator → CII XML, (c) runs KoSIT 3-layer validation, (d) persists result to `EInvoiceLifecycle` + uploads XML to R2, (e) returns the validation report to the UI. Also an "Validate now" CTA for any already-finalized invoice — re-runs validation without mutating stored XML (compares hash; flags if drift). No validation on draft-invoice writes.

### Leitweg-ID Data Model & Validation (EINV-05)
- **D-05:** **New Prisma model `LeitwegId`:**
  - Fields: `id`, `organizationId`, `value` (string, unique per org), `description` (optional free text — e.g. "Bundesministerium für Finanzen — Abteilung IV"), `contractorId` (nullable FK — attaches the ID as a default for a given contractor), `contractId` (nullable FK — attaches as a per-contract override), `isDefaultForContractor` (bool — when set, marks the default LeitwegId among multiple attached to the same contractor), `validFrom` (nullable Date), `validTo` (nullable Date), `notes` (nullable Text), `createdAt`, `updatedAt`.
  - Multi-tenant scoped via Prisma client extension.
  - Unique constraint `(organizationId, value)` — an org can't register the same Leitweg-ID twice.
  - Indexed on `(organizationId, contractorId)` and `(organizationId, contractId)`.
  - Real-world orgs invoice multiple German agencies, each with its own Leitweg-ID; this model supports multi-ID-per-contractor + per-contract override without requiring denormalized string copies.
- **D-06:** **Resolution rule for an invoice's effective Leitweg-ID:**
  1. If `Invoice.contractId` is set AND a `LeitwegId` row exists with that `contractId` → use that.
  2. Else if `Invoice.contractorId` is set AND a `LeitwegId` row exists with that `contractorId` AND `isDefaultForContractor=true` → use that.
  3. Else → no Leitweg-ID resolved (triggers D-08 soft-gate).
  Resolution function lives in a small new helper `packages/api/src/services/leitweg-id-resolver.ts`. Tested independently from the XRechnung generator.
- **D-07:** **Format validation via Zod at the tRPC + entity boundary:**
  - New validator module `packages/validators/src/leitweg-id.ts` exporting `leitwegIdSchema`.
  - Structure: coarse (2–12 digits) + optional `-` refinement (0–30 uppercase alphanumerics) + `-` 2-digit check digit. Total max 46 chars.
  - Regex: `/^(\d{2,12})(?:-([A-Z0-9]{0,30}))?-(\d{2})$/`.
  - `.refine()` validates the Modulo-11-10 check digit (algorithm per XRechnung spec §BT-10) against coarse + refinement parts.
  - Used by `leitwegId.create` and `leitwegId.update` tRPC mutations.
- **D-08:** **Leitweg-ID required for DE B2G invoicing — soft-gate with warning.**
  - New boolean field on `Contractor`: `isPublicSectorBuyer` (default `false`).
  - If `invoice.contractor.countryCode === 'DE'` AND `invoice.contractor.isPublicSectorBuyer === true` AND D-06 resolution returns no ID → the `finalizeEInvoice` mutation returns a `warnings: ['LEITWEG_ID_MISSING']` entry; XRechnung XML is still produced (with BT-10 omitted if the recipient is a non-Leitweg-mandated agency, which some federal Landesebene are); EINV-07 compliance report flags the invoice red.
  - Hard-block only triggers if the invoice is also being sent via Storecove (D-09) AND the buyer's Peppol ID requires Leitweg-ID per Storecove's documentType-aware routing.

### Peppol Transmission via Storecove (EINV-06)
- **D-09:** **Extend `StorecoveAdapter.transmitInvoice` with a format discriminator**, not a new adapter instance.
  - Modify `TransmitInvoiceParams` in `packages/einvoice/src/asp/types.ts` to accept `format: { kind: 'ubl-pint-ae' } | { kind: 'cii-xrechnung', customizationId, profileId } | { kind: 'ubl-peppol-bis-3' }`. Adapter maps each format to the Peppol Network document type ID string + Storecove's `document_type_id` parameter.
  - Storecove API v2 accepts both UBL and CII payloads via the same `/invoices/submit` endpoint with `document_type_id`. No additional HTTP client changes.
  - Webhook HMAC verification, `GovApiRateLimiter`, `GovApiAuditLogger` wiring all reused as-is.
  - Existing peppol-ae tests continue to pass; new tests exercise the XRechnung-CII path.
- **D-10:** **Per-org one-time Peppol participant registration via Storecove.**
  - New `peppolParticipantId` + `peppolParticipantSchemeId` + `peppolParticipantStatus` fields on `Organization` (Prisma migration). `peppolParticipantStatus` enum: `'NOT_REGISTERED' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'FAILED'`.
  - Settings UI at `/[locale]/(dashboard)/settings/e-invoicing/` (new page) with an "Enable Peppol UK" action for org admins. Action calls `storecove.adapter.registerParticipant({...})` using the org's chosen scheme (typical: `0060` = UK Companies House, `0088` = GLN, `0106` = Dun & Bradstreet) + value (registration number). Persists the returned Storecove participant ID + status.
  - Storecove webhook handler updates `peppolParticipantStatus` on status change events (reuses existing `packages/api/src/routers/storecove-webhook` if it exists; otherwise extends whatever webhook surface the peppol-ae adapter already wires to).
  - Send gate: `storecove.transmitInvoice` refuses to send unless the sender's `Organization.peppolParticipantStatus === 'ACTIVE'`.
- **D-11:** **Buyer Peppol ID + SML lookup validation before send.**
  - New fields on `Contractor`: `peppolSchemeId` (nullable string like `0060`), `peppolParticipantValue` (nullable string). Paired — either both set or both null. Zod schema validates the pair via `refine`.
  - Before `storecove.adapter.transmitInvoice`, a pre-flight call to `storecove.adapter.lookupParticipantCapabilities({ schemeId, value })` confirms the recipient is registered in the Peppol SML AND supports `cii-xrechnung` document type. Caches capability results in a new short-TTL table `PeppolCapabilityCache { orgId, schemeId, value, documentTypes Json, cachedAt, expiresAt }` (6-hour TTL) to avoid hammering Storecove on repeat sends.
  - On lookup failure (participant not registered or doesn't support XRechnung-CII) the mutation throws `PARTICIPANT_NOT_REACHABLE` with actionable error copy; no transmission attempt is made.

### E-Invoice Lifecycle & Compliance Status (EINV-07)
- **D-12:** **New Prisma model `EInvoiceLifecycle` 1:1 with `Invoice`:**
  - Fields: `id`, `organizationId`, `invoiceId` (FK, unique), `profileId` (string — `'xrechnung-de'`, `'peppol-ae-pint'`, etc., forward-compatible), `xmlKey` (nullable R2 object key), `xmlSha256` (nullable), `ruleSetVersion` (string — pinned at generation time, e.g. `XRechnung 3.0.2`), `validatedAt` (nullable), `validationStatus` enum (`'NOT_VALIDATED' | 'VALID' | 'INVALID' | 'WARNINGS'`), `validationReportSummary Json?` (normalized summary: per-layer status, error count, first 20 issues with XPath + message — see D-13), `validationReportFullKey` (nullable R2 key — full KoSIT HTML report), `transmittedAt` (nullable), `transmissionId` (nullable — Storecove message ID), `transmissionStatus` enum (`'NOT_SENT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED'`), `deliveredAt` (nullable), `deliveryAckJson Json?`, `lastErrorJson Json?`, `createdAt`, `updatedAt`.
  - Multi-tenant scoped. Unique `(organizationId, invoiceId)`.
  - State transitions enforced by a small FSM helper (not a DB trigger — keep schema simple); invalid transitions throw.
- **D-13:** **Child `EInvoiceLifecycleEvent` table — append-only audit trail:**
  - Fields: `id`, `organizationId`, `lifecycleId` (FK), `eventType` enum (`'GENERATED' | 'VALIDATED' | 'TRANSMITTED' | 'DELIVERY_ACK' | 'DELIVERY_FAILED' | 'RE_VALIDATED' | 'RE_TRANSMITTED'`), `occurredAt`, `actorUserId` (nullable — null for webhook-originated events), `detailsJson Json?` (event-specific payload), `createdAt`.
  - Provides the audit trail required for German/EU e-invoicing compliance reviews (demonstrates "when was it generated, validated, sent, acknowledged").
- **D-14:** **Validation report storage split:** structured summary in `EInvoiceLifecycle.validationReportSummary` (pass/fail per layer, error count, first 20 issues with XPath + rule ID + severity + message — enough for the UI tab); full KoSIT HTML report (the official KoSIT rendering with line-highlighting) uploaded to R2 at `einvoice-reports/{organizationId}/{invoiceId}/{ruleSetVersion}-{reportSha256[0:16]}.html`, content-addressed. Signed URL TTL 300s matching Phase 56/59.
- **D-15:** **EINV-07 compliance UI:**
  - New `eInvoiceStatus` column on the existing `/[locale]/(dashboard)/invoices/` list, with filter chips: `All` / `Not generated` / `Valid` / `Warnings` / `Invalid` / `Transmitted` / `Failed`. Badge style matches Phase 60 compliance pill palette.
  - Per-org summary tile at top of the invoices list: "X of Y invoices EN 16931 compliant" with a progress bar + count of invoices needing attention (invalid + failed). Click-through filters the list.
  - Per-invoice detail page (`/[locale]/(dashboard)/invoices/[id]/`) gains an "E-invoice" tab that shows: generation status, validation report summary (per-layer + issue list), transmission history (from `EInvoiceLifecycleEvent`), CTAs — "Generate XML" (first time) / "Finalize + validate" (produces canonical XML + runs KoSIT) / "Download XML" / "Download full report" / "Send via Peppol" (visible only for DE public-sector DE invoices and UK B2G sends where `Organization.peppolParticipantStatus === 'ACTIVE'`).
- **D-16:** **tRPC router layout:** new `packages/api/src/routers/einvoice.ts` with procedures: `finalize({ invoiceId })`, `revalidate({ invoiceId })`, `downloadXml({ lifecycleId })` (query returning signed URL), `downloadReport({ lifecycleId })` (query returning signed URL for the full HTML report), `send({ invoiceId })` (Peppol transmission gated on D-10 + D-11), `listByOrg({ status?, cursor? })`. Leitweg-ID management gets its own `leitwegId.ts` router: `list`, `listByContractor`, `listByContract`, `create`, `update`, `delete`, `setDefault`. Peppol participant gets `packages/api/src/routers/peppol-participant.ts`: `getStatus`, `register`, `deregister`.

### Claude's Discretion
- Exact `XRechnung 3.0.2` release pin (use the latest available at planning time — 3.0.2 is the assumption; confirm and update in RESEARCH.md)
- KoSIT artifact release tag — pick the most recent KoSIT validator-configuration release matching the pinned XRechnung version
- Whether to vendor `saxon-js` via `pnpm add` vs include as a workspace-local optional dep — go with the simpler `pnpm add`
- Exact SVRL → typed-report normalization shape — mirror whatever maps cleanly to the UI's issue list
- Whether `PeppolCapabilityCache` TTL is 6h or 24h — trade off freshness vs API load; 6h is a safe default
- UI layout of the "E-invoice" invoice-detail tab — defer specifics to the frontend-design plugin during planning
- Error-copy for `LEITWEG_ID_MISSING`, `PARTICIPANT_NOT_REACHABLE`, `KOSIT_VALIDATION_FAILED` — follow existing i18n patterns in `apps/web/messages/*.json` under a new `EInvoice` namespace
- Whether to add an admin-only "Force re-validate all invoices" bulk action — nice-to-have; decide during planning based on scope budget
- Whether webhook-driven transmission status updates get a dedicated in-app notification (via the Phase 60 notification-service plumbing) or just update the UI silently — probably silent for now, but the notification path is easy to add later

### Folded Todos
No todos folded — `gsd-tools todo match-phase 61` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` lines 35, 38, 39, 40, 41 — EINV-01 (XRechnung CII), EINV-04 (KoSIT 3-layer validation), EINV-05 (Leitweg-ID), EINV-06 (UK B2G via Storecove Peppol), EINV-07 (compliance status view)
- `.planning/ROADMAP.md` §Phase 61 — Goal, 4 success criteria, `Depends on Phase 57`

### Standing project constraints
- `.planning/STATE.md` §"Standing Project Constraints" — app is local-only; legal/regulatory verification (any tax adviser / Steuerberater sign-off on locked phrases, if any) is deferred post-deploy; ship code with locked-phrase working copy

### Prior phase context (foundations this phase extends)
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — VAT validation, reverse-charge handling, KleinunternehmerRegelung flag, invoice footer legal notices — feed into XRechnung line and tax subtotal sections
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — locked legal phrase pattern, German translation keys, CI guard pattern — any statutory German phrasing for XRechnung-specific UI flows the same way

### Existing code (reusable infrastructure)
- `packages/einvoice/src/index.ts` — profile interface exports (`EInvoiceProfile`, `EInvoice`, `EInvoiceLine`, etc.)
- `packages/einvoice/src/registry.ts` — profile registry; new XRechnung profile registered here
- `packages/einvoice/src/engine/` — `engine.ts`, `pipeline.ts`, `xml-utils.ts` — shared XML-building primitives
- `packages/einvoice/src/profiles/peppol-ae/` — reference profile for layout + file organization (copy the structure, change UBL → CII and jurisdiction constants)
- `packages/einvoice/src/asp/storecove/` — `adapter.ts`, `client.ts`, `schemas.ts`, `types.ts` — extended with CII format discriminator per D-09
- `packages/einvoice/src/asp/types.ts` — `ASPAdapter` interface + `TransmitInvoiceParams` — modified per D-09
- `packages/db/prisma/schema/invoice.prisma` — existing `Invoice` model; add 1:1 relation to new `EInvoiceLifecycle`
- `packages/db/prisma/schema/contractor.prisma` — existing `Contractor` + `ContractorAssignment`; `Contractor` gains `isPublicSectorBuyer`, `peppolSchemeId`, `peppolParticipantValue`
- `packages/db/prisma/schema/organization.prisma` — existing `Organization`; gains `peppolParticipantId`, `peppolParticipantSchemeId`, `peppolParticipantStatus`
- `packages/api/src/services/r2.ts` — `putObjectAndSignDownload`, `signExistingDownload` (Phase 59) for XML + validation-report persistence
- `packages/validators/src/` — extend with `leitweg-id.ts` (new module); `index.ts` re-export
- `packages/validators/src/__tests__/` — add Leitweg-ID format + check-digit tests
- `packages/gov-api/` — `GovApiRateLimiter`, `GovApiAuditLogger` abstractions already wired into Storecove adapter; Phase 61 reuses them
- `apps/web/src/app/[locale]/(dashboard)/invoices/` — existing invoice list + detail page; extended with compliance column/filter/tile/tab per D-15
- `apps/web/src/app/[locale]/(dashboard)/settings/` — new `e-invoicing/` page for Peppol participant registration per D-10
- `apps/web/messages/*.json` — new `EInvoice` namespace for chrome strings (button copy, tile headings, filter labels, error copy)

### External regulatory & technical references
- XRechnung 3.0.2 specification — https://www.xoev.de/xrechnung-16828 (German federal e-invoicing CIUS on EN 16931)
- EN 16931-1:2017+A1:2019 — European semantic model for e-invoices (the EN standard XRechnung profiles)
- UN/CEFACT CII D16B schema — https://unece.org/trade/uncefact/xml-schemas (Cross Industry Invoice D16B, XRechnung's syntax)
- KoSIT validator configuration for XRechnung — https://github.com/itplr-kosit/validator-configuration-xrechnung (source of the .sch files)
- KoSIT Validator — https://github.com/itplr-kosit/validator (reference implementation; local saxon-js run reuses the same artifacts)
- Peppol BIS Billing 3.0 — https://docs.peppol.eu/poacc/billing/3.0/
- Peppol document type IDs — https://docs.peppol.eu/edelivery/codelists/
- Storecove REST API v2 documentation — https://www.storecove.com/docs/
- Leitweg-ID specification — https://www.xoev.de/downloads-2316#Leitweg-ID (format + Modulo-11-10 check digit algorithm)
- UK public sector Peppol — NHS / Crown Commercial Service Peppol mandate; https://www.peppol.uk/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Pluggable profile pattern** (peppol-ae, ksef, zatca already ship this way): new XRechnung profile registered in `registry.ts`, discovered by `getProfileForCountry`/`getProfileById` — zero refactor of existing profiles
- **Storecove ASP adapter** (`packages/einvoice/src/asp/storecove/adapter.ts`) already handles Peppol participant registration + invoice transmission + HMAC webhook verification + rate limiting + audit logging — Phase 61 adds a format discriminator and reuses the rest
- **Core `EInvoice` envelope** (`packages/einvoice/src/types/invoice.ts`): generic invoice model covering Party / Line / TaxSubtotal / PaymentMeans — already neutral on UBL vs CII syntax
- **`engine/xml-utils.ts`**: XML-builder primitives (element, attr, namespace binding) reused by the CII generator
- **R2 persistence pattern** (Phase 59 Plan 59-01 + Phase 56 Plan 07): `putObjectAndSignDownload`, `signExistingDownload`, content-addressed keys — reused for XRechnung XML + validation report storage
- **Phase 57 VAT + reverse-charge logic**: `Invoice.isReverseCharge`, `Invoice.vatRate` / `vatAmountMinor` — feed directly into XRechnung BG-23 tax subtotal rows
- **Phase 57 Kleinunternehmer flag** on Organization: informs `CustomizationID` and line-level VAT exemption reasons (§19 UStG)
- **Phase 60 notification-service** (`packages/api/src/services/notification-service`): available if we want transmission-status notifications later

### Established Patterns
- **Profile-per-country** (einvoice, gov-api, classification) — XRechnung follows the same layout
- **Append-only compliance tables** (Phase 51, 57, 58, 59 assessments/documents; Phase 60 triggers are mutable but evidence is append-only): `EInvoiceLifecycle` is mutable (status transitions) but `EInvoiceLifecycleEvent` is append-only for the audit trail — same dual-tier pattern as Phase 60
- **Content-addressed R2 keys** with SHA-256: used for classification docs (Phase 59); reused for XRechnung XML + validation reports
- **Signed URL TTL 300s** matching Phase 56/59
- **Zod at tRPC boundary** for all new router inputs
- **Locked legal phrases** pattern — if XRechnung surfaces any German statutory copy beyond what Phase 56 already locks (e.g. Leitweg-ID explanatory text), it goes through `packages/validators/src/legal/de.ts` with CI-guard coverage
- **Multi-tenant Prisma client extension** — all new models scoped by `organizationId`
- **No `console.*` in source** — `@contractor-ops/logger`

### Integration Points
- **Invoice list + detail page** (`apps/web/src/app/[locale]/(dashboard)/invoices/`): compliance column, filter chips, per-org summary tile at top, per-invoice "E-invoice" tab — existing surfaces extended, no new top-level page
- **Settings → E-invoicing** (`apps/web/src/app/[locale]/(dashboard)/settings/e-invoicing/`, new): Peppol participant registration for the org, Leitweg-ID management list, Storecove health status indicator
- **Contractor profile page**: Leitweg-ID default + Peppol ID fields added to the existing form (Phase 57 country-compliance surface)
- **Contract page**: per-contract Leitweg-ID override field + resolved-Leitweg-ID preview
- **tRPC appRouter** (`packages/api/src/routers/root.ts`): register `einvoice`, `leitwegId`, `peppolParticipant` routers
- **Storecove webhook route** (existing or new at `apps/web/src/app/api/webhooks/storecove/route.ts`): receives transmission status events, updates `EInvoiceLifecycle.transmissionStatus` + writes `EInvoiceLifecycleEvent` audit row
- **Existing `/invoices/[id]/page.tsx`**: gain a tabbed layout (`Details` | `E-invoice` | existing tabs); the E-invoice tab is the UI delivery surface for D-15

</code_context>

<specifics>
## Specific Ideas

- XRechnung 3.0.2's dual `CustomizationID` (XRechnung CIUS) + `ProfileID` (Peppol BIS 3.0) on the same document is load-bearing: it means one generator output is valid for both the KoSIT validator AND the Peppol network UK B2G route (no separate UBL transcode needed) — saves a whole format-conversion step
- CII syntax choice is driven by two facts: (a) EINV-01 explicitly locks it, and (b) Peppol-UK + German B2G converge on XRechnung-CII as a supported document type ID via Storecove — so one XML serves both markets
- KoSIT validation running locally via bundled XSLTs (pre-compiled from .sch) is the industry-standard approach and matches what reference implementations do; the alternative (remote KoSIT HTTP validator) introduces a runtime dependency on a government-hosted service with no SLA
- `saxon-js` is chosen over `libxslt`-backed alternatives because it's pure JS (no native binding build issues on Render/Vercel) and widely used for schematron-derived XSLT 2.0+ evaluation
- Leitweg-ID Modulo-11-10 check digit is a real validator; refusing to persist invalid IDs at the boundary prevents a downstream KoSIT failure that's much harder to diagnose
- `LeitwegId` entity (not denormalized string fields) is chosen because real B2G invoicing involves multiple sub-agencies per buyer and per-contract overrides — schema supports it cleanly
- The Storecove adapter's format discriminator is an additive change — peppol-ae continues to work without any call-site updates
- Per-org one-time participant registration (not per-invoice) matches Storecove's billing model and prevents duplicate-registration errors
- Peppol capability cache (6h TTL) exists because Storecove's SML lookup has rate limits and the same buyer will be invoiced many times
- EINV-07 compliance surfaced on the existing invoices list (not a separate page) matches where users already look; summary tile gives at-a-glance health, filter chips enable drill-down
- Lifecycle event log is append-only for audit defensibility; the parent lifecycle row is mutable because it tracks CURRENT state (mirrors Phase 60's dual-tier pattern)
- XML + full KoSIT HTML report both persisted in R2 at content-addressed keys: auditable, deduplicatable, deletable by retention policy later

</specifics>

<deferred>
## Deferred Ideas

- **ZUGFeRD PDF/A-3 with embedded CII** — Phase 62 (explicit)
- **Inbound XRechnung / ZUGFeRD invoice parsing** — Phase 62
- **UBL-XRechnung variant** (XRechnung also has a UBL flavour, less common than CII) — out of scope; CII covers both the German B2G and UK B2G routes
- **French Factur-X / Italian FatturaPA** other country profiles — future phases when customers need them
- **Automatic Peppol participant DIRECTORY registration** (beyond Storecove SMP) — Storecove handles SMP registration on participant setup; Peppol Directory (human-searchable) listing is a separate flag not included in v5.0
- **Bulk invoice export to XRechnung ZIP** — out of scope; users generate per-invoice in v5.0
- **Embedded line-attachment PDFs** (supporting timesheets, breakdowns) in CII AdditionalReferencedDocument — future phase
- **Digital signature on XRechnung XML** — German XRechnung does NOT require signature (EN 16931 removed it); skip
- **Mustangproject JVM integration** — rejected in favour of pure-JS saxon-js; revisit only if saxon-js can't handle specific KoSIT quirks
- **Custom XRechnung profile for non-B2G private-sector German invoicing** — v5.0 XRechnung is for B2G; private-sector DE invoicing continues on existing Invoice PDF path until market demand justifies it
- **Per-invoice XML manual edit UI** — out of scope; XML is generated from Invoice data, not hand-edited
- **Validation against "XRechnung 2.x" historical versions** — pinned to 3.0.2; older versions deferred
- **Automated XRechnung-version upgrade migration** when KoSIT ships a new release — future phase; v5.0 pins one version
- **Integration with Leitweg-ID government public directory** (auto-suggest / lookup as user types) — future phase; v5.0 has free-form entry with validation

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 61` returned 0 matches, so no todos were reviewed.

</deferred>

---

*Phase: 61-xrechnung-e-invoicing*
*Context gathered: 2026-04-14*
