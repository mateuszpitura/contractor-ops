# Phase 59 — Research

**Generated:** 2026-04-13
**Primary input:** `.planning/phases/59-classification-documents-chain-tracking/59-CONTEXT.md`
**Requirements addressed:** CLASS-03 (SDS PDF), CLASS-04 (IR35 chain + SDS delivery tracking), CLASS-06 (DRV audit defense bundle)
**Depends on:** Phase 58 (`ClassificationAssessment` model, outcome envelope, locked-phrases CI guard, profile registry)
**Phase 58 status:** Partial (Plan 58-01 shipped — `ClassificationAssessment` model + workspace + locked-phrases disclaimers). Plans 58-02/03/04 in flight (scoring + tRPC router + wizard UI). Phase 59 plans MUST treat Phase 58 D-03 (outcome envelope), D-06 (rule-set constants), D-07 (locked phrases), D-08 (append-only + `questionsSnapshot`), D-14 (DRV category weighting), and D-16 (outcome visualisations) as locked contracts — the Phase 58 artifacts they produce are consumed read-only in Phase 59.

---

## Question We Answer

> "What do I need to know to PLAN Phase 59 well?"

Concretely:

1. Which existing React-PDF / R2 / tRPC / Prisma / locked-phrase patterns Phase 59 mirrors verbatim.
2. What new Prisma models (`ClassificationDocument`, `Ir35ChainParticipant`, `Ir35OtherClientAttestation`) look like and where they land.
3. What the SDS and DRV bundle templates render — section-by-section — from `ClassificationAssessment.outcome` + `questionsSnapshot`.
4. How immutable document persistence (render → SHA-256 → R2 content-addressed key → row) is wired into `putObjectAndSignDownload` + a new `signExistingDownload` helper.
5. Which locked-phrase constants land where, and how the CI guard gets extended without breaking Phase 56 / 58 coverage.
6. The IR35-chain data shape, multi-agency `orderIndex` semantics, and the explicit "mark delivered / acknowledged" two-timestamp model.
7. What the DRV "other-client attestation" looks like as a DRV-scoped entity (separate from `Ir35ChainParticipant`).
8. A validation strategy (Nyquist) covering CLASS-03/04/06 with concrete test commands + Wave-0 gaps.
9. Known pitfalls: snapshot-version drift, R2 re-sign vs re-upload, multi-tenant cross-reads, PDF byte drift on re-render, chain reordering integrity.

---

## Pattern 1 — React-PDF template mirror (Phase 56 → Phase 59)

The Phase 56 `gdpr-privacy-notice.tsx` template is the **exact** structural precedent for both new templates. Mirror these elements verbatim:

| Token | Value | Source |
|-------|-------|--------|
| Font | `Helvetica` | `gdpr-privacy-notice.tsx` L29 |
| Page size | A4 (default) | same |
| Padding | `padding: 56, paddingBottom: 72` | L34 |
| Teal accent | `#0d7f72` | L22 |
| Body grey | `#1f2937` | L23 |
| Muted grey | `#6b7280` | L24 |
| Rule grey | `#d1d5db` | L25 |
| Title | 20pt bold teal | L42-46 |
| Section title | 12pt bold grey-body | L50-55 |
| Section body | 10pt grey-body, line-height 1.55 | L56 |
| Footer | 8pt muted grey, centred, bottom 36pt, left/right 56pt, 1px top rule | L57-67 |
| Page number | 8pt muted grey, bottom 36pt right 56pt | L68-74 |

Two new files land in `packages/api/src/pdf-templates/`:

1. **`ir35-sds.tsx`** (CLASS-03) — Verdict-first, evidence-trailing layout per D-01/D-02:
   - Page 1 `<Page>`: header block (org + contractor + engagement ref + `ruleSetVersion` + `completedAt`); verdict banner (coloured pill spanning ~80% width; green/red/amber per D-02); 1-paragraph summary from `outcome.summary` (Phase 58 D-03 envelope); engagement details two-column block (client, role, start date, rate, scope) sourced from `ContractorAssignment` + `Contractor`.
   - Page 2+ `<Page>`: per-area section — ONE `View` per IR35 area (substitution, control, financial-risk, part-and-parcel, MOO). Each section = pill heading (coloured verdict: `strong-outside` / `leaning-outside` / `neutral` / `leaning-inside` / `strong-inside` mapped to green/amber/red) + list of driving answers from `questionsSnapshot` (prompt + user answer + `caseLawCitation`). React-PDF auto-paginates `<Page wrap>` when area evidence exceeds a page.
   - Final `<Page>`: dispute-process block (verbatim `IR35_DISPUTE_PROCESS_EN` from `packages/validators/src/legal/en.ts`) + disclaimer (`SDS_DISCLAIMER_EN` from `disclaimers.ts`).

2. **`drv-defense-bundle.tsx`** (CLASS-06) — Single consolidated PDF per D-14:
   - Page 1 `<Page>`: cover (org + contractor + engagement header + `DRV_DEFENSE_COVER_HEADER_DE`); table of contents listing the 4 sections with page refs (React-PDF `<Link src="#sec-1">` / `<View id="sec-1">` anchors — supported in `@react-pdf/renderer` 3.x).
   - Section 1 `<Page wrap>`: engagement structure summary (2-column key/value block).
   - Section 2 `<Page wrap>`: independence indicators — for each of the 4 DRV categories (`integration`, `entrepreneurial`, `personal-dep`, `economic-dep`) render pill (green/amber/red by `outcome.categoryBreakdown[c].verdict`) + weighted-score text + list of driving answers from `questionsSnapshot` (prompt + user answer + `drvReference`).
   - Section 3 `<Page wrap>`: risk-assessment history — chronological list of ALL prior `ClassificationAssessment` rows with `contractorAssignmentId` = same AND `countryCode='DE'` AND `status='completed'`, each rendered as row card (traffic-light pill + total weighted score + per-category micro-bars + `completedAt` + `ruleSetVersion` + delta vs previous `Δ +12 amber → red`).
   - Section 4 `<Page wrap>`: other-client attestation — platform-derived table (from `Ir35OtherClientAttestation` + cross-reference `ContractorAssignment` rows for same `contractorId` within same `organizationId`) followed by verbatim contractor statement + dated signature line.

