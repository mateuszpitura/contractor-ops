# Phase 87: Theme A — 1042-S + US Classification + Determination Letter - Research

**Researched:** 2026-06-18
**Domain:** US cross-border tax reporting (Form 1042-S) + US worker classification (federal common-law/economic-realities + CA AB5 + §530) + deterministic determination-letter PDF + informational 1099-K threshold tracker
**Confidence:** MEDIUM-HIGH (in-tree reuse HIGH/verified; IRS box structure CITED HIGH; legal rule-set criteria MEDIUM with adviser-verify flags; exact IRIS 1042-S XSD element names + income-code numbers MEDIUM, execution-time re-verify)

## Summary

Phase 87 is a **compose-don't-rebuild** phase. Every surface extends a shipped engine: the v5.0 classification registry (`packages/classification`), the P85 treaty engine (`WithholdingTaxRate` + `treaty-rate.service.applyTreaty`), the P86 IRIS pipeline + react-pdf recipient-PDF infra, and the v5.0 `EconomicDependencyAlertState` cron/band pattern. The only genuinely new persisted models are `Form1042S`, a `US_DETERMINATION_LETTER` `ClassificationDocument` kind (+ a US `ClassificationAssessment` via `countryCode='US'`), and `Form1099KTrackerState`.

The P85 + P86 schema groundwork is **already on disk and verified**: `WithholdingTaxRate` carries the structured `treatyArticle` column; `Form1099Nec`/`IrisSubmission`/`IrisAck`/`Tax1099Threshold`/`StateFilingConfig` exist; `applyTreaty` resolves the §875(d)-gated treaty-rate-or-30% decision; `require-us-expansion-flag.ts` (`assertUsExpansionEnabled` + `isUsExpansionRegistered`) is wired into `root.ts`. The classification registry, `ClassificationProfile` contract, IR35/Scheinselbständigkeit rule-set authoring pattern, `classification-document-render.ts` render/archive service, and `SOFTWARE_NOT_LEGAL_ADVICE_EN` disclaimer are all present.

**Two material gaps the planner MUST account for** (P86 is still mid-execution per STATE.md — 86-05 done, transmitter/ack-parser/IRIS-generator are Wave-0 RED scaffolds, not yet GREEN): (1) the **IRIS schema-bundle is a human-only IRS SOR download** and the TY2025 package documented in-tree is **1099-NEC payload XSD + Transmission Manifest only — it does NOT contain the 1042-S XSD**, which has a separate schema/record layout (Pub 1187, not the 1099-series Pub 1220/IRIS 1099 schema). (2) The `TaxFilingTransmitter` seam + single ack parser that D-08 says 1042-S reuses are **not on disk yet** — Phase 87 plans must declare a dependency on P86 landing them, or build them.

**Primary recommendation:** Build the deterministic core (Form1042S model + box mapping, US ClassificationProfile rule set, determination-letter react-pdf template, 1099-K tracker cron) against the existing engines; gate the live 1042-S IRIS transmit behind the existing `module.iris-efile` flag (dark) exactly like P86's 1099 path; tag every legal criterion (federal factors, AB5 prongs, §530 conditions, treaty articles, income codes) adviser-verify; defer pixel-accurate IRS-form fidelity to the recipient Copy-PDF only (substitute black-ink, Pub 1179 idiom). Do NOT add an LLM (D-01) and do NOT build payout deduction (Phase 88).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 1042-S box computation + immutable snapshot | API / Backend (`packages/api/services`) | DB (`Form1042S` model) | Server-only tax computation; PII never in client |
| Treaty rate/article snapshot (§875(d) gate) | API (`treaty-rate.service.applyTreaty`) | DB (`WithholdingTaxRate`) | Mechanical published-table lookup, reused from P85 |
| IRIS 1042-S XML build + XSD validate | `packages/iris` (server) | CI (checksum + XSD validate job) | Same pattern as P86 IRIS 1099; offline, SSRF/XXE-safe |
| 1042-S IRIS transmit (manual default / A2A dark) | API (`TaxFilingTransmitter` seam) | flag `module.iris-efile` | Reuse P86 transmit tail; no separate TCC enrollment |
| US classification scoring | `packages/classification` (server-only) | API router (`classificationProcedure`) | Pure scoring stays server-side per profile contract |
| AB5 work-state auto-flag | API (engagement work-state field + scoring input) | DB (engagement) | AB5 governs work *performed* in CA; work-state primary, P84 residence fallback |
| Determination-letter PDF render/archive | API (`classification-document-render` pattern) | R2 (US tax-archive bucket) | Deterministic react-pdf → R2 CAS, mirrors SDS |
| 1099-K threshold tracking | `apps/cron-worker` (periodic job) | DB (`Form1099KTrackerState`) + Notification | Rolling band cron, mirrors `EconomicDependencyAlertState` |
| 1099-K / classification UI surface | Frontend (`apps/web-vite` page→container→hook→component) | tRPC client | Profile badge + classification wizard; loading/empty/error + i18n |

## Standard Stack

### Core (all in-tree — no new external deps required for the deterministic core)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-pdf/renderer` | `^4.5.1` (in `packages/api`) | Determination-letter + 1042-S recipient-copy PDF | Already the in-tree PDF stack (SDS, 1099-NEC Copy-B). [VERIFIED: packages/api/package.json] |
| `fast-xml-parser` | `^5.7.3` (in `packages/iris`) | IRIS 1042-S XML build (XMLBuilder, never string concat) | Established by P86 IRIS generator + `packages/einvoice`. [VERIFIED: packages/iris/package.json] |
| `libxmljs2` | `^0.37.0` (in `packages/iris`) | IRIS 1042-S XSD validation (`{ nonet: true }`, no XXE) | P86 validator pattern; SSRF/XXE-safe. [VERIFIED: packages/iris/package.json] |
| `@contractor-ops/classification` | workspace | US `ClassificationProfile` registers here | Registry auto-discovers; `getProfileForCountry('US')`. [VERIFIED: registry.ts] |
| `zod` | repo standard | tRPC inputs + answer schemas (`getAnswerSchemaForType`) | Boundary validation per CLAUDE.md. [VERIFIED] |

