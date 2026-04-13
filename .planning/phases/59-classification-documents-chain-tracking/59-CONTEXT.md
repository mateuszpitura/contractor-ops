# Phase 59: Classification Documents & Chain Tracking - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate the legally required classification documents from completed Phase 58 assessments and record IR35 chain-participant evidence per engagement. Scope anchor: (a) SDS PDF for UK/IR35 engagements (CLASS-03), (b) IR35 chain participant data model + per-participant SDS delivery tracking (CLASS-04), (c) DRV audit defense PDF bundle for German engagements (CLASS-06). Consumes `ClassificationAssessment` rows from Phase 58 read-only — no changes to the engine or rule sets. Proactive alerts, reassessment triggers, Statusfeststellungsverfahren tracking, and the compliance health dashboard are Phase 60 and remain explicitly out of scope.

</domain>

<decisions>
## Implementation Decisions

### SDS PDF Structure & Layout (CLASS-03)
- **D-01:** SDS document structure is **verdict-first, evidence-trailing**: Page 1 = verdict banner + 1-paragraph summary + engagement details block. Pages 2+ = per-area breakdown (substitution, control, financial risk, part-and-parcel, MOO) with driving answers and CEST-aligned case-law citations. Final page = dispute process block + disclaimer. Mirrors how HMRC reviewers scan SDS (verdict first, evidence on challenge).
- **D-02:** Visualisation = **pills + minimal typography** matching Phase 56 privacy-notice styling (Helvetica, A4, ~56pt padding, teal accent `#0d7f72`, grey body `#1f2937`). Each area gets a coloured verdict pill: green `Outside IR35` / red `Inside IR35` / amber `Undetermined`. No scorecard tables; reasoning is plain text under the pill heading. Prints legibly in B&W.
- **D-03:** Dispute-process content is boilerplate drawn from a new `IR35_DISPUTE_PROCESS_EN` locked-phrase constant in `packages/validators/src/legal/en.ts`, protected by the Phase 58 locked-phrases CI guard (extend `locked-phrases-guard.test.ts` reserved-key list with `IR35_DISPUTE_*` and `SDS_*` patterns). Universal text per HMRC off-payroll rules — 45-day challenge window, client review obligation, client response timeframe. No per-organization customization in v5.0.
- **D-04:** Existing Phase 56 React-PDF infrastructure is the rendering foundation. New template file `packages/api/src/pdf-templates/ir35-sds.tsx` mirrors the `gdpr-privacy-notice.tsx` structure (StyleSheet, Document/Page components, same colour tokens). Consumes `ClassificationAssessment` + embedded `questionsSnapshot` from Phase 58 D-03 outcome envelope — no joins against current rule-set code (frozen to `ruleSetVersion`).

### Document Persistence & Lifecycle
- **D-05:** Generated documents (SDS, DRV bundle) are **persisted as immutable artifacts**. On first `generate` mutation: render PDF via `@react-pdf/renderer` `renderToBuffer`, compute SHA-256 hash of the bytes, upload to R2 at a content-addressed key, then insert a `ClassificationDocument` row. Subsequent downloads re-sign the same R2 object — bytes never change. Required for HMRC/DRV audit defensibility where the evidence is the exact PDF that was issued.
- **D-06:** New Prisma model `ClassificationDocument`:
  - Fields: `id`, `organizationId`, `classificationAssessmentId` (FK), `kind` enum (`'SDS' | 'DRV_DEFENSE_BUNDLE'`), `pdfKey` (R2 object key), `sha256Hash`, `byteSize`, `generatedAt`, `generatedByUserId`, `rendererVersion` (string — the `@react-pdf/renderer` + template version at render time), `ruleSetVersion` (copied from assessment at render time for defence-in-depth), `createdAt`, `updatedAt`.
  - Multi-tenant scoped by `organizationId` via the existing Prisma client extension. Append-only — no `UPDATE` allowed after initial insert (enforced by Prisma middleware or a trigger; simplest is Prisma client extension guard).
  - Indexed on `(organizationId, classificationAssessmentId, kind)` and `(organizationId, generatedAt)`.
