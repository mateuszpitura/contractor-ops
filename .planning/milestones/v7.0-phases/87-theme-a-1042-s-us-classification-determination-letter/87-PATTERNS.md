# Phase 87: Theme A — 1042-S + US Classification + Determination Letter - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 23 new/extended files across 6 surfaces (classification rule set, determination letter, 1042-S, 1099-K tracker, routers, web-vite)
**Analogs found:** 21 / 23 (2 cross-phase targets are P86 Wave-0 RED scaffolds — see Cross-Phase Dependencies)

> Phase 87 is ~90% wiring of shipped engines. Every analog below is **filesystem-verified in this tree** (not from RESEARCH alone). The two exceptions — the P86 IRIS generator/validator and the transmitter/ack-parser — exist **only as RED/`it.todo` test scaffolds**; their analogs are the scaffolds + the sibling form-1099-nec service, and the planner must declare a cross-phase dependency or build the seam.

---

## Cross-Phase Dependencies & Human Checkpoints (READ FIRST)

Two RESEARCH-flagged gaps, **confirmed at the filesystem level**:

1. **1042-S IRIS XSD not bundled — `checkpoint:human-verify`.**
   `packages/iris/src/schema-bundle/` contains `source.txt`, `README.md`, `checksums.txt` only. `source.txt` explicitly documents the bundled package as "**1099-NEC payload XSD + Transmission Manifest XSD**" — the **1042-S XSD (IRS Pub 1187) is NOT present**. It is a **human-only IRS SOR login download**. The `buildIris1042SXml` generator + 1042-S validator cannot be GREEN until the XSD is placed and checksum-pinned. Does **not** block the deterministic core (model, box mapping, recipient PDF, classification, determination letter, 1099-K tracker).

2. **P86 transmitter seam + ack parser + IRIS generator not on disk.** Confirmed missing:
   - `packages/iris/src/generator.ts` → only `src/__tests__/generator.test.ts` exists, importing a `buildIrisXml` that "does not exist yet" (Wave-0 RED, resolution-fail).
   - `packages/iris/src/validator.ts` → only `src/__tests__/validator.test.ts`.
   - `packages/api/src/services/tax-filing-transmitter.ts` → only `__tests__/tax-filing-transmitter.test.ts` (all `it.todo`).
   - `packages/api/src/services/iris-ack-parser.ts` → only `__tests__/iris-ack-parser.test.ts` (all `it.todo`).
   The `IrisSubmission` / `IrisAck` / `IrisAckStatus` Prisma models **do** exist (tax.prisma lines 180-217). Planner: declare an explicit dependency that P86 lands these GREEN before P87's 1042-S transmit wave, OR build the seam in P87 (parameterizing form-type). The 1042-S deterministic core proceeds regardless.

---

## File Classification

