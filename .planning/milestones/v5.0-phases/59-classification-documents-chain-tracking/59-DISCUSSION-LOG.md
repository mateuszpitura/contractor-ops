# Phase 59: Classification Documents & Chain Tracking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 59-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 59-classification-documents-chain-tracking
**Areas discussed:** SDS PDF structure & layout, Document persistence model, IR35 chain data model + delivery, DRV audit bundle packaging

---

## SDS PDF Structure & Layout

### Q1 — Document structure (verdict-first vs evidence-first vs compact)

| Option | Description | Selected |
|--------|-------------|----------|
| Verdict-first, evidence-trailing | Page 1: verdict banner + summary + engagement details. Pages 2+: per-area breakdown with answers and case-law citations. Final page: dispute process + disclaimer | ✓ |
| Evidence-first, verdict-trailing | Page 1: engagement + context. Pages 2-6: each IR35 area walked through. Final: verdict | |
| Compact one-page summary + appendix | Page 1: everything (verdict + area scorecard + dispute text) on one A4. Appendix pages for per-area evidence | |

**User's choice:** Verdict-first, evidence-trailing
**Notes:** Matches how HMRC reviewers scan SDS — verdict first, dig into reasoning only when challenged.

### Q2 — Visualisation density

| Option | Description | Selected |
|--------|-------------|----------|
| Pills + minimal typography (Helvetica, teal accent) | Match Phase 56 privacy notice. Each area gets a coloured verdict pill, bold area heading, plain text reasoning | ✓ |
| Scorecard table | Table with columns: Area, Verdict, Driving answers, Citation. Compact, less narrative room | |
| Evidence cards per area | One section per area with a boxed card. More whitespace; longer documents | |

**User's choice:** Pills + minimal typography
**Notes:** Consistent with Phase 56 brand — classification documents should feel like the same product family as privacy notices.

### Q3 — Dispute-process section content source

| Option | Description | Selected |
|--------|-------------|----------|
| Boilerplate from locked-phrases module | Add `IR35_DISPUTE_PROCESS_EN` to `packages/validators/src/legal/en.ts`, locked + CI-guarded. No per-org customization | ✓ |
| Org-customizable with locked floor | Locked legal core + optional per-org block for internal dispute routing | |
| Plan-specific, decide during implementation | You decide during planning | |

**User's choice:** Boilerplate from locked-phrases module
**Notes:** Matches Phase 58 D-07 pattern for locked legal phrases.

---

## Document Persistence Model

### Q1 — Storage lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Persist immutable artifact + hash, stream signed URL on request | Render once, SHA-256 hash, R2 content-addressed key, `ClassificationDocument` row. Subsequent downloads re-sign existing object | ✓ |
| Render on demand from snapshot | Phase 58 snapshot is already immutable — regenerate bytes each download. Zero extra storage; bytes won't hash-match if renderer code changes | |
| Both — persist on finalize, regenerate for previews | Versioned persist event + ephemeral preview renders. More complex lifecycle | |

**User's choice:** Persist immutable artifact + hash
**Notes:** Compliance intent — HMRC/DRV auditors expect bit-identical evidence of what was issued.

### Q2 — Signed URL TTL

| Option | Description | Selected |
|--------|-------------|----------|
| 300s (match Phase 56) | Same as `generatePrivacyNoticePdf` | ✓ |
| 15 minutes (900s) | Longer window for slow networks | |
| You decide | Claude's discretion | |

**User's choice:** 300s (match Phase 56)
**Notes:** Consistency with existing PDF download flow.

### Q3 — Regeneration policy

| Option | Description | Selected |
|--------|-------------|----------|
| Never auto-regenerate — frozen to rule-set version | Original bytes are what's auditable. Rule-set changes produce new assessments + new documents | ✓ |
| Manual "regenerate" action | Allow user to render a new ClassificationDocument row from same assessment | |

**User's choice:** Never auto-regenerate
**Notes:** Append-only audit model matches Phase 58 D-08.

---

## IR35 Chain Participants Data Model + Delivery

### Q1 — Data model shape

| Option | Description | Selected |
|--------|-------------|----------|
| New Prisma model, typed rows | `Ir35ChainParticipant { engagementId, role enum, orderIndex, displayName, contactEmail?, linkedOrgId?, linkedContractorId?, sdsDeliveredAt?, sdsAcknowledgedAt? }`. Ordered rows support multi-agency chains | ✓ |
| JSONB array on ContractorAssignment | `ir35Chain Json?` column. Simpler migration; harder to query | |
| Two tables: parties + chain-links | `Ir35ChainParty` master + `Ir35Chain` links. Over-normalized for v5.0 | |

