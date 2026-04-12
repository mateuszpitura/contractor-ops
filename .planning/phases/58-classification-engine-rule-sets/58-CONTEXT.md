# Phase 58: Classification Engine & Rule Sets - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a pluggable contractor-classification engine in a new `packages/classification` workspace (mirroring `packages/einvoice`) with two country rule sets: UK IR35 (5 CEST-aligned areas → inside/outside/undetermined verdict) and German Scheinselbständigkeit (~20 DRV criteria across 4 categories → green/amber/red traffic-light). Assessments are stored per-engagement (ContractorAssignment) with immutable snapshots for audit defensibility. Scope anchor: the engine + two rule sets + assessment capture/draft lifecycle + outcome rendering + mandatory disclaimer gate. Document generation (SDS PDF, DRV audit defense bundle) is Phase 59; proactive alerts and reassessment triggers are Phase 60.

</domain>

<decisions>
## Implementation Decisions

### Engine Architecture
- **D-01:** New workspace `packages/classification` with abstract `ClassificationProfile` base class. Subclasses `IR35Profile` and `ScheinselbstandigkeitProfile` extend it. Profile registry lookup by `contractor.countryCode` (GB → IR35, DE → Scheinselbständigkeit). Mirrors `packages/einvoice` profile-per-country + `packages/gov-api` abstract client pattern.
- **D-02:** Abstract base exposes: `buildAssessment(engagementId): AssessmentShell`, `scoreAssessment(answers): Outcome`, `renderOutcome(assessment): OutcomeView`. Per-country subclasses override all three. Registry method: `getProfileForCountry(countryCode)`.
- **D-03:** Outcome envelope: `Assessment { id, organizationId, contractorAssignmentId, countryCode, ruleSetVersion, status, questionsSnapshot, answers, outcome, completedAt, disclaimerAcknowledgedAt, immutableAfter }`. `outcome` is a TypeScript discriminated union on `countryCode`:
  - `Ir35Outcome = { kind: 'IR35', verdict: 'inside'|'outside'|'undetermined', areaResults: Ir35AreaResult[], reasoning }`
  - `ScheinselbstandigkeitOutcome = { kind: 'SCHEINSELBSTANDIGKEIT', riskLevel: 'green'|'amber'|'red', totalScore: number, categoryBreakdown: ScheinCategoryResult[] }`

### Storage Model
- **D-04:** New Prisma model `ClassificationAssessment` linked to `ContractorAssignment` (engagement anchor). Multi-tenant scoped by `organizationId`. One draft per engagement at a time; completed assessments are append-only (each re-run creates a new row). Schema: `id`, `organizationId`, `contractorAssignmentId` (FK), `countryCode`, `ruleSetVersion`, `status` (`'draft'|'completed'`), `questionsSnapshot` JSONB, `answers` JSONB, `outcome` JSONB (nullable while draft), `completedAt`, `disclaimerAcknowledgedAt`, `immutableAfter`, `createdAt`, `updatedAt`.
- **D-05:** Contractor profile links to the engagement's latest completed assessment for display (Phase 56 CountryComplianceSection gains a "Classification" tile per engagement).

### Rule-Set Representation
- **D-06:** IR35 and DRV criteria live as typed `as const` TypeScript constants in `packages/classification/src/rule-sets/{ir35.ts,scheinselbstandigkeit.ts}`. Each question: `{ id, area/category, prompt: { en, pl, de }, helpText: { en, pl, de }, caseLawCitation (IR35) OR drvReference (DE), answerType, weight, required }`. Compile-time type safety; PR-reviewed changes; easy git history.
- **D-07:** Question prompt text lives inline in the TS constant. Mandatory German legal phrases (e.g. "Scheinselbstandigkeit", "wesentliche Merkmale", "Statusfeststellungsverfahren") are imported verbatim from `packages/validators/src/legal/de.ts` — extend Phase 56's locked-phrase set with `CLASSIFICATION_SCHEIN_*` constants. CI guard (Phase 56 locked-phrases-guard.test.ts) extended to assert these constants render verbatim in the assessment wizard UI.
- **D-08:** Rule-set versioning via `RULE_SET_VERSION` constant per rule set (e.g. `'IR35-2024-CEST'`, `'SCHEINSELBSTANDIGKEIT-DRV-2024'`). On assessment completion, the full `questionsSnapshot` (prompts + weights) is persisted to the `ClassificationAssessment` row so old assessments render correctly after future rule-set updates. Required for audit defensibility.