| New/Extended File | Role | Data Flow | Closest Analog (verified) | Match Quality |
|-------------------|------|-----------|----------------------------|---------------|
| `packages/classification/src/profiles/us/index.ts` | profile (registry plugin) | transform | `profiles/ir35/index.ts` | exact |
| `packages/classification/src/profiles/us/rule-set.ts` | rule-set (data) | transform | `profiles/ir35/rule-set.ts` + `scheinselbstandigkeit/rule-set.ts` | exact |
| `packages/classification/src/profiles/us/scoring.ts` | scoring (pure) | transform | `profiles/ir35/scoring.ts` | exact |
| `packages/classification/src/types/outcome.ts` (extend) | type | — | same file (`Outcome` union + `Ir35Outcome`) | exact |
| `packages/classification/src/schemas/answers.ts` (maybe extend) | schema | request-response | same file (`getAnswerSchemaForType`) | exact |
| `packages/api/src/pdf-templates/us-determination-letter.tsx` | pdf-template | file-I/O | `pdf-templates/ir35-sds.tsx` | exact |
| `packages/api/src/services/classification-document-render.ts` (extend) | service | file-I/O | same file (`renderSdsPdfBuffer`) | exact |
| `packages/db/.../classification.prisma` `US_DETERMINATION_LETTER` kind | migration | — | `ClassificationDocumentKind` enum (line 49) | exact |
| `packages/db/.../tax.prisma` `Form1042S` model | model | CRUD | `Form1099Nec` (line 141) | exact |
| `packages/api/src/services/form-1042s.service.ts` | service | CRUD + batch | `form-1099-nec.service.ts` | exact |
| `packages/api/src/services/form-1042s-pdf.ts` | service | file-I/O | `form-1099-nec-pdf.ts` | exact |
| `packages/api/src/pdf-templates/form-1042s-recipient-copy.tsx` | pdf-template | file-I/O | `pdf-templates/form-1099-nec-copy-b.tsx` | exact |
| 1042-S treaty snapshot (within service) | service | transform | `treaty-rate.service.ts` (`applyTreaty`) | exact |
| `packages/iris/src/generator.ts` `buildIris1042SXml` | service | transform | `__tests__/generator.test.ts` RED scaffold | **scaffold-only** |
| `packages/iris/src/validator.ts` (1042-S XSD) | service | transform | `__tests__/validator.test.ts` RED scaffold | **scaffold-only** |
| `packages/db/.../tax.prisma` `Form1099KTrackerState` + `Tax1099KThreshold` | model | CRUD | `EconomicDependencyAlertState` + `Tax1099Threshold` | exact / role-match |
| `packages/api/src/services/form-1099k-tracker.service.ts` | service | event-driven (cron) | `economic-dependency-scan.ts` | exact |
| `apps/cron-worker/src/jobs/handlers/form-1099k-tracker.ts` | cron handler | event-driven | `handlers/classification-economic-dependency.ts` | exact |
| `apps/cron-worker/src/jobs/registry.ts` (extend) | config | — | same file | exact |
| `packages/api/src/middleware/require-us-expansion-flag.ts` (reuse) | middleware | request-response | same file | exact |
| 1042-S staff router(s) | router | CRUD / request-response | `routers/compliance/classification-*.ts` + `form-1099-nec` router pattern | role-match |
| 1042-S portal router | router | request-response | P86 portal consent + P85 portal tax-form router | partial (P86 in-flight) |
| web-vite components/hooks | component / hook | request-response | per 87-UI-SPEC (extends v5.0 + P85/P86 idioms) | exact (UI-SPEC) |

Engagement **work-state** field (AB5 trigger, D-04): add to the engagement model (`ContractorAssignment` — confirm exact model at plan time; `resolveAssignmentAndProfile` already selects `contractor.countryCode`). Primary AB5 signal; fall back to contractor P84 US state when unset.

---

## Pattern Assignments

### `packages/classification/src/profiles/us/index.ts` (profile, transform)

**Analog:** `packages/classification/src/profiles/ir35/index.ts` (verbatim shape)

**Registry self-registration** (`profiles/ir35/index.ts:15-19, 62-63`):
```typescript
export class IR35Profile implements ClassificationProfile {
  readonly profileId = 'ir35' as const;
  readonly country = 'GB' as const;
  readonly displayName = 'IR35 (United Kingdom)';
  readonly ruleSetVersion = RULE_SET_VERSION;
  // buildAssessment / scoreAssessment / renderOutcome ...
}
registerProfile(new IR35Profile()); // side-effect on import
```
**Copy:** the class shape + side-effect `registerProfile(new UsClassificationProfile())`. `country = 'US'`, `profileId = 'us-classification'`, `ruleSetVersion = 'US-2026-COMMONLAW-AB5'` (or similar — frozen on submit). **Differs:** `renderOutcome` guards `outcome.kind !== 'US_CLASSIFICATION'` (new discriminant). **No `registry.ts` change** — `getProfileForCountry('US')` auto-resolves (registry.ts:47-60).

**Contract** (`types/profile.ts:12-30`): `profileId`, `country`, `displayName`, `ruleSetVersion`, `buildAssessment(engagementId)`, `scoreAssessment(answers): Outcome` (PURE, server-only — never import in a client bundle), `renderOutcome(assessment): OutcomeView`.

---

### `packages/classification/src/profiles/us/scoring.ts` (scoring, pure)

**Analog:** `packages/classification/src/profiles/ir35/scoring.ts`