### Supporting (in-tree services to reuse, not rebuild)
| Asset | Path | Purpose |
|-------|------|---------|
| `applyTreaty` / `resolveTreatyDecision` | `packages/api/src/services/treaty-rate.service.ts` | 1042-S box-3b rate + treaty article snapshot; §875(d) → treaty-or-30% [VERIFIED] |
| `renderSdsPdfBuffer` pattern | `packages/api/src/services/classification-document-render.ts` | Determination-letter render/archive (R2 CAS, sha256, `ClassificationDocument` row) [VERIFIED] |
| `renderForm1099NecCopyB` / `form-1099-nec-pdf.ts` | `packages/api/src/services/` | 1042-S recipient-copy render/archive idiom (Pub 1179 substitute, last-4 masking) [VERIFIED] |
| `SOFTWARE_NOT_LEGAL_ADVICE_EN` | `packages/validators/src/legal/disclaimers.ts` | Determination-letter advisory footer (locked phrase; CI-guarded) [VERIFIED] |
| `writeAuditLog` | `packages/api/src/services/audit-writer.ts` | AB5 override / 1042-S generate-correct-transmit / letter-gen audit [VERIFIED] |
| `idempotency.ts` (reserve/complete/clear) | `packages/api/src/lib/` | 1042-S batch generate/transmit dedupe [VERIFIED] |
| `assertUsExpansionEnabled` / `isUsExpansionRegistered` | `packages/api/src/middleware/require-us-expansion-flag.ts` | `module.us-expansion` per-request + conditional root spread [VERIFIED] |
| `economic-dependency-scan` + cron handler | `packages/api/src/services/` + `apps/cron-worker/.../classification-economic-dependency.ts` | 1099-K tracker cron/band/notification template [VERIFIED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built IRIS 1042-S XML (fast-xml-parser) | Vendor transmitter (Sovos/1099Pro) | D-08 reuses P86's `Vendor` stub seam — fallback only if TCC never approved; not the default |
| Deterministic letter template | LLM-drafted narrative | **EXPLICITLY FORBIDDEN by D-01** — classification-verdict liability + first LLM-doc surface avoided |
| New US classification flag | Reuse `module.classification-engine` + `module.us-expansion` | See Open Question 1 — US profile sits at the intersection of two existing gates |

**Installation:** No new external packages required for the deterministic core. The IRIS 1042-S XSD is a **human-only IRS SOR download** added to `packages/iris/src/schema-bundle/` at a `checkpoint:human-verify` task, then checksum-pinned. No npm install step.

## Package Legitimacy Audit

> Phase 87's deterministic core installs **no new external packages** — it composes existing workspace packages and already-installed deps (`@react-pdf/renderer`, `fast-xml-parser`, `libxmljs2`, `zod`). slopcheck not run because there is nothing new to audit.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none — all reuse) | — | No new install; existing deps already audited in P85/P86 |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

If the planner discovers a genuine new dep is needed (none anticipated), run the Package Legitimacy Gate and gate behind `checkpoint:human-verify` per the 7-day-release-age rule (CLAUDE.md / `.npmrc` `min-release-age=7`).

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │  module.us-expansion gate (assertUsExpansion) │
                          └─────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼────────────────────────────────────┐
        │ (1) 1042-S                         │ (2) US classification              │ (3) 1099-K tracker
        ▼                                    ▼                                    ▼
 contractor W-8 on file              engagement (work-state) + contractor P84   settled USD payouts
 (P85 form routing)                  state (residence fallback)                 (payment domain)
        │                                    │                                    │
        ▼                                    ▼                                    ▼
 form-routing: W-8 → 1042-S          getProfileForCountry('US')           periodic cron (createCronLogger)
 (W-9 → 1099-NEC, P86)               buildAssessment → answers →           sum minor-amount + txn count
        │                            scoreAssessment (federal base +        per contractor per tax-year
        ▼                            CA-ABC overlay + §530 flag)                  │
 applyTreaty(residency)                      │                                    ▼
 → rate + article (§875(d):                  ▼                            band transition SAFE→APPROACHING→OVER
   W-8 chain complete? treaty : 30%) ClassificationAssessment (US)         vs Tax1099KThreshold config ($20k+200)
        │                            outcome JSON (frozen snapshot)               │
        ▼                                    │                                    ▼
 Form1042S immutable snapshot                ▼                            up-crossing → proactive notification
 (box 1 income code, box 2 gross,    renderAndArchive →                   (Notification table, dedup)
  box 3a/3b ch3 exempt+rate,         US_DETERMINATION_LETTER PDF                  │
  box 4a/4b ch4, box 7 withheld,     (verdict, factor reasoning, AB5/§530         ▼
  recipient 13j/13k status codes,     flags, citations, SOFTWARE_NOT_LEGAL...)    contractor-profile badge
  13n LOB, treaty article)           → R2 CAS + ClassificationDocument row        (informational ONLY)
        │
        ▼
 buildIris1042SXml() → xsdValidate (1042-S XSD)  ──→  TaxFilingTransmitter seam
        │                                              ├─ ManualDownload (default, no TCC)
        ▼                                              ├─ IrisA2A (dark, module.iris-efile)
 recipient-copy PDF (consent-gated, last-4)           └─ Vendor (stub)
 → R2 archive                                                   │
                                                                ▼
                                                    single ack parser (6 IrisAckStatus) → IrisAck row + audit
```

### Recommended Project Structure (new/extended files — planner refines)
```
packages/db/prisma/schema/
├── tax.prisma                    # + Form1042S model; + Form1099KTrackerState model; + Tax1099KThreshold config
└── classification.prisma         # + US_DETERMINATION_LETTER to ClassificationDocumentKind enum

packages/classification/src/
├── types/outcome.ts              # + US outcome shape (discriminated union 'US_CLASSIFICATION')
├── profiles/us/
│   ├── rule-set.ts               # federal factors + CA-ABC prongs + §530 conditions, citations, i18n prompts
│   ├── scoring.ts                # base economic-realities/common-law + AB5 ABC overlay + §530 relief flag
│   └── index.ts                  # UsClassificationProfile implements ClassificationProfile; registerProfile()

packages/api/src/
├── services/
│   ├── form-1042s.service.ts     # box aggregation + immutable supersede + idempotency (mirror form-1099-nec.service)
│   ├── form-1042s-pdf.ts         # recipient-copy render/archive (mirror form-1099-nec-pdf)
│   ├── classification-document-render.ts  # + renderDeterminationLetterPdfBuffer (mirror renderSdsPdfBuffer)
│   └── form-1099k-tracker.service.ts       # band scan (mirror economic-dependency-scan)
├── pdf-templates/
│   ├── form-1042s-recipient-copy.tsx       # substitute recipient copy (mirror form-1099-nec-copy-b)
│   └── us-determination-letter.tsx         # verdict-first, factor evidence (mirror ir35-sds.tsx)
└── routers/...                   # US classification wiring (compliance routers are multi-country already)

packages/iris/src/
├── generator.ts                  # + buildIris1042SXml (parameterize form-type OR sibling builder)
├── validator.ts                  # validate against 1042-S XSD
└── schema-bundle/                # + 1042-S XSD (human-only IRS SOR download + checksum pin)

apps/cron-worker/src/jobs/
├── handlers/form-1099k-tracker.ts # periodic band scan handler
└── registry.ts                    # + register the tracker job
```

### Pattern 1: Pluggable country ClassificationProfile (mirror IR35/Schein)
**What:** A US profile implements the `ClassificationProfile` contract (`profileId`, `country='US'`, `displayName`, `ruleSetVersion`, `buildAssessment`, `scoreAssessment` (pure, server-only), `renderOutcome`) and self-registers via `registerProfile(new UsClassificationProfile())` on import side-effect. `getProfileForCountry('US')` resolves it. Routers (`classification-shared.ts`, draft/read/submit/document) are already multi-country — no router change beyond US wiring.
**When to use:** US-CLASS-01 / US-CLASS-02.
**Example contract** (verified):
```typescript
// Source: packages/classification/src/types/profile.ts [VERIFIED]
export interface ClassificationProfile {
  readonly profileId: string;
  readonly country: string;           // 'US'
  readonly displayName: string;
  readonly ruleSetVersion: string;    // frozen on submit (snapshot)
  buildAssessment(engagementId: string): AssessmentShell;
  scoreAssessment(answers: AnswerMap): Outcome;   // pure, server-only
  renderOutcome(assessment: Assessment): OutcomeView;
}
```

### Pattern 2: Composite scoring with dispositive-first ordering (mirror IR35 scoring)
**What:** IR35 scoring runs **dispositive rules first** (substitution/MOO strong-inside → inside), then a composite count. The US profile should mirror this: base federal common-law/economic-realities weighted assessment → **CA-ABC overlay defaults the outcome to employee unless all three prongs pass when work-state=CA** (stricter, dispositive overlay) → **§530 surfaced as a relief-eligibility flag** on the result (not a verdict change). Reasoning string MUST cite the triggering rule verbatim for audit defence.
**Example:**
```typescript
// Source: packages/classification/src/profiles/ir35/scoring.ts [VERIFIED — order load-bearing]
if (subVerdict === 'strong-inside' || mooVerdict === 'strong-inside') { overall = 'inside'; /* dispositive */ }
else if (subVerdict === 'strong-outside') { overall = 'outside'; }
else { /* composite count of leaning signals */ }
```

### Pattern 3: Treaty rate/article snapshot with §875(d) gating (reuse applyTreaty)
**What:** `applyTreaty({ contractorResidency, asOf, override })` returns `{ rate, article, source: 'treaty'|'override'|'statutory_30', autoRate, autoArticle, auditRequired }`. Statutory default = **30%**; treaty rate only when a non-XX `WithholdingTaxRate` row carries a treatyRate. **§875(d) / W-8-chain-complete gating** in P87 means: only apply the treaty rate when the contractor's W-8 chain is complete (valid W-8 on file); otherwise 30%. Snapshot rate + article onto `Form1042S` (box 3b + the treaty-article field). Override → `writeAuditLog`.
**Example:**
```typescript
// Source: packages/api/src/services/treaty-rate.service.ts [VERIFIED]
const STATUTORY_RATE = 30;
const US_INCOME_TYPE = 'business_profits';
// hasTreatyRow = row !== null && row.treatyRate !== null && row.contractorResidency !== 'XX'
```

### Pattern 4: Immutable + supersede compliance record (mirror Form1099Nec)
**What:** `Form1042S` is append-only record-of-record. A CORRECTED form inserts a new ACTIVE row and flips the prior to SUPERSEDED inside one `$transaction`. Snapshot keeps **TIN/FTIN last-4 only** — never full value in snapshot/PDF/log. Tenant-owning (never `globalModels`); cross-org leak test per model.
```prisma
// Mirror: packages/db/prisma/schema/tax.prisma Form1099Nec [VERIFIED]
enum Form1042SStatus { DRAFT ACTIVE SUPERSEDED }
// Form1042S { box1IncomeCode, box2GrossIncomeMinor, box3aChap3ExemptionCode,
//   box3bChap3RateBp, box4aChap4ExemptionCode, box4bChap4RateBp,
//   box7FederalTaxWithheldMinor, recipientChap3StatusCode, recipientChap4StatusCode,
//   recipientLobCode, treatyArticle, snapshotJson (last-4 only), supersededById, deletedAt }
```

### Pattern 5: Deterministic recipient-copy PDF, consent-gated (reuse P86 idiom)
**What:** Recipient copy is a substitute black-ink react-pdf (Pub 1179 §4.6 idiom), rendered from the **stored immutable snapshot** ("values as filed", never live recompute), TIN/FTIN masked to last-4, archived to the US R2 tax bucket. Delivery is **portal-download gated on affirmative IRS e-delivery consent**; no consent / no portal seat → flag for paper/manual (covers foreign W-8 recipients without a portal seat). IRS-side reporting goes via IRIS XML, never a rendered PDF.

### Pattern 6: Rolling band-state cron (mirror EconomicDependencyAlertState)
**What:** A per-contractor-per-tax-year `Form1099KTrackerState` row written exclusively by a periodic cron (`createCronLogger`). The cron sums cumulative payout minor-amount + transaction count for the tax year, transitions bands (SAFE → APPROACHING → OVER) vs a **tax-year-keyed config** ($20,000 + 200 transactions), fires a proactive notification on up-crossing with same-band re-fire suppressed (lastReminderAt). **Informational only — never files a 1099-K** (the platform is not the TPSO/settlement entity).
```typescript
// Source pattern: classification-economic-dependency.ts handler [VERIFIED]
// flag short-circuit → runScan → band transition → notification (dedup via lastReminderAt)
```

### Anti-Patterns to Avoid
- **Adding an LLM to the determination letter.** D-01 forbids it. An LLM asserting a worker classification is exactly the verdict-liability the product avoids.
- **Building payout deduction.** 1042-S is REPORTED-only (box 7 records withheld; the actual treaty/24%/30% payout reduction is Phase 88). Do not mutate payouts.
- **Hardcoding the $20,000/200 or treaty rates as constants.** Use tax-year-keyed config tables (mirror `Tax1099Threshold` / `WithholdingTaxRate`). The stale `$5K/$600` in the backlog is WRONG (OBBBA reverted it).
- **String-concatenated IRIS XML.** Use `fast-xml-parser` XMLBuilder (entity-escape bugs surface as opaque XSD failures). Validate `{ nonet: true }` (no SSRF/XXE).
- **Full SSN/TIN/FTIN in snapshot, PDF, or log.** Last-4 only; full value behind `CONTRACTOR_PII:READ` reveal only, staff-router only.
- **Treating the DOL 2024 economic-reality rule as settled law.** It is enjoined / not currently enforced (see Pitfall 3). Tag adviser-verify.
- **Presenting the US classification as a final legal verdict.** Advisory only (D-05); inherits `SOFTWARE_NOT_LEGAL_ADVICE_EN`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Treaty rate/article + 30% default | New US 1042-S rate engine | `applyTreaty` (P85) | One treaty engine; §875(d) gating + override+reason+audit already done |
| Classification engine/routers | New US engine fork | `ClassificationProfile` + registry | Routers multi-country; add a profile, don't fork |
| PDF render → R2 CAS archive | New PDF/archive pipeline | `classification-document-render.ts` + `form-1099-nec-pdf.ts` | sha256 CAS, content-disposition, append-only doc row, lazy react-pdf import |
| IRIS XML build + XSD validate | New XML/validator stack | `packages/iris` (P86) | XMLBuilder + libxmljs2 `{nonet:true}` + CI checksum-pin already established |
| IRIS transmit (manual/A2A/vendor) | New transmit pipeline | `TaxFilingTransmitter` seam (P86) | Same form-type-parameterized transmit tail; no separate TCC |
| Band-state cron + notification | New tracker cron | `economic-dependency-scan` pattern | Band transitions, dedup, notification, flag short-circuit done |
| Batch dedupe | Custom dedup | `idempotency.ts` reserve/complete/clear | Prevents double-file on retry storms |
| Sensitive-action trail | Custom audit | `writeAuditLog` | Tenant + actor + tx-aware |
| US-surface gating | New flag plumbing | `assertUsExpansionEnabled` + `isUsExpansionRegistered` | Per-request + conditional root spread done |

**Key insight:** Phase 87 is ~90% wiring of shipped engines. The genuinely new work is (a) authoring the US classification rule set faithfully, (b) the `Form1042S` box mapping + IRIS 1042-S XSD/payload (a distinct IRS schema from the 1099 series), and (c) the two new PDF templates. Everything else is a parameterization of P85/P86/v5.0 code.

## Common Pitfalls

### Pitfall 1: Assuming the IRIS 1099 schema bundle covers 1042-S
**What goes wrong:** Planner assumes 1042-S e-files through the exact same XSD as the P86 1099-NEC payload.
**Why it happens:** D-08 says "reuse the P86 IRIS pipeline," which is true for the *transmit tail*, but 1042-S has a **separate IRS schema and record layout** governed by **Publication 1187** (1042-S electronic filing spec), distinct from the 1099-series spec. The in-tree `packages/iris/src/schema-bundle/source.txt` explicitly documents the bundled TY2025 package as "**1099-NEC payload XSD + Transmission Manifest XSD**" — 1042-S XSD is NOT in it. [VERIFIED: source.txt]
**How to avoid:** Plan a `checkpoint:human-verify` task to download the **1042-S IRIS XSD** from the IRS SOR (human-only login), add it to `schema-bundle/`, and re-pin `checksums.txt`. The `buildIris1042SXml` generator + validator target this 1042-S XSD, not the 1099 XSD. Re-verify the TY2026 schema when it posts (~Nov 2026).
**Warning signs:** A plan that says "validate 1042-S against the existing 1099 XSD"; a checksums.txt with no 1042-S entry.

### Pitfall 2: P86 transmitter seam + ack parser not yet on disk
**What goes wrong:** Phase 87 plans reference `tax-filing-transmitter.ts` / `iris-ack-parser` as existing, but they are **not on disk** (STATE.md: P86 at 86-05 done; the IRIS generator/transmitter/ack-parser are Wave-0 RED scaffolds — `packages/iris/src/__tests__/generator.test.ts` imports a `buildIrisXml` that "does not exist yet"). [VERIFIED via filesystem]
**Why it happens:** CONTEXT.md was written assuming P86 completes first; P86 is parallel/in-flight.
**How to avoid:** Either (a) declare an explicit cross-phase dependency that P86's transmitter seam + ack parser + IRIS generator land GREEN before P87's 1042-S transmit wave, or (b) scope P87 so the 1042-S generator/transmitter is authored alongside (parameterizing form-type), accepting it builds the seam if P86 hasn't. The 1042-S **deterministic core** (model, box mapping, PDF, classification) does NOT depend on the transmitter and can proceed regardless.
**Warning signs:** Plan tasks that import from a non-existent `tax-filing-transmitter.ts` without a guard or dependency note.

### Pitfall 3: Treating DOL 2024 economic-reality rule as the live federal standard
**What goes wrong:** Authoring the federal rule set strictly to the DOL 2024 six-factor final rule.
**Why it happens:** It's the most recent published rule (effective 2024-03-11). But it **is being challenged in federal court, and DOL investigators are directed not to apply it in current enforcement** [CITED: dol.gov]. Meanwhile the **IRS** common-law test (three categories: behavioral control, financial control, relationship of parties — the modernization of the 20-factor test) governs federal *tax* classification, which is the product's domain (1099/1042-S). [CITED: irs.gov tc762 / SS-8].
**How to avoid:** Base the federal layer on the **IRS common-law three-category test** (behavioral / financial / relationship) — the tax-classification standard — and treat DOL economic-realities as a *secondary signal* clearly flagged adviser-verify and "subject to active rulemaking." Do not present either as settled. Tag the whole federal layer adviser-verify.
**Warning signs:** A rule set that cites only the DOL 2024 rule; no IRS common-law factors; no "rule in flux" annotation.

### Pitfall 4: AB5 keyed to residence instead of work-state
**What goes wrong:** Auto-flagging AB5 on the contractor's residence state.
**Why it happens:** Residence is the obvious field. But **AB5 governs work performed in CA**, not residence (D-04). Labor Code 2775 presumes employee status for "a person providing labor or services" under CA wage orders/Labor Code.
**How to avoid:** Add an engagement **work-state** field as the **primary** AB5 trigger; fall back to the contractor's P84 US state only when work-state is unset. Override is audit-logged (`writeAuditLog`).
**Warning signs:** AB5 flag reads `contractor.usState` directly with no engagement work-state.

### Pitfall 5: AB5 exemption-list drift / B2B 12-criteria oversimplification
**What goes wrong:** Hardcoding a short list of AB5 exemptions, or modeling the B2B exemption as a single checkbox.
**Why it happens:** The professional-services + B2B exemptions are extensive. The **B2B exemption (Labor Code 2776) requires 12 separate criteria**, all met in practice, not on paper [CITED]; AB 2257 (2020) refined exemptions and moved the test to Labor Code 2775–2785. The exemption list drifts.
**How to avoid:** Model the ABC test as the default; surface §2776 B2B and professional-services exemptions as **flags requiring adviser confirmation**, not auto-determinations. Tag the exemption list adviser-verify + "AB 2257 / Labor Code 2775–2785 as of 2026, re-verify." Don't auto-clear an engagement through an exemption.
**Warning signs:** A single `ab5Exempt` boolean; auto-determination that an engagement is exempt.

### Pitfall 6: 1042-S vs 1099-NEC mis-routing
**What goes wrong:** A foreign contractor gets a 1099-NEC, or a US person gets a 1042-S.
**Why it happens:** Routing must derive from the **form on file** (P85), not nationality guesses.
**How to avoid:** Derive from the contractor's active `TaxFormSubmission`: **W-8BEN/W-8BEN-E → 1042-S**; **W-9 → 1099-NEC** (P86). Mirror `tax-form-routing.ts` (P85). A contractor with no valid W-form and US-source income → 30% statutory 1042-S path + escalation, never silent skip.
**Warning signs:** Routing on `contractor.countryCode` alone; no read of `TaxFormSubmission.formType`.

### Pitfall 7: `getAnswerSchemaForType` exhaustiveness
**What goes wrong:** Adding a new `AnswerType` for §530/AB5-specific inputs breaks the exhaustive `never` switch in `answers.ts`.
**Why it happens:** `getAnswerSchemaForType` switches on the `AnswerType` union with a `const exhaustive: never` guard. [VERIFIED]
**How to avoid:** Prefer reusing existing answer types (`yes-no`, `score-0-3`, `likert-5`, `rationale`) for the US rule set. If a new type is genuinely needed, update the `AnswerType` union + the switch + the Zod schema together.

## Runtime State Inventory

> Greenfield-within-existing-engine: new models + new profile + new cron, no rename/migration of existing runtime state. The categories below are checked for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New rows only (`Form1042S`, US `ClassificationAssessment`, `ClassificationDocument` US_DETERMINATION_LETTER kind, `Form1099KTrackerState`). No existing data re-keyed. | Forward migration adds models/enum value; zero data migration |
| Live service config | IRIS A2A transmit reuses the **existing `module.iris-efile` PENDING flag** (FOUND7-02) — no new flag minted for 1042-S transmit. US surface reuses `module.us-expansion`. Classification reuses `module.classification-engine`. | Confirm no new flag needed (Open Q1); register any new PENDING gate in signoff registry if planner adds one |
| OS-registered state | New cron job (`form-1099k-tracker`) registered in `apps/cron-worker/.../registry.ts` + a `CRON_*_SCHEDULE` env var. | Register job + add env to `.env.example` + cron-worker env schema |
| Secrets/env vars | No new secrets. IRS TCC for live A2A reuses the P86 TCC (D-08 — no separate 1042-S enrollment). Classification needs no external enrollment. | New `CRON_FORM_1099K_TRACKER_SCHEDULE` env only |
| Build artifacts | New `packages/iris/src/schema-bundle/*.xsd` (1042-S) — checksum-pinned; CI checksum guard must include it. | Human-download + `verify:schema-checksums --write` re-pin at checkpoint |

**Nothing found requiring data migration of existing records.** New enum value `US_DETERMINATION_LETTER` on `ClassificationDocumentKind` is additive (Prisma migration, non-breaking).

## Code Examples

### US ClassificationProfile registration (mirror IR35Profile)
```typescript
// Source pattern: packages/classification/src/profiles/ir35/index.ts [VERIFIED]
export class UsClassificationProfile implements ClassificationProfile {
  readonly profileId = 'us-classification' as const;
  readonly country = 'US' as const;
  readonly displayName = 'US Worker Classification (federal + CA AB5 + §530)';
  readonly ruleSetVersion = US_RULE_SET_VERSION; // e.g. 'US-2026-COMMONLAW-AB5'
  buildAssessment(_engagementId: string): AssessmentShell {
    return { ruleSetVersion: this.ruleSetVersion, profileId: this.profileId, questions: US_QUESTIONS };
  }
  scoreAssessment(answers: AnswerMap): Outcome { return scoreUsClassification(answers).outcome; }
  renderOutcome(assessment: Assessment): OutcomeView { /* ... */ }
}
registerProfile(new UsClassificationProfile()); // side-effect on import
```

### Determination-letter render (mirror renderSdsPdfBuffer)
```typescript
// Source pattern: packages/api/src/services/classification-document-render.ts [VERIFIED]
// 1. findFirstOrThrow assessment (org-scoped) — guard status==='COMPLETED' && questionsSnapshot
// 2. guard outcome.kind === 'US_CLASSIFICATION'
// 3. const { renderToBuffer } = await import('@react-pdf/renderer');  // lazy
// 4. buffer = await renderToBuffer(UsDeterminationLetterDocument({ assessment, engagement, contractor, organization, renderedAt }));
// 5. sha256 → buildClassificationDocumentKey({ kind:'US_DETERMINATION_LETTER', ... }) → ClassificationDocument row (append-only)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FIRE for 1042-S e-file | **IRIS only** (FIRE retired filing season 2027; IRIS available Jan 1, 2026; mandatory for TY2026 1042-S due Mar 15, 2027) | OBBBA / IRS 2025-26 | 1042-S transmits through the same IRIS A2A tail as 1099; no FIRE code [CITED: irs.gov p1187] |
| 1099-K $600 threshold (ARPA) | **$20,000 + 200 transactions** (OBBBA reverted to pre-ARPA) | OBBBA 2025; IRS FS-2025-08 (Oct 2025) | Tracker config = $20k+200, tax-year-keyed [CITED: irs.gov 1099-K FAQ] |
| 1099-NEC $600 | $2,000 (TY2026, OBBBA) | OBBBA | P86 config table; not P87 but confirms the no-constant pattern |
| `@react-pdf/renderer` 3.x | **4.5.1** (in `packages/api`) | — | The 3.4.5 string in `classification-document-render.ts` is a stale **constant label**, not the actual dep; the real dep is v4. Plan tasks must not assume v3 API. [VERIFIED] |
| DOL 2021 IC rule | DOL 2024 economic-reality rule — **but enjoined / not enforced** | 2024-03; litigation ongoing | Federal layer = IRS common-law (tax), DOL = secondary adviser-verify signal [CITED: dol.gov] |