### Assessment Workflow & UX
- **D-09:** Multi-step wizard by area/category: IR35 has 5 steps (substitution → control → financial risk → part-and-parcel → MOO); Scheinselbständigkeit has 4 steps (integration → entrepreneurial independence → personal dependency → economic dependency). Progress bar + step-label breadcrumb. Outcome computed only after final 'Submit'.
- **D-10:** Draft autosave on every answer change — the `ClassificationAssessment` row with `status='draft'` is updated server-side so users can resume on any device. On 'Submit': status → `'completed'`, `immutableAfter` timestamp set (prevents edits), outcome computed and stored. Starting a new assessment on the same engagement creates a new row (append-only history).
- **D-11:** Optional questions allowed; IR35 short-circuits to 'undetermined' verdict when critical areas have insufficient signal (mirrors HMRC CEST). DRV criteria are all required, but 'Nicht anwendbar / Not applicable' is a valid answer scoring 0.
- **D-12:** **Blocking disclaimer modal** shown after Submit, before outcome renders. Modal text imported from `packages/validators/src/legal/disclaimers.ts` (new module). IR35 disclaimer: "This tool does not constitute legal advice; HMRC Status Determination Statement is your responsibility." DE: "Dieses Ergebnis ersetzt keine rechtsverbindliche Statusfeststellung (§ 7a SGB IV)." User must tick 'I understand' to view outcome; `disclaimerAcknowledgedAt` is stored. Legal-liability protection.

### Scoring & Outcome Thresholds
- **D-13:** IR35 composite-rule scoring (not weighted sum):
  - Each of the 5 areas yields a verdict: `'strong-outside' | 'leaning-outside' | 'neutral' | 'leaning-inside' | 'strong-inside'`.
  - **Dispositive rules (trump composite):** any `'strong-inside'` on Substitution OR Mutuality of Obligation → `inside`. Any `'strong-outside'` on Substitution → `outside`.
  - Otherwise count leaning signals across remaining areas: ≥3 leaning-inside → `inside`, ≥3 leaning-outside → `outside`, anything else or ≥2 neutral critical areas → `undetermined`.
  - Mirrors HMRC CEST logic.
- **D-14:** DRV Scheinselbständigkeit scoring — weighted sum with traffic-light thresholds:
  - Each criterion scored `0|1|2|3` (not indicative / weak / moderate / strong indicator of Scheinselbständigkeit).
  - Category weights: **integration 30%, entrepreneurial independence 30%, personal dependency 25%, economic dependency 15%** (DRV-guidance-aligned).
  - Total weighted score 0-100. Thresholds: **<30 green** (low risk), **30-60 amber** (moderate risk), **>60 red** (high risk).
  - Per-category breakdown shows category-average vs category-max.
- **D-15:** Economic-dependency capture in Phase 58: one DRV criterion asks "What % of contractor's billing comes from your org?" stored as 0-100 input on the assessment. Feeds into economic-dependency category score. Phase 60 will add the 70% warning / 83.3% critical auto-alert; Phase 58 only captures the value.
- **D-16:** Outcome-page visualizations:
  - **IR35:** verdict banner (large pill: green "Outside IR35" / red "Inside IR35" / amber "Undetermined") + 5 area cards showing each area's verdict pill and the 2-3 driving questions.
  - **DRV:** traffic-light banner (green/amber/red) + 4 horizontal category bars filled to category score (weighted) + total score vs threshold markers. Each category expandable to show criterion breakdown.