**Dispositive-first ordering — ORDER IS LOAD-BEARING** (`ir35/scoring.ts:89-137`):
```typescript
// Step 2: DISPOSITIVE rules, ORDER LOAD-BEARING.
if (subVerdict === 'strong-inside' || mooVerdict === 'strong-inside') {
  overall = 'inside';
  reasoning = 'Inside IR35 — Substitution strong-inside is dispositive per HMRC v Atholl House [2022] UKSC.';
} else if (subVerdict === 'strong-outside') { overall = 'outside'; }
else { /* composite count of leaning signals: insideCount>=3 → inside, etc. */ }
```
**Copy for US (D-03):** base = **federal IRS common-law three-category** weighted composite (behavioral / financial / relationship — NOT DOL 2024 as primary; Pitfall 3). Then **CA-ABC overlay = dispositive** when work-state = CA (defaults to employee unless all three prongs pass). Then **§530 = relief-eligibility FLAG on the result, not a verdict change** (D-03/Pitfall 5). **Reasoning string MUST cite the triggering rule verbatim** (`ir35/scoring.ts:93-96, 122`) for audit defence. Returns `{ outcome, reasoning }` (see `ScoreIr35Result`, scoring.ts:59-62). Compute `computedAt: new Date().toISOString()` (scoring.ts:153).

---

### `packages/classification/src/profiles/us/rule-set.ts` (rule-set, data)

**Analog:** `packages/classification/src/profiles/ir35/rule-set.ts` + `scheinselbstandigkeit/rule-set.ts`

**Pattern** (`ir35/rule-set.ts:17, 40-71, 84-`):
- `export const RULE_SET_VERSION = '…' as const;` — persisted in the questions snapshot on submit, frozen.
- Case-law citations as named consts reused across question blocks (`CITE_ATHOLL`, `CITE_PGMOL` …). US: IRS common-law (tc762 / SS-8), CA Labor Code 2775-2785 / 2776 (B2B 12-criteria), §530 Revenue Act 1978.
- `*_YES_DIRECTION` influence map (`Record<questionId, direction>`) translating an answer into a directional area signal; `'…-strong'` dispositive, `'…-leaning'` composite.
- `*_QUESTIONS` array — stable, append-only IDs; `prompt.en` authoritative + `prompt.pl`/`prompt.de` with `REVIEW:` tokens for adviser sign-off. D-14 requires en/en-US/de/pl/ar parity.

**Differs / adviser-verify (Pitfalls 3,4,5):** every federal factor + AB5 prong + §530 condition + treaty article + income code tagged adviser-verify and "subject to active rulemaking" where relevant. AB5 exemptions modeled as **adviser-confirm flags, never auto-determinations** (no single `ab5Exempt` boolean).

**Answer schema** (`schemas/answers.ts:27-44`): `getAnswerSchemaForType` is an exhaustive `never` switch over `AnswerType`. **Pitfall 7:** prefer reusing `'yes-no'` / `'score-0-3'` / `'likert-5'` / `'rationale'` for the US rule set; a new `AnswerType` requires updating the union + switch + Zod schema together.

**Outcome union extension** (`types/outcome.ts:72-73`):
```typescript
export type Outcome = Ir35Outcome | ScheinselbstandigkeitOutcome; // + UsClassificationOutcome
```
Add `UsClassificationOutcome` with `kind: 'US_CLASSIFICATION'`, `ruleSetVersion`, `verdict`, factor results (federal categories), `ab5Flag`, `section530ReliefEligible`, `computedAt`. Extend `OutcomeView` if `verdict` widens (currently `Ir35Verdict | ScheinVerdict`).

---

### `packages/api/src/pdf-templates/us-determination-letter.tsx` (pdf-template, file-I/O)

**Analog:** `packages/api/src/pdf-templates/ir35-sds.tsx`

**Module contract** (`ir35-sds.tsx:1-19`):
```typescript
export const TEMPLATE_VERSION = 1 as const;
export const RENDERER_SLUG = 'ir35-sds' as const;
// Reads ONLY assessment.outcome + questionsSnapshot + engagement context.
// NEVER imports live rule-set constants (only TYPES).
// Locked phrases come from @contractor-ops/validators. Byte stability: caller provides stable renderedAt.
```
**Copy:** `TEMPLATE_VERSION` + `RENDERER_SLUG = 'us-determination-letter'`; verdict-pill + per-factor evidence + citations layout (`ir35-sds.tsx:43-120`, `VERDICT_PILLS` / `AREA_PILLS` / styles). **Differs:** verdict-first with AB5 amber chip + §530 info chip (mirror UI-SPEC tone reconciliation); footer disclaimer = `SOFTWARE_NOT_LEGAL_ADVICE_EN` (D-05), imported from `@contractor-ops/validators` (NOT a translation file — CI-locked, see disclaimers.ts:82-94). **No LLM** (D-01 — explicitly forbidden).