Both templates must use `<Page wrap>` on content pages so React-PDF page-breaks cleanly; absolute-positioned footer + `render={({ pageNumber, totalPages }) => ...}` page-number block repeats on every page.

---

## Pattern 2 — Immutable R2 persistence with content-addressed keys

This is new for the repo (Phase 56 generated-on-demand without persistence, returning signed URLs that vanished after 300s). Phase 59 needs bytes to persist for audit defence. Pattern:

```text
generate mutation (first call):
  1. Load ClassificationAssessment (must be completed, org-scoped, questionsSnapshot non-null)
  2. Build template props from row + engagement + contractor data
  3. buf = await renderToBuffer(<IR35SDSDocument {...props} />)          // @react-pdf/renderer
  4. hash = createHash('sha256').update(buf).digest('hex')              // node:crypto
  5. key = `classification-documents/${orgId}/${assessmentId}/sds-${ruleSetVersion}-${hash.slice(0,16)}.pdf`
  6. await putObjectAndSignDownload({ key, body: buf, contentType: 'application/pdf', ttlSeconds: 300 })
     → returns { signedUrl, expiresInSeconds }
  7. await tx.classificationDocument.create({ data: { id, orgId, assessmentId, kind:'SDS', pdfKey:key, sha256Hash:hash, byteSize:buf.byteLength, rendererVersion, ruleSetVersion, generatedByUserId } })
  8. Return { url: signedUrl, expiresInSeconds, documentId: row.id }

download query (subsequent):
  1. Load ClassificationDocument by id (org-scoped)
  2. await signExistingDownload(doc.pdfKey, 300)   // NEW helper — GetObjectCommand + getSignedUrl only, no PutObject
  3. Return { url: signedUrl, expiresInSeconds: 300, byteSize, sha256Hash }
```

The `signExistingDownload(key, ttlSeconds)` helper lives in `packages/api/src/services/r2.ts` alongside `putObjectAndSignDownload`, follows the same `GetObjectCommand` + `ResponseContentDisposition: 'attachment'` pattern but skips the `PutObjectCommand`. R2 never receives a second upload for the same content-addressed key — idempotent by design.

Content-addressed key rationale:
- Hash in key = future de-dup without schema churn; two identical render runs on the same assessment produce the same key and (optionally) share the same object.
- Organisation prefix = belt-and-braces multi-tenant guard; a leaked key still can't be re-used cross-tenant because tRPC path checks `organizationId` against the row before re-signing.
- `ruleSetVersion` + hash snippet = trivial forensic check: "is this file the same bytes we rendered?" without downloading.

**No auto-regeneration** per D-09. If a future phase wants regeneration, it creates a fresh `ClassificationAssessment` (Phase 58 append-only) and a fresh `ClassificationDocument` — never replaces existing rows.

---

## Pattern 3 — Append-only Prisma models (extend the classification.prisma file)

Phase 58 Plan 58-01 shipped `packages/db/prisma/schema/classification.prisma` with the `ClassificationAssessment` model + `ClassificationAssessmentStatus` enum. Phase 59 **appends** three new models to the same file (keeps the domain boundary tight; no new schema file needed):

```prisma
// Phase 59 · CLASS-03 — persisted immutable classification documents (SDS, DRV bundle)
enum ClassificationDocumentKind {
  SDS
  DRV_DEFENSE_BUNDLE
}

model ClassificationDocument {
  id                        String   @id @default(cuid())
  organizationId            String
  classificationAssessmentId String
  kind                      ClassificationDocumentKind
  pdfKey                    String   // R2 object key (content-addressed — see Pattern 2)
  sha256Hash                String   @db.Char(64)
  byteSize                  Int
  rendererVersion           String   // e.g. "@react-pdf/renderer@3.4.5+ir35-sds@1"
  ruleSetVersion            String   // copied from assessment at render time (defence-in-depth)
  generatedAt               DateTime @default(now())
  generatedByUserId         String
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  organization             Organization            @relation(fields: [organizationId], references: [id])
  classificationAssessment ClassificationAssessment @relation(fields: [classificationAssessmentId], references: [id])
  generatedBy              User                    @relation(fields: [generatedByUserId], references: [id])

  @@index([organizationId, classificationAssessmentId, kind])
  @@index([organizationId, generatedAt(sort: Desc)])
  // NOTE: append-only; enforce at application layer (Prisma client extension guard — see Pattern 4).
}

// Phase 59 · CLASS-04 — IR35 chain participants with per-link SDS delivery tracking
enum Ir35ChainRole {
  CLIENT
  AGENCY
  PSC
  WORKER
}

model Ir35ChainParticipant {
  id                     String   @id @default(cuid())
  organizationId         String
  contractorAssignmentId String
  role                   Ir35ChainRole
  orderIndex             Int      // chain position; 0 = top of chain
  displayName            String
  contactEmail           String?
  linkedOrganizationId   String?
  linkedContractorId     String?
  sdsDeliveredAt         DateTime?
  sdsDeliveredNote       String?  @db.VarChar(500)
  sdsAcknowledgedAt      DateTime?
  sdsAcknowledgedNote    String?  @db.VarChar(500)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  organization         Organization         @relation(fields: [organizationId], references: [id])
  contractorAssignment ContractorAssignment @relation(fields: [contractorAssignmentId], references: [id])
  linkedOrganization   Organization?        @relation("Ir35ChainParticipantLinkedOrg", fields: [linkedOrganizationId], references: [id])
  linkedContractor     Contractor?          @relation(fields: [linkedContractorId], references: [id])

  @@index([organizationId, contractorAssignmentId, orderIndex])
  @@index([organizationId, linkedOrganizationId])
  // NOTE (D-12): sdsDeliveredAt/sdsAcknowledgedAt are explicitly set by mark-delivered/mark-acknowledged
  // tRPC mutations — NEVER auto-set by ClassificationDocument.generate.
}

// Phase 59 · CLASS-06 — DRV defense bundle: contractor's "other clients" attestation
model Ir35OtherClientAttestation {
  id                     String   @id @default(cuid())
  organizationId         String
  contractorAssignmentId String   @unique  // one attestation per engagement
  statementText          String   @db.VarChar(4000)
  signedName             String
  signedAt               DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  organization         Organization         @relation(fields: [organizationId], references: [id])
  contractorAssignment ContractorAssignment @relation(fields: [contractorAssignmentId], references: [id])

  @@index([organizationId, contractorAssignmentId])
}
```