### Claude's Discretion
- Exact IR35 question inventory and CEST-aligned wording (use official CEST reference)
- Exact DRV criterion inventory (DRV Rundschreiben RS 2022/1 guidance)
- Weight tuning within DRV categories (criteria inside a category)
- Answer-type enum (Yes/No vs Likert scale vs multi-select) per question
- Exact disclaimer wording beyond minimum legal phrasing (with Steuerberater review)
- Progress-bar visual styling (matches UI-SPEC from Phase 56)
- Whether to render the outcome page as server-rendered (SSR) or client (CSR) — probably SSR for SEO-less admin
- Assessment list page layout (contractor profile tile style vs table)
- Export-to-PDF of outcome (basic; Phase 59 handles the full SDS / DRV defense bundle)

### Folded Todos
No todos folded — no pending backlog items matched Phase 58 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — CLASS-01 (generic engine), CLASS-02 (IR35), CLASS-05 (Scheinselbständigkeit), CLASS-11 (per-engagement storage)
- `.planning/ROADMAP.md` §Phase 58 — Goal, 4 success criteria
- `.planning/STATE.md` — "Classification engine as new `packages/classification` with pluggable country rule sets (mirrors einvoice pattern)" + "Classification stored per-engagement, not per-contractor"

### Prior phase context (foundations this phase extends)
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — D-05 locked-phrases module, D-06 CI guard, D-14 CountryComplianceSection pattern for per-engagement display surfaces
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — isKleinunternehmer org flag (may interact with Scheinselbständigkeit economic-dependency scoring)

### Existing infrastructure
- `packages/einvoice/src/profiles/` — profile-per-country pattern to mirror (`ksef`, `zatca`, `peppol-ae`)
- `packages/einvoice/src/index.ts` — registry + profile interface
- `packages/db/prisma/schema/contractor.prisma` — `ContractorAssignment` (engagement anchor) + `Contractor` (profile)
- `packages/validators/src/legal/de.ts` — extend with `CLASSIFICATION_SCHEIN_*` locked phrases
- `packages/validators/src/legal/en.ts` (new in Phase 57) — add IR35 mandatory disclaimer phrase if any
- `packages/validators/src/legal/disclaimers.ts` (new) — IR35 + DRV mandatory disclaimers, locked constants with CI guard coverage
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — extend reserved-key list with `CLASSIFICATION_*` and `DISCLAIMER_*` patterns
- `apps/web/messages/{en,pl,de,ar}.json` — `Classification` namespace for wizard UI (prompts stay in rule-set constants; only chrome like "Next", "Previous", step labels live in messages)
- `apps/web/src/components/contractors/compliance/` — Phase 56 CountryComplianceSection; extend per-engagement with Classification tile