---

### `packages/api/src/services/classification-document-render.ts` (extend, file-I/O)

**Analog:** same file — `renderSdsPdfBuffer` (lines 78-187)

**Add `renderDeterminationLetterPdfBuffer` mirroring** (verified excerpt):
```typescript
const assessment = await prisma.classificationAssessment.findFirstOrThrow({
  where: { id: params.classificationAssessmentId, organizationId: params.organizationId },
  include: { contractorAssignment: { include: { contractor: true, organization: true } } },
});
if (assessment.status !== 'COMPLETED' || assessment.questionsSnapshot === null) throw …;
const outcome = assessment.outcome as { kind?: string } | null;
if (!outcome || outcome.kind !== 'US_CLASSIFICATION') throw …; // guard the discriminant
const { renderToBuffer } = await import('@react-pdf/renderer'); // lazy
const buffer = await renderToBuffer(UsDeterminationLetterDocument({ assessment, engagement, contractor, organization, renderedAt }));
const sha256Hash = createHash('sha256').update(buffer).digest('hex');
const key = buildClassificationDocumentKey({ …, kind: 'US_DETERMINATION_LETTER', ruleSetVersion: assessment.ruleSetVersion, sha256: sha256Hash });
// append-only ClassificationDocument row (kind/pdfKey/sha256Hash/byteSize/rendererVersion/ruleSetVersion/generatedByUserId)
```
**Note (RESEARCH State-of-the-Art):** `REACT_PDF_VERSION = '3.4.5'` (line 45) is a **stale constant label** — the real dep is `@react-pdf/renderer ^4.5.1`. Do not assume v3 API. **Differs from SDS:** US has no `SdsApproval` gate row by default — UI-SPEC adds an SDS-mirror approval gate (`SDS_APPROVAL_STATEMENT_EN` analog, typed name + checkbox) at the button layer (`generate-determination-letter-button.tsx`); planner decides whether a server approval row is required (mirror `sdsApproval` lookup, render-service:104-110).

---

### `packages/db/.../tax.prisma` `Form1042S` model (model, CRUD)

**Analog:** `Form1099Nec` (tax.prisma:141-176)

**Immutable + supersede idiom to copy** (verified):
```prisma
model Form1099Nec {
  id String @id @default(cuid())
  organizationId String
  payerOrgId String          // aggregation axis (carried explicitly for agent-org split)
  recipientId String
  taxYear Int
  status Form1099Status @default(DRAFT)   // DRAFT | ACTIVE | SUPERSEDED
  box1AmountMinor Int                      // minor units (USD cents)
  currency String @default("USD") @db.Char(3)
  corrected Boolean @default(false)
  snapshotJson Json                        // record-of-record; last-4 TIN only, never full SSN
  pdfArchiveKey String?
  supersededById String? @unique
  deletedAt DateTime?                      // data-purge soft-delete chokepoint (IRS retention)
  // @@index([organizationId, payerOrgId, recipientId, taxYear, status]); supersede self-relation
}
```
**Form1042S columns (D-06, Open Q3 — codes adviser-verify at coding time, A1/A2):** `box1IncomeCode`, `box2GrossIncomeMinor`, `box3aChap3ExemptionCode`, `box3bChap3RateBp` (basis-points or `Decimal(5,2)` consistent with `WithholdingTaxRate.treatyRate`), `box4aChap4ExemptionCode`, `box4bChap4RateBp`, `box7FederalTaxWithheldMinor`, `recipientChap3StatusCode` (13j), `recipientChap4StatusCode` (13k), `recipientLobCode` (13n), `treatyArticle`, `snapshotJson` (last-4 FTIN only), `supersededById`, `deletedAt`. New `enum Form1042SStatus { DRAFT ACTIVE SUPERSEDED }`. **Tenant-owning — never in `globalModels`; cross-org leak test per model** (security domain V4). Mark **append-only** (mirror `ClassificationDocument` APPEND_ONLY guard note, classification.prisma:74).