**User's choice:** New Prisma model with typed rows
**Notes:** Flexible, queryable, audit-friendly.

### Q2 — Participant identity

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: linked when available, free-text fallback | CLIENT = auto-populated from current tenant; WORKER = linked Contractor; AGENCY/PSC = free-text | ✓ |
| All free-text | displayName + contactEmail only | |
| All linked | Require Organization/Contractor for every role | |

**User's choice:** Hybrid
**Notes:** Future phases can upgrade free-text to linked entities without schema changes.

### Q3 — SDS delivery semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit per-link mark-delivered action by user | Generation sets `generatedAt`; delivery requires click per participant; optional separate `sdsAcknowledgedAt` for confirmed receipt | ✓ |
| Email-and-forget | App sends SDS PDF link via email; delivery = send timestamp. Depends on mail infra and longer signed URLs | |
| Auto-delivered on document generation | `sdsDeliveredAt = generatedAt` for every participant | |

**User's choice:** Explicit per-link mark-delivered
**Notes:** HMRC audit wants proof each party received SDS, not just that it was generated. Two timestamps (delivered + acknowledged) capture outbound vs confirmed receipt.

---

## DRV Audit Defense Bundle Packaging

### Q1 — Bundle format

| Option | Description | Selected |
|--------|-------------|----------|
| Single consolidated PDF with cover + sections | One PDF: cover + TOC + 4 sections. No new dependencies. DRV auditors prefer a single exhibit | ✓ |
| ZIP of separate section PDFs + manifest | Adds `archiver` / `yazl`. 5 files. More flexible; multi-file open burden | |
| Single PDF default, ZIP when size > threshold | Conditional format based on byte size. Overengineered for v5.0 | |

**User's choice:** Single consolidated PDF
**Notes:** Avoids adding a ZIP library dependency; single unified exhibit works for German auditors.

### Q2 — Other-client attestation data source

| Option | Description | Selected |
|--------|-------------|----------|
| Contractor-entered statement + platform data | User-editable text field + auto-appended table of other ContractorAssignment rows | ✓ |
| Auto-generated from platform data only | Strict platform list; no contractor statement | |
| Free-text only, no platform data | User types everything manually | |

**User's choice:** Contractor-entered statement + platform data
**Notes:** Most accurate for audit — contractor can attest to off-platform engagements the system can't see.

### Q3 — Risk assessment history depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full outcome per prior assessment + score delta | Traffic-light verdict + total score + category breakdown + completion date + delta vs previous for each historical DE assessment | ✓ |
| Compact timeline — date + verdict + total score | One row per prior assessment in a table | |
| Latest assessment only, prior ones linked in platform | Single snapshot; reviewer must return to platform | |

**User's choice:** Full outcome per prior assessment + score delta
**Notes:** DRV reviewers look favourably on demonstrable reassessment discipline; bytes are cheap relative to evidentiary value.

---

## Claude's Discretion

Areas where exact values are deferred to planning/implementation rather than locked during discussion:
- Exact React-PDF StyleSheet numeric values (padding, fontSize, line-height) — use Phase 56 as baseline
- Pagination strategy for SDS per-area evidence when it exceeds one page
- Final wording of `IR35_DISPUTE_PROCESS_EN`, `SDS_DISCLAIMER_*`, `DRV_DEFENSE_*` locked constants (may need UK tax-adviser / Steuerberater review checkpoint like Phase 58 Plan 05)
- DB migration strategy (single migration vs one per model)
- `rendererVersion` stored as plain string vs semver
- tRPC router split (`classification-document` + `ir35-chain` vs extension of Phase 58 `classification` router)
- UI chrome (modal vs dialog vs sheet for chain-participant editor) — defer to frontend-design plugin

## Deferred Ideas

Captured in 59-CONTEXT.md `<deferred>` section:
- Automated SDS email delivery to external chain participants
- Digital signature on other-client attestation
- Per-organization customizable dispute-process text
- Manual "regenerate SDS from same assessment" button
- Chain-participant entity promotion (free-text → linked once agency directory exists)
- DRV defense bundle in languages other than German
- SDS bulk generation across engagements
- SDS template A/B variations
- ZIP bundle format for DRV evidence

Reviewed Todos (not folded): none — `gsd-tools todo match-phase 59` returned 0 matches.