- **D-07:** R2 object key convention: `classification-documents/{organizationId}/{classificationAssessmentId}/{kind-lowercase-with-dashes}-{ruleSetVersion}-{sha256[0:16]}.pdf`. Content-addressed (hash in the key) so identical renders can be deduplicated in future if ever needed; organization-scoped to prevent cross-tenant access; matches the Phase 56 R2 layout conventions.
- **D-08:** Signed download URL TTL = **300 seconds** (matches Phase 56 `generatePrivacyNoticePdf` pattern via `PDF_TTL_SECONDS` in `packages/api/src/routers/legal.tsx`). Reuse `putObjectAndSignDownload` from `packages/api/src/services/r2.ts` for the upload + initial signed URL; add a second helper `signExistingDownload(key, ttlSeconds)` for re-signing on subsequent downloads without re-uploading.
- **D-09:** **No auto-regeneration.** `ruleSetVersion` changes in Phase 58's classification rule sets do not retroactively re-render existing documents. Each `ClassificationDocument` row is frozen to the rule-set version that was active when the parent `ClassificationAssessment` was completed — originating bytes are what's auditable. A fresh document requires a fresh assessment (Phase 58 D-08 append-only model). No manual "regenerate" button in v5.0.

### IR35 Chain Participants Data Model (CLASS-04)
- **D-10:** New Prisma model `Ir35ChainParticipant`:
  - Fields: `id`, `organizationId`, `contractorAssignmentId` (FK — engagement anchor), `role` enum (`'CLIENT' | 'AGENCY' | 'PSC' | 'WORKER'`), `orderIndex` (integer — chain position; supports multi-agency chains like `CLIENT(0) → AGENCY(1) → AGENCY(2) → PSC(3) → WORKER(4)`), `displayName`, `contactEmail` (nullable), `linkedOrganizationId` (nullable FK), `linkedContractorId` (nullable FK), `sdsDeliveredAt` (nullable), `sdsDeliveredNote` (nullable — user-entered context e.g. "emailed to procurement"), `sdsAcknowledgedAt` (nullable), `sdsAcknowledgedNote` (nullable), `createdAt`, `updatedAt`.
  - Indexed on `(organizationId, contractorAssignmentId, orderIndex)` and `(organizationId, linkedOrganizationId)`.
  - Multi-tenant scoped via the Prisma client extension.
- **D-11:** Participant identity is **hybrid (linked-when-available, free-text fallback)**:
  - `CLIENT` role is auto-populated from the current tenant (`linkedOrganizationId = ctx.organizationId`, `displayName = organization.name`) — the user's org is always the client on an IR35 engagement stored in their tenant.
  - `WORKER` role links to a `Contractor` via `linkedContractorId` when the assignment has one; displayName defaults to the contractor's name.
  - `AGENCY` and `PSC` roles are free-text `displayName + contactEmail` because external agencies and the contractor's PSC are rarely other tenants. Future phases can backfill linked entities without schema changes.
- **D-12:** **Explicit per-link mark-delivered action.** Document generation only sets `ClassificationDocument.generatedAt`; it does NOT automatically set `sdsDeliveredAt` on chain rows. Delivery is recorded via an explicit mutation per participant row — the engagement UI has a chain panel where each participant has "Mark as delivered" and "Mark as acknowledged" actions with an optional note field. Two separate timestamps (`sdsDeliveredAt`, `sdsAcknowledgedAt`) capture outbound vs confirmed receipt — HMRC audit defense can distinguish "we sent it" from "they acknowledged it".
- **D-13:** No automated email in Phase 59 — delivery is manual action only. An email-out flow can land in Phase 60 or later but is explicitly deferred (signed-URL TTL of 300s would need rethinking for external recipients anyway).