---

### `packages/api/src/services/form-1042s.service.ts` (service, CRUD + batch)

**Analog:** `packages/api/src/services/form-1099-nec.service.ts` (verbatim structure)

**Idioms to copy** (verified):
- **Immutable snapshot + sanitizer** (1099 service:232-315): `FORBIDDEN_SNAPSHOT_KEYS` set drops full `ssn`/`tin`; `buildSnapshot` keeps `recipientTinLast4` only; `sanitizeSnapshotValue` strips forged full-identifier keys.
- **CORRECTED = supersede in one tx** (`supersedeCorrected`:359-395): `updateMany {status:'ACTIVE'} → {status:'SUPERSEDED'}` THEN `create {status:'ACTIVE', corrected:true}`. Supersede MUST run before insert. `fileCorrection` (630-662) joins supersede + `writeAuditLog({action:'form1099.correction'})` in the caller's tx → use `'form1042s.correction'`.
- **Idempotent batch** (`generateBatch`:486-595): `reserve(key, TTL)` → `HIT`/`PENDING`/`MISS`; on success `complete(key, result, TTL)`; on error `clear(key)`. Deterministic `batchIdempotencyKey` (406-412). `writeAuditLog({action:'form1099.generate'})` → `'form1042s.generate'`.
- **Box amounts in minor units; threshold/figures from config table, never constants** (lines 28-39, 164-172).

**Differs (D-07, §875(d) gate):** instead of box-1 FX aggregation + box-4 backup-withholding, the 1042-S service:
1. routes W-8 → 1042-S vs W-9 → 1099-NEC from the form on file (Pitfall 6 — read `TaxFormSubmission.formType`, mirror P85 `tax-form-routing`; never route on nationality).
2. resolves box-2 rate + treaty article via `applyTreaty` (below), **gated on W-8 chain complete** → treaty rate else 30% statutory.
3. snapshots rate + article (REPORTED-only; payout deduction is Phase 88 — do not mutate payouts).

**Treaty snapshot — analog `treaty-rate.service.ts` (`applyTreaty`, lines 144-175):**
```typescript
const decision = await applyTreaty({ contractorResidency, asOf, override });
// → { rate, article, source: 'treaty'|'override'|'statutory_30', autoRate, autoArticle, auditRequired }
// STATUTORY_RATE = 30 (line 24). hasTreatyRow = non-XX row with non-null treatyRate (line 163).
// override branch requires non-empty reason + auditRequired=true → caller writeAuditLog.
```
**§875(d) gate to add:** apply the treaty rate only when the contractor's W-8 chain is complete; otherwise force 30%. Snapshot the resolved rate onto `box3bChap3RateBp` + `treatyArticle`.

---

### `packages/api/src/services/form-1042s-pdf.ts` + `pdf-templates/form-1042s-recipient-copy.tsx` (service + pdf-template, file-I/O)

**Analog:** `form-1099-nec-pdf.ts` + `pdf-templates/form-1099-nec-copy-b.tsx`

**Render-and-archive idiom to copy** (`form-1099-nec-pdf.ts:39-138`, verified):
- `renderForm1099NecCopyB(snapshot)` — lazy `await import('@react-pdf/renderer')` + lazy template import; renders from the **stored immutable snapshot, never a live recompute**.
- `renderAndArchiveCopyB(db, formId)`: **CAS guard** — `updateMany where { id, pdfArchiveKey: null }`; `count === 0` → already-claimed short-circuit (lines 113-122). Archive key `1099-nec/<orgId>/<id>.pdf` (org-scoped, ASVS V4). `putObjectAndSignDownload({ ttlSeconds: 60 })`.
**Differs:** key prefix `1042-s/<orgId>/<id>.pdf`; `recipientTinLast4` → `recipientFtinLast4` (foreign TIN); box layout (1a-1c, box 2, box 5 treaty article). **Consent gate (D-09):** furnishing is gated on the **same P86 affirmative IRS e-delivery consent**; no consent / no portal seat → flag for paper/manual. The PDF is archived either way — the gate is on *furnishing*, not generation.

---

### `packages/iris/src/generator.ts` `buildIris1042SXml` + `validator.ts` (service, transform) — SCAFFOLD-ONLY

