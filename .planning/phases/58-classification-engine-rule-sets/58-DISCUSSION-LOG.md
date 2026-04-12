# Phase 58: Classification Engine & Rule Sets - Discussion Log

> **Audit trail only.** Decisions captured in CONTEXT.md.

**Date:** 2026-04-12
**Phase:** 58-classification-engine-rule-sets
**Areas discussed:** Engine architecture & outcome shapes, Question/criteria representation, Assessment workflow & UX, Scoring + outcome thresholds

---

## Engine Architecture & Outcome Shapes

### Q1: Engine architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Abstract ClassificationProfile base + per-country subclass | Mirrors einvoice/GovApiClient | ✓ |
| Per-country services (no shared base) | Simpler; divergence risk | |
| Rule-DSL driven | Generic; heavy investment | |

**User's choice:** Abstract base + per-country subclass (Recommended)

### Q2: Outcome shape

| Option | Description | Selected |
|--------|-------------|----------|
| Shared envelope + per-country payload (discriminated union) | Ir35Outcome vs ScheinselbstandigkeitOutcome | ✓ |
| Unified outcome with optional fields | Fuzzy semantics | |
| Totally independent types | Loses unified query | |

**User's choice:** Shared envelope + discriminated union (Recommended)

### Q3: Storage model

| Option | Description | Selected |
|--------|-------------|----------|
| New ClassificationAssessment → ContractorAssignment | Append-only audit history | ✓ |
| Embed on ContractorAssignment row | Loses history | |
| Separate AssessmentAnswer + Outcome tables | Over-normalized | |

**User's choice:** ClassificationAssessment model (Recommended)

---

## Question/Criteria Representation

### Q4: Criteria representation

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript constants with source-law citations | Type-safe; PR-reviewed | ✓ |
| DB-seeded | Operationally flexible; drift risk | |
| JSON manifest | Readable; no type safety | |

**User's choice:** TS constants (Recommended)

### Q5: Localization

| Option | Description | Selected |
|--------|-------------|----------|
| Prompts in constants + locked phrases imported verbatim | Type-safe; CI guard asserts | ✓ |
| Translation keys in messages/*.json | Breaks locked-phrase guard | |
| English source, translated at runtime | Fails DE legal requirements | |

**User's choice:** Constants + locked phrase imports (Recommended)

### Q6: Rule-set versioning

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable snapshot: ruleSetVersion + questionsSnapshot on row | Audit-defensible | ✓ |
| Reference current only | Breaks audit trail | |
| Frozen rule constants per version tagged in code | Heavy churn | |

**User's choice:** Immutable snapshot (Recommended)

---

## Assessment Workflow & UX

### Q7: Form pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step wizard by area/category + draft autosave | 5 IR35 steps; 4 DRV steps | ✓ |
| Single scrollable form | Overwhelming | |
| Conditional branching wizard | Hides rationale | |

**User's choice:** Multi-step wizard (Recommended)

### Q8: Draft lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Draft row in ClassificationAssessment + locked on submit | One draft per engagement; immutable after submit | ✓ |
| Separate Draft table merged on submit | Two tables | |
| Local storage only | Loses work on device switch | |

**User's choice:** Draft row + locked-on-submit (Recommended)

### Q9: Skip questions

| Option | Description | Selected |
|--------|-------------|----------|
| Some optional; 'undetermined' for IR35 if insufficient | Matches CEST; DRV 'Nicht anwendbar' scores 0 | ✓ |
| All required | Forces guessing | |
| All optional | False confidence risk | |

**User's choice:** Some optional + undetermined (Recommended)

### Q10: Disclaimer gate

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking disclaimer modal before outcome | acknowledgedAt stored | ✓ |
| Inline always-visible disclaimer | Weaker legal posture | |
| Footer-only disclaimer | Minimal protection | |

**User's choice:** Blocking modal (Recommended)

---

## Scoring & Outcome Thresholds

### Q11: IR35 scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Per-area verdicts + composite rule | Substitution/MOO dispositive per Atholl House | ✓ |
| Weighted numeric sum with thresholds | Loses dispositive nuance | |
| ML/fuzzy model | Out of scope | |

**User's choice:** Per-area + composite rule (Recommended)

### Q12: DRV scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Weighted sum across 4 categories → traffic-light | Integration 30% / Entrepreneurial 30% / Personal 25% / Economic 15%; thresholds <30 green / 30-60 amber / >60 red | ✓ |
| Count of 'strong' criteria only | Loses nuance | |
| Binary rules | Doesn't match holistic DRV approach | |

**User's choice:** Weighted sum + traffic-light (Recommended)

### Q13: Economic dependency capture

| Option | Description | Selected |
|--------|-------------|----------|
| Capture ratio as criterion; Phase 60 owns alerts | Feeds economic-dependency category score | ✓ |
| Skip entirely in Phase 58 | Weakens outcome accuracy | |
| Auto-derive from invoice data | Data completeness risk | |

**User's choice:** Capture as criterion (Recommended)

### Q14: Outcome visualization

| Option | Description | Selected |
|--------|-------------|----------|
| IR35: 5 area cards; DRV: 4 category bars | Expandable per-criterion breakdown | ✓ |
| Verdict + flat question list | Less visual structure | |
| Verdict only (click to expand) | Hides reasoning | |

**User's choice:** Area cards / category bars (Recommended)

---

## Claude's Discretion

- IR35 exact question inventory (CEST-aligned)
- DRV exact criterion inventory (Rundschreiben RS 2022/1)
- Weight tuning within DRV categories
- Answer-type enum per question
- Exact disclaimer wording beyond legal minimum
- SSR vs CSR rendering of outcome page
- Assessment list page layout
- Export-to-PDF of outcome (basic; full regulatory PDF in Phase 59)

## Deferred Ideas

- SDS PDF generation — Phase 59
- IR35 chain tracking — Phase 59
- DRV audit defense bundle — Phase 59
- Economic-dependency alert thresholds — Phase 60
- Reassessment triggers — Phase 60
- DRV Statusfeststellungsverfahren tracking — Phase 60
- Cross-engagement compliance dashboard — Phase 60
- Rule-set versioning UI — future
- Third country rule sets — out of scope for v5.0