Back-relations to append in existing files:

- `contractor.prisma` → `ContractorAssignment`:
  ```prisma
    classificationDocuments     ClassificationDocument[]
    ir35ChainParticipants       Ir35ChainParticipant[]
    ir35OtherClientAttestation  Ir35OtherClientAttestation?
  ```
- `contractor.prisma` → `Contractor`:
  ```prisma
    ir35ChainParticipantLinks Ir35ChainParticipant[]  // via linkedContractorId
  ```
- `organization.prisma` → `Organization`:
  ```prisma
    classificationDocuments             ClassificationDocument[]
    ir35ChainParticipants               Ir35ChainParticipant[]
    ir35ChainParticipantLinkedOrgs      Ir35ChainParticipant[] @relation("Ir35ChainParticipantLinkedOrg")
    ir35OtherClientAttestations         Ir35OtherClientAttestation[]
  ```
- `auth.prisma` (or wherever `User` lives) → `User`:
  ```prisma
    generatedClassificationDocuments ClassificationDocument[]
  ```

Why same file: all three are classification-domain concerns; keeping them together makes migrations easier to reason about and mirrors how `consent.prisma` aggregates consent-domain models.

Note on `classificationAssessmentId` name: spelled identically on both models so existing Phase 58 patterns transfer unchanged (`ctx.db.classificationDocument.findMany({ where: { classificationAssessmentId } })`).

---

## Pattern 4 — Append-only enforcement via Prisma client extension

`ClassificationDocument` must be insert-only. Options:

| Option | Where | Pros | Cons |
|--------|-------|------|------|
| A. Database trigger | Postgres | Unbypassable from any code path | Adds SQL migration; non-trivial to test |
| B. Prisma client extension guard | `packages/db/src/tenant-scoped-client.ts` | All existing writes already go through this extension; pattern precedent (consent, tax-id) | Bypassable if someone imports raw PrismaClient — but team convention + lint rule already forbids that |
| C. Application-layer guard in tRPC router | `packages/api/src/routers/classification-document.ts` | Simplest | Only blocks tRPC writes; service-code writes can skip |

**Recommended: Option B** — extend the existing Prisma client extension with an `operation === 'update' && model === 'ClassificationDocument'` guard that throws. Mirror the pattern used for `ConsentRecord` (Phase 51). Document the guard in code comments.

Reference file: `packages/db/src/tenant-scoped-client.ts` (search for the consent guard — planner reads exact pattern). If the guard doesn't yet exist for consent (check before assuming), add both together in Plan 59-01.

`Ir35ChainParticipant` is mutable (mark-delivered, mark-acknowledged, reorder, upsert) — no guard.
`Ir35OtherClientAttestation` is updatable until first signed (after which we could freeze it, but the DRV bundle copies the statement text at render time so the persisted PDF is already immutable; no need for DB-level freeze).

---

## Pattern 5 — Locked phrase constants + CI guard extension

Phase 58 D-07 established `packages/validators/src/__tests__/locked-phrases-guard.test.ts` with `RESERVED_LEGAL_KEYS` + `RESERVED_DISCLAIMER_KEYS` constants. Phase 59 extends:

| Constant | Module | Locale | Purpose |
|----------|--------|--------|---------|
| `IR35_DISPUTE_PROCESS_EN` | `packages/validators/src/legal/en.ts` | EN | Verbatim 45-day dispute process block for SDS final page (D-03) |
| `SDS_DISCLAIMER_EN` | `packages/validators/src/legal/disclaimers.ts` | EN | "This document is a status determination statement…" legal disclaimer on SDS last page |
| `DRV_DEFENSE_COVER_HEADER_DE` | `packages/validators/src/legal/de.ts` | DE | Cover-page legal header for DRV bundle |
| `DRV_DEFENSE_SECTION_TITLES_DE` | `packages/validators/src/legal/de.ts` | DE | Titles for the 4 DRV bundle sections ("Engagement-Struktur", "Selbständigkeitsindikatoren", "Risikobewertungsverlauf", "Attestierung weiterer Auftraggeber") |
| `DRV_DEFENSE_TABLE_HEADERS_DE` | `packages/validators/src/legal/de.ts` | DE | Column headers for the risk-history table + cross-reference table |
| `DRV_DEFENSE_DISCLAIMER_DE` | `packages/validators/src/legal/disclaimers.ts` | DE | DRV audit defense bundle disclaimer |
| `DRV_DEFENSE_ATTESTATION_FOOTER_DE` | `packages/validators/src/legal/de.ts` | DE | "Datum / Unterschrift" block template |

All new keys must be added to:
- `RESERVED_LEGAL_KEYS` (in `de.ts` + `en.ts` — merged via `packages/validators/src/legal/index.ts` export)
- `RESERVED_DISCLAIMER_KEYS` (for `SDS_DISCLAIMER_EN` + `DRV_DEFENSE_DISCLAIMER_DE`)
- The reserved-key prefix list in `locked-phrases-guard.test.ts`:
  - `IR35_DISPUTE_*`
  - `SDS_*`
  - `DRV_DEFENSE_*`