**Analog:** `packages/iris/src/__tests__/generator.test.ts` (RED scaffold) + `__tests__/validator.test.ts` — the implementation **does not exist yet**.

**Contract dictated by the RED scaffold** (verified `generator.test.ts`):
```typescript
import { buildIrisXml } from '../generator'; // resolution-fails until built
// emits a Transmission Manifest carrying schema { versionNum, versionDt };
// writes payee B-record; uses fast-xml-parser XMLBuilder (NEVER string-concat);
// full TIN never leaks — last-4 only.
```
**Copy:** XMLBuilder usage (fast-xml-parser `^5.7.3`), `{ nonet: true }` libxmljs2 validation (`^0.37.0`, no SSRF/XXE), checksum-pinned bundle. **Differs (Open Q2, Pitfall 1):** 1042-S is a **separate IRS schema (Pub 1187)** — recommend a **sibling `buildIris1042SXml`** (chapter 3/4 status codes, income codes, treaty fields differ materially), sharing the Transmission Manifest helper but a separate B-record builder. **Blocked on the human XSD download** + on P86's `buildIrisXml` landing GREEN.

**Transmit tail (D-08):** `tax-filing-transmitter.ts` (ManualDownload default / IrisA2A dark behind `module.iris-efile` / Vendor stub) + `iris-ack-parser.ts` (six `IrisAckStatus`, Error Information Group, `OriginalReceiptId`) are **`it.todo` scaffolds** — same cross-phase dependency. `IrisSubmission`/`IrisAck` models already exist (tax.prisma:180-217).

---

### `packages/db/.../tax.prisma` `Form1099KTrackerState` + `Tax1099KThreshold` (model, CRUD)

**Analog:** `EconomicDependencyAlertState` (classification.prisma:151-175) + `Tax1099Threshold` (tax.prisma:221-227)

**Band-state model idiom** (verified):
```prisma
enum EconomicDependencyBand { SAFE WARNING CRITICAL }
model EconomicDependencyAlertState {
  contractorAssignmentId String @unique     // one state row per subject, written by cron
  currentBand EconomicDependencyBand @default(SAFE)
  lastBillingShare Decimal @db.Decimal(5, 4)
  lastScannedAt DateTime
  lastCrossedAt DateTime?
  lastReminderAt DateTime?                   // dedup re-fire cadence
}
```
**Form1099KTrackerState (D-10):** per contractor **per tax-year** (`@@unique([contractorId, taxYear])`), `currentBand SAFE|APPROACHING|OVER`, `cumulativePayoutMinor`, `transactionCount`, `lastScannedAt`, `lastCrossedAt`, `lastReminderAt`. Tenant-owning; cross-org leak test.
**Threshold config (D-11):** `Tax1099KThreshold` mirroring `Tax1099Threshold` (`taxYear @unique`, `amountThresholdMinor` = $20,000, `transactionCountThreshold` = 200 — OBBBA, NOT the stale $5K/$600). Never a constant.

---

### `packages/api/src/services/form-1099k-tracker.service.ts` + cron handler (event-driven)

**Analog:** `economic-dependency-scan.ts` + `handlers/classification-economic-dependency.ts`

**Scan/band/notification idiom to copy** (`economic-dependency-scan.ts`, verified):
- `createCronLogger('…')` (line 50) — NO `console.*`.
- pure `bandFor(value): Band` + `bandIndex(b)` (66-82) for transition comparison.
- `updateBandState` (179-248): `next > prev` → up-cross fire; `next < prev` → resolved; same non-safe band + `lastReminderAt ≥ cadence` → re-fire; `upsert` keyed on the `@unique` column.
- notification via `dispatch({ organizationId, type, recipientUserIds, title, body, entityType, entityId, metadata })` (340-353); recipients from `resolveRbacRecipients(orgId, 'contractor:read')`.
- bounded fan-out `pLimit(10)` (294-295); `metrics.gauge` (370-372).

**Handler** (`classification-economic-dependency.ts:18-56`): `evaluate(flag, FLAG_CTX)` short-circuit → `CRON_SKIPPED_FLAG_OFF`; try `runScan` → `{ ok, durationMs, details }`; catch → `Sentry.captureException({ tags: { 'cron.job': … } })`.
**Differs (D-10):** sum cumulative payout minor + transaction count for the tax year (read payment domain); **purely informational — the scan NEVER files a 1099-K** (assert this invariant in a unit test); SAFE/APPROACHING/OVER bands; proactive heads-up notification on up-cross. Flag = `module.us-expansion` (US surface).