### DRV Audit Defense Bundle (CLASS-06)
- **D-14:** DRV bundle is a **single consolidated PDF**, not a ZIP. Document structure: cover page (org + contractor + engagement header) → table of contents → 4 sections, each as one or more React-PDF `<Page>` components with shared header/footer:
  1. Engagement structure summary (client / contractor / PSC / start date / rate / project scope)
  2. Independence indicators (derived from the completed Scheinselbständigkeit assessment's 4 DRV categories with pill verdicts per category — entrepreneurial independence, integration, personal dependency, economic dependency)
  3. Risk assessment history (all prior `ClassificationAssessment` rows for this engagement — `countryCode='DE'`, in chronological order)
  4. Other-client attestation (contractor's signed statement + platform-derived cross-reference table)

  No new ZIP library dependency. `@react-pdf/renderer` handles multi-page multi-section output; German auditors prefer a single unified exhibit.
- **D-15:** Independence indicators section pulls directly from the latest completed DE-country `ClassificationAssessment.outcome.categoryBreakdown` (Phase 58 D-14 structure: 4 categories with weighted scores). Each category renders as a pill (green/amber/red matching traffic-light thresholds) + the driving DRV criteria answers from `questionsSnapshot`. Reuses Phase 58 rule-set constants, imported read-only.
- **D-16:** **Risk-assessment-history section is full-depth.** For each prior `ClassificationAssessment` on the same `contractorAssignmentId` with `countryCode='DE'` and `status='completed'`, render traffic-light verdict + total weighted score + per-category breakdown + `completedAt` + `ruleSetVersion` + score delta vs previous (`Δ +12 amber → red` style). DRV reviewers look favourably on demonstrable reassessment discipline, so depth here is worth the bytes.
- **D-17:** **Other-client attestation combines contractor statement + platform data**:
  - A contractor-editable text field captures free-form attestation ("I currently provide services to clients X, Y, Z in addition to {current org}"). Stored on a new `Ir35OtherClientAttestation` row (or similar DRV-specific name) keyed to the engagement — since this is DRV-specific evidence it belongs in its own table, not the existing Ir35ChainParticipant model.
  - An auto-generated supporting table appends any `ContractorAssignment` rows on the platform sharing the same `contractorId` with other organizations (cross-tenant read is NOT allowed — only shows rows the tenant itself has created for this contractor e.g. multiple engagements within the same org, or historical assignments). A footer explicitly states that platform data is not exhaustive.
  - The attestation statement is printed verbatim below the platform table with a dated signature line (typed by contractor, not digital signature — v5.0 defers e-signing to a future phase).
- **D-18:** German-language DRV bundle content is sourced from: (a) locked Scheinselbständigkeit phrases from Phase 58 D-07 `CLASSIFICATION_SCHEIN_*` constants, (b) a new `DRV_DEFENSE_*` locked-phrase set in `packages/validators/src/legal/de.ts` (cover-page legal header, section titles, risk-assessment-history table headers, other-client attestation header) with CI-guard coverage. Chrome strings like page numbers and "Continued overleaf" use the existing `Classification` namespace in `apps/web/messages/de.json` (UI chrome pattern from Phase 58).

### Claude's Discretion
- Exact React-PDF `<StyleSheet>` numeric values (padding, fontSize, line-height) — match Phase 56 privacy-notice template as baseline, tune per template during implementation
- Whether to paginate the per-area evidence in SDS on page 2 or split when content exceeds a page
- Exact wording of `IR35_DISPUTE_PROCESS_EN`, `SDS_DISCLAIMER_*`, and `DRV_DEFENSE_*` locked constants — follow HMRC/DRV phrasing but final strings decided in plan execution (may need UK tax-adviser / Steuerberater review checkpoint similar to Phase 58 Plan 58-05)
- DB migration strategy for the 2 new Prisma models — single migration vs one per model (probably single; straightforward additive change)
- Whether to store `rendererVersion` as a plain string or as semver — string is simpler, use that unless a comparator is needed
- Exact tRPC router layout: new `classification-document` + `ir35-chain` routers vs extension of the Phase 58 `classification` router (likely two new routers but tunable)
- UI chrome (modal vs dialog vs sheet for the chain-participant editor; badge style for delivery state) — defer to frontend-design plugin during planning

### Folded Todos
No todos folded — `gsd-tools todo match-phase 59` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` lines 23, 24, 26 — CLASS-03 (SDS PDF), CLASS-04 (IR35 chain + delivery), CLASS-06 (DRV audit defense bundle)
- `.planning/ROADMAP.md` §Phase 59 — Goal, 3 success criteria, `Depends on Phase 58`

### Prior phase context (foundations this phase extends)
- `.planning/phases/58-classification-engine-rule-sets/58-CONTEXT.md` — D-03 assessment outcome envelope, D-04 `ClassificationAssessment` model, D-06 rule-set constants, D-07 locked-phrases module, D-08 append-only + `ruleSetVersion` pattern, D-14 category weighting + thresholds, D-16 outcome visualisations (SDS/DRV reuse these)
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — VAT validation pattern and `isKleinunternehmer` org flag context
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — D-07 (locked phrases + CI guard), Plan 07 (React-PDF template + R2 signed-URL flow) — the reference implementation this phase mirrors

### Existing code (reusable infrastructure)
- `packages/api/src/pdf-templates/gdpr-privacy-notice.tsx` — React-PDF template structure to mirror for SDS + DRV bundle (StyleSheet tokens, colour palette, page layout)
- `packages/api/src/routers/legal.tsx` — `generatePrivacyNoticePdf` as the model for `renderToBuffer` → `putObjectAndSignDownload` → signed-URL response
- `packages/api/src/services/r2.ts` — `putObjectAndSignDownload` helper; extend with `signExistingDownload` for re-download flows
- `packages/db/prisma/schema/contractor.prisma` — `ContractorAssignment` engagement anchor; new `Ir35ChainParticipant` model joins here
- `packages/db/prisma/schema/classification.prisma` (Phase 58 Plan 58-01) — new `ClassificationDocument` and `Ir35ChainParticipant` models belong here or in a new `classification-document.prisma`
- `packages/validators/src/legal/en.ts` (Phase 57) — extend with `IR35_DISPUTE_PROCESS_EN`, `SDS_DISCLAIMER_EN`
- `packages/validators/src/legal/de.ts` (Phase 56, extended in Phase 58) — extend with `DRV_DEFENSE_*` constants
- `packages/validators/src/legal/disclaimers.ts` (Phase 58) — add `SDS_DISCLAIMER_EN`, `DRV_DEFENSE_DISCLAIMER_DE`
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — extend reserved-key list with `IR35_DISPUTE_*`, `SDS_*`, `DRV_DEFENSE_*`
- `apps/web/messages/{en,de}.json` — `Classification` namespace (chrome strings only; SDS/DRV body text lives in locked constants)
- `apps/web/src/components/contractors/compliance/` — Phase 56 `CountryComplianceSection` dispatcher; extend per-engagement with a "Generate SDS" / "Generate DRV bundle" CTA + chain participant panel
- Multi-tenant Prisma client extension (`packages/db/src/tenant-scoped-client.ts` or equivalent) — all new models use it for `organizationId` scoping

### External regulatory references (normative text sources)
- HMRC Check Employment Status for Tax (CEST) — https://www.gov.uk/guidance/check-employment-status-for-tax
- HMRC off-payroll working rules (ITEPA 2003 Chapter 10, Chapter 8) — SDS content requirements, 45-day dispute window
- ESM10001 onwards (HMRC Employment Status Manual) — SDS and status determination guidance
- Deutsche Rentenversicherung Statusfeststellungsverfahren (§ 7a SGB IV) — DRV clearance procedure context for the defense bundle
- DRV Rundschreiben RS 2022/1 — Scheinselbständigkeit assessment guidance (source of the 4-category structure)
- BSG Scheinselbständigkeit case law — evidence of the integration + economic-dependency test reflected in the independence-indicators section

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **React-PDF template pattern** (`packages/api/src/pdf-templates/gdpr-privacy-notice.tsx`): Document + Page + StyleSheet setup, colour tokens (`TEAL_ACCENT #0d7f72`, `GREY_BODY #1f2937`, `GREY_MUTED #6b7280`, `GREY_RULE #d1d5db`), A4 sizing, Helvetica font, grayscale with single teal accent — clone for `ir35-sds.tsx` and `drv-defense-bundle.tsx`
- **tRPC PDF mutation pattern** (`packages/api/src/routers/legal.tsx`): `tenantProcedure` → resolve org context → `renderToBuffer` → `putObjectAndSignDownload` → return `{ url, expiresInSeconds }`. Extend for `generateSds` + `generateDrvDefenseBundle` mutations
- **R2 storage + signed URL** (`packages/api/src/services/r2.ts`): `putObjectAndSignDownload` handles upload + URL signing. Need to add `signExistingDownload(key, ttlSeconds)` for re-download flow (D-05 persists once, re-signs on subsequent requests)
- **Phase 58 `ClassificationAssessment` outcome envelope**: `outcome.kind === 'IR35'` carries verdict + areaResults + reasoning; `outcome.kind === 'SCHEINSELBSTANDIGKEIT'` carries riskLevel + totalScore + categoryBreakdown. Both contain the data SDS and DRV bundle need — no extra queries required beyond loading the row
- **Phase 58 `questionsSnapshot` JSONB**: frozen copy of rule-set questions at assessment completion. SDS + DRV bundle render from this snapshot directly — rule-set code changes don't affect generated documents
- **Phase 58 locked-phrases CI guard** (`packages/validators/src/__tests__/locked-phrases-guard.test.ts`): extend reserved-key list to include `IR35_DISPUTE_*`, `SDS_DISCLAIMER_*`, `DRV_DEFENSE_*`
- **Multi-tenant Prisma client extension**: all new models (`ClassificationDocument`, `Ir35ChainParticipant`, `Ir35OtherClientAttestation`) automatically organization-scoped

### Established Patterns
- **Profile-per-country** (einvoice, gov-api, classification) — document generators live alongside the domain package: put SDS template in `packages/api/src/pdf-templates/` (not in `packages/classification`) since PDF rendering is a web-app concern, but import rule-set constants from `packages/classification` read-only
- **Append-only compliance tables** (ConsentRecord Phase 51, TaxIdValidation Phase 57, ClassificationAssessment Phase 58, new ClassificationDocument Phase 59) — no updates after insert, audit history is row history
- **Immutable JSONB snapshots** (ConsentRecord content, ClassificationAssessment.questionsSnapshot) — SDS doesn't need its own snapshot because the assessment row is already frozen; `ClassificationDocument` only stores bytes + hash, not the semantic content
- **Locked legal phrase constants + CI guard** (Phase 56, 58) — ALL SDS/DRV legal-text phrases go through this pattern
- **Zod at tRPC boundary** — new inputs (`generateSdsInput`, `markChainDeliveredInput`, `generateDrvBundleInput`, `upsertChainParticipantInput`) are Zod schemas in the router module
- **Signed URL TTL 300s** — Phase 56 pattern; matched in D-08

### Integration Points
- **Engagement (ContractorAssignment) detail page** — new "Classification Documents" section with "Generate SDS" / "Generate DRV defense bundle" CTAs (gated by assessment completion + country), plus an IR35 chain-participants panel when `countryCode='GB'`
- **Contractor profile → `CountryComplianceSection`** (Phase 56 D-14) — extend per-engagement tile to show latest SDS status (generated / delivered to N of M participants) when applicable
- **tRPC**:
  - `classificationDocument.generateSds({ classificationAssessmentId })` — mutation returning `{ url, expiresInSeconds }`
  - `classificationDocument.generateDrvDefenseBundle({ classificationAssessmentId, attestationText })` — mutation
  - `classificationDocument.getDownloadUrl({ classificationDocumentId })` — query re-signing existing R2 object
  - `ir35Chain.listByEngagement({ contractorAssignmentId })`, `upsertParticipant`, `reorderParticipants`, `markDelivered`, `markAcknowledged`
- **Phase 60 consumers**: `ClassificationDocument` rows feed into the compliance dashboard (document coverage per engagement) and reassessment-trigger flows (comparing old vs new SDS). No Phase 60 work here, just design the shape so Phase 60 can read without schema churn
- **Multi-tenant enforcement** — every new mutation uses `tenantProcedure`; `organizationId` is never user-supplied

</code_context>

<specifics>
## Specific Ideas

- SDS "verdict-first, evidence-trailing" layout is load-bearing because HMRC audit reviewers typically scan the verdict first and dig into area reasoning only when challenged — putting evidence before verdict increases reviewer load
- Pills + Helvetica + teal accent intentionally matches the Phase 56 privacy-notice design so classification documents feel like the same product family
- Signed URL TTL of 300s stays consistent with Phase 56; longer TTLs would need a separate justification and likely a separate download-link flow (e.g. emailed delivery to external parties, which is deferred)
- `sdsDeliveredAt` vs `sdsAcknowledgedAt` separation matters for HMRC audit: "we issued the SDS" and "the agency confirmed receipt" are different evidentiary claims
- Content-addressed R2 key (`sha256[0:16]` in the path) supports future de-duplication without changing any schemas; the database row holds the canonical hash for integrity checks
- Single consolidated PDF (not ZIP) for DRV bundle avoids adding a `yazl`/`archiver` dependency — React-PDF multi-page covers the need and German auditors prefer a single exhibit
- Risk-history section depth was chosen because DRV reviewers reward demonstrable reassessment discipline — the extra bytes are cheap and the evidentiary value is high
- Other-client attestation on its own table (not on `Ir35ChainParticipant`) because it's DRV-specific evidence with different semantics from IR35 chain participants; keeping them separate keeps both models coherent
- `rendererVersion` field on `ClassificationDocument` captures `@react-pdf/renderer` version + template hash — if anyone ever needs to prove "this is the binary that was rendered by this exact code", the field exists

</specifics>

<deferred>
## Deferred Ideas

- **Automated SDS email delivery to external chain participants** — deferred; current signed-URL TTL of 300s is insufficient for external recipients, and email pipeline hasn't been validated for external addresses. Likely Phase 60 or later
- **Digital signature on other-client attestation** — typed contractor name + date in v5.0; DocuSign/e-signing integration already exists in the repo but is scoped per-contract, not per-attestation. Future phase
- **Per-organization customizable dispute-process text in SDS** — boilerplate in v5.0; if customer feedback demands custom dispute workflows, a later phase can add a nullable `disputeProcessOverride` on Organization with locked-phrase floor
- **Manual "regenerate SDS from same assessment"** button — no UI in v5.0 (D-09); a fresh document requires a fresh assessment to keep the audit model clean
- **Chain-participant entity promotion** (upgrading AGENCY/PSC free-text rows to linked Organization/Contractor rows once we have a cross-tenant agency directory) — future phase, no schema block
- **DRV defense bundle in languages other than German** — single-locale (DE) in v5.0; UK SDS is English-only; no translation burden
- **SDS bulk generation** (e.g. "generate SDS for all engagements with completed IR35 assessments") — v5.0 is per-engagement only
- **SDS template A/B variations** (e.g. short-form for simple engagements vs long-form) — out of scope for v5.0
- **ZIP bundle format** for DRV audit evidence — explicitly rejected in D-14; if a future DRV update mandates multi-file exhibits, revisit

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 59` returned 0 matches, so no todos were reviewed.

</deferred>

---

*Phase: 59-classification-documents-chain-tracking*
*Context gathered: 2026-04-13*