**Deprecated/outdated:**
- FIRE system: documentation-only legacy fallback; no code (D-08).
- Backlog `$5K/$600` 1099-K threshold: STALE — use `$20,000 + 200` (REQUIREMENTS.md line 20).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 1042-S income code for independent personal services compensation is **16** (and dependent personal services 17; "other income" 23/50) | 1042-S box mapping | MEDIUM — wrong income code rejects at IRIS; **execution-time verify against i1042s Appendix B/C** before coding the box map |
| A2 | Chapter 3 status code "individual" vs "corporation" + treaty exemption code (treaty-benefit) map to specific 2-digit codes | 1042-S box 13j/13k, 3a | MEDIUM — verify exact codes in i1042s Appendix B at coding time; codes are stable but exact values not re-confirmed this session |
| A3 | The federal rule set should lead with the **IRS common-law three-category test** (not DOL) | Classification rule set | LOW-MEDIUM — both cited; adviser-verify flag covers residual risk |
| A4 | AB5 B2B exemption = 12 criteria (Labor Code 2776); professional-services exemption list per AB 2257 | AB5 overlay | MEDIUM — exemption list drifts; modeled as adviser-confirm flags, not auto-determination, which de-risks |
| A5 | §530 three conditions (reporting consistency, substantive consistency, reasonable basis) are surfaced as a **relief flag**, not a verdict | §530 layer | LOW — well-documented; flag-only posture de-risks |
| A6 | 1042-S IRIS XSD is a separate schema under Pub 1187, distinct from the in-tree 1099 XSD bundle | IRIS payload | HIGH that it's separate (source.txt confirms 1099-only bundle); exact XSD element names unknown — **execution-time verify after human SOR download** |
| A7 | P86 transmitter seam + ack parser + IRIS generator land GREEN before P87's 1042-S transmit wave | Dependency | MEDIUM — P86 in-flight; planner must declare dependency or build the seam |