**Registry** (`registry.ts:29-42, 71-77`): add `CRON_FORM_1099K_TRACKER_SCHEDULE` to the `getJobDefinitions` env param + a `{ meta: { name: 'form-1099k-tracker', schedule }, handler }` entry. Add the env var to `.env.example` + the cron-worker env schema.

---

### Routers — US classification wiring + 1042-S staff/portal (router, request-response)

**Analog:** `routers/compliance/classification-{shared,draft,read,submit,document}.ts`

**Multi-country wiring is already generic** (`classification-shared.ts:157-193`, verified):
```typescript
const profile = getProfileForCountry(assignment.contractor.countryCode); // resolves 'US' automatically
```
`classificationDraftRouter.createDraft` (`classification-draft.ts:27-53`) writes `countryCode: profile.country` + `ruleSetVersion: profile.ruleSetVersion`. **No router change needed for US classification beyond registering the US profile** and confirming the document router handles the `US_DETERMINATION_LETTER` kind (existing router is `classification-document.tsx`, not `.ts`).

**Procedure + gating:** `classificationProcedure` = `module.classification-engine` gate (`require-classification-flag.ts`). **Open Q1 recommendation:** gate US classification behind **both** `classificationProcedure` AND `assertUsExpansionEnabled(organizationId, region)` (defense-in-depth, no new flag).
**1042-S routers (new):** Zod `.strict()` on every input; tenant from session; `writeAuditLog` on generate/correct/transmit; `idempotency.ts` on batch. Conditional `root.ts` spread via `isUsExpansionRegistered()` + per-request `assertUsExpansionEnabled`. Portal router cannot be conditionally spread (flat merge) — `assertUsExpansionEnabled` is the load-bearing portal gate (`require-us-expansion-flag.ts:1-12, 29-47`). Full FTIN reveal behind `CONTRACTOR_PII:READ`, staff-router only.

---

### web-vite components + hooks

**Analog:** per 87-UI-SPEC §Component Inventory (extends v5.0 classification + P85/P86 tax-filing idioms — `classification-tile.tsx`, `generate-sds-button.tsx`, `advisory-banner.tsx`, `tax-form-status-card.tsx`, `step-attest.tsx`, `ssn-masked-reveal.tsx`).

**Layering (CLAUDE.md + UI-SPEC):** Page (thin composer, Suspense/permissions, no tRPC) → wired section (4-state branch, no direct tRPC) → hook `components/{domain}/hooks/use-*.ts` (sole tRPC boundary) → presentational. **NO new `*-container.tsx`** (project moved off that name; `ClassificationTileContainer` is a legacy survivor — do not add new `*Container`). Tokens/typography/color verbatim from UI-SPEC; AB5 flag amber `warning` (never destructive), §530 flag `info` blue, 1099-K band amber-at-most (informational, no filing CTA). The 1042-S portal PDF reuses the **exact P86** `step-edelivery-consent.tsx` + `use-edelivery-consent.ts`. **1042-S filing components mirror P86 `tax-1099-*` — which are NOT YET ON DISK** (P86 in-flight); same cross-phase note.

---

## Shared Patterns