Exact wording for each constant is deferred to Plan execution (per CONTEXT.md "Claude's Discretion") — English text follows HMRC off-payroll working guidance; German text follows DRV Rundschreiben RS 2022/1 phrasing. Plan 59-01 checkpoints for UK tax-adviser + Steuerberater review of the final wording (same pattern as Phase 58 Plan 58-05).

CI guard assertion shape:
```ts
it('rejects IR35_DISPUTE_*, SDS_*, DRV_DEFENSE_* keys in any messages/*.json', () => {
  const LEAKY = ['IR35_DISPUTE_', 'SDS_', 'DRV_DEFENSE_'];
  for (const locale of ['en','pl','de','ar']) {
    const messages = loadMessages(locale);
    const hits = Object.keys(flatten(messages)).filter(k => LEAKY.some(p => k.includes(p)));
    expect(hits).toEqual([]);
  }
});
```

---

## Pattern 6 — tRPC router layout

Two new routers (not extensions of the Phase 58 `classification` router, which stays focused on the engine / wizard / assessment lifecycle):

### `packages/api/src/routers/classification-document.ts`

| Procedure | Type | Input | Output | RBAC |
|-----------|------|-------|--------|------|
| `generateSds` | mutation | `{ classificationAssessmentId: string }` | `{ url, expiresInSeconds, documentId, byteSize, sha256Hash }` | `contractor:write` (same as assessment submit) |
| `generateDrvDefenseBundle` | mutation | `{ classificationAssessmentId: string, attestationText: string, signedName: string }` | same shape | `contractor:write` |
| `getDownloadUrl` | query | `{ classificationDocumentId: string }` | `{ url, expiresInSeconds, kind, generatedAt, byteSize, sha256Hash }` | `contractor:read` |
| `listByEngagement` | query | `{ contractorAssignmentId: string }` | `Array<{ id, kind, generatedAt, byteSize, rendererVersion, ruleSetVersion }>` | `contractor:read` |

All procedures use `tenantProcedure` → Prisma extension auto-scopes by `organizationId`. Zod input schemas are colocated in the router module.

### `packages/api/src/routers/ir35-chain.ts`

| Procedure | Type | Input | Output | RBAC |
|-----------|------|-------|--------|------|
| `listByEngagement` | query | `{ contractorAssignmentId: string }` | `Array<Ir35ChainParticipantDto>` ordered by `orderIndex` | `contractor:read` |
| `upsertParticipant` | mutation | `{ id?, contractorAssignmentId, role, orderIndex, displayName, contactEmail?, linkedContractorId? }` (CLIENT role derives linkedOrganizationId server-side) | participant DTO | `contractor:write` |
| `reorderParticipants` | mutation | `{ contractorAssignmentId, orderedIds: string[] }` (server assigns `orderIndex` = position in array) | `{ success: true }` | `contractor:write` |
| `markDelivered` | mutation | `{ id, note?: string }` (sets `sdsDeliveredAt = now()`) | DTO | `contractor:write` |
| `markAcknowledged` | mutation | `{ id, note?: string }` (sets `sdsAcknowledgedAt = now()`) | DTO | `contractor:write` |
| `removeParticipant` | mutation | `{ id }` | `{ success: true }` | `contractor:write` |

Bootstrapping rule: on first call to `listByEngagement` for an engagement that has zero participants AND `countryCode='GB'`, server auto-seeds CLIENT (tenant org) + WORKER (contractor) rows via a `findMany` + `createMany` fallback. AGENCY + PSC are never auto-seeded — user always adds explicitly.

### `packages/api/src/routers/ir35-other-client-attestation.ts` (or inline in `classification-document.ts` if short)

| Procedure | Type | Input | Output | RBAC |
|-----------|------|-------|--------|------|
| `getForEngagement` | query | `{ contractorAssignmentId }` | attestation DTO or null | `contractor:read` |
| `upsert` | mutation | `{ contractorAssignmentId, statementText, signedName }` (sets `signedAt = now()`) | DTO | `contractor:write` |
| `getPlatformCrossReference` | query | `{ contractorAssignmentId }` | `Array<{ assignmentId, clientDisplayName, startDate, endDate, isSameOrg: true }>` (from same-org assignments sharing `contractorId`; cross-tenant NOT exposed) | `contractor:read` |

