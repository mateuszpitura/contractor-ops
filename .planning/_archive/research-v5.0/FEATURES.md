# Feature Research: v5.0 UK & Germany Expansion

**Domain:** UK IR35 contractor classification, German Scheinselbständigkeit assessment, EN 16931 e-invoicing (XRechnung/ZUGFeRD), UK BACS payments, market-specific compliance features
**Researched:** 2026-04-12
**Confidence:** MEDIUM (based on established regulatory frameworks and domain expertise; web verification was unavailable -- key claims flagged for validation against HMRC, DRV, and EN 16931 official sources before implementation)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any UK/Germany contractor management platform must have. Missing these means the product cannot comply with local employment law or will be rejected by compliance-conscious buyers.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **IR35 Status Determination Engine** | UK off-payroll rules (Chapter 10 ITEPA 2003) require medium/large clients to determine worker status for EVERY contractor engagement. Failure to assess = automatic "inside IR35" treatment + employer NICs liability. Since April 2021 reform, the onus is on the client (not the contractor's PSC) | HIGH | Must model HMRC's CEST (Check Employment Status for Tax) tool logic. 5 assessment areas: personal service/substitution, control, financial risk, part-and-parcel, mutuality of obligation. Three outcomes: inside IR35, outside IR35, undetermined. Depends on: new classification engine (generic) |
| **Status Determination Statement (SDS) generation** | Legal requirement under IR35 reforms. Client MUST provide written SDS to the worker AND the next party in the chain BEFORE the engagement starts. Must include reasons for the determination. Worker has right to dispute | MEDIUM | PDF document containing: determination outcome, assessment date, engagement details, reasoning per assessment area, client details, dispute process description. Must be versioned (redetermination required on material change). Depends on: IR35 engine |
| **IR35 chain participant tracking** | The fee-payer (often agency, not client) is responsible for deducting tax if determination is "inside." Client must pass SDS down the chain. Platform must track who received what and when | MEDIUM | Model: Client -> Agency/Intermediary (0-n) -> Contractor's PSC -> Worker. Store chain for each engagement. Track SDS delivery timestamps. Relevant for the ~40% of UK contractors who work through agencies. Depends on: SDS generation |
| **Scheinselbständigkeit risk assessment** | German companies engaging contractors face penalties for disguised employment (Scheinselbständigkeit). The Deutsche Rentenversicherung (DRV) conducts status audits. Companies need ongoing risk monitoring, not just one-time assessment | HIGH | DRV uses ~20 criteria across 4 categories: integration into client operations, entrepreneurial independence, personal dependency, economic dependency. Must produce a weighted risk score. No binary pass/fail -- it is a holistic assessment. Depends on: new classification engine (generic) |
| **DRV audit defense documentation** | When DRV audits, companies must prove contractors are genuinely independent. Documentation must be prepared BEFORE audit, not after. Retroactive social security contributions for 4 years + penalties | MEDIUM | Generate: engagement structure summary, independence indicators checklist, risk assessment history with dates, contractor's other client attestation, proof of entrepreneurial risk-bearing. Must be exportable as PDF bundle. Depends on: Scheinselbständigkeit assessment |
| **Economic dependency monitoring (Germany)** | A contractor deriving >83.33% (5/6) of revenue from a single client is legally presumed economically dependent ("arbeitnehmeraehnliche Person") under Section 2 SGB VI. Triggers mandatory pension insurance | MEDIUM | Track billing distribution across clients per contractor. Alert at 70% threshold (warning), 83.33% threshold (critical). Requires contractor to self-report other client revenue OR provide attestation of revenue diversity. Depends on: contractor billing data already exists |
| **XRechnung e-invoicing profile** | Germany mandated XRechnung for B2G invoices since November 2020. B2B mandate via Growth Opportunities Act (Wachstumschancengesetz): mandatory receipt from January 2025, mandatory sending phased from January 2027. Tech companies with government contracts MUST use XRechnung | HIGH | EN 16931 compliant. Germany uses CII (Cross Industry Invoice) syntax by default, though UBL is also accepted. XRechnung adds German-specific CIUS rules on top of EN 16931 core. Leitweg-ID required for B2G. Must validate against KoSIT validator. Depends on: existing e-invoicing engine (new country profile) |
| **ZUGFeRD e-invoicing profile** | ZUGFeRD (now version 2.3.x) is the German hybrid format: machine-readable XML embedded in a human-readable PDF/A-3. More practical for B2B because recipients can read the PDF even without e-invoicing software. EN 16931 compliant at COMFORT+ profiles | HIGH | PDF/A-3 with embedded CII XML. Five profiles: MINIMUM, BASIC WL, BASIC, EN 16931 (COMFORT), EXTENDED. B2B typically uses EN 16931 profile (maps 1:1 to XRechnung). Requires PDF/A-3 generation library. Depends on: existing e-invoicing engine (new country profile) |
| **UK VAT rates and HMRC VAT validation** | UK VAT: standard 20%, reduced 5%, zero 0%. Must validate UK VAT numbers via HMRC API (not VIES -- UK left EU). Reverse charge for construction industry (CIS) | LOW | Add UK tax rates to existing TaxRate table. HMRC VAT number check API replaces VIES for UK. Format: GB + 9 digits or GB + 12 digits (branch). Depends on: existing VAT engine (add UK rates) |
| **German USt-IdNr validation via VIES** | German VAT identification numbers must be validated via EU VIES system. Format: DE + 9 digits. Required for reverse charge invoices within EU | LOW | Already have reverse charge detection. Add VIES API call for DE VAT numbers. Standard EU validation -- well-documented. Depends on: existing VAT engine |
| **UK contractor profile fields** | UK contractors need: UTR (Unique Taxpayer Reference, 10 digits), Companies House number (for limited companies), VAT registration number, IR35 status per engagement, SDS reference | LOW | Extend existing country-specific fields pattern from v4.0 (freelance permits, trade licenses). Add UK field set activated for UK orgs. Depends on: existing contractor profile extension |
| **German contractor profile fields** | German contractors need: Steuernummer (tax number, regional format), Handelsregister number (commercial register, e.g., HRB 12345 Amtsgericht Muenchen), USt-IdNr (VAT ID), Scheinselbständigkeit risk level, Sozialversicherungsnummer (social security, if status changes) | LOW | Same extension pattern. German field set activated for DE orgs. Depends on: existing contractor profile extension |
| **BACS Direct Credit payment export** | UK domestic payments use BACS Direct Credit. Standard 18 fixed-width file format. Used by all UK banks for batch contractor payments. Processing takes 3 working days (Day 1: input, Day 2: processing, Day 3: credit) | MEDIUM | Standard 18 format: fixed-width records (VOL1 header, HDR1/HDR2, UHL1, contra/destination records, EOF1/EOF2). Each payment record is 100 bytes. Requires BACS bureau membership or submission via bank's Bacstel-IP service. Depends on: existing payment export framework (add BACS as format) |
| **German i18n (third language)** | German market requires German UI. Third language after English and Polish. German has simpler plural rules than Arabic (only 2 forms: one/other, like English) but longer words that affect layout | MEDIUM | Add `de` locale to next-intl. German text averages 30% longer than English -- test for text overflow. Compound nouns (Vertragsverwaltung, Rechnungsgenehmigung) need adequate column widths. Depends on: existing i18n framework |

### Differentiators (Competitive Advantage)

Features that set Contractor Ops apart from Deel, Remote, and local UK/DE compliance tools. Not required for launch, but create moats.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Generic contractor classification risk engine** | A pluggable classification framework that supports IR35 (UK) and Scheinselbständigkeit (DE) as rule sets -- same pattern as the e-invoicing engine's country profiles. Future markets (France: Scheinselbstständigkeit/URSSAF, Netherlands: DBA) slot in as new rule sets without architectural changes | HIGH | Abstract: `ClassificationEngine` with `RuleSet` profiles. Each rule set defines: assessment criteria, scoring weights, outcome categories, document templates. IR35 and Scheinselbständigkeit are the first two profiles. This is the architectural investment for v5.0 (like e-invoicing engine was for v4.0) |
| **Automated IR35 reassessment triggers** | IR35 determination must be reassessed when the engagement materially changes (scope change, rate change, extension, etc.). Most platforms require manual reassessment. Auto-detecting triggers from contract amendments, rate changes, and extensions is a strong differentiator | MEDIUM | Monitor contract amendments, rate period changes, scope changes, and extensions. Flag for reassessment when material changes detected. Link to previous SDS for comparison. Most UK companies do this in spreadsheets with calendar reminders |
| **UK late payment interest calculator** | The Late Payment of Commercial Debts (Interest) Act 1998 entitles contractors to statutory interest on overdue invoices: Bank of England base rate + 8% per annum. Plus fixed compensation (GBP 40/70/100 based on debt size). Most contractors do not know this, and most platforms do not surface it | LOW | Auto-calculate accrued interest on overdue GBP invoices. Display to both client (liability exposure) and contractor (entitlement). Fixed compensation: <GBP 1000 = GBP 40, GBP 1000-9999 = GBP 70, >=GBP 10000 = GBP 100. Bank of England rate fetched periodically |
| **German Skonto (early payment discount) support** | Standard German B2B practice: 2% discount for payment within 10 days (Skonto), otherwise net 30. Extremely common in German business -- not supporting Skonto signals the platform does not understand German B2B | LOW | Add optional Skonto terms to invoice/contract: discount percentage + discount period days. Calculate discounted amount. Track whether payment qualifies for Skonto based on payment date. Display both amounts on invoice |
| **Statusfeststellungsverfahren (DRV clearance procedure) tracking** | Companies can proactively request a formal DRV status determination (Statusfeststellungsverfahren) for specific engagements. This provides legal certainty. Tracking application status, outcomes, and validity periods is valuable for compliance-conscious German companies | MEDIUM | Track: application filed date, DRV reference number, outcome (selbstaendig/abhaengig beschaeftigt), validity period, conditions. Link to contractor engagement. Remind when validity expires. Fewer than 5% of platforms track this |
| **Peppol BIS Billing 3.0 for UK** | UK adopted Peppol for public sector e-invoicing post-Brexit. NHS and some government bodies require Peppol BIS. The existing Peppol integration (PINT-AE) shares 90%+ infrastructure -- UK Peppol is nearly free to add | LOW | New country profile on existing e-invoicing engine. UK-specific fields: VAT treatment codes, CIS deductions. Reuse Storecove ASP integration. Minimal incremental effort given existing Peppol PINT-AE profile |
| **Faster Payments integration (UK)** | UK Faster Payments processes in hours (not 3 days like BACS). Many fintechs and banks now support Faster Payments file submission. Higher per-transaction limit (GBP 1M since 2022). Shows the platform is modern, not stuck on legacy BACS | MEDIUM | Requires API integration (ISO 20022 based). Consider partnering with a payments-as-a-service provider (Modulr, ClearBank). May be out of scope for v5.0 MVP but worth researching. Depends on: BACS as baseline |
| **Compliance health dashboard per market** | Consolidated view showing: IR35 assessment coverage (% of UK contractors assessed), Scheinselbständigkeit risk distribution, XRechnung/ZUGFeRD compliance status, overdue reassessments, economic dependency alerts. Extension of v4.0 compliance dashboard concept | MEDIUM | Builds on existing dashboard KPI pattern. Aggregates classification engine data, e-invoicing compliance, and contractor profile completeness. Actionable: click-through to resolve each issue |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create legal liability, excessive complexity, or miss the product's core focus.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Definitive IR35 determination (not risk assessment)** | "Tell me definitively if this contractor is inside or outside IR35" | Providing a binding determination creates existential liability. If platform says "outside" and HMRC disagrees, the platform could be liable. Even HMRC's own CEST tool includes a disclaimer that results are not legally binding. Tax tribunals regularly overturn CEST results. IR35 case law is notoriously inconsistent (cf. Atholl House, PGMOL cases) | Provide a structured assessment tool that MIRRORS CEST's questions and logic, produces a risk score and recommendation, but explicitly states it is an aid to decision-making, not a legal determination. Store the client's final determination alongside the tool's recommendation. Require human sign-off |
| **Automated DRV submission** | "Submit Statusfeststellungsverfahren applications directly to DRV" | DRV applications require wet signatures and are processed by mail or through their online portal with personal authentication. No public API exists. Building automated submission would require screen-scraping a government portal -- brittle, likely illegal, and useless when the process changes | Track application status and outcomes. Generate pre-filled application forms that the HR/legal team can print, sign, and submit. Remind about deadlines. Be the system of record, not the submission channel |
| **Real-time HMRC VAT reporting** | "Submit MTD VAT returns directly from the platform" | Making Tax Digital (MTD) VAT is a quarterly filing obligation for the entire organization, not per-contractor. It requires API integration with HMRC's MTD platform, handling of bridging software requirements, and covers ALL business income -- not just contractor payments. This is accounting software territory (Xero, QuickBooks, FreeAgent) | Validate UK VAT numbers via HMRC's API. Calculate correct VAT on invoices. Export VAT-relevant data that feeds into the client's accounting system. Do not become an MTD filing tool |
| **German payroll processing for inside-IR35 equivalents** | "If Scheinselbständigkeit is detected, process them as employees" | Converting a contractor to an employee requires: employment contract, Meldung zur Sozialversicherung, Lohnsteueranmeldung, Krankenkasse registration, Berufsgenossenschaft registration. This is full German payroll -- a completely different product (DATEV, Personio territory) | Flag the risk. Generate documentation showing the engagement should be restructured. Provide a handoff package to the client's HR/payroll provider. Do not process German payroll |
| **Become a KoSIT XRechnung validator** | "Validate XRechnung XML ourselves instead of using external validation" | KoSIT (Koordinierungsstelle fuer IT-Standards) maintains the official XRechnung validator with Schematron rules that update with each XRechnung version (currently 3.0.x). Maintaining your own validator means tracking every rule change -- significant ongoing burden | Use KoSIT's open-source validator (Java-based, can run as a service) or integrate with a validation API. Focus on XML generation, not validation infrastructure |
| **CIS (Construction Industry Scheme) deductions** | "Support CIS tax deductions for UK construction contractors" | CIS is a niche UK scheme applying only to construction industry. It requires monthly CIS returns to HMRC, contractor verification, and specific deduction rates. Very different from standard B2B contracting. Adds significant complexity for a small market segment | If a UK customer is in construction, note CIS applicability on contractor profile. Export CIS-relevant data. Do not build CIS deduction/reporting -- this is construction payroll software territory |
| **Multi-country consolidated classification** | "One assessment that covers IR35 AND Scheinselbständigkeit for a contractor working in both UK and DE" | UK and German classification are fundamentally different legal frameworks with different criteria, different outcomes, and different consequences. A combined assessment would be legally meaningless and potentially misleading | Separate assessments per jurisdiction. If a contractor works in both markets, they have two independent assessments. The classification engine's pluggable design handles this naturally |

## Feature Dependencies

```
Generic Contractor Classification Engine
    +-- IR35 Rule Set (UK)
    |       +-- SDS Generation
    |       |       +-- SDS Delivery Tracking
    |       +-- IR35 Chain Participant Tracking
    |       +-- IR35 Reassessment Triggers
    +-- Scheinselbständigkeit Rule Set (Germany)
    |       +-- DRV Audit Defense Documentation
    |       +-- Statusfeststellungsverfahren Tracking
    +-- (Future: France URSSAF, Netherlands DBA)

Economic Dependency Monitoring (Germany)
    (independent -- uses existing billing data)
    (enhances Scheinselbständigkeit assessment -- feeds risk score)

EN 16931 E-Invoicing Engine Extension
    +-- XRechnung Country Profile
    |       +-- Leitweg-ID management (B2G)
    |       +-- KoSIT validation integration
    +-- ZUGFeRD Country Profile
    |       +-- PDF/A-3 generation
    |       +-- CII XML embedding
    +-- Peppol BIS UK Profile (optional, low effort)

UK Payment Infrastructure
    +-- BACS Standard 18 Export
    +-- (Future: Faster Payments API)

UK VAT + HMRC Validation
    (extends existing TaxRate table + reverse charge service)

German VAT + VIES Validation
    (extends existing TaxRate table + reverse charge service)

UK Contractor Fields (UTR, Companies House)
    (extends existing country-specific fields pattern)

German Contractor Fields (Steuernummer, Handelsregister)
    (extends existing country-specific fields pattern)

German i18n
    (extends existing next-intl framework)

UK Late Payment Interest Calculator
    (independent -- uses existing invoice due dates + payment dates)

German Skonto Support
    +-- Invoice terms extension
    +-- Payment matching logic update
```

### Dependency Notes

- **IR35 + Scheinselbständigkeit require Classification Engine:** Both are rule sets plugging into the same abstract framework. Building either without the engine means duplicating assessment logic, scoring, document generation, and reassessment tracking.
- **SDS Generation requires IR35 Engine:** The SDS document contains the reasoning from the assessment -- it cannot be generated independently.
- **DRV Audit Defense requires Scheinselbständigkeit Engine:** The documentation package references assessment criteria, scores, and history from the engine.
- **XRechnung/ZUGFeRD require existing e-invoicing engine:** Both are EN 16931 country profiles. The existing engine's `generate()`, `parse()`, `validate()` interfaces apply directly. XRechnung uses CII syntax (different from KSeF/ZATCA/Peppol which use UBL) -- the engine must support both syntaxes.
- **Economic dependency monitoring is independent** but its output enhances the Scheinselbständigkeit risk score (revenue concentration is one of the DRV's assessment criteria).
- **ZUGFeRD depends on XRechnung:** ZUGFeRD's EN 16931 profile uses the same CII XML as XRechnung, just embedded in PDF/A-3. Build XRechnung XML generation first, then wrap in PDF.
- **BACS is independent** of the classification engine. It extends the existing payment export framework (CSV, Elixir, SEPA, SWIFT) with a new format.
- **German i18n is independent** -- can be built in parallel with any other feature.

## MVP Definition

### Launch With (v5.0 Core)

Minimum to enter UK and German markets with credible compliance coverage.

- [ ] **Generic contractor classification engine** -- Abstract framework with rule sets, scoring, document generation, reassessment tracking. THE architectural investment of v5.0
- [ ] **IR35 rule set** -- CEST-aligned assessment (5 areas, ~25 questions), risk scoring, inside/outside/undetermined outcomes
- [ ] **SDS generation + delivery tracking** -- PDF generation, chain participant tracking, delivery timestamps, dispute workflow
- [ ] **Scheinselbständigkeit rule set** -- DRV-aligned assessment (~20 criteria, 4 categories), weighted risk scoring, traffic-light outcomes
- [ ] **DRV audit defense documentation** -- Exportable PDF bundle with assessment history, independence indicators, revenue attestation
- [ ] **Economic dependency monitoring** -- Billing concentration tracking, 70%/83.33% threshold alerts, contractor attestation workflow
- [ ] **XRechnung country profile** -- CII XML generation, KoSIT validation, Leitweg-ID for B2G
- [ ] **ZUGFeRD country profile** -- PDF/A-3 with embedded CII XML, EN 16931 COMFORT profile
- [ ] **BACS Standard 18 export** -- Fixed-width payment file generation for UK domestic payments
- [ ] **UK/German VAT rates + validation** -- UK rates (20%/5%/0%), HMRC VAT check, German rates (19%/7%/0%), VIES validation
- [ ] **UK + German contractor profile fields** -- UTR, Companies House, Steuernummer, Handelsregister, etc.
- [ ] **German i18n** -- Full German translation, third locale in next-intl

### Add After Validation (v5.x)

Features to add once UK/German markets are live and generating feedback.

- [ ] **IR35 reassessment triggers** -- Auto-detect material changes from contract amendments, rate changes, extensions. Trigger: UK customers managing 20+ contractors report reassessment as a pain point
- [ ] **UK late payment interest calculator** -- Statutory interest + compensation on overdue invoices. Trigger: UK contractors request visibility into late payment entitlements
- [ ] **German Skonto support** -- Early payment discount terms on invoices. Trigger: German customers report manually tracking Skonto eligibility
- [ ] **Statusfeststellungsverfahren tracking** -- DRV clearance procedure application tracking. Trigger: German customers proactively requesting DRV determinations
- [ ] **Peppol BIS UK profile** -- UK public sector e-invoicing. Trigger: UK customer wins NHS/government contract requiring Peppol
- [ ] **Compliance health dashboard (UK/DE)** -- Market-specific compliance overview. Trigger: Customer managing contractors in both markets needs consolidated view

### Future Consideration (v6+)

Features to defer until UK/Germany PMF is established.

- [ ] **Faster Payments API integration** -- UK real-time payments. Defer: BACS is sufficient for MVP; Faster Payments requires banking partnership
- [ ] **France URSSAF classification rule set** -- Defer: France is the hardest EU market. Prove the classification engine pattern works with UK+DE first
- [ ] **Netherlands DBA (Wet DBA) rule set** -- Defer: Natural third market for classification engine. Well-defined criteria (similar to Scheinselbständigkeit)
- [ ] **MTD VAT bridging** -- Defer: Accounting software territory (Xero, QuickBooks). Not our core value
- [ ] **Automated Statusfeststellungsverfahren form generation** -- Defer: DRV forms change. Manual form filling is acceptable

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Generic classification engine | HIGH | HIGH | P0 |
| IR35 rule set | HIGH | HIGH | P0 |
| SDS generation + delivery | HIGH | MEDIUM | P0 |
| Scheinselbständigkeit rule set | HIGH | HIGH | P0 |
| DRV audit defense docs | HIGH | MEDIUM | P0 |
| Economic dependency monitoring | HIGH | MEDIUM | P0 |
| XRechnung profile | HIGH | HIGH | P0 |
| ZUGFeRD profile | HIGH | HIGH | P0 |
| BACS Standard 18 export | HIGH | MEDIUM | P0 |
| UK/DE VAT rates + validation | HIGH | LOW | P0 |
| UK + DE contractor fields | HIGH | LOW | P0 |
| German i18n | MEDIUM | MEDIUM | P0 |
| IR35 chain participant tracking | MEDIUM | MEDIUM | P0 |
| IR35 reassessment triggers | MEDIUM | MEDIUM | P1 |
| UK late payment interest | LOW | LOW | P1 |
| German Skonto | MEDIUM | LOW | P1 |
| Statusfeststellungsverfahren tracking | MEDIUM | MEDIUM | P1 |
| Peppol BIS UK | LOW | LOW | P2 |
| Compliance health dashboard | MEDIUM | MEDIUM | P1 |
| Faster Payments | LOW | HIGH | P2 |

**Priority key:**
- P0: Must have for UK+DE market launch
- P1: Should have, add when demand validates
- P2: Nice to have, future consideration

## Detailed Feature Specifications

### IR35 Status Determination Engine

**HMRC CEST Tool Assessment Areas:**

The Check Employment Status for Tax (CEST) tool assesses 5 key areas. Our engine must mirror these:

1. **Personal service / Right of substitution**
   - Can the worker send a substitute?
   - Has a substitute actually been used?
   - Does the client have the right to reject a substitute?
   - Who pays the substitute?
   - Key: If genuine right of substitution exists AND has been exercised, strongly indicates outside IR35

2. **Control**
   - Who decides what work is done?
   - Who decides when the work is done?
   - Who decides where the work is done?
   - Who decides how the work is done?
   - Key: More client control = more like employment. But "what" is less relevant than "how"

3. **Financial risk**
   - Does the worker risk their own money?
   - Does the worker provide their own equipment (significant cost)?
   - Does the worker fix mistakes at their own expense?
   - Is payment fixed regardless of outcome?
   - Key: Genuine financial risk (not just "no sick pay") indicates outside IR35

4. **Part and parcel of the organisation**
   - Does the worker have management responsibilities over client staff?
   - Does the worker receive the same benefits as employees?
   - Is the worker treated as part of the client's organisation?
   - Key: Inclusion in org events/benefits suggests inside IR35

5. **Mutuality of obligation (MOO)**
   - Is the client obliged to offer work?
   - Is the worker obliged to accept work?
   - Key: Contract-to-contract engagement with no ongoing obligation indicates outside

**CEST Outcomes:**
- **Inside IR35** -- worker would be an employee if engaged directly. Fee-payer must deduct income tax, employee NICs, and pay employer NICs
- **Outside IR35** -- worker is genuinely self-employed for this engagement. No PAYE deductions required
- **Undetermined** -- CEST cannot make a determination. Client must seek professional advice. Platform should flag this as HIGH risk

**SDS (Status Determination Statement) Must Contain:**
- The client's conclusion (inside/outside/undetermined)
- The date of the determination
- The engagement details (role, project, duration, rate)
- Reasons for the conclusion, organized by assessment area
- Reference to CEST assessment (if used)
- Client contact details for queries
- Dispute process: worker has right to dispute within statutory timeframe
- Statement that the determination applies to this specific engagement only

**Confidence: MEDIUM** -- based on established IR35 legislation (Chapter 10 ITEPA 2003, Finance Act 2021 reforms). CEST question wording should be verified against current HMRC CEST tool before implementation.

### Scheinselbständigkeit Risk Assessment

**DRV Assessment Criteria (approximately 20 factors across 4 categories):**

1. **Integration into client operations (Eingliederung)**
   - Works at client premises
   - Uses client equipment/tools
   - Has fixed working hours set by client
   - Reports to client management
   - Attends internal meetings regularly
   - Has client email address
   - Appears in client org chart
   - Weight: HIGH -- most heavily weighted category

2. **Entrepreneurial independence (Unternehmerische Freiheit)**
   - Markets services to multiple clients
   - Has own business premises/office
   - Employs own staff
   - Bears economic risk (fixed-price projects with overrun risk)
   - Has own professional insurance
   - Invests in own equipment
   - Sets own pricing/rates
   - Weight: HIGH

3. **Personal dependency (Persoenliche Abhaengigkeit)**
   - Client dictates how work is performed (Weisungsgebundenheit)
   - Cannot refuse assignments
   - Cannot use substitutes
   - Subject to client's disciplinary procedures
   - Has no say in which tasks to accept
   - Weight: MEDIUM

4. **Economic dependency (Wirtschaftliche Abhaengigkeit)**
   - >83.33% of revenue from single client (Section 2 SGB VI threshold)
   - No other clients in past 12 months
   - Financially dependent on contract continuation
   - Weight: MEDIUM -- but triggers automatic pension insurance obligation at 5/6 threshold

**Scoring approach:** Weighted average across criteria. Traffic-light output:
- GREEN (low risk): Score <30% -- strong independence indicators
- AMBER (medium risk): Score 30-60% -- mixed signals, recommend review
- RED (high risk): Score >60% -- strong employment indicators, recommend restructuring or formal DRV determination

**Required documentation for audit defense:**
1. Engagement contract clearly specifying project-based/deliverable-based scope
2. Evidence of contractor's other clients (revenue attestation, references)
3. Proof contractor uses own equipment and tools
4. Absence of integration evidence (no client email, no fixed hours, no org chart inclusion)
5. Assessment history showing periodic review (not just at engagement start)
6. Written confirmation of contractor's business registration (Gewerbeanmeldung or Freiberufler status at Finanzamt)

**Confidence: MEDIUM** -- based on established DRV assessment practice and German labor law. The exact weighting of criteria is not published by DRV (it varies by case), so our scoring is an approximation that should be reviewed by German employment law counsel.

### Economic Dependency Monitoring (Germany)

**Thresholds:**
- **>83.33% (5/6)** of total revenue from one client: Legal threshold under Section 2 Sentence 1 No. 9 SGB VI. Contractor becomes "arbeitnehmeraehnliche Selbstaendige" (employee-like self-employed). MANDATORY pension insurance contribution of 18.6% of income kicks in. Client may be liable for half.
- **70%** warning threshold: Industry best practice to alert before crossing the legal boundary
- **100%** single client: Highest risk -- nearly guaranteed Scheinselbständigkeit finding in any DRV audit

**Implementation:**
- Track per-contractor: total invoiced amount to THIS org vs. self-reported total revenue
- Contractor self-reports annually or provides attestation (Eigenerklaerung) about revenue distribution
- Dashboard shows distribution per contractor with color coding
- Alert system: notify org admin + contractor when approaching/exceeding thresholds
- Historical tracking: show trend over quarters (a contractor gradually moving from 60% to 85% is a red flag even if the 83.33% is not yet crossed)

### XRechnung vs ZUGFeRD

**What buyers actually expect:**

| Context | Expected Format | Why |
|---------|-----------------|-----|
| B2G (public sector) | XRechnung (pure CII or UBL XML) | Legally mandated since November 2020. Must include Leitweg-ID routing code |
| B2B (large companies) | ZUGFeRD EN 16931 (PDF/A-3 + XML) | Most practical: accounting team sees PDF, ERP system reads embedded XML. Wachstumschancesgesetz requires e-invoice capability from Jan 2025 (receipt) |
| B2B (SMEs) | ZUGFeRD BASIC or higher | SMEs often lack ERP e-invoicing support. ZUGFeRD's human-readable PDF is essential for them. Pure XML would be rejected |
| Between systems with EDI | XRechnung (pure XML) | When both sides have ERP integration, the PDF wrapper adds no value |

**Recommendation:** Build BOTH. ZUGFeRD is the primary B2B format (covers 80%+ of use cases). XRechnung is mandatory for B2G and preferred for system-to-system. Since ZUGFeRD EN 16931 profile uses the SAME CII XML as XRechnung, the XML generation is shared -- ZUGFeRD just adds the PDF/A-3 wrapper.

**XRechnung specifics:**
- Current version: 3.0.x (verify against KoSIT releases before implementation)
- Syntax: CII (Cross Industry Invoice) by default, UBL also accepted
- Validation: KoSIT validator (open-source Java tool, Schematron-based)
- B2G requires Leitweg-ID (routing identifier, format: [coarse]-[medium]-[fine], e.g., 04011000-12345-67)
- Transmission: Peppol or email. ZRE (Zentrale Rechnungseingangsplattform) for federal government

**ZUGFeRD specifics:**
- Current version: 2.3.x (aligned with Factur-X 1.0, the French equivalent)
- Profiles: MINIMUM (very basic), BASIC WL, BASIC, EN 16931 (COMFORT), EXTENDED
- EN 16931 profile = XRechnung-compatible XML inside PDF
- Requires PDF/A-3 (not just PDF) -- the XML is embedded as an attachment named `factur-x.xml`
- Library needed: pdf-lib or similar for PDF/A-3 generation with embedded XML

**Confidence: MEDIUM** -- based on EN 16931 standard and German e-invoicing ecosystem. XRechnung version number and KoSIT validator should be verified against kosit.org before implementation.

### BACS Standard 18 File Format

**Structure:**
```
VOL1 label (80 bytes) -- volume header
HDR1 label (80 bytes) -- file header, includes SUN (Service User Number)
HDR2 label (80 bytes) -- record format info
UHL1 label (80 bytes) -- user header, includes processing date, currency (always GBP for domestic)

Contra record(s) (100 bytes each) -- the paying account(s)
  - Sort code (6 digits)
  - Account number (8 digits)  
  - Transaction type: 17 (contra credit) or 0 (contra debit)
  - Amount in pence (11 digits, right-justified, zero-filled)
  - Account name (18 chars)
  - Service User Number (6 digits)
  - Reference (18 chars)

Destination records (100 bytes each) -- one per payment
  - Sort code (6 digits)
  - Account number (8 digits)
  - Transaction type: 99 (credit)
  - Amount in pence (11 digits)
  - Recipient name (18 chars)
  - Reference (18 chars)
  - Service User Number (6 digits)

EOF1 label (80 bytes) -- end of file
EOF2 label (80 bytes) -- end of file (part 2)
```

**Key details:**
- All amounts in pence (integer minor units -- matches our existing pattern)
- Sort code + account number (not IBAN for domestic UK payments)
- Service User Number (SUN) is assigned by BACS to the client organization
- Processing: submit Day 1, BACS processes Day 2, funds arrive Day 3
- Maximum 999,999 records per file
- Character set: limited to uppercase A-Z, 0-9, space, and a few special characters
- Currency: always GBP for domestic BACS (international payments use SWIFT/CHAPS)

**What UK companies actually use:**
- Small companies (<50 payments/month): Online banking bulk upload (CSV, varies by bank)
- Medium companies (50-500 payments/month): BACS Standard 18 via their bank's Bacstel-IP service
- Large companies (500+ payments/month): Direct BACS bureau or Bacstel-IP direct submission
- Fintechs: API-based (Modulr, ClearBank) -- no file generation needed

**Our recommendation:** Generate Standard 18 files. This covers the medium company segment (our target). Smaller companies can use CSV export (already built). Larger companies and fintechs are future considerations.

**Confidence: MEDIUM** -- BACS Standard 18 is a well-established format unchanged for decades. Exact field positions should be verified against current BACS specification before implementation.

### UK Late Payment Interest

**Late Payment of Commercial Debts (Interest) Act 1998:**

- Applies to ALL commercial (B2B) debts, including contractor invoices
- Statutory interest rate: Bank of England base rate + 8% per annum, calculated daily on the overdue amount
- Interest starts accruing from the day after the agreed payment date (or 30 days after invoice/delivery if no agreed terms)
- Fixed-sum compensation in addition to interest:
  - Debt up to GBP 999.99: GBP 40
  - Debt GBP 1,000 to GBP 9,999.99: GBP 70
  - Debt GBP 10,000+: GBP 100
- Reasonable debt recovery costs can also be claimed
- Cannot be contracted out of (any contract term excluding statutory interest is void)

**Implementation:** Display accrued interest on overdue invoices. Useful for both sides:
- Client: sees their growing liability, incentivizing timely payment
- Contractor (via portal): sees their entitlement, with "claim interest" documentation

### German Skonto

**How it works in practice:**

- Standard German B2B payment terms: "2% Skonto bei Zahlung innerhalb von 10 Tagen, netto 30 Tage" (2% discount if paid within 10 days, otherwise net 30)
- The discount applies to the NET amount (before VAT in some interpretations, but commonly on gross)
- Industry variations: some use 3% / 14 days, others 1% / 7 days
- Accounting treatment: Skonto reduces the invoice amount; VAT must be adjusted accordingly
- Very common: ~60-70% of German B2B invoices include Skonto terms

**Implementation:**
- Add to contract/invoice: `skontoPercent`, `skontoDays`, `netPaymentDays`
- On invoice display: show both amounts ("Pay GBP X by [date] for 2% discount, or GBP Y by [date]")
- On payment matching: if payment amount equals Skonto amount AND payment date is within Skonto period, mark as "paid with Skonto"
- VAT adjustment: when Skonto is taken, VAT basis is reduced proportionally

## Competitor Feature Analysis

| Feature | Deel | Remote | Hive (DE) | IR35 Shield (UK) | Our Approach |
|---------|------|--------|-----------|-------------------|--------------|
| IR35 assessment | Basic questionnaire | Not specialized | N/A | Core product -- deep CEST alignment | Structured CEST-aligned assessment in pluggable engine. Risk scoring, not legal determination. SDS generation + chain tracking |
| Scheinselbständigkeit | Generic risk flag | Basic checklist | Deep -- core product | N/A | DRV-aligned criteria, weighted scoring, audit defense docs. Economic dependency monitoring (unique in contractor ops platforms) |
| XRechnung/ZUGFeRD | Not available | Not specialized | Basic | N/A | Both formats via pluggable e-invoicing engine. ZUGFeRD (PDF/A-3 + XML) for B2B, XRechnung for B2G. Shared EN 16931 core |
| BACS payments | Via their payment rails | Via their payment rails | N/A | N/A | Standard 18 file generation. We organize and batch, bank transfers. Consistent with SEPA/SWIFT approach |
| Classification engine | Per-country bespoke | Per-country bespoke | Scheinselbständigkeit only | IR35 only | Generic engine with pluggable rule sets. First platform to cover BOTH UK and DE in one architecture |
| Economic dependency | Not tracked | Not tracked | Some mention | Not applicable | Automated monitoring with threshold alerts. Revenue attestation workflow. Unique differentiator |
| Late payment interest | Not calculated | Not calculated | Not shown | Not applicable | Auto-calculated per UK statute. Visible to both parties |
| Skonto | Not applicable | Not applicable | Often manual | Not applicable | First-class payment term with auto-matching |
| Contractor lifecycle | Strong (but EOR-focused) | Strong (but EOR-focused) | Weak (compliance only) | Weak (assessment only) | Full lifecycle: assess -> onboard -> contract -> invoice -> approve -> pay. Our core strength |

## Market-Specific Requirements Summary

### United Kingdom (Entry Difficulty: 3/5)

| Requirement | Category | Depends On |
|-------------|----------|------------|
| IR35 status determination engine | Table Stakes | Classification engine |
| SDS generation + delivery tracking | Table Stakes | IR35 engine |
| Chain participant tracking | Table Stakes | SDS generation |
| BACS Standard 18 payment export | Table Stakes | Payment export framework |
| UK VAT rates (20%/5%/0%) | Table Stakes | Existing TaxRate table |
| HMRC VAT number validation | Table Stakes | New API integration |
| UK contractor fields (UTR, Companies House) | Table Stakes | Existing country fields pattern |
| UK GDPR compliance (ICO regime) | Table Stakes | Existing GDPR foundation |
| Late payment interest calculator | Differentiator | Invoice due dates |
| Peppol BIS UK | Differentiator | Existing Peppol infrastructure |
| Faster Payments integration | Future | Banking partnership |

### Germany (Entry Difficulty: 4/5)

| Requirement | Category | Depends On |
|-------------|----------|------------|
| Scheinselbständigkeit risk assessment | Table Stakes | Classification engine |
| DRV audit defense documentation | Table Stakes | Scheinselbständigkeit engine |
| Economic dependency monitoring | Table Stakes | Contractor billing data |
| XRechnung e-invoicing profile | Table Stakes | E-invoicing engine (CII syntax) |
| ZUGFeRD e-invoicing profile | Table Stakes | XRechnung profile + PDF/A-3 |
| German VAT rates (19%/7%/0%) | Table Stakes | Existing TaxRate table |
| VIES USt-IdNr validation | Table Stakes | EU VIES API |
| German contractor fields (Steuernummer, HRB) | Table Stakes | Existing country fields pattern |
| German i18n | Table Stakes | Existing next-intl framework |
| German GDPR (BDSG supplement) | Table Stakes | Existing GDPR foundation |
| Skonto support | Differentiator | Invoice terms |
| Statusfeststellungsverfahren tracking | Differentiator | Scheinselbständigkeit engine |

## Sources

- HMRC: Off-payroll working rules (IR35) -- Chapter 10 ITEPA 2003, Finance Act 2021 reforms (MEDIUM confidence -- based on training data, verify against gov.uk/guidance/understanding-off-payroll-working-ir35)
- HMRC CEST Tool -- gov.uk/guidance/check-employment-status-for-tax (MEDIUM confidence -- question categories verified from training data, exact wording should be verified)
- Late Payment of Commercial Debts (Interest) Act 1998 -- legislation.gov.uk (HIGH confidence -- established legislation, rates well-known)
- Deutsche Rentenversicherung: Statusfeststellungsverfahren -- Section 7a SGB IV (MEDIUM confidence -- criteria known from training data, exact weighting should be verified with German employment law counsel)
- Section 2 Sentence 1 No. 9 SGB VI -- arbeitnehmeraehnliche Selbstaendige threshold (HIGH confidence -- 5/6 = 83.33% threshold is well-established)
- EN 16931 European e-invoicing standard (HIGH confidence -- established EU standard)
- XRechnung -- KoSIT/xoev.de (MEDIUM confidence -- version number should be verified)
- ZUGFeRD -- zugferd.de (MEDIUM confidence -- version number should be verified)
- Wachstumschancesgesetz / Growth Opportunities Act -- German B2B e-invoicing mandate (MEDIUM confidence -- timeline should be verified against official Bundesgesetzblatt)
- BACS Standard 18 file format -- bacs.co.uk (MEDIUM confidence -- format is well-established but exact field positions should be verified against current spec)
- Bank of England base rate -- bankofengland.co.uk (rate changes; implementation should fetch dynamically)
- Existing codebase: `packages/einvoice/src/engine/engine.ts`, `packages/api/src/services/tax-rate.service.ts`, `packages/api/src/services/payment-export.ts`, `packages/api/src/services/payment-format-detection.ts`, `packages/db/prisma/schema/tax.prisma`, `packages/db/prisma/schema/contractor.prisma`

---
*Feature research for: v5.0 UK & Germany Expansion*
*Researched: 2026-04-12*