### Advisory disclaimer (D-05) — reuse verbatim, CI-locked
**Source:** `packages/validators/src/legal/disclaimers.ts` — `SOFTWARE_NOT_LEGAL_ADVICE_EN` (lines 82-94), `SDS_APPROVAL_STATEMENT_EN` (64-68) for the letter approval gate analog.
**Apply to:** US determination-letter footer, classification advisory banner, every 1042-S/classification user-facing artifact.
These are **locked phrases — MUST NOT be translated or moved into messages/*.json** (CI guard `locked-phrases-guard.test.ts`, disclaimers.ts:5-8). Import from `@contractor-ops/validators`.

### Audit (D-15)
**Source:** `packages/api/src/services/audit-writer.ts` (`writeAuditLog`); usage `form-1099-nec.service.ts:569-581, 646-659` (pass `tx` when in a transaction).
**Apply to:** classification override (+reason), 1042-S generate/correct/transmit, determination-letter generation, treaty-rate override.

### Idempotency (D-15)
**Source:** `packages/api/src/lib/idempotency.ts` (`reserve`/`complete`/`clear`); usage `form-1099-nec.service.ts:493-588`.
**Apply to:** any 1042-S batch generate/transmit. Deterministic key `form1042s:batch:{org}:{payerOrg}:{taxYear}`.

### US-surface gating (D-12)
**Source:** `packages/api/src/middleware/require-us-expansion-flag.ts` — `assertUsExpansionEnabled(orgId, region)` (per-request, throws `FORBIDDEN` `US_EXPANSION_DISABLED`) + `isUsExpansionRegistered()` (conditional `root.ts` spread; `QA_DEFAULT_ORG_ID` force-registers).
**Apply to:** all 1042-S staff + portal routers, the 1099-K tracker cron flag check, and (per Open Q1) US classification routers alongside `classificationProcedure`.

### PII / last-4 masking (Security V4/V6)
**Source:** `form-1099-nec.service.ts:232-315` (`FORBIDDEN_SNAPSHOT_KEYS` + `sanitizeSnapshotValue`); web-vite `ssn-masked-reveal.tsx` (UI-SPEC §Shared, `CONTRACTOR_PII:READ`-gated, audit-logged).
**Apply to:** `Form1042S` snapshot (FTIN last-4 only), recipient-copy PDF, every 1042-S recipient row. Full value never in snapshot/PDF/log.

### Tax-year-keyed config, never constants
**Source:** `Tax1099Threshold` (tax.prisma:221-227) + `getBox1ThresholdMinor` (1099 service:164-172) + `WithholdingTaxRate` (tax.prisma:23) via `applyTreaty`.
**Apply to:** 1099-K $20,000+200 threshold (`Tax1099KThreshold`), 1042-S treaty rates/articles.

### Documentation-follows-code (gated)
New models → `wiki/structure/prisma-schema-areas.md`; new procedures → `api-routers-catalog.md`; new cron → `cron-jobs.md`; 1042-S integration → `wiki/integrations/`; classification + us-tax-forms domain pages; `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` for new invariants; bump `source_commit`. `pnpm check:wiki-brain` before done. `.planning/phases` is a symlink — orchestrator commits via `.planning/milestones/`.

---

## No Analog Found / Scaffold-Only

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/iris/src/generator.ts` `buildIris1042SXml` | service | transform | Target `generator.ts` is a Wave-0 RED scaffold (`buildIrisXml` not implemented); 1042-S XSD is a human-only IRS SOR download not yet bundled (`source.txt` = 1099-only) |
| `packages/iris/src/validator.ts` (1042-S XSD) | service | transform | `validator.ts` does not exist; blocked on the 1042-S XSD download |
| `packages/api/src/services/tax-filing-transmitter.ts` | service | request-response | Only an `it.todo` scaffold exists (P86 Wave-0); cross-phase dependency |
| `packages/api/src/services/iris-ack-parser.ts` | service | transform | Only an `it.todo` scaffold exists (P86 Wave-0); cross-phase dependency |

For these, the planner uses the RED scaffold contracts (above) + the `form-1099-nec.service` sibling, and either declares a P86 dependency or builds the seam parameterizing form-type. The deterministic core (model, box mapping, recipient PDF, classification, determination letter, 1099-K tracker) has full analogs and proceeds independently.

---

## Metadata

**Analog search scope:** `packages/classification/src/{types,registry,profiles/ir35,profiles/scheinselbstandigkeit,schemas}`, `packages/api/src/{services,pdf-templates,routers/compliance,middleware,lib}`, `packages/db/prisma/schema/{tax,classification}.prisma`, `packages/validators/src/legal`, `packages/iris/src/{schema-bundle,__tests__}`, `apps/cron-worker/src/jobs`.
**Files scanned:** 31 analog candidates verified for existence; 18 read in full or targeted sections; 4 confirmed scaffold-only.
**Pattern extraction date:** 2026-06-18
**Re-verify before production:** 1042-S income/status codes (A1/A2, i1042s Appendix B/C), 1042-S IRIS XSD element names (after SOR download), AB5 exemption list, DOL rule status (Valid until 2026-07-18).