## Open Questions

1. **Which feature flag(s) gate the US classification surface?**
   - What we know: Existing classification routers use `classificationProcedure` (= `module.classification-engine`). The US cross-border surface uses `module.us-expansion` (`assertUsExpansionEnabled`). [VERIFIED both]
   - What's unclear: A US `ClassificationProfile` sits at the intersection — is it gated by `module.classification-engine` (as a classification feature), `module.us-expansion` (as a US feature), or both?
   - Recommendation: Gate the US classification routers behind **both** — `classificationProcedure` (engine on) AND `assertUsExpansionEnabled` (US surface on), defense-in-depth. Planner to confirm; no new flag (avoid flag sprawl, consistent with P86's no-new-`iris-a2a-transmit` decision).

2. **Parameterize the P86 IRIS XML builder for 1042-S, or sibling builder?**
   - What we know: D-08 (Claude's Discretion) leaves this to the planner "after the P86 builder lands." The P86 `buildIrisXml` is a Wave-0 scaffold (not GREEN yet).
   - Recommendation: Sibling `buildIris1042SXml` in `packages/iris` (1042-S record layout differs materially — chapter 3/4 status codes, income codes, treaty fields). Share the Transmission Manifest helper; separate B-record builder. Decide once P86's generator is GREEN.

3. **Exact 1042-S box → `Form1042S` column mapping.**
   - What we know: box 1 income code, box 2 gross income, box 3a/3b (ch3 exemption + rate), box 4a/4b (ch4 exemption + rate), box 7 federal tax withheld, box 10 total withholding credit, recipient 13j (ch3 status) / 13k (ch4 status) / 13n (LOB code), withholding-agent 12a–12m. [CITED: i1042s]
   - What's unclear: exact income-code numbers (A1) and status-code values (A2) — execution-time verify.
   - Recommendation: Model rate columns as basis-points or Decimal(5,2) consistent with `WithholdingTaxRate.treatyRate`; store income/status/exemption/LOB codes as short strings; box amounts in minor units (USD cents) like `Form1099Nec`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-pdf/renderer` | Determination letter + 1042-S recipient PDF | ✓ | ^4.5.1 (packages/api) | — |
| `fast-xml-parser` | IRIS 1042-S XML build | ✓ | ^5.7.3 (packages/iris) | — |
| `libxmljs2` | IRIS 1042-S XSD validate | ✓ | ^0.37.0 (packages/iris) | — |
| IRIS 1042-S XSD | XSD validation of 1042-S payload | ✗ | — | **Human-only IRS SOR download** at `checkpoint:human-verify`; generator/validator buildable against it once placed |
| P86 `TaxFilingTransmitter` seam + ack parser | 1042-S transmit | ✗ (Wave-0 scaffold) | — | Declare cross-phase dependency, or build the seam in P87 |
| IRS IRIS TCC | Live A2A transmit (dark) | n/a | — | ManualDownload default (no TCC needed); A2A dark behind `module.iris-efile` |
| Prisma | New models/migration | ✓ | 7 (prisma-client) | — |

**Missing dependencies with no fallback:** none that block the deterministic core.
**Missing dependencies with fallback:**
- IRIS 1042-S XSD → human download + checksum pin (gated `checkpoint:human-verify`); does not block model/PDF/classification work.
- P86 transmitter/ack-parser → build-in-P87 or cross-phase dependency; does not block deterministic core.

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (turbo-orchestrated) |
| Config file | per-package `vitest.config.ts` (e.g. `packages/iris/vitest.config.ts`, `packages/classification/*`, `packages/api/*`) |
| Quick run command | `pnpm --filter @contractor-ops/classification test <path>` (scope to file; never unscoped web-vite) |
| Full suite command | `pnpm test` (turbo → vitest) — but **scope to touched packages** per MEMORY (full web-vite run kills RAM) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| US-FORM-06 | 1042-S box aggregation + immutable supersede + idempotency | unit | `pnpm --filter @contractor-ops/api test form-1042s.service` | ❌ Wave 0 |
| US-FORM-06 | §875(d) gate: W-8 complete → treaty rate; else 30% | unit | `pnpm --filter @contractor-ops/api test form-1042s.service` (treaty-gate cases) | ❌ Wave 0 |
| US-FORM-06 | IRIS 1042-S XML builds + validates against 1042-S XSD | unit | `pnpm --filter @contractor-ops/iris test generator` / `validator` | ⚠ generator test exists as 1099 RED scaffold; add 1042-S |
| US-FORM-06 | recipient-copy PDF renders from snapshot, last-4 masked, consent-gated | unit | `pnpm --filter @contractor-ops/api test form-1042s-pdf` | ❌ Wave 0 |
| US-CLASS-01 | US profile scores federal + ABC overlay + §530 flag deterministically | unit | `pnpm --filter @contractor-ops/classification test profiles/us` | ❌ Wave 0 |
| US-CLASS-02 | AB5 auto-flags on work-state=CA; P84-state fallback; override audit-logged | unit + integration | `pnpm --filter @contractor-ops/classification test profiles/us` + `pnpm --filter @contractor-ops/api test classification` | ❌ Wave 0 |
| US-CLASS-03 | 1099-K band cron transitions vs $20k+200 config; notification dedup; never files | unit | `pnpm --filter @contractor-ops/api test form-1099k-tracker.service` | ❌ Wave 0 |
| US-CLASS-04 | Determination letter renders verdict + factor reasoning + AB5/§530 flags + citations + disclaimer | unit (byte-stable) | `pnpm --filter @contractor-ops/api test classification-document-render` (US letter case) | ❌ Wave 0 |
| cross | Form1042S / Form1099KTrackerState cross-org leak (tenant isolation) | integration | per-model leak test (repo convention) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** scoped `pnpm --filter <pkg> test <path>` for the touched package.
- **Per wave merge:** `pnpm --filter @contractor-ops/classification test && pnpm --filter @contractor-ops/api test <touched> && pnpm --filter @contractor-ops/iris test` + `pnpm typecheck --filter=@contractor-ops/api`.
- **Phase gate:** touched-package suites green + `pnpm typecheck` (tsc) + `pnpm check:wiki-brain` before `/gsd:verify-work`. **Never** run the full unscoped web-vite suite (RAM).

### Wave 0 Gaps
- [ ] `packages/classification/src/profiles/us/__tests__/rule-set.test.ts` + `scoring.test.ts` — US-CLASS-01/02
- [ ] `packages/api/src/services/__tests__/form-1042s.service.test.ts` — US-FORM-06 (box agg, treaty gate, supersede, idempotency)
- [ ] `packages/api/src/services/__tests__/form-1042s-pdf.test.ts` — recipient copy (last-4, consent gate)
- [ ] `packages/api/src/pdf-templates/__tests__/us-determination-letter.test.tsx` — byte-stable letter render
- [ ] `packages/api/src/services/__tests__/form-1099k-tracker.service.test.ts` — band transitions + never-file invariant
- [ ] `packages/iris/src/__tests__/generator-1042s.test.ts` + `validator-1042s.test.ts` — depends on 1042-S XSD placed (RED until XSD lands)
- [ ] Per-model cross-org leak tests for `Form1042S` + `Form1099KTrackerState`

## Security Domain

> `security_enforcement` absent in config → treated as enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session; tenant from session (`organizationId`, region) never client input |
| V3 Session Management | yes (portal recipient PDF download) | existing portal magic-link/session; consent-gated download |
| V4 Access Control | **yes (critical)** | RLS + org-scoped queries; `CONTRACTOR_PII:READ` for full TIN/FTIN reveal (staff-router only); per-model cross-org leak test; tenant-owning models never in `globalModels` |
| V5 Input Validation | yes | Zod on every tRPC procedure + classification answer schemas (`getAnswerSchemaForType`); `.strict()` DTOs; no unsafe `as` on snapshots |
| V6 Cryptography | yes | TIN/FTIN encrypted-at-rest + last-4 only in snapshot/PDF/log (reuse P84 SSN handling); sha256 CAS for PDFs; never hand-roll |
| V13 API / Web Service | yes | flag-gated routers (`module.us-expansion` + `module.classification-engine`); FORBIDDEN on flag-off |
| V14 Configuration | yes | IRIS XSD checksum-pinned (supply-chain); `{nonet:true}` (no SSRF), `noent:false` (no XXE) at validation |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Full TIN/FTIN leak into snapshot/PDF/log | Information Disclosure | last-4 only; encrypted column + `CONTRACTOR_PII:READ` reveal; snapshot sanitizer strips forged full-id keys (P86 pattern) |
| Cross-org read of `Form1042S` / tracker state | Elevation / Info Disclosure | org-scoped `findFirst` + RLS; per-model leak test; tenant-owning model |
| Tampered IRIS 1042-S XSD silently changes "valid" | Tampering | SHA-256 checksum-pin in `schema-bundle/checksums.txt`; CI guard fails on mismatch/missing/unlisted |
| XXE / SSRF via XSD `<xs:import schemaLocation>` | Info Disclosure / SSRF | `libxmljs2 { nonet: true }`, self-contained bundle, `noent:false` (P86 pattern) |
| Mass-assignment of `organizationId`/box amounts via client | Tampering | `.strict()` Zod DTOs; tenant from session; box figures computed server-side from settled payments, never client-supplied |
| Double-file 1042-S batch on retry | Tampering / Repudiation | `idempotency.ts` reserve/complete/clear; compare-and-swap on PDF archive slot (P86 pattern) |
| Unaudited AB5 override / classification change | Repudiation | `writeAuditLog` on override (+ reason), generate, correct, transmit, letter-gen |
| Presenting advisory output as legal verdict | (compliance/liability) | `SOFTWARE_NOT_LEGAL_ADVICE_EN` footer; adviser-verify annotations; never "final determination" |

## Project Constraints (from CLAUDE.md)
- pnpm 10 + Turborepo; `pnpm typecheck` (tsc) CI-canonical (never tsgo in CI).
- tRPC v11 Zod on every procedure; tenant from session; `writeAuditLog` on sensitive mutations.
- No `console.*` in app source — `@contractor-ops/logger` / `createCronLogger`.
- `semble search` before grep; **MUST Read before Edit** on existing files; Edit > Write; minimal diff; no sed/bulk-replace.
- 7-day release age (`.npmrc min-release-age=7`); no `@latest`; typosquat check; `pnpm audit` + `pnpm security:scan` after dep changes (none expected here).
- **No breadcrumb IDs in source comments** (no `Phase 87`, `US-CLASS-02`, `D-04`, `Pitfall 5`) — real domain IDs OK (`1042-S`, `AB5`, `§530`, `W-8BEN`, `§875(d)`, `1099-K`). Traceability → commit + `.planning/`.
- **Documentation follows code (GATED):** new models → `wiki/structure/prisma-schema-areas.md`; new procedures → `api-routers-catalog.md`; new cron → `cron-jobs.md`; 1042-S integration → `wiki/integrations/`; classification + us-tax-forms domain pages; `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` for new invariants; bump `source_commit` on touched wiki frontmatter; `pnpm check:wiki-brain` before done. `.planning/phases` is a symlink — orchestrator commits via `.planning/milestones/`.
- Local-only / legal-deferred: ship working code with adviser-verify annotations; do NOT hard-block on tax-adviser sign-off.
- Feature flags via `@contractor-ops/feature-flags` only; flag keys in registry then Unleash UI.
- UI: `frontend-design` (+ impeccable on web-vite) before UI edits; loading/empty/error + WCAG; i18n parity en/en-US/de/pl/ar(RTL), no hardcoded strings.

## Sources

### Primary (HIGH confidence)
- In-tree (filesystem-verified): `packages/classification/src/{types/profile.ts,registry.ts,types/rule-set.ts,types/outcome.ts,profiles/ir35/{rule-set.ts,scoring.ts,index.ts},schemas/answers.ts,index.ts}`; `packages/db/prisma/schema/{tax.prisma,classification.prisma}`; `packages/api/src/services/{treaty-rate.service.ts,classification-document-render.ts,form-1099-nec.service.ts,form-1099-nec-pdf.ts}`; `packages/api/src/pdf-templates/{ir35-sds.tsx,form-1099-nec-copy-b.tsx}`; `packages/api/src/middleware/{require-us-expansion-flag.ts,require-classification-flag.ts}`; `packages/api/src/root.ts`; `packages/iris/{package.json,src/schema-bundle/{source.txt,README.md},src/__tests__/generator.test.ts}`; `packages/validators/src/legal/disclaimers.ts`; `apps/cron-worker/src/jobs/{registry.ts,handlers/classification-economic-dependency.ts}`; `packages/api/package.json` (`@react-pdf/renderer ^4.5.1`).
- IRS — Instructions for Form 1042-S (2026): https://www.irs.gov/instructions/i1042s (box structure, chapter 3/4 codes, exemption codes, 30% default)
- IRS — Publication 1187 (1042-S e-file spec): https://www.irs.gov/pub/irs-pdf/p1187.pdf ; FIRE→IRIS transition: https://www.irs.gov/individuals/international-taxpayers/information-reporting-for-form-1042-s
- IRS — 1099-K threshold under OBBBA ($20,000 + 200): https://www.irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000
- IRS — worker classification common-law (behavioral/financial/relationship): https://www.irs.gov/taxtopics/tc762 ; SS-8: https://www.irs.gov/businesses/ss-8-determinations-of-worker-classification

### Secondary (MEDIUM confidence)
- CA AB5 ABC test + Labor Code 2775–2785 + B2B (2776, 12 criteria) + professional-services exemption: https://www.ftb.ca.gov/file/business/industries/worker-classification-and-ab-5-faq.html ; https://www.dir.ca.gov/dlse/faq_independentcontractor.htm
- §530 Revenue Act 1978 three conditions: https://www.irs.gov/government-entities/worker-reclassification-section-530-relief
- DOL 2024 economic-reality rule (enjoined / not enforced): https://www.dol.gov/agencies/whd/flsa/misclassification/rulemaking ; enforcement guidance: https://www.dol.gov/newsroom/releases/whd/whd20250501

### Tertiary (LOW confidence — execution-time verify)
- Exact 1042-S income-code numbers (A1) and chapter 3/4 status-code values (A2) — verify in i1042s Appendix B/C at coding time.
- Exact IRIS 1042-S XSD element names — verify after human IRS SOR download.

## Metadata

**Confidence breakdown:**
- Standard stack / in-tree reuse: HIGH — every asset filesystem-verified.
- 1042-S box structure: HIGH (CITED i1042s) for box layout; MEDIUM for exact income/status code numbers (execution-time verify).
- IRIS 1042-S payload: MEDIUM — separate-schema fact HIGH (source.txt); exact XSD elements unknown until SOR download.
- Classification legal criteria: MEDIUM — well-sourced but jurisdiction-sensitive and partly in-flux (DOL rule enjoined); adviser-verify flags throughout.
- 1099-K threshold + IRIS/FIRE transition: HIGH (CITED irs.gov).
- Pitfalls / architecture: HIGH — derived from verified in-tree patterns + STATE.md.

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (30 days). Re-verify TY2026 IRIS schema (~Nov 2026), AB5 exemption list, and DOL rule status before production.