All three routers added to the root router in `packages/api/src/root.ts` as `classificationDocument`, `ir35Chain`, `ir35Attestation` (or combined under `classification` namespace — planner decides, but keep Phase 58's `classification` router untouched).

---

## Pattern 7 — Reading `outcome` and `questionsSnapshot` from Phase 58

Phase 58 D-03 defined the `outcome` discriminated union:

```ts
type Outcome =
  | { kind: 'IR35'; verdict: 'outside' | 'inside' | 'undetermined'; summary: string; areaResults: Ir35AreaResult[] }
  | { kind: 'SCHEINSELBSTANDIGKEIT'; riskLevel: 'green' | 'amber' | 'red'; totalScore: number; categoryBreakdown: ScheinCategoryResult[] };

type Ir35AreaResult = { area: Ir35Area; verdict: Ir35AreaVerdict; drivingQuestionIds: string[]; reasoning: string };
type ScheinCategoryResult = { category: ScheinCategory; weightedScore: number; verdict: 'green'|'amber'|'red'; drivingQuestionIds: string[] };
```

`questionsSnapshot` (D-08) is a frozen `{ ruleSetVersion, profileId, questions: RuleSetQuestion[] }` — each question has prompt/helpText/citation. SDS renders `areaResults[*].drivingQuestionIds` → look up each question in `questionsSnapshot.questions` by `id` → render prompt + `caseLawCitation`. DRV bundle does the same with `categoryBreakdown[*].drivingQuestionIds` + `drvReference`.

**Critical:** never reach for live rule-set constants when rendering a persisted document. Read only from `assessment.outcome` + `assessment.questionsSnapshot`. This is what makes the document bytes stable across rule-set updates (D-09).

Where the answer values live: `assessment.answers` (JSONB map of `questionId → { rawScore?, value?, isNotApplicable? }`). For each driving question: render `prompt` (EN/DE from snapshot per locale) + the answer value (display-formatted from `answerType`) + the citation.

---

## Pattern 8 — Integration into contractor-assignment UI

Phase 56 `CountryComplianceSection` dispatcher (in `apps/web/src/components/contractors/compliance/`) already renders per-country fields. Phase 59 adds:

- **New component: `<ClassificationDocumentsPanel engagementId={...} />`** in `apps/web/src/components/contractors/classification-documents/` (new directory, Phase 59-scoped, no collision with Phase 58's `classification/` wizard directory).
  - Renders for any engagement with a completed IR35 or Schein assessment.
  - Top row: generate CTA (button label switches to "Generate SDS" or "Generate DRV defense bundle" based on `countryCode`).
  - History row: list of prior `ClassificationDocument` rows with "Download" button → calls `getDownloadUrl` tRPC query → opens signed URL in a new tab (user has 300s to complete the download).
  - Disabled state when assessment is not completed; tooltip "Generate a completed classification assessment first".

- **New component: `<Ir35ChainPanel engagementId={...} />`** rendered on GB engagements.
  - Table: Role | Display name | Email | SDS delivered? | SDS acknowledged? | Actions (mark-delivered / mark-acknowledged / edit / remove) | Drag handle for reorder.
  - "Add participant" modal (shadcn dialog) — form with role select, displayName, email, optional contractor picker for WORKER role.
  - CLIENT row is read-only (auto-populated from tenant); WORKER row is read-only when `linkedContractorId` is set.

- **Extension of existing per-engagement detail page** — mount both panels below the existing `CountryComplianceSection`. Do NOT modify `CountryComplianceSection` itself (minimises collision with Phase 58 Plans 58-02/03/04 and Phase 56/57 UI).

Phase 56 D-14 tile (latest compliance status on contractor profile) can optionally show "SDS generated · delivered to N of M participants" — but this is deferred to a follow-up if it causes churn, and is marked as a Claude's-discretion nice-to-have in CONTEXT.md.

UI chrome strings (button labels, column headers, tooltips, error messages) live in `apps/web/messages/{en,de}.json` under a new `ClassificationDocuments` namespace + existing `Classification` namespace. **Legal body text NEVER goes into messages.json** — always imported from locked constants (D-03, D-18).

---

## Pattern 9 — DRV platform cross-reference (same-tenant only)

For the DRV bundle Section 4 cross-reference table, we must be careful NOT to expose cross-tenant contractor data (ASVS V4). The query:

```ts
const crossRef = await ctx.db.contractorAssignment.findMany({
  where: {
    contractorId: engagement.contractorId,
    organizationId: ctx.organizationId,       // critical: same-tenant only
    id: { not: engagement.id },
  },
  select: { id: true, clientDisplayName: true, startDate: true, endDate: true, projectScope: true },
  orderBy: { startDate: 'desc' },
});
```

The Prisma tenant-extension enforces `organizationId` scope anyway — the explicit filter is defence-in-depth and makes intent visible. PDF footer next to the table states in German: "Diese Übersicht zeigt nur Engagements, die von Ihrer Organisation auf dieser Plattform erfasst wurden. Sie ist nicht erschöpfend." (verbatim locked text: `DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE`).

---

## Pattern 10 — `rendererVersion` composite string

Format: `"@react-pdf/renderer@<pkg-version>+<template-slug>@<template-version>"`. Examples:
- SDS: `"@react-pdf/renderer@3.4.5+ir35-sds@1"`
- DRV: `"@react-pdf/renderer@3.4.5+drv-defense-bundle@1"`

Template version is manually bumped by the developer in the template file (`export const TEMPLATE_VERSION = 1;`). Storing the composite means any future change to either the library version or the template logic forks the renderer identity — a forensic engineer can tell which template rendered a given PDF without guessing.

Package version is read at render time via `import { version as reactPdfVersion } from '@react-pdf/renderer/package.json' assert { type: 'json' }` (or `createRequire` for ESM compat). If import-assertions cause build issues, fall back to `process.env.NODE_PACKAGE_VERSION__REACT_PDF_RENDERER` populated by a build-time plugin — planner decides in execution.

---

## Sources

### Primary (HIGH confidence — verified in repo on 2026-04-13)

**Repo code / schemas:**
- `packages/api/src/pdf-templates/gdpr-privacy-notice.tsx` — React-PDF template structure + token palette (Patterns 1, 10)
- `packages/api/src/routers/legal.tsx` — `generatePrivacyNoticePdf` + `PDF_TTL_SECONDS = 300` pattern (Pattern 2)
- `packages/api/src/services/r2.ts` — `putObjectAndSignDownload` implementation; confirms `GetObjectCommand` + `getSignedUrl` pattern for `signExistingDownload` addition (Pattern 2)
- `packages/db/prisma/schema/classification.prisma` — existing `ClassificationAssessment` model + `ClassificationAssessmentStatus` enum (confirms Phase 58 Plan 58-01 shipped; new models append here, Pattern 3)
- `packages/db/prisma/schema/contractor.prisma` — `ContractorAssignment` + `Contractor` back-relation targets (Pattern 3)
- `packages/db/prisma/schema/organization.prisma` — `Organization` back-relation target (Pattern 3)
- `packages/validators/src/legal/{en,de}.ts` — existing locked-phrase module shape; extension targets for Phase 59 (Pattern 5)
- `packages/validators/src/legal/disclaimers.ts` — Phase 58 bilingual disclaimers; extension target (Pattern 5)
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — existing CI guard; extension target for `IR35_DISPUTE_*` / `SDS_*` / `DRV_DEFENSE_*` prefixes (Pattern 5)
- `apps/web/src/components/contractors/compliance/` — Phase 56 `CountryComplianceSection` dispatcher; extension target is a new sibling directory `classification-documents/` (Pattern 8)
- `apps/web/messages/{en,de}.json` — UI chrome string namespaces (Pattern 5, 8)

**Phase context:**
- `.planning/phases/58-classification-engine-rule-sets/58-CONTEXT.md` — D-03 (outcome envelope), D-06 (rule-set constants), D-07 (locked phrases), D-08 (append-only + snapshot), D-14 (DRV category weighting), D-16 (outcome visualisations) — all consumed read-only
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — Plan 07 PDF generation pattern (Pattern 1, 2)
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — tenant-scoped service + Prisma client extension precedent (Pattern 4)
- `.planning/REQUIREMENTS.md` L23, L24, L26 — CLASS-03/04/06 normative text

### Primary (HIGH confidence — regulatory sources)

- HMRC CEST tool: https://www.gov.uk/guidance/check-employment-status-for-tax
- HMRC ITEPA 2003 Chapter 10 / Chapter 8 — SDS content + 45-day dispute window
- HMRC Employment Status Manual (ESM10001+) — SDS guidance
- DRV §7a SGB IV — Statusfeststellungsverfahren procedure
- DRV Rundschreiben RS 2022/1 — Scheinselbständigkeit assessment categories (independence indicators source)

### Secondary (MEDIUM confidence — library docs & patterns)

- `@react-pdf/renderer` 3.x multi-page layout — `<Page wrap>`, absolute-positioned footer, page-number render prop: https://react-pdf.org/advanced#on-document-render
- `@react-pdf/renderer` table of contents via `<Link>` + `id` anchors: https://react-pdf.org/components#link
- AWS SDK v3 S3 presigned URLs via `getSignedUrl` (existing usage in `r2.ts` confirms pattern)
- Node `crypto.createHash('sha256')` for content-addressed keys (Node 18+ LTS — already in use elsewhere in repo for file hashing)

### Tertiary (LOW confidence — flagged for review)

- Exact English wording of `IR35_DISPUTE_PROCESS_EN` and `SDS_DISCLAIMER_EN` — proposed text must be reviewed by UK tax adviser (same sign-off pattern as Phase 58 Plan 58-05)
- Exact German wording of `DRV_DEFENSE_*` constants — must be reviewed by a Steuerberater with Rentenversicherungsrecht expertise
- Whether React-PDF supports `<Link src="#id">` anchor jumps reliably across all viewers — if not, degrade TOC to plain text "Section 3 — page 8" (planner notes this as a fallback in DRV template plan)

---

## Validation Architecture

Nyquist validation is enabled (`.planning/config.json` — `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (existing, repo-wide); `@testing-library/react` + `axe-core` for UI integration + a11y; no Playwright for this phase |
| Config file | Per-workspace `vitest.config.ts` (existing); new `packages/api` integration tests land in `packages/api/src/routers/__tests__/` alongside the existing classification / legal router tests |
| Quick run command | `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/validators test` |
| Full suite command | `pnpm test` (workspace root) |
| Estimated runtime | ~10s quick (api + validators); ~60-90s full monorepo |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLASS-03 | `generateSds` renders verdict-first PDF and persists row | integration | `pnpm --filter @contractor-ops/api test src/routers/__tests__/classification-document.test.ts` | ❌ Wave 0 |
| CLASS-03 | `generateSds` on a draft assessment throws `PRECONDITION_FAILED` | integration | same | ❌ Wave 0 |
| CLASS-03 | `generateSds` twice on same assessment produces identical SHA-256 (byte stability) | integration | same | ❌ Wave 0 |
| CLASS-03 | SDS template renders a green/red/amber pill matching `outcome.verdict` (RTL snapshot on `<IR35SDSDocument>` via `@react-pdf/renderer` `pdf().toString()`) | unit | `pnpm --filter @contractor-ops/api test src/pdf-templates/__tests__/ir35-sds.test.tsx` | ❌ Wave 0 |
| CLASS-03 | SDS template falls back to "Undetermined" pill when `verdict='undetermined'` | unit | same | ❌ Wave 0 |
| CLASS-03 | SDS template renders ONE section per IR35 area from `areaResults` | unit | same | ❌ Wave 0 |
| CLASS-03 | SDS template includes `IR35_DISPUTE_PROCESS_EN` verbatim on final page | unit | same | ❌ Wave 0 |
| CLASS-03 | SDS template reads from `questionsSnapshot`, NOT live rule-set constants | unit | same | ❌ Wave 0 |
| CLASS-04 | `listByEngagement` auto-seeds CLIENT + WORKER on first call for GB engagement | integration | `packages/api/src/routers/__tests__/ir35-chain.test.ts` | ❌ Wave 0 |
| CLASS-04 | `upsertParticipant` rejects when `linkedContractorId` belongs to another org | integration | same | ❌ Wave 0 |
| CLASS-04 | `markDelivered` sets `sdsDeliveredAt`; idempotent on re-call (keeps earliest timestamp OR updates — planner picks; test asserts the chosen behaviour) | integration | same | ❌ Wave 0 |
| CLASS-04 | `markAcknowledged` sets `sdsAcknowledgedAt` independently of `sdsDeliveredAt` | integration | same | ❌ Wave 0 |
| CLASS-04 | `reorderParticipants` assigns `orderIndex = i` per array position; rejects when ids don't match engagement | integration | same | ❌ Wave 0 |
| CLASS-04 | Multi-tenant: Org A cannot list / mutate Org B's chain | integration | same | ❌ Wave 0 |
| CLASS-04 | CLIENT / WORKER row removal is blocked or silently recreated (planner picks — test asserts chosen behaviour) | integration | same | ❌ Wave 0 |
| CLASS-06 | `generateDrvDefenseBundle` renders 4-section PDF and persists row | integration | `packages/api/src/routers/__tests__/classification-document.test.ts` | ❌ Wave 0 |
| CLASS-06 | DRV bundle Section 3 contains ALL completed DE assessments for engagement (not just latest) | integration | same | ❌ Wave 0 |
| CLASS-06 | DRV bundle Section 4 cross-reference only includes same-tenant assignments | integration | same | ❌ Wave 0 |
| CLASS-06 | DRV bundle embeds `attestationText` + `signedName` + dated line verbatim | integration | same | ❌ Wave 0 |
| CLASS-06 | DRV template renders verbatim `DRV_DEFENSE_*` locked strings | unit | `packages/api/src/pdf-templates/__tests__/drv-defense-bundle.test.tsx` | ❌ Wave 0 |
| D-05 | `signExistingDownload` signs download URL for existing R2 key without re-uploading (mock S3; assert no `PutObjectCommand`) | unit | `packages/api/src/services/__tests__/r2.test.ts` (EXTEND) | ✅ EXTEND |
| D-06 | Prisma client extension blocks `ClassificationDocument.update(...)` | integration | `packages/db/src/__tests__/tenant-scoped-client.test.ts` (EXTEND) | ✅ EXTEND |
| D-06 | `ClassificationDocument` schema has `@@index` on `(organizationId, classificationAssessmentId, kind)` | unit | Prisma schema parse test (existing pattern) | ❌ Wave 0 |
| D-07 | R2 object key matches regex `^classification-documents/{orgId}/{assessmentId}/(sds|drv-defense-bundle)-[^/]+-[a-f0-9]{16}\.pdf$` | unit | `packages/api/src/services/__tests__/classification-document-keys.test.ts` | ❌ Wave 0 |
| D-08 | `getDownloadUrl` returns TTL = 300s | integration | `classification-document.test.ts` | ❌ Wave 0 |
| D-09 | Re-running `generateSds` after rule-set version change does NOT rewrite old document bytes (assert SHA unchanged across versions) | integration | same | ❌ Wave 0 |
| D-18 | Locked phrase guard — `IR35_DISPUTE_*`, `SDS_*`, `DRV_DEFENSE_*` prefixes absent from `messages/*.json` | unit | `packages/validators/src/__tests__/locked-phrases-guard.test.ts` (EXTEND) | ✅ EXTEND |
| WCAG AA | Generate buttons have accessible names + disabled state `aria-disabled` tied to assessment status | a11y (axe) | `apps/web/src/components/contractors/classification-documents/__tests__/a11y.test.tsx` | ❌ Wave 0 |
| WCAG AA | IR35 chain table is semantically a `<table>` with `<th scope="col">`; action buttons have accessible labels | a11y (axe) | `apps/web/src/components/contractors/ir35-chain/__tests__/a11y.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/validators test && pnpm --filter @contractor-ops/db test`
- **Per wave merge:** `pnpm test` (workspace root — all tests, including web RTL)
- **Phase gate:** Full suite green + UK tax-adviser sign-off on `IR35_DISPUTE_PROCESS_EN` + Steuerberater sign-off on `DRV_DEFENSE_*` wording before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/api/src/pdf-templates/__tests__/ir35-sds.test.tsx` — SDS template unit tests (verdict pill, per-area sections, locked phrases, snapshot freeze)
- [ ] `packages/api/src/pdf-templates/__tests__/drv-defense-bundle.test.tsx` — DRV bundle unit tests (4 sections, locked phrases, risk history depth)
- [ ] `packages/api/src/routers/__tests__/classification-document.test.ts` — router integration tests (generate × 2, getDownloadUrl TTL, byte stability, same-tenant cross-ref)
- [ ] `packages/api/src/routers/__tests__/ir35-chain.test.ts` — router integration tests (auto-seed, upsert, reorder, markDelivered/Acknowledged, multi-tenant)
- [ ] `packages/api/src/services/__tests__/classification-document-keys.test.ts` — key format regex test
- [ ] EXTEND `packages/api/src/services/__tests__/r2.test.ts` — `signExistingDownload` no-upload test
- [ ] EXTEND `packages/db/src/__tests__/tenant-scoped-client.test.ts` — ClassificationDocument update-block test
- [ ] EXTEND `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — `IR35_DISPUTE_*` / `SDS_*` / `DRV_DEFENSE_*` prefix assertions
- [ ] `apps/web/src/components/contractors/classification-documents/__tests__/a11y.test.tsx` + RTL behavior tests
- [ ] `apps/web/src/components/contractors/ir35-chain/__tests__/a11y.test.tsx` + RTL behavior tests
- [ ] Prisma schema change: `packages/db/prisma/schema/classification.prisma` (+ `contractor.prisma`, `organization.prisma`, `auth.prisma` back-relations) + `[BLOCKING] pnpm --filter @contractor-ops/db db:generate && db:push` — no api tests run until this lands

Framework installation: none required — Vitest + RTL + axe + `@react-pdf/renderer` + AWS SDK v3 are all already in the repo.

---

## Security Domain

`security_enforcement` is explicitly `false` in `.planning/config.json` → threat-model block is not mandated per-plan. However, the same ASVS lenses Phase 58 applied remain relevant and are called out informally:

| Threat | Category (STRIDE) | Mitigation |
|--------|------------------|-----------|
| Cross-org read of `ClassificationDocument` | Information Disclosure | `tenantProcedure` + Prisma client extension filter; the organisation-scoped R2 key is belt-and-braces |
| Bypass signed URL by reusing another org's R2 key | Access Control | `getDownloadUrl` loads the row by id (org-scoped) and re-signs ONLY that row's `pdfKey`; direct R2 key construction by clients never trusted |
| Mutation of generated document bytes | Tampering / Repudiation | Append-only (Pattern 4) + content-addressed key (Pattern 2) — any change produces a different key, so the evidentiary row is immutable |
| PII in `sdsDeliveredNote` / attestation text leaks to logs | Information Disclosure | Free-text columns excluded from observability middleware request-body logging (existing rule; confirm Plan 59-03) |
| `linkedContractorId` references another tenant's contractor | Access Control | `upsertParticipant` checks `ctx.db.contractor.findUnique({ where: { id, organizationId: ctx.organizationId } })` — Prisma extension already enforces this but the explicit check is defence-in-depth |
| Signed URL leaked → long-lived access | Exposure | 300s TTL (D-08); `ResponseContentDisposition: attachment` so browser opens a download dialog rather than displaying |
| Stored XSS via attestation text rendered in React | Tampering + Info Disclosure | Only rendered through React (escapes by default); PDF render also escapes `<Text>` content; never `dangerouslySetInnerHTML` |
| Race on `reorderParticipants` (two tabs) | Integrity | Transaction with `updateMany` by `id IN (...)` within tx; planner may add optimistic concurrency on `updatedAt` if this proves flaky |
| DoS via `generateSds` spam | DoS | Existing `@upstash/ratelimit` pattern; planner adds a budget of e.g. 30 generations / hour / engagement |
| `rendererVersion` replay (claim "this PDF was rendered by newer code") | Repudiation | Field is append-only; audit log entry (existing audit.prisma) records the generation event with `generatedByUserId` + timestamp |

No new credentials, no new external APIs (R2 + existing AWS SDK keys). No PII leaves the tenant boundary. Security enforcement may stay off for per-plan threat-model blocks, but the above concerns are reflected in plan tasks' acceptance criteria.

---

## Pitfalls

1. **Snapshot drift** — If a future Phase 58 patch updates `ClassificationAssessment.questionsSnapshot` structure, Phase 59 templates may render blanks for missing fields. Mitigation: template code reads snapshot via typed `QuestionsSnapshot` from `@contractor-ops/classification` (Phase 58 D-08) and Vitest tests assert rendering on frozen fixtures checked into the repo.
2. **PDF byte drift on re-render** — `@react-pdf/renderer` can produce slightly different bytes across invocations if it embeds a timestamp. Mitigation: test asserts SHA-256 equality across two renders of the same props; if drift is real, pass `{ pdfVersion: '1.5' }` + fixed `creationDate` to the Document props. Byte stability is the entire point of content-addressed storage.
3. **R2 upload failure leaves row uncreated** — the order is "upload → create row"; if the row create fails post-upload, R2 has an orphan object. Mitigation: wrap in a tRPC-level try/catch that on row-create failure deletes the R2 object before rethrowing. Document this in Plan 59-02/59-04.
4. **Cross-tenant linkage via `linkedContractorId`** — a malicious payload could supply a contractor id from another tenant. Mitigation: explicit same-tenant check in `upsertParticipant` (Pattern 6 note).
5. **Reorder integrity** — `orderIndex` collisions across concurrent edits. Mitigation: server-assigned `orderIndex = position in orderedIds array`; client sends complete ordered list, never deltas.
6. **Re-sign on missing R2 object** — if an R2 object is deleted out-of-band, `signExistingDownload` returns a URL that 404s. Mitigation: `getDownloadUrl` calls `HeadObjectCommand` first; if 404, throw `NOT_FOUND` and log an alert (observability rule: "R2 object missing for ClassificationDocument row {id}").
7. **`questionsSnapshot` may be `null` on draft rows** — `generateSds` MUST check `assessment.status === 'completed' && assessment.questionsSnapshot !== null` before proceeding. Returning a 412 PRECONDITION_FAILED is clearer than a 500 crash.
8. **DRV risk-history "delta vs previous" edge case** — first assessment has no prior; template must handle `previous === null` with a placeholder ("Erste Bewertung — kein Vergleichswert").
9. **Locked phrase wording requires legal review** — same pattern as Phase 58 Plan 58-05; build in a checkpoint in Plan 59-01 (or earliest plan touching the constants) to pause for sign-off before shipping.
10. **Multi-file Prisma schema limits on `@unique`** — `Ir35OtherClientAttestation.contractorAssignmentId` gets `@unique` (one per engagement). This works cross-file because Prisma folder-mode concatenates. No partial-unique trickery needed.
11. **Message file namespace collision** — Phase 58 introduced `Classification` namespace. Phase 59 adds `ClassificationDocuments` (plural, distinct) + keys inside `Classification.chain.*` and `Classification.documents.*`. Ensure no key collisions with Phase 58 keys by reading Phase 58's `apps/web/messages/en.json` draft before adding.
12. **`Ir35ChainParticipant.orderIndex = 0` auto-seed collision** — if two tabs both hit `listByEngagement` concurrently on an empty engagement, both may attempt to seed. Mitigation: upsert-on-conflict for the CLIENT + WORKER rows (use Prisma `createMany({ skipDuplicates: true })` with a unique partial filter emulation, or wrap in a transaction with `findFirst` pre-check).
13. **`@react-pdf/renderer` anchor link fallback** — if `<Link src="#sec-1">` doesn't hyperlink in all PDF viewers, degrade TOC to plain `"Section 3 — page 8"` labels. Don't block the DRV bundle on this nicety.
14. **`rendererVersion` package import** — reading `@react-pdf/renderer/package.json` at runtime may hit ESM import-assertion compat issues. Safer: hardcode the version string via a build-time constant (rolled up via vite-define or a generated file). Planner resolves during execution.
15. **Attestation text over 4000 chars** — `Ir35OtherClientAttestation.statementText` is capped at 4000 in schema (`@db.VarChar(4000)`); matching Zod schema should clamp to 4000. If content legitimately needs more (rare), reconsider TEXT column — defer until seen in the wild.

---

## Downstream consumers

These Phase 59 artifacts are designed to feed Phase 60 (compliance health dashboard + reassessment triggers) without churn:

- `ClassificationDocument.generatedAt` — Phase 60 dashboard shows "SDS: last generated N days ago, delivered to 2 of 4 participants".
- `ClassificationDocument.sha256Hash` — Phase 60 can show a "Document unchanged since generation" checkmark.
- `Ir35ChainParticipant.sdsDeliveredAt / sdsAcknowledgedAt` — Phase 60 feeds these into the delivery-status widget.
- `Ir35OtherClientAttestation.signedAt` — Phase 60 can trigger a "re-attestation required after 12 months" reassessment.

No schema changes are anticipated in Phase 60 — only new queries on existing rows.