### External regulatory references
- HMRC CEST (Check Employment Status for Tax) — https://www.gov.uk/guidance/check-employment-status-for-tax
- HMRC IR35 legislation (ITEPA 2003 Chapter 10) + Off-payroll working rules (Chapter 8)
- Supreme Court HMRC v Atholl House Productions [2022] UKSC (IR35 three-stage test)
- Ready Mixed Concrete v MPNI [1968] (IR35 foundational test)
- Deutsche Rentenversicherung Statusfeststellungsverfahren (§ 7a SGB IV)
- DRV Rundschreiben RS 2022/1 — Scheinselbständigkeit assessment guidance
- BSG Scheinselbständigkeit case law — integration + economic-dependency test

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/einvoice` profile-per-country architecture — exact pattern to replicate for classification
- `packages/gov-api/GovApiClient` abstract base (Phase 54) — reference for abstract-base-plus-subclasses pattern
- `ContractorAssignment` Prisma model — per-engagement anchor already exists
- `packages/validators/src/legal/de.ts` locked-phrases module (Phase 56 D-05) — extend with classification-specific constants
- Phase 56 locked-phrases CI guard (locked-phrases-guard.test.ts) — pattern to extend
- Phase 56 CountryComplianceSection dispatcher — extend to render per-engagement classification tile
- shadcn Wizard/Stepper pattern (to be built or chosen) — Dialog + Progress + step indicator
- React Hook Form + Zod — already used for Phase 56 profile forms; reuse for wizard

### Established Patterns
- Profile registry per country (einvoice, gov-api)
- Discriminated unions on countryCode for per-country payload shapes
- Append-only tables for compliance-sensitive data (ConsentRecord Phase 51, TaxIdValidation Phase 57)
- Immutable snapshot via JSONB for audit defensibility
- Locked legal phrase constants + CI guard (Phase 56)
- Zod schemas at tRPC + RHF boundary (repo-wide)
- Multi-tenant `organizationId` scoping via Prisma client extension

### Integration Points
- Contractor profile (Phase 56 CountryComplianceSection) — add per-engagement Classification tile showing latest verdict + re-run CTA
- Engagement/ContractorAssignment page — "Run classification assessment" primary CTA
- tRPC router: new `classification` router with mutations `createDraft`, `saveAnswer`, `submit`, `acknowledgeDisclaimer`, and queries `getLatest(engagementId)`, `listByContractor`
- Organization settings — no new settings required; assessment is per-engagement
- Phase 59 (SDS PDF, DRV audit defense bundle) consumes `Assessment.outcome` + `questionsSnapshot`
- Phase 60 (economic dependency alerts) reads `Assessment.outcome.categoryBreakdown` for DRV economic-dependency ratio
- Locked-phrase CI guard — extend reserved-key list with classification/disclaimer patterns

</code_context>

<specifics>
## Specific Ideas

- Substitution and MOO as dispositive areas in IR35 reflects Supreme Court Atholl House precedence — this is legally load-bearing; the composite rule cannot be replaced with naive scoring
- DRV 4-category weighting (30/30/25/15) aligns with DRV Rundschreiben guidance; reviewed by Steuerberater in the Phase 56 review cycle
- "Nicht anwendbar" answer scoring 0 is important for DRV: criteria about a specific working arrangement may not apply
- Assessment outcome page needs per-area/per-category expandable cards so the user can trace exactly why a given verdict was produced (required for defense during HMRC/DRV audit)
- Client-billing ratio as a DRV criterion in Phase 58 captures the data point; Phase 60 owns the alert thresholds and background monitoring

</specifics>

<deferred>
## Deferred Ideas

- SDS (Status Determination Statement) PDF generation — Phase 59
- IR35 chain participant tracking (client/agency/PSC/worker) — Phase 59
- DRV audit defense documentation bundle — Phase 59
- Economic-dependency alert thresholds (70% warning, 83.33% critical) — Phase 60
- Reassessment trigger on engagement material change (contract amendment, rate change, scope change) — Phase 60
- Statusfeststellungsverfahren (DRV clearance procedure) tracking with filing date, reference, outcome, expiry reminders — Phase 60
- Compliance health dashboard across all engagements — Phase 60
- Export-to-PDF of raw outcome page — basic may land in Phase 58; full regulatory-grade PDF is Phase 59
- ML/fuzzy scoring model — requires training data and legal review; out of scope for v5.0
- Rule-set versioning UI to switch between historic and current rule sets — future phase if customer demand
- Bulk assessment runner (apply same assessment to many engagements) — future phase
- Third country rule sets beyond UK/DE — out of scope for v5.0

### Reviewed Todos (not folded)
None — no pending todos matched Phase 58 scope.

</deferred>

---

*Phase: 58-classification-engine-rule-sets*
*Context gathered: 2026-04-12*
