# Phase 58: Classification Engine & Rule Sets - Research

**Researched:** 2026-04-12
**Domain:** Regulatory-compliance decision engines (UK IR35 + German Scheinselbständigkeit), pluggable rule-set architecture, immutable-snapshot assessment storage, multi-step wizard UX with server-side draft autosave
**Confidence:** HIGH on architecture (direct codebase mirror), MEDIUM-HIGH on regulatory content (CEST/DRV primary sources cited verbatim), MEDIUM on exact question inventory (Steuerberater / UK tax-adviser review is a Phase 56/57 pattern that should repeat here)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Engine Architecture**
- **D-01:** New workspace `packages/classification` with abstract `ClassificationProfile` base class. Subclasses `IR35Profile` and `ScheinselbstandigkeitProfile` extend it. Profile registry lookup by `contractor.countryCode` (GB → IR35, DE → Scheinselbständigkeit). Mirrors `packages/einvoice` profile-per-country + `packages/gov-api` abstract client pattern.
- **D-02:** Abstract base exposes: `buildAssessment(engagementId): AssessmentShell`, `scoreAssessment(answers): Outcome`, `renderOutcome(assessment): OutcomeView`. Per-country subclasses override all three. Registry method: `getProfileForCountry(countryCode)`.
- **D-03:** Outcome envelope: `Assessment { id, organizationId, contractorAssignmentId, countryCode, ruleSetVersion, status, questionsSnapshot, answers, outcome, completedAt, disclaimerAcknowledgedAt, immutableAfter }`. `outcome` is a TypeScript discriminated union on `countryCode`:
  - `Ir35Outcome = { kind: 'IR35', verdict: 'inside'|'outside'|'undetermined', areaResults: Ir35AreaResult[], reasoning }`
  - `ScheinselbstandigkeitOutcome = { kind: 'SCHEINSELBSTANDIGKEIT', riskLevel: 'green'|'amber'|'red', totalScore: number, categoryBreakdown: ScheinCategoryResult[] }`

**Storage Model**
- **D-04:** New Prisma model `ClassificationAssessment` linked to `ContractorAssignment`. Multi-tenant scoped by `organizationId`. One draft per engagement at a time; completed assessments are append-only. Schema: `id`, `organizationId`, `contractorAssignmentId` (FK), `countryCode`, `ruleSetVersion`, `status` (`'draft'|'completed'`), `questionsSnapshot` JSONB, `answers` JSONB, `outcome` JSONB (nullable while draft), `completedAt`, `disclaimerAcknowledgedAt`, `immutableAfter`, `createdAt`, `updatedAt`.
- **D-05:** Contractor profile links to the engagement's latest completed assessment. Phase 56 `CountryComplianceSection` gains a "Classification" tile per engagement.

**Rule-Set Representation**
- **D-06:** Criteria live as typed `as const` TypeScript constants in `packages/classification/src/rule-sets/{ir35.ts,scheinselbstandigkeit.ts}`. Each question: `{ id, area/category, prompt: { en, pl, de }, helpText: { en, pl, de }, caseLawCitation (IR35) OR drvReference (DE), answerType, weight, required }`.
- **D-07:** Prompt text inline in TS. Mandatory German phrases imported verbatim from `packages/validators/src/legal/de.ts` — extend Phase 56's locked-phrase set with `CLASSIFICATION_SCHEIN_*` constants. CI guard (Phase 56 `locked-phrases-guard.test.ts`) extended to assert these render verbatim in wizard UI.
- **D-08:** Rule-set versioning via `RULE_SET_VERSION` constant per rule set (e.g. `'IR35-2024-CEST'`, `'SCHEINSELBSTANDIGKEIT-DRV-2024'`). On completion, the full `questionsSnapshot` (prompts + weights) persisted to the row so old assessments render correctly after future updates.

**Assessment Workflow & UX**
- **D-09:** Multi-step wizard by area/category. IR35: 5 steps (substitution → control → financial risk → part-and-parcel → MOO); Scheinselbständigkeit: 4 steps (integration → entrepreneurial independence → personal dependency → economic dependency). Progress bar + step breadcrumb. Outcome computed only after final Submit.
- **D-10:** Draft autosave on every answer change — `ClassificationAssessment` row with `status='draft'` updated server-side so users can resume on any device. On Submit: status → `'completed'`, `immutableAfter` set, outcome computed + stored. Starting a new assessment on the same engagement creates a new row (append-only).
- **D-11:** Optional questions allowed; IR35 short-circuits to `undetermined` when critical areas have insufficient signal (mirrors HMRC CEST). DRV criteria all required, but `Nicht anwendbar` scores 0.
- **D-12:** Blocking disclaimer modal after Submit, before outcome renders. Modal text from new module `packages/validators/src/legal/disclaimers.ts`. User must tick 'I understand' to view outcome; `disclaimerAcknowledgedAt` stored.

**Scoring & Outcome Thresholds**
- **D-13:** IR35 composite-rule scoring. Each of 5 areas yields `'strong-outside' | 'leaning-outside' | 'neutral' | 'leaning-inside' | 'strong-inside'`. Dispositive: any `strong-inside` on Substitution OR MOO → `inside`; any `strong-outside` on Substitution → `outside`. Otherwise count leaning signals: ≥3 leaning-inside → `inside`, ≥3 leaning-outside → `outside`, else or ≥2 neutral critical areas → `undetermined`.
- **D-14:** DRV Scheinselbständigkeit weighted sum. Each criterion `0|1|2|3`. Category weights: integration 30 %, entrepreneurial independence 30 %, personal dependency 25 %, economic dependency 15 %. Total 0-100. Thresholds: <30 green, 30-60 amber, >60 red. Per-category breakdown shows category-average vs category-max.
- **D-15:** Phase 58 captures economic-dependency billing-ratio (0-100). Phase 60 adds 70 %/83.33 % alerts.
- **D-16:** Outcome visualizations:
  - IR35: verdict banner pill + 5 area cards with area verdict pill + 2-3 driving questions
  - DRV: traffic-light banner + 4 horizontal category bars (weighted fill) + total score vs threshold markers; each category expandable to criterion breakdown

### Claude's Discretion

- Exact IR35 question inventory and CEST-aligned wording (official CEST reference)
- Exact DRV criterion inventory (DRV Rundschreiben RS 2022/1)
- Weight tuning within DRV categories (criteria inside a category)
- Answer-type enum (Yes/No vs Likert vs multi-select) per question
- Exact disclaimer wording beyond minimum legal phrasing (with Steuerberater review)
- Progress-bar visual styling (matches Phase 56)
- Whether to render outcome SSR or CSR (decided: SSR per UI-SPEC Open Item 2)
- Assessment list page layout (confirmed: Table ≥1024 px, cards below)
- Basic export-to-PDF via `window.print()` (full regulatory PDF is Phase 59)

### Deferred Ideas (OUT OF SCOPE)

- SDS PDF generation — Phase 59
- IR35 chain participant tracking — Phase 59
- DRV audit defense bundle — Phase 59
- Economic-dependency alert thresholds (70 %/83.33 %) — Phase 60
- Reassessment triggers — Phase 60
- Statusfeststellungsverfahren tracking — Phase 60
- Compliance health dashboard — Phase 60
- Full regulatory-grade PDF — Phase 59
- ML/fuzzy scoring — out of scope for v5.0
- Rule-set versioning UI to switch historic/current — future
- Bulk assessment runner — future
- Third country rule sets beyond UK/DE — out of scope for v5.0
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLASS-01 | Generic pluggable classification engine supporting multiple country rule sets | §Standard Stack (profile registry + abstract base mirror `packages/einvoice`), §Architecture Patterns (registry + profile interface), §Code Examples (profile skeleton) |
| CLASS-02 | UK IR35 CEST-aligned assessment across 5 areas → inside/outside/undetermined | §Regulatory Domain — IR35 CEST (5 areas, dispositive-rule scoring, case-law citations), §Code Examples (IR35 scoring function) |
| CLASS-05 | German Scheinselbständigkeit assessment using ~20 DRV criteria across 4 categories → traffic-light | §Regulatory Domain — DRV Rundschreiben RS 2022/1 (4-category weighted scoring, criterion inventory), §Code Examples (DRV scoring function) |
| CLASS-11 | Assessments stored per-engagement (ContractorAssignment), append-only history | §Storage Model (Prisma schema + indexes), §Architecture Patterns (append-only lifecycle) |
</phase_requirements>

## Summary

Phase 58 builds a new `packages/classification` workspace that mirrors the already-shipped `packages/einvoice` profile-per-country pattern (D-01). The engine is two moving parts: a tiny abstract `ClassificationProfile` base + registry (model after `packages/einvoice/src/registry.ts` + `EInvoiceProfile` interface) and two rule-set files with typed `as const` question constants (IR35, Scheinselbständigkeit). Assessment data lives in a new `ClassificationAssessment` Prisma model anchored to `ContractorAssignment` with a `questionsSnapshot` JSONB for audit defensibility (D-04, D-08). The wizard is a standard React Hook Form + Zod discriminated-union multi-step form with server-side draft autosave; tRPC router on `tenantProcedure` handles createDraft / saveAnswer / submit / acknowledgeDisclaimer.

The regulatory content is the hardest part. IR35 scoring is **composite-rule, NOT weighted sum** — Substitution and Mutuality of Obligation are dispositive per *Ready Mixed Concrete v MPNI [1968]*, *Atholl House [2022] UKSC*, and the 2022 Supreme Court PGMOL ruling. Getting this wrong is a legal-liability exposure, not just a code quality issue — the CEST tool itself is widely criticised for mis-weighting substitution, which is why our disclaimer (D-12) is blocking. DRV scoring is simpler (weighted sum with 30/30/25/15 category weights, aligned with DRV Rundschreiben RS 2022/1 guidance) but every criterion needs a `drvReference` citation for audit defense.

**Primary recommendation:** Create the package skeleton + Prisma schema in Wave 0, implement both rule-set constants + scoring functions in Wave 1 (pure units, easy to test), wire the tRPC router + wizard in Wave 2, land the disclaimer modal + outcome pages in Wave 3. Steuerberater review of DE question inventory + UK tax-adviser review of IR35 wording is a parallel track (same pattern as Phase 56's STATE.md blocker entry — planner MUST include a human-review checkpoint task).

## Project Constraints (from CLAUDE.md)

| Directive | Phase 58 Application |
|-----------|----------------------|
| Turborepo monorepo, clean architecture boundaries | New `packages/classification` workspace — zero leakage into `apps/web` beyond tRPC router wiring [VERIFIED: CLAUDE.md + existing `packages/einvoice` pattern] |
| Next.js + tRPC + Prisma + Zod + RHF + shadcn/ui + Tailwind | All phase code stays inside this stack — no new frameworks [VERIFIED: `apps/web/package.json`] |
| ctx7 for library docs | Planner MUST use ctx7 when touching Radix `AlertDialog`, React Hook Form multi-step, Zod discriminatedUnion [VERIFIED: CLAUDE.md line "Always use ctx7"] |
| Production-grade, WCAG AA | Disclaimer modal is `role="alertdialog"`, verdict communication never colour-only, 44×44 touch targets on tablet [VERIFIED: UI-SPEC §Accessibility] |
| Schema validation at all external boundaries | Zod schemas at tRPC input + RHF resolver + Prisma `@db.Json` — every answer payload validated [VERIFIED: CLAUDE.md + Phase 56 pattern] |
| Security best practices | Multi-tenant via `tenantProcedure` (ALS + Prisma extension) — every `ClassificationAssessment` query scoped to `organizationId` [VERIFIED: `packages/api/src/middleware/tenant.ts`] |
| Explicit, meaningful naming | Profile classes, scoring functions, answer types — no abbreviations; e.g. `Ir35AreaVerdict` not `Ir35Av` [CITED: CLAUDE.md Code Quality] |
| Strong typing, avoid `any` | Discriminated union on `Assessment.outcome.kind`; `as const` for rule-set question tuples; typed `LockedDePhraseKey` pattern repeats for `DISCLAIMER_*` [VERIFIED: existing `packages/validators/src/legal/de.ts`] |
| Observability — no silent failures | Autosave errors surface via toast + retry; tRPC errors logged through existing `observabilityMiddleware` (init.ts) [VERIFIED: `packages/api/src/init.ts`] |
| Database: reversible migrations | `ClassificationAssessment` added via Prisma migration, not `db push`; rollback path documented [VERIFIED: Phase 56 migration pattern] |
| i18n Polish + English + German + Arabic | Wizard chrome in `messages/{en,pl,de,ar}.json` `Classification` namespace; question prompts inline in TS constants (D-07) [VERIFIED: UI-SPEC §Copywriting Contract] |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@trpc/server`, `@trpc/client` | ^11.16.0 | Classification router (createDraft, saveAnswer, submit, acknowledgeDisclaimer, getLatest, listByContractor) | Already the repo's API layer; tenantProcedure gives multi-tenant scoping for free [VERIFIED: `apps/web/package.json`] |
| `@prisma/client`, `prisma` | ^7.7.0 | `ClassificationAssessment` model + JSONB columns for `questionsSnapshot` / `answers` / `outcome` | Existing ORM; Prisma 7 supports JSONB natively [VERIFIED: `packages/db/package.json`] |
| `zod` | ^3.25.76 | Discriminated union schemas for `Assessment.outcome`, per-question answer validation, tRPC input guards | Required by CLAUDE.md "schema validation at all external boundaries"; matches Phase 56 pattern [VERIFIED] |
| `react-hook-form` | ^7.72.1 | Wizard form state, per-step validation, dirty tracking for autosave trigger | Already used in every form in the repo [VERIFIED] |
| `@hookform/resolvers` | ^5.2.2 | Zod resolver for RHF | Same as Phase 56 [VERIFIED] |
| `@base-ui/react` (Radix primitives) | ^1.3.0 | `AlertDialog` (blocking disclaimer), `Progress`, `RadioGroup`, `Collapsible`, `Checkbox` — all already present in `apps/web/src/components/ui/` | shadcn/ui default; no new shadcn adds required per UI-SPEC verification [VERIFIED: `apps/web/src/components/ui/` has `alert-dialog.tsx`, `progress.tsx`, `radio-group.tsx`, `collapsible.tsx`] |
| `next-intl` | ^4.9.1 | `Classification` namespace in `messages/{en,pl,de,ar}.json`; `useTranslations('Classification')` in wizard chrome | Already configured with de locale in Phase 56 [VERIFIED] |
| `superjson` | ^2.2.6 | tRPC transformer — handles Date (for `immutableAfter`), BigInt, Map natively in assessment payload | Already the repo's tRPC transformer [VERIFIED: `packages/api/src/init.ts`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | ^2.0.7 | Autosave failure toast, submit-fail retry toast | Per UI-SPEC §Interaction 4 — toast on autosave network error |
| `lucide-react` | ^1.8.0 | `CircleCheck`, `CircleX`, `CircleHelp`, `ShieldCheck`, `ShieldAlert`, `ShieldX`, `AlertTriangle`, `ChevronRight`, `Loader2`, `TrendingUp`, `TrendingDown`, `Minus` | Per UI-SPEC §Color semantic triad table |
| `date-fns` | ^4.1.0 | Format `completedAt`, `immutableAfter` in outcome page + assessment list | Already the repo's date lib [VERIFIED] |
| `Intl.RelativeTimeFormat` | native | "Saved 3 min ago" autosave pill | UI-SPEC Open Item 11 explicitly locks native API — zero new dep |
| `vitest` | (repo) | Unit tests for scoring functions, rule-set snapshot immutability, locked-phrases guard extension | Existing test runner [VERIFIED: `apps/web/package.json` `test` script] |
| `@testing-library/react` (indirect via vitest setup) | existing | Wizard + autosave component integration tests | Standard in repo |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom wizard shell (Card + Progress + step indicator) | shadcn `Tabs` | UI-SPEC Open Item 1 explicitly rejects Tabs — it implies equal-status sections; a wizard is strictly sequential and enforces submit-once state machine. KEEP custom shell. |
| `@react-pdf/renderer` for outcome PDF | Native `window.print()` | UI-SPEC Open Item 4 locks `window.print()` for Phase 58; full React-PDF is Phase 59 (SDS/DRV audit bundle). KEEP `window.print()`. |
| Zustand for wizard state | React Hook Form only | RHF already tracks form state. Zustand would be redundant and break the RHF-Zod resolver flow. KEEP RHF-only. |
| Separate `IR35Assessment` + `DrvAssessment` tables | Single `ClassificationAssessment` with discriminated `outcome` JSONB | D-03 locks the single-table + discriminated union. Two tables would duplicate indexes, break `listByContractor` ordering, and prevent the generic engine from doing `getLatestForEngagement(engagementId)` without a union query. KEEP single table. |
| `zod.discriminatedUnion('kind', [...])` for outcome | Tagged literal type only | Runtime validation at the tRPC boundary needs Zod; compile-time TS union is necessary but not sufficient. KEEP both. |

**Installation:**
No new dependencies required. All libraries are already installed. Planner confirms via `apps/web/package.json` grep + `packages/validators/package.json` grep before adding any task that proposes `npm install`.

**Version verification:**
Versions verified from `apps/web/package.json` (read during research, 2026-04-12). No version bumps required for Phase 58.

## Architecture Patterns

### Recommended Project Structure

```
packages/classification/
├── package.json                                 # workspace package, exports src/index.ts
├── src/
│   ├── index.ts                                 # public API — mirror packages/einvoice/src/index.ts
│   ├── registry.ts                              # getProfileForCountry, registerProfile, listProfiles
│   ├── types/
│   │   ├── profile.ts                           # ClassificationProfile interface
│   │   ├── assessment.ts                        # Assessment, AssessmentShell, AnswerMap
│   │   ├── outcome.ts                           # Ir35Outcome, ScheinselbstandigkeitOutcome, discriminated union
│   │   └── rule-set.ts                          # RuleSetQuestion, AnswerType, AreaOrCategory
│   ├── profiles/
│   │   ├── ir35/
│   │   │   ├── index.ts                         # IR35Profile class
│   │   │   ├── rule-set.ts                      # IR35_QUESTIONS as const + RULE_SET_VERSION='IR35-2024-CEST'
│   │   │   ├── scoring.ts                       # scoreIr35(answers) — composite-rule engine (D-13)
│   │   │   ├── area-scoring.ts                  # Per-area verdict helpers
│   │   │   └── __tests__/
│   │   │       ├── scoring.test.ts              # every dispositive + leaning combination
│   │   │       └── rule-set.test.ts             # snapshot immutability, every question has caseLawCitation
│   │   └── scheinselbstandigkeit/
│   │       ├── index.ts                         # ScheinselbstandigkeitProfile class
│   │       ├── rule-set.ts                      # SCHEIN_QUESTIONS + category weights + RULE_SET_VERSION
│   │       ├── scoring.ts                       # scoreSchein(answers) — weighted sum + threshold (D-14)
│   │       └── __tests__/
│   │           ├── scoring.test.ts              # threshold boundary + weight math
│   │           └── rule-set.test.ts             # every criterion has drvReference
│   ├── schemas/
│   │   ├── assessment.ts                        # assessmentSchema (Zod discriminated union on countryCode)
│   │   └── answers.ts                           # per-answer-type Zod schemas
│   └── snapshot.ts                              # buildQuestionsSnapshot(profile) — freeze at submit time
└── tsconfig.json

packages/validators/src/legal/disclaimers.ts      # NEW — DISCLAIMER_IR35_*, DISCLAIMER_SCHEIN_* constants
packages/validators/src/legal/de.ts               # EXTEND — add CLASSIFICATION_SCHEIN_* + merge into RESERVED_LEGAL_KEYS
packages/validators/src/__tests__/locked-phrases-guard.test.ts  # EXTEND — cover CLASSIFICATION_* + DISCLAIMER_* patterns

packages/db/prisma/schema/classification.prisma   # NEW — ClassificationAssessment model

packages/api/src/routers/classification.ts        # NEW — tRPC router (createDraft, saveAnswer, submit, acknowledgeDisclaimer, getLatest, listByContractor)
packages/api/src/root.ts                          # EXTEND — wire classification router

apps/web/src/app/[locale]/contractors/[id]/engagements/[engagementId]/classification/
├── page.tsx                                      # Wizard entry (resolves profile from engagement.countryCode)
└── [assessmentId]/page.tsx                       # Outcome page (SSR)
apps/web/src/app/[locale]/contractors/[id]/classification/page.tsx   # List view

apps/web/src/components/contractors/classification/
├── classification-tile.tsx
├── classification-engagement-cta.tsx
├── classification-disclaimer-dialog.tsx
├── classification-assessment-list.tsx
├── wizard/                                       # (all wizard components per UI-SPEC §Component Inventory)
└── outcome/                                      # (verdict banner, area cards, DRV bars per UI-SPEC §Component Inventory)

apps/web/messages/{en,pl,de,ar}.json              # EXTEND — Classification namespace (chrome only; prompts stay in TS)
```

### Pattern 1: Profile Registry (mirror of `packages/einvoice/src/registry.ts`)

**What:** A `Map<string, ClassificationProfile>` with `register`, `get`, `list`, `clear`. Country code (GB / DE) keys the map via an `accepts(countryCode)` method OR a `country` readonly property.

**When to use:** Every country rule set. Do NOT branch on `countryCode` in the router or in the wizard — always resolve through the registry.

**Example (adapted from `packages/einvoice/src/registry.ts`):**
```typescript
// packages/classification/src/registry.ts
// Source pattern: packages/einvoice/src/registry.ts (VERIFIED)
import type { ClassificationProfile } from './types/profile.js';

const profiles = new Map<string, ClassificationProfile>();

export function registerProfile(profile: ClassificationProfile): void {
  if (profiles.has(profile.profileId)) {
    throw new Error(`Classification profile already registered: ${profile.profileId}`);
  }
  profiles.set(profile.profileId, profile);
}

export function getProfileForCountry(countryCode: string): ClassificationProfile {
  for (const p of profiles.values()) {
    if (p.country === countryCode) return p;
  }
  throw new Error(
    `No classification profile for country: ${countryCode}. Available: ${
      Array.from(profiles.values()).map(p => p.country).join(', ') || 'none'
    }`,
  );
}

export function clearProfiles(): void {
  profiles.clear(); // for testing only — mirror einvoice pattern
}
```

### Pattern 2: Profile Interface (mirror of `packages/einvoice/src/types/profile.ts`)

**What:** A `ClassificationProfile` interface with three methods (D-02: `buildAssessment`, `scoreAssessment`, `renderOutcome`) + readonly metadata.

**When to use:** Both `IR35Profile` and `ScheinselbstandigkeitProfile` implement this directly. Later country additions (France, Netherlands, etc.) implement it unmodified.

**Example:**
```typescript
// packages/classification/src/types/profile.ts
import type { Assessment, AssessmentShell, AnswerMap } from './assessment.js';
import type { Outcome, OutcomeView } from './outcome.js';

export interface ClassificationProfile {
  readonly profileId: string;         // e.g. 'ir35' | 'scheinselbstandigkeit'
  readonly country: string;           // ISO 3166-1 alpha-2
  readonly displayName: string;       // 'IR35 (UK)' | 'Scheinselbständigkeit (DE)'
  readonly ruleSetVersion: string;    // e.g. 'IR35-2024-CEST'

  /** Shape a new draft with the current rule set's questions. */
  buildAssessment(engagementId: string): AssessmentShell;

  /** Compute the outcome from collected answers. Pure function — no I/O. */
  scoreAssessment(answers: AnswerMap): Outcome;

  /** Shape the server-rendered outcome view model from a completed Assessment row. */
  renderOutcome(assessment: Assessment): OutcomeView;
}
```

### Pattern 3: Discriminated Union for Outcome (D-03)

**What:** Zod `discriminatedUnion('kind', [ir35OutcomeSchema, scheinOutcomeSchema])` on the `outcome` JSONB column; matching TS union inferred from Zod.

**When to use:** Every place that reads `assessment.outcome` — the router's `getLatest` query, the SSR outcome page, the contractor-profile tile, the list view.

**Example:**
```typescript
// packages/classification/src/schemas/assessment.ts
import { z } from 'zod';

export const ir35AreaVerdictSchema = z.enum([
  'strong-outside', 'leaning-outside', 'neutral', 'leaning-inside', 'strong-inside'
]);

export const ir35AreaResultSchema = z.object({
  area: z.enum(['substitution', 'control', 'financial-risk', 'part-and-parcel', 'moo']),
  verdict: ir35AreaVerdictSchema,
  drivingQuestionIds: z.array(z.string()).max(3),
});

export const ir35OutcomeSchema = z.object({
  kind: z.literal('IR35'),
  verdict: z.enum(['inside', 'outside', 'undetermined']),
  areaResults: z.array(ir35AreaResultSchema).length(5),
  reasoning: z.string().max(2000),
});

export const scheinOutcomeSchema = z.object({
  kind: z.literal('SCHEINSELBSTANDIGKEIT'),
  riskLevel: z.enum(['green', 'amber', 'red']),
  totalScore: z.number().min(0).max(100),
  categoryBreakdown: z.array(
    z.object({
      category: z.enum(['integration', 'entrepreneurial', 'personal-dep', 'economic-dep']),
      weight: z.number(),
      weightedScore: z.number(),
      maxWeightedScore: z.number(),
      criterionAnswers: z.array(z.object({
        questionId: z.string(),
        rawScore: z.number().int().min(0).max(3),
      })),
    })
  ).length(4),
});

export const outcomeSchema = z.discriminatedUnion('kind', [ir35OutcomeSchema, scheinOutcomeSchema]);
export type Outcome = z.infer<typeof outcomeSchema>;
```

### Pattern 4: `questionsSnapshot` Immutability (D-08)

**What:** On `submit`, deep-clone and freeze the current rule-set's questions + weights into the row. The outcome page reads from the snapshot, NEVER from the live rule-set constant.

**When to use:** Always — the audit-defensibility rationale is LOAD-BEARING. When HMRC or DRV later audits a 2026 assessment, the 2028 rule set could have different wording; the snapshot preserves exactly what the user answered against.

**Example:**
```typescript
// packages/classification/src/snapshot.ts
import type { ClassificationProfile } from './types/profile.js';

export function buildQuestionsSnapshot(profile: ClassificationProfile): object {
  const shell = profile.buildAssessment('snapshot-only');
  return Object.freeze(structuredClone({
    ruleSetVersion: profile.ruleSetVersion,
    profileId: profile.profileId,
    questions: shell.questions,   // full {id, prompt, helpText, citation, weight, ...} per question
  }));
}
```

The tRPC `submit` mutation stores this as `questionsSnapshot: buildQuestionsSnapshot(profile)`. The outcome page reads `assessment.questionsSnapshot.questions[i].prompt.de` to render — so even if `IR35_QUESTIONS` in source is later amended, historical assessments stay stable.

### Pattern 5: Append-Only Assessment Lifecycle (D-04, D-10)

**What:** Each `submit` creates a NEW row. `draft → completed` is one-way. "Re-run" never revives or edits a completed assessment.

**Why:** Compliance-sensitive data mirror of Phase 51's `ConsentRecord` + Phase 57's `TaxIdValidation` append-only patterns.

**Example router:**
```typescript
// packages/api/src/routers/classification.ts (skeleton)
import { router } from '../init.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { getProfileForCountry } from '@contractor-ops/classification';

export const classificationRouter = router({
  createDraft: tenantProcedure
    .input(z.object({ contractorAssignmentId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.db.contractorAssignment.findUnique({
        where: { id: input.contractorAssignmentId },
        include: { contractor: true },
      });
      if (!assignment) throw new TRPCError({ code: 'NOT_FOUND' });

      // Guard: one draft per engagement at a time (D-04)
      const existing = await ctx.db.classificationAssessment.findFirst({
        where: { contractorAssignmentId: input.contractorAssignmentId, status: 'draft' },
      });
      if (existing) return existing;

      const profile = getProfileForCountry(assignment.contractor.countryCode);
      const shell = profile.buildAssessment(input.contractorAssignmentId);

      return ctx.db.classificationAssessment.create({
        data: {
          organizationId: ctx.organizationId,
          contractorAssignmentId: input.contractorAssignmentId,
          countryCode: assignment.contractor.countryCode,
          ruleSetVersion: profile.ruleSetVersion,
          status: 'draft',
          questionsSnapshot: null,           // not frozen until submit
          answers: {},
          outcome: null,
        },
      });
    }),

  saveAnswer: tenantProcedure
    .input(z.object({
      assessmentId: z.string().cuid(),
      questionId: z.string(),
      answer: z.unknown(),                   // validated per-question inside
    }))
    .mutation(async ({ ctx, input }) => {
      // Idempotent upsert into answers JSONB
      // Zod-validate per questionId's answerType before writing
      // Throws if status !== 'draft'
    }),

  submit: tenantProcedure
    .input(z.object({ assessmentId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.classificationAssessment.findUnique({
        where: { id: input.assessmentId, status: 'draft' },
      });
      if (!draft) throw new TRPCError({ code: 'NOT_FOUND' });
      const profile = getProfileForCountry(draft.countryCode);
      const outcome = profile.scoreAssessment(draft.answers as AnswerMap);
      const snapshot = buildQuestionsSnapshot(profile);
      return ctx.db.classificationAssessment.update({
        where: { id: draft.id },
        data: {
          status: 'completed',
          outcome,
          questionsSnapshot: snapshot,
          completedAt: new Date(),
          immutableAfter: new Date(),
        },
      });
    }),

  acknowledgeDisclaimer: tenantProcedure
    .input(z.object({ assessmentId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.classificationAssessment.update({
        where: { id: input.assessmentId, status: 'completed' },
        data: { disclaimerAcknowledgedAt: new Date() },
      });
    }),

  getLatest: tenantProcedure
    .input(z.object({ contractorAssignmentId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.classificationAssessment.findFirst({
        where: { contractorAssignmentId: input.contractorAssignmentId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
      });
    }),

  listByContractor: tenantProcedure
    .input(z.object({ contractorId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.classificationAssessment.findMany({
        where: { contractorAssignment: { contractorId: input.contractorId } },
        orderBy: [{ status: 'desc' /* draft first */ }, { completedAt: 'desc' }],
      });
    }),
});
```

### Anti-Patterns to Avoid

- **Branching on `countryCode` inside the wizard component.** Resolve through the registry. Otherwise adding a third country means editing the wizard.
- **Storing `outcome` as free JSON without a Zod discriminated union.** Silent contract drift will happen across releases. Use `outcomeSchema.parse(row.outcome)` on every read.
- **Reading current `IR35_QUESTIONS` constant from the outcome page.** Always read `assessment.questionsSnapshot.questions` — otherwise upgrading the rule set breaks historical audits.
- **Using `Tabs` for the wizard.** UI-SPEC Open Item 1 locks against this — Tabs implies equal-status, wizard is strictly sequential.
- **Client-side scoring.** `scoreAssessment` lives on the server inside the tRPC `submit` handler. Client renders the result. Never score on the client — that's defeat-the-audit territory.
- **Hard-coding dispositive rules inline.** Write `scoreIr35` as a pure function; test every combination. The 2022 PGMOL Supreme Court ruling could shift dispositive weight — isolated function is easy to revise.
- **Letting `answers` drift without schema.** Each `questionId` has an `answerType`; `saveAnswer` Zod-validates against that answerType. Otherwise a rogue client could save a string where a number is expected → scoring explodes at submit.
- **Treating "Not applicable" as missing.** DRV "Nicht anwendbar" scores 0 but IS an answer (D-11). Missing answer ≠ 0.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-step wizard state machine | Custom state-chart library | RHF `useForm` per wizard + step-index state via `useState` or `nuqs` | RHF already tracks dirty + touched + errors per step; adding a state machine library for a 5-step form is overengineering. UI-SPEC Open Item 1 locks the custom Card+Progress shell. |
| Debounced autosave | Manual `setTimeout` logic | Standard RHF `watch` + debounced `useEffect` (500 ms for textareas, blur-trigger for radios/numbers) | Every form in the repo uses this pattern [CITED: UI-SPEC §Interaction 4]. No `lodash.debounce` or `use-debounce` dependency needed. |
| Relative time ("Saved 3 min ago") | `date-fns/formatDistance` or a custom function | `Intl.RelativeTimeFormat` (native, locale-aware) | UI-SPEC Open Item 11 locks this. Zero dependency, handles `de-DE` + `ar-SA` natively. |
| Blocking modal with Escape/overlay disabled | Custom overlay component | shadcn `AlertDialog` (Radix) with `onInteractOutside={e => e.preventDefault()}` + `onEscapeKeyDown={e => e.preventDefault()}` | Radix AlertDialog has the correct `role="alertdialog"` + focus trap + `aria-labelledby`/`aria-describedby` wiring. Already installed. [VERIFIED: `apps/web/src/components/ui/alert-dialog.tsx` present] |
| Immutable snapshot | Manual `JSON.parse(JSON.stringify(...))` | `structuredClone(...)` + `Object.freeze` | `structuredClone` is supported in Node 17+ and handles Dates, Maps, typed arrays — `JSON.parse` does not. |
| Discriminated-union runtime validation | Custom type guards | `z.discriminatedUnion('kind', [...])` | Zod native, cleaner type inference, works with tRPC transformer. |
| Weighted-sum with threshold mapping | Nested `if/else` | Pure function with a `THRESHOLDS: readonly [...]` constant + binary search or direct comparison | Test coverage of threshold boundaries (29.99, 30, 60, 60.01) is trivial for a pure function; buried `if/else` in a component is not. |
| Per-Bundesland translation of DRV criteria | Not needed — DRV criteria are federal | Keep DE prompts federal; no Bundesland-specific fork | Phase 56's Steuernummer regex is Bundesland-specific, but DRV status determination is federal (§ 7a SGB IV is federal law). Don't over-generalise. |
| PDF generation | React-PDF pipeline | `window.print()` + print stylesheet | UI-SPEC Open Item 4 explicitly defers to Phase 59 for regulatory-grade PDF. |
| Storing rule-set versions in DB | Rule-set versions table | `RULE_SET_VERSION` constant in source + `ruleSetVersion` string column on assessment | DB-driven versioning is deferred (Deferred Ideas list in CONTEXT.md). Keep it source-driven for Phase 58. |

**Key insight:** This is a "boring Lego" phase — the boring parts (wizard UX, server storage, registry) are all solved patterns already in the codebase. The novel parts are (1) the regulatory content (IR35 + DRV) and (2) the scoring functions. Concentrate engineering attention there; everything else is pattern-match to existing phases.

## Regulatory Domain

This section is the load-bearing research for CLASS-02 and CLASS-05. The planner and executor MUST treat this content as the source of truth for question inventory and scoring logic. A Steuerberater / UK tax-adviser review checkpoint (mirror of Phase 56 pattern) is REQUIRED before the phase ships.

### IR35 (UK) — CEST-Aligned Assessment

**Primary source:** HMRC CEST (Check Employment Status for Tax) tool at [gov.uk/guidance/check-employment-status-for-tax](https://www.gov.uk/guidance/check-employment-status-for-tax) [CITED]. CEST was updated in April 2025 with refined guidance on substitution and financial risk; the underlying technical principles (5 areas + dispositive tests) are unchanged [CITED: [Bird & Bird — Closer Look at HMRC's Updated CEST Tool, 2025](https://www.twobirds.com/en/insights/2025/uk/spot-the-difference-a-closer-look-at-hmrcs-updated-cest-tool)].

**Case law that drives scoring (dispositive rule rationale — D-13):**

| Case | Citation | Relevance to Phase 58 |
|------|----------|-----------------------|
| Ready Mixed Concrete (South East) Ltd v MPNI | [1968] 2 QB 497 | Foundational three-stage test: personal service, mutuality, control. Our 5 areas unpack these three. [CITED: widespread legal reference] |
| Hall v Lorimer | [1994] ICR 218 (CA) | Emphasis on financial risk + in-business-on-own-account as a counterweight to control. Drives the financial-risk area. [CITED] |
| HMRC v Atholl House Productions Ltd | [2022] UKSC (confirmed on appeal) | Substitution as primary dispositive factor; "Stage 3" balancing test. Drives our "strong-outside on Substitution → outside" rule. [CITED: CONTEXT.md canonical refs] |
| HMRC v Professional Game Match Officials Ltd (PGMOL) | [2024] UKSC | MOO exists whenever a contract (even verbal) exists; MOO must be assessed in its quality, not merely existence. Drives our "strong-inside on MOO → inside" dispositive rule. [CITED: [Worksome — UK's Supreme Court on Mutuality of Obligation](https://www.worksome.com/blog/the-uks-supreme-court-takes-a-firm-stand-on-mutuality-of-obligation)] |

**CEST 2025 update notes** (these inform question wording):
- Substitution questions now focus on whether the worker's own skill/labour is truly central (not just whether a substitute is theoretically permitted). The right must be **unrestricted and genuinely exercisable**. [CITED: [Bird & Bird](https://www.twobirds.com/en/insights/2025/uk/spot-the-difference-a-closer-look-at-hmrcs-updated-cest-tool)]
- Financial risk is narrowed to **meaningful financial risks** — if the hirer agrees to buy back equipment at contract end, that is NOT genuine risk. [CITED: same source]
- A pre-requisite question about contract existence was added to reflect PGMOL. [CITED: same source]
- HMRC explicitly confirmed: "There is no change to the underlying technical principles" — the 5-area structure and dispositive weighting are stable. [CITED: [Kingsbridge — HMRC CEST update April 2025](https://www.kingsbridge.co.uk/blog/contractors/ir35/hmrc-cest-update-april-2025-review/)]

**Recommended IR35 question inventory (approx. 22-26 questions across 5 areas):**

The exact wording is for the planner + UK tax-adviser review. The following is the **minimum question set** per area — derived from CEST's public question taxonomy + post-PGMOL refinements. Each question must have `{ id, area, prompt: {en, pl, de}, helpText: {en, pl, de}, caseLawCitation, answerType, required }`.

**Area 1: Substitution** (3-5 questions) — **DISPOSITIVE per D-13**
- Q-SUB-01: "Does the worker have an unrestricted right to provide a substitute?" (Yes/No) — cites *Autoclenz v Belcher* / *Atholl House*
- Q-SUB-02: "Has a substitute actually been provided during this engagement?" (Yes/No)
- Q-SUB-03: "Would the client have the right to reject a substitute on grounds other than skill or security vetting?" (Yes/No — inverse: Yes → inside leaning)
- Q-SUB-04: "Is the worker required to pay their own substitute?" (Yes/No — Yes → outside leaning)
- Q-SUB-05 (optional): "Has substitution been explicitly prohibited in the contract?" (Yes/No — Yes → strong inside on this area)

**Area 2: Control** (4-6 questions) — contributes to composite
- Q-CTRL-01: "Does the client decide how the work is done day-to-day?"
- Q-CTRL-02: "Does the client decide where the work is done?"
- Q-CTRL-03: "Does the client decide the hours the work is done?"
- Q-CTRL-04: "Can the client move the worker to a different task mid-engagement without renegotiation?"
- Q-CTRL-05: "Does the worker have the freedom to use their own methods to deliver the outcome?"
- Q-CTRL-06 (optional): "Does the worker require client approval for subcontractors?"

**Area 3: Financial Risk** (4-5 questions) — contributes to composite (2025 CEST sharpening)
- Q-FIN-01: "Does the worker bear the cost of rectifying defective work in their own time?" (Yes → outside leaning)
- Q-FIN-02: "Does the worker provide their own equipment to perform the service?"
  - Follow-up: "Is there a buy-back or reimbursement agreement for that equipment at contract end?" (Yes → NEUTRALISES financial risk per 2025 CEST guidance)
- Q-FIN-03: "Does the worker invoice for agreed deliverables or for time spent?" (Deliverables → outside; time → inside leaning)
- Q-FIN-04: "Is the worker paid regardless of outcome or performance?" (Yes → inside leaning)
- Q-FIN-05: "Does the worker have exposure to profit or loss beyond hourly rate?"

**Area 4: Part-and-Parcel / Integration** (3-4 questions)
- Q-PP-01: "Does the worker receive employee benefits (pension, sick pay, paid leave)?"
- Q-PP-02: "Is the worker listed in the client's internal directory / org chart?"
- Q-PP-03: "Does the worker attend client staff events, trainings, performance reviews?"
- Q-PP-04: "Does the worker have line-management responsibility over client employees?"

**Area 5: Mutuality of Obligation** (3-5 questions) — **DISPOSITIVE per D-13 (post-PGMOL)**
- Q-MOO-01: "Is the client obliged to offer further work once the current engagement ends?" (Yes → inside leaning)
- Q-MOO-02: "Is the worker obliged to accept further work offered?" (Yes → inside leaning)
- Q-MOO-03: "Is there a minimum-hours or minimum-retainer guarantee in the contract?" (Yes → strong inside)
- Q-MOO-04: "Can either party terminate the engagement on short notice without penalty?" (Yes → outside leaning)
- Q-MOO-05: "Has the engagement been extended or renewed multiple times?" (Yes → inside leaning, secondary signal)

All IR35 questions MUST carry a `caseLawCitation` string rendered in the Collapsible (UI-SPEC §Interaction 5).

**Scoring function (D-13 — reference implementation):**

```typescript
// packages/classification/src/profiles/ir35/scoring.ts
import type { AnswerMap, Ir35AreaVerdict, Ir35Outcome } from '../../types/outcome.js';

export function scoreIr35Area(area: Ir35Area, answers: AnswerMap): Ir35AreaVerdict {
  // Aggregate answers for this area into one of 5 verdicts
  // strong-outside | leaning-outside | neutral | leaning-inside | strong-inside
  // Implementation: per-area weighted tally with thresholds
}

export function scoreIr35(answers: AnswerMap): Ir35Outcome {
  const areas: Record<Ir35Area, Ir35AreaVerdict> = {
    substitution: scoreIr35Area('substitution', answers),
    control: scoreIr35Area('control', answers),
    'financial-risk': scoreIr35Area('financial-risk', answers),
    'part-and-parcel': scoreIr35Area('part-and-parcel', answers),
    moo: scoreIr35Area('moo', answers),
  };

  // DISPOSITIVE RULES (D-13) — evaluate in this strict order:
  if (areas.substitution === 'strong-inside' || areas.moo === 'strong-inside') {
    return { kind: 'IR35', verdict: 'inside', areaResults: toResults(areas), reasoning: '...' };
  }
  if (areas.substitution === 'strong-outside') {
    return { kind: 'IR35', verdict: 'outside', areaResults: toResults(areas), reasoning: '...' };
  }

  // COMPOSITE — count leaning signals
  const leaningInside = Object.values(areas).filter(v => v === 'leaning-inside' || v === 'strong-inside').length;
  const leaningOutside = Object.values(areas).filter(v => v === 'leaning-outside' || v === 'strong-outside').length;
  const neutralCritical = [areas.substitution, areas.moo].filter(v => v === 'neutral').length;

  if (leaningInside >= 3) return ir35('inside', areas);
  if (leaningOutside >= 3) return ir35('outside', areas);
  if (neutralCritical >= 2) return ir35('undetermined', areas);
  return ir35('undetermined', areas);
}
```

### Scheinselbständigkeit (DE) — DRV Rundschreiben RS 2022/1

**Primary sources:**
- DRV "Gemeinsames Rundschreiben zur Statusfeststellung von Erwerbstätigen" at [deutsche-rentenversicherung.de/SharedDocs/Downloads/DE/Fachliteratur_Kommentare_Gesetzestexte/summa_summarum/rundschreiben/2022/statusfestellung_erwerbstaetige.html](https://www.deutsche-rentenversicherung.de/SharedDocs/Downloads/DE/Fachliteratur_Kommentare_Gesetzestexte/summa_summarum/rundschreiben/2022/statusfestellung_erwerbstaetige.html) — effective 2022-08-16, replacing 2021-07-26 version [CITED]
- § 7a SGB IV (Sozialgesetzbuch IV, Paragraph 7a) — statutory basis for Statusfeststellungsverfahren [CITED: standard German code reference]
- DRV "Scheinselbstständigkeit erkennen" public guide at [deutsche-rentenversicherung.de](https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Arbeitnehmer-und-Selbststaendige/03_Selbststaendige/scheinselbststaendigkeit.html) [CITED]
- Handwerkskammer Niederbayern-Oberpfalz Merkblatt Scheinselbständigkeit Stand 2024 [CITED: [hwkno.de merkblatt](https://www.hwkno.de/downloads/scheinselbstaendigkeit-76,154.pdf)]

**DRV doctrine:** German courts and DRV Bund apply a "Gesamtwürdigung aller Umstände des Einzelfalles" (overall weighting of all circumstances of the individual case) [CITED: [isdv.net — Statusfeststellung Scheinselbständigkeit](https://www.isdv.net/en/scheinselbstaendigkeit/)]. The 4-category weighting (30/30/25/15) per D-14 is a commonly-accepted DRV-guidance-aligned decomposition used by accounting firms — **however the weights themselves are NOT published verbatim in the Rundschreiben**; they are a Steuerberater-reviewed interpretation [ASSUMED]. The planner MUST flag this in the Steuerberater review checklist.

**Recommended DRV criterion inventory (exactly 20 criteria across 4 categories):**

Each criterion MUST carry `drvReference` (section in the Rundschreiben or BSG case citation), `prompt: {en, de, pl}`, `answerType: 'score-0-3'`, `required: true`.

**Category 1: Eingliederung in die Arbeitsorganisation** (Integration — 30 % weight, ~6 criteria)
- DRV-INT-01: Weisungsgebundenheit Zeit (Working hours prescribed by client)
- DRV-INT-02: Weisungsgebundenheit Ort (Workplace prescribed by client)
- DRV-INT-03: Weisungsgebundenheit Art und Weise (How the work is performed prescribed)
- DRV-INT-04: Nutzung Betriebsmittel des Auftraggebers (Use of client's facilities/equipment)
- DRV-INT-05: Teilnahme an Teammeetings, Dienstbesprechungen (Attendance at internal meetings)
- DRV-INT-06: Einsatz im Team mit Festangestellten (Team integration with employees)

**Category 2: Unternehmerische Selbstständigkeit** (Entrepreneurial Independence — 30 % weight, ~5 criteria; scores are INVERSE — higher value = MORE indication of Scheinselbständigkeit, i.e. LESS entrepreneurial independence)
- DRV-ENT-01: Kein eigenes unternehmerisches Risiko (No own business risk)
- DRV-ENT-02: Keine eigene Betriebsstätte (No own business premises)
- DRV-ENT-03: Kein eigenes Personal / keine Subunternehmer (No employees or subcontractors)
- DRV-ENT-04: Keine eigene Außendarstellung / Werbung (No own marketing / branding)
- DRV-ENT-05: Kein wesentliches eigenes Betriebskapital (No significant own capital investment)

**Category 3: Persönliche Abhängigkeit** (Personal Dependency — 25 % weight, ~5 criteria)
- DRV-PER-01: Persönliche Leistungserbringungspflicht (Personal service obligation — no substitution)
- DRV-PER-02: Regelmäßige detaillierte Berichtspflicht (Regular detailed reporting duty) [CITED: gov.uk-style obligation in DRV examples]
- DRV-PER-03: Urlaub / Abwesenheit abstimmungspflichtig (Leave requires client approval)
- DRV-PER-04: Feste monatliche Vergütung (Fixed monthly salary-like payment)
- DRV-PER-05: Kontinuierliche Beschäftigung ohne klares Projektende (Ongoing engagement without clear project end)

**Category 4: Wirtschaftliche Abhängigkeit** (Economic Dependency — 15 % weight, ~4 criteria)
- DRV-ECO-01: Anteil der Gesamteinnahmen von diesem Auftraggeber (% of total revenue from this client) — **0-100 numeric input per D-15**; feeds a score band (0-50 % → score 0, 50-70 % → score 1, 70-83 % → score 2, >83 % → score 3) per the 5/6 test from § 2 Nr. 9 SGB VI arbeitnehmerähnliche Selbstständige threshold [CITED: standard German social-security reference]
- DRV-ECO-02: Dauer der Zusammenarbeit > 1 Jahr (Engagement length > 1 year)
- DRV-ECO-03: Keine aktive Akquise anderer Kunden (No active acquisition of other clients)
- DRV-ECO-04: Exklusivitätsvereinbarung mit Auftraggeber (Exclusivity agreement)

**Scoring function (D-14 — reference implementation):**

```typescript
// packages/classification/src/profiles/scheinselbstandigkeit/scoring.ts
import type { AnswerMap, ScheinselbstandigkeitOutcome } from '../../types/outcome.js';

const CATEGORY_WEIGHTS = {
  integration: 30,
  entrepreneurial: 30,
  'personal-dep': 25,
  'economic-dep': 15,
} as const;

const THRESHOLDS = { green: 30, amber: 60 } as const; // <30 green, 30-60 amber, >60 red

export function scoreSchein(answers: AnswerMap): ScheinselbstandigkeitOutcome {
  const categoryBreakdown = (Object.keys(CATEGORY_WEIGHTS) as Array<keyof typeof CATEGORY_WEIGHTS>)
    .map(cat => {
      const criterionAnswers = answersForCategory(cat, answers); // [{ questionId, rawScore: 0|1|2|3 }]
      const maxRaw = criterionAnswers.length * 3;                // if 6 criteria → 18
      const sumRaw = criterionAnswers.reduce((s, a) => s + a.rawScore, 0);
      const categoryWeight = CATEGORY_WEIGHTS[cat];
      // Normalise to the weight: category contributes up to `categoryWeight` points to the total
      const weightedScore = maxRaw === 0 ? 0 : (sumRaw / maxRaw) * categoryWeight;
      return {
        category: cat,
        weight: categoryWeight,
        weightedScore,
        maxWeightedScore: categoryWeight,
        criterionAnswers,
      };
    });

  const totalScore = categoryBreakdown.reduce((s, c) => s + c.weightedScore, 0);
  const riskLevel: 'green' | 'amber' | 'red' =
    totalScore < THRESHOLDS.green ? 'green' :
    totalScore <= THRESHOLDS.amber ? 'amber' : 'red';

  return { kind: 'SCHEINSELBSTANDIGKEIT', riskLevel, totalScore, categoryBreakdown };
}
```

**Scoring direction clarification:** Rundschreiben criteria are written "as indicators OF Scheinselbständigkeit". All 20 criteria score 0-3 where 3 = strong indication of Scheinselbständigkeit (= BAD). Category 2 (Entrepreneurial Independence) criteria MUST be phrased in the negative to keep the direction consistent ("No own premises", "No own subcontractors") — otherwise the math inverts. The rule-set TS constant authoring MUST flag this in a `// NOTE:` comment inside each criterion.

### Regulatory Review Checkpoints (MUST include in PLAN)

Mirror of Phase 56 STATE.md blocker pattern:
1. **UK tax-adviser review** of IR35 question inventory + dispositive rules before Phase 58 ships. Review commissioned during Wave 1; delivered before Wave 3 outcome-page merge.
2. **Steuerberater review** of DRV question inventory + category weights + German legal phrasing. Review commissioned during Wave 1; delivered before Wave 3.
3. Both reviews produce a REVIEWED.md artifact in `packages/classification/` with signoff date and reviewer identity.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 58 creates new data only. No existing classification data to migrate. ChromaDB/Mem0/Redis do not hold classification state. | None |
| Live service config | None — no external service (HMRC / DRV) is contacted in Phase 58. Phase 57 does HMRC VAT / VIES calls but those are unrelated. | None |
| OS-registered state | None — no cron, scheduled task, or daemon created in Phase 58. Phase 60 adds economic-dependency alerts (cron); out of scope here. | None |
| Secrets/env vars | None — no new API keys, no third-party services. All data is local Postgres + local tRPC. | None |
| Build artifacts | New `packages/classification` workspace requires `pnpm install` + `turbo build` to wire. `packages/db` requires `prisma generate` after the new `classification.prisma` is added. `packages/validators` requires rebuild after the `disclaimers.ts` + `de.ts` extension. | `pnpm install && pnpm --filter @contractor-ops/db db:generate && pnpm --filter @contractor-ops/db db:push` as the Wave 0 blocking step (mirror of Phase 57's Wave 0 `[BLOCKING] prisma db push` task) |

**Nothing found in categories 1-4:** Verified by scanning `packages/db/prisma/schema/` (no existing `ClassificationAssessment` model), grep for "classification" in source (no hits), STATE.md "Pending Todos: None yet".

## Common Pitfalls

### Pitfall 1: Scoring from live rule-set constant instead of snapshot
**What goes wrong:** Outcome page shows different question prompts (or different weights) than what the user answered against because `IR35_QUESTIONS` or `SCHEIN_QUESTIONS` was updated between submit and view.
**Why it happens:** Developer instinct is to read the latest constant. That's correct for the wizard; it is WRONG for the outcome page.
**How to avoid:** Outcome page route signature is `(assessmentId) => serverComponent(assessment)`. The component reads `assessment.questionsSnapshot.questions[i].prompt.{locale}` — NEVER imports `IR35_QUESTIONS` from the rule-set file. Enforce via an ESLint rule banning rule-set imports inside `outcome/*.tsx` files, or via a test that mocks a mismatched rule-set constant and verifies the snapshot wins.
**Warning signs:** `outcome` folder imports `@contractor-ops/classification/rule-sets/*`; outcome tests pass with the live constant but fail when the constant is mocked.

### Pitfall 2: Re-running scoring on the client
**What goes wrong:** A clever developer computes `outcome` client-side on the wizard's final step "for responsiveness". Now the client can submit any outcome it wants; audit trail is compromised.
**Why it happens:** RHF + Zod makes it easy to wire.
**How to avoid:** `scoreAssessment` is called ONLY inside the tRPC `submit` handler on the server. The wizard's Submit button posts answers, the server scores, returns the computed outcome. The client never imports `scoreIr35` / `scoreSchein`.
**Warning signs:** Client-side import of `@contractor-ops/classification/profiles/*/scoring`; outcome JSON visible before Submit completes.

### Pitfall 3: Dispositive rule order bugs
**What goes wrong:** Scoring function checks `leaning-inside >= 3` before checking the `strong-inside on Substitution/MOO` dispositive rule. A case with strong-inside on Substitution + 4 leaning-outside elsewhere returns `outside` instead of the correct `inside`.
**Why it happens:** Natural reading order is "composite first because it's longer".
**How to avoid:** Write the scoring function with dispositive rules FIRST, then early-return. Test every combination: 5^5 = 3125 possible area-verdict tuples. Test at least: all 5 dispositive combos (strong-in on sub OR moo → inside × 2 = 2 tests; strong-out on sub → outside × 1; strong-in on sub AND strong-out on sub is impossible by construction; strong-in on moo AND strong-out on sub → check precedence locked by ORDER). Plus at least 10 composite cases around the ≥3 boundary.
**Warning signs:** Scoring test file has <20 test cases; no explicit "dispositive wins over composite" test.

### Pitfall 4: DRV weighted-sum arithmetic drift
**What goes wrong:** Category weights don't sum to 100, or a category with zero criteria causes `NaN` via `sumRaw/maxRaw = 0/0`.
**Why it happens:** Refactor adds a criterion and forgets to update category-max-raw calculation; category tuning shifts weights.
**How to avoid:** Test that `CATEGORY_WEIGHTS` sum is exactly 100 (static assertion); test that a fully-empty category returns weightedScore 0 (not NaN); test the threshold boundaries (29.9 → green, 30 → amber, 60 → amber, 60.1 → red).
**Warning signs:** No static test for weight sum; no boundary-threshold test.

### Pitfall 5: "Not applicable" treated as missing
**What goes wrong:** DRV wizard lets user move forward without answering, because "N/A = missing". Submit then scores NaN and throws.
**Why it happens:** DRV's "Nicht anwendbar" has `rawScore: 0` but IS explicitly selected. Confusing N/A with undefined is natural.
**How to avoid:** The `Score03Answer` component selects N/A as `rawScore: 0` explicitly. The `answers` JSONB stores `{ questionId: { rawScore: 0, isNotApplicable: true } }` distinct from `undefined`. Submit validation: every DRV `required: true` criterion MUST have an entry in `answers`.
**Warning signs:** No `isNotApplicable` flag in the answer shape; submit doesn't block on missing answers.

### Pitfall 6: Disclaimer modal bypassable via direct URL
**What goes wrong:** User shares the outcome URL; recipient navigates directly and sees the outcome without the disclaimer.
**Why it happens:** Modal is assumed to render on assessment completion only.
**How to avoid:** Outcome page (SSR) checks `assessment.disclaimerAcknowledgedAt`. If null, the page renders the modal forcibly (see UI-SPEC §Interaction 1). The modal re-opens every page load until acknowledged. `acknowledgeDisclaimer` tRPC mutation writes the timestamp; subsequent page loads skip the modal.
**Warning signs:** Outcome page renders without checking `disclaimerAcknowledgedAt`; modal only shown via client-side trigger.

### Pitfall 7: Draft resume across rule-set version boundary
**What goes wrong:** User starts a draft against `IR35-2024-CEST`. Six months later rule set is updated to `IR35-2025-CEST-REV2`. User resumes the draft; prompts have changed; their previous answers may reference removed questions.
**Why it happens:** `answers` JSONB references question IDs that may not exist in the new rule set.
**How to avoid:** On draft resume, compare `draft.ruleSetVersion` with current `profile.ruleSetVersion`. If mismatch: block resume and show the copy from UI-SPEC §Error states "Resume draft blocked — rule-set version mismatch". User must start a new assessment; their draft row is preserved in the history (not deleted).
**Warning signs:** tRPC `getDraft` doesn't compare versions; wizard loads stale answer for a no-longer-existing question.

### Pitfall 8: Multi-tenant leakage via direct Prisma query
**What goes wrong:** A helper reads `prisma.classificationAssessment.findMany(...)` (no ctx.db), bypassing the tenant-scope extension. Cross-org data leaks.
**Why it happens:** Copy-paste from a legacy module that predates the tenant extension.
**How to avoid:** All classification queries go through `ctx.db` (which carries the Prisma client extension from `createTenantClientFrom`). Lint rule: ban `prisma.classificationAssessment` in router/service files; only allow `ctx.db.classificationAssessment`.
**Warning signs:** `import { prisma } from '@contractor-ops/db'` inside `packages/api/src/routers/classification.ts` — it should import only `tenantProcedure`.

### Pitfall 9: Locked-phrase leak into messages/de.json
**What goes wrong:** A well-meaning developer adds `"CLASSIFICATION_SCHEIN_TITLE": "Scheinselbständigkeit"` to `messages/de.json` because they saw it rendered in the wizard.
**Why it happens:** The wizard uses `useTranslations('Classification')`; the pattern "every visible string is in messages" is usually correct.
**How to avoid:** The CI guard (Phase 56 `locked-phrases-guard.test.ts`, extended per D-07) fails the build. ALSO: add a comment in `messages/de.json` at the top of the `Classification` namespace: `"_NOTE": "Legal-locked phrases are in packages/validators/src/legal/de.ts (CLASSIFICATION_SCHEIN_*) and /legal/disclaimers.ts (DISCLAIMER_*). DO NOT duplicate here."`.
**Warning signs:** CI fail on `RESERVED_LEGAL_KEYS` check; unexpected key in `messages/de.json`.

### Pitfall 10: Two wizards fight over autosave race
**What goes wrong:** User opens the same engagement's wizard in two tabs. Both tabs save answers to the single draft row; last write wins; the other tab silently overwrites.
**Why it happens:** Draft is "one per engagement" (D-04), but no optimistic-concurrency control.
**How to avoid:** Add an `updatedAt` check in `saveAnswer` — if incoming client's last-known `updatedAt` is older than the row's, return a conflict. Client shows "This assessment was updated elsewhere — reload to see latest answers". This is a small but necessary guardrail.
**Warning signs:** No `If-Match`/`updatedAt` guard in `saveAnswer`; both tabs show stale data with no warning.

## Code Examples

Verified patterns lifted from existing codebase + standard Zod/RHF idioms.

### Registry pattern (mirror of `packages/einvoice/src/registry.ts`)
```typescript
// See "Pattern 1" in §Architecture above — full code included there.
// Source: packages/einvoice/src/registry.ts (VERIFIED, read 2026-04-12)
```

### Extending RESERVED_LEGAL_KEYS (mirror of `packages/validators/src/legal/de.ts`)
```typescript
// packages/validators/src/legal/de.ts — append to existing exports
// Source pattern: existing de.ts (VERIFIED, read 2026-04-12)

export const CLASSIFICATION_SCHEIN_TITLE = 'Scheinselbständigkeit' as const;
export const CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL = 'Statusfeststellungsverfahren' as const;
export const CLASSIFICATION_SCHEIN_CRITERIA_LABEL =
  'Wesentliche Merkmale der Selbstständigkeit' as const;
export const CLASSIFICATION_SCHEIN_INTEGRATION =
  'Eingliederung in die Arbeitsorganisation' as const;
export const CLASSIFICATION_SCHEIN_ENTREPRENEURIAL =
  'Unternehmerische Selbstständigkeit' as const;
export const CLASSIFICATION_SCHEIN_PERSONAL_DEP =
  'Persönliche Abhängigkeit' as const;
export const CLASSIFICATION_SCHEIN_ECONOMIC_DEP =
  'Wirtschaftliche Abhängigkeit' as const;
export const CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL =
  'Hinweis der Deutschen Rentenversicherung' as const;
export const CLASSIFICATION_SCHEIN_NOT_APPLICABLE = 'Nicht anwendbar' as const;

export const RESERVED_LEGAL_KEYS = [
  // ...existing Phase 56 keys...
  'GDPR_CONTROLLER_LABEL', 'GDPR_RIGHTS_HEADING', /* ... */
  // Phase 58 additions:
  'CLASSIFICATION_SCHEIN_TITLE',
  'CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL',
  'CLASSIFICATION_SCHEIN_CRITERIA_LABEL',
  'CLASSIFICATION_SCHEIN_INTEGRATION',
  'CLASSIFICATION_SCHEIN_ENTREPRENEURIAL',
  'CLASSIFICATION_SCHEIN_PERSONAL_DEP',
  'CLASSIFICATION_SCHEIN_ECONOMIC_DEP',
  'CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL',
  'CLASSIFICATION_SCHEIN_NOT_APPLICABLE',
] as const;
```

### New disclaimer module
```typescript
// packages/validators/src/legal/disclaimers.ts — NEW
// Source pattern: packages/validators/src/legal/de.ts
// CI guard: locked-phrases-guard.test.ts extended to cover DISCLAIMER_* keys

export const DISCLAIMER_IR35_BODY =
  'This tool does not constitute legal advice. The Status Determination Statement (SDS) under ' +
  'Chapter 10 ITEPA 2003 remains your responsibility; HMRC does not recognise third-party tool ' +
  'output as a substitute for reasonable care. Consult a qualified UK tax adviser before acting ' +
  'on this result.' as const;

export const DISCLAIMER_IR35_ACKNOWLEDGEMENT =
  'I understand this is not legal advice' as const;

export const DISCLAIMER_SCHEIN_BODY =
  'Dieses Ergebnis ersetzt keine rechtsverbindliche Statusfeststellung nach § 7a SGB IV. ' +
  'Eine abschließende Beurteilung obliegt ausschließlich der Deutschen Rentenversicherung im ' +
  'Rahmen des Statusfeststellungsverfahrens. Konsultieren Sie vor einer Entscheidung eine ' +
  'qualifizierte Steuerberatung oder Fachanwältin/Fachanwalt für Sozialrecht.' as const;

export const DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT =
  'Ich verstehe, dass diese Bewertung keine rechtsverbindliche Statusfeststellung ersetzt.' as const;

export const RESERVED_DISCLAIMER_KEYS = [
  'DISCLAIMER_IR35_BODY',
  'DISCLAIMER_IR35_ACKNOWLEDGEMENT',
  'DISCLAIMER_SCHEIN_BODY',
  'DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT',
] as const;

export const LOCKED_DISCLAIMERS = {
  DISCLAIMER_IR35_BODY,
  DISCLAIMER_IR35_ACKNOWLEDGEMENT,
  DISCLAIMER_SCHEIN_BODY,
  DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT,
} as const;
```

### Prisma model
```prisma
// packages/db/prisma/schema/classification.prisma — NEW
model ClassificationAssessment {
  id                        String   @id @default(cuid())
  organizationId            String
  contractorAssignmentId    String
  countryCode               String   @db.Char(2)
  ruleSetVersion            String
  status                    ClassificationAssessmentStatus @default(draft)
  questionsSnapshot         Json?    // frozen on submit
  answers                   Json     @default("{}")
  outcome                   Json?    // populated on submit
  completedAt               DateTime?
  disclaimerAcknowledgedAt  DateTime?
  immutableAfter            DateTime?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  organization         Organization         @relation(fields: [organizationId], references: [id])
  contractorAssignment ContractorAssignment @relation(fields: [contractorAssignmentId], references: [id])

  @@index([organizationId])
  @@index([organizationId, contractorAssignmentId, status])
  @@index([organizationId, contractorAssignmentId, completedAt(sort: Desc)])
}

enum ClassificationAssessmentStatus {
  draft
  completed
}
```

Also add the reverse relation to `ContractorAssignment` in `contractor.prisma`:
```prisma
// packages/db/prisma/schema/contractor.prisma — extend ContractorAssignment
model ContractorAssignment {
  // ...existing fields...
  classificationAssessments ClassificationAssessment[]
}
```

### Multi-step wizard form pattern (RHF + Zod discriminated union)
```typescript
// apps/web/src/components/contractors/classification/wizard/classification-wizard-shell.tsx
// Source pattern: [LogRocket — Multi-step React Hook Form + Zod](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/) [CITED]
// Source pattern: [BuildWithMatija — Multi-step RHF + Zod + shadcn](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps) [CITED]

'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc';

// Step schemas are Zod objects; the full form schema is their intersection (NOT discriminatedUnion —
// because every step is required; discriminatedUnion applies to the OUTCOME shape, not the form shape).
const stepSchemas = {
  substitution: z.object({ 'SUB-01': z.enum(['yes', 'no']), /* ... */ }),
  control: z.object({ /* ... */ }),
  // etc.
};

export function ClassificationWizardShell({ assessmentId, ruleSet }: Props) {
  const t = useTranslations('Classification');
  const [currentStep, setCurrentStep] = useState(0);
  const saveAnswer = trpc.classification.saveAnswer.useMutation();
  const submit = trpc.classification.submit.useMutation();

  const form = useForm({
    resolver: zodResolver(stepSchemas[stepOrder[currentStep]]),
    defaultValues: /* load from getDraft */,
    mode: 'onBlur',
  });

  // Autosave — D-10
  const watchedAnswers = form.watch();
  useEffect(() => {
    const dirty = form.formState.dirtyFields;
    for (const qId of Object.keys(dirty)) {
      saveAnswer.mutate({ assessmentId, questionId: qId, answer: watchedAnswers[qId] });
    }
  }, [watchedAnswers, form.formState.dirtyFields, assessmentId, saveAnswer]);

  // Step guard — validate current step before advancing
  async function next() {
    const ok = await form.trigger();
    if (!ok) return;
    setCurrentStep(s => s + 1);
  }

  // Submit — server computes outcome and returns
  async function onSubmit(data: FormValues) {
    const result = await submit.mutateAsync({ assessmentId });
    // Redirect to outcome page; modal renders forcibly until acknowledged
    router.push(`/contractors/${contractorId}/engagements/${engagementId}/classification/${result.id}`);
  }

  return (
    <FormProvider {...form}>
      <ClassificationProgressBar currentStep={currentStep} totalSteps={stepOrder.length} />
      <ClassificationStepIndicator steps={stepOrder} currentStep={currentStep} />
      <Card>
        <CardContent>
          {renderStep(stepOrder[currentStep])}
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 0}>
          {t('previous')}
        </Button>
        {currentStep < stepOrder.length - 1
          ? <Button onClick={next}>{t('next')}</Button>
          : <Button onClick={form.handleSubmit(onSubmit)}>{t('submitAssessment')}</Button>}
      </div>
      <ClassificationAutosaveIndicator state={saveAnswer.status} lastSavedAt={lastSavedAt} />
    </FormProvider>
  );
}
```

### Disclaimer modal (shadcn AlertDialog, blocking)
```typescript
// apps/web/src/components/contractors/classification/classification-disclaimer-dialog.tsx
// Source: UI-SPEC §Interaction 6 + shadcn AlertDialog primitive (already installed — VERIFIED)

'use client';

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
         AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel }
  from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import {
  DISCLAIMER_IR35_BODY, DISCLAIMER_IR35_ACKNOWLEDGEMENT,
  DISCLAIMER_SCHEIN_BODY, DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT,
} from '@contractor-ops/validators/legal/disclaimers';
import { trpc } from '@/lib/trpc';

interface Props {
  assessmentId: string;
  countryCode: 'GB' | 'DE';
  open: boolean;
  onAcknowledged: () => void;
  onDeferred: () => void;
}

export function ClassificationDisclaimerDialog({ assessmentId, countryCode, open, onAcknowledged, onDeferred }: Props) {
  const [checked, setChecked] = useState(false);
  const acknowledge = trpc.classification.acknowledgeDisclaimer.useMutation({
    onSuccess: onAcknowledged,
  });

  const body = countryCode === 'GB' ? DISCLAIMER_IR35_BODY : DISCLAIMER_SCHEIN_BODY;
  const ackLabel = countryCode === 'GB' ? DISCLAIMER_IR35_ACKNOWLEDGEMENT : DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onInteractOutside={(e) => e.preventDefault()}    // per UI-SPEC §Interaction 6
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-lg"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-accent-warm" aria-hidden />
            Before you continue
          </AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-start gap-2">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} autoFocus />
          <span className="text-sm">{ackLabel}</span>
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDeferred}>Acknowledge later</AlertDialogCancel>
          <AlertDialogAction
            disabled={!checked || acknowledge.isPending}
            onClick={() => acknowledge.mutate({ assessmentId })}
          >
            I understand — view outcome
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### IR35 scoring test coverage (Vitest)
```typescript
// packages/classification/src/profiles/ir35/__tests__/scoring.test.ts
// Every dispositive combination + composite boundary — per Pitfall 3

import { describe, it, expect } from 'vitest';
import { scoreIr35 } from '../scoring.js';

describe('scoreIr35 — dispositive rules (D-13)', () => {
  it('strong-inside on Substitution → inside (even when all other areas leaning-outside)', () => {
    expect(scoreIr35(mkAnswers({ sub: 'strong-inside', ctrl: 'leaning-outside', fin: 'leaning-outside', pp: 'leaning-outside', moo: 'leaning-outside' })).verdict).toBe('inside');
  });
  it('strong-inside on MOO → inside', () => {
    expect(scoreIr35(mkAnswers({ sub: 'neutral', ctrl: 'neutral', fin: 'neutral', pp: 'neutral', moo: 'strong-inside' })).verdict).toBe('inside');
  });
  it('strong-outside on Substitution → outside (no other dispositive triggered)', () => {
    expect(scoreIr35(mkAnswers({ sub: 'strong-outside', ctrl: 'leaning-inside', fin: 'leaning-inside', pp: 'leaning-inside', moo: 'neutral' })).verdict).toBe('outside');
  });
  it('strong-inside on Substitution AND strong-outside on Substitution is impossible — strong-inside wins', () => {
    // By construction a single area has one verdict — no test needed. Documented as invariant.
  });
  it('strong-inside on MOO WINS over strong-outside on Substitution (order: inside-dispositive first)', () => {
    expect(scoreIr35(mkAnswers({ sub: 'strong-outside', ctrl: 'neutral', fin: 'neutral', pp: 'neutral', moo: 'strong-inside' })).verdict).toBe('inside');
  });
});

describe('scoreIr35 — composite rule', () => {
  it('3 leaning-inside, 0 dispositive → inside', () => {
    expect(scoreIr35(mkAnswers({ sub: 'neutral', ctrl: 'leaning-inside', fin: 'leaning-inside', pp: 'leaning-inside', moo: 'neutral' })).verdict).toBe('inside');
  });
  it('3 leaning-outside, 0 dispositive → outside', () => {
    expect(scoreIr35(mkAnswers({ sub: 'neutral', ctrl: 'leaning-outside', fin: 'leaning-outside', pp: 'leaning-outside', moo: 'neutral' })).verdict).toBe('outside');
  });
  it('2 leaning each + Substitution neutral + MOO neutral → undetermined (≥2 neutral critical)', () => {
    expect(scoreIr35(mkAnswers({ sub: 'neutral', ctrl: 'leaning-inside', fin: 'leaning-outside', pp: 'leaning-inside', moo: 'neutral' })).verdict).toBe('undetermined');
  });
  it('all 5 neutral → undetermined', () => {
    expect(scoreIr35(mkAnswers({ sub: 'neutral', ctrl: 'neutral', fin: 'neutral', pp: 'neutral', moo: 'neutral' })).verdict).toBe('undetermined');
  });
});
```

### DRV scoring test coverage
```typescript
// packages/classification/src/profiles/scheinselbstandigkeit/__tests__/scoring.test.ts

describe('scoreSchein — weighted sum (D-14)', () => {
  it('CATEGORY_WEIGHTS sum to 100', () => {
    expect(Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b)).toBe(100);
  });

  it('all criteria score 0 → total 0 → green', () => {
    const r = scoreSchein(allZeros());
    expect(r.totalScore).toBe(0);
    expect(r.riskLevel).toBe('green');
  });

  it('all criteria score 3 → total 100 → red', () => {
    const r = scoreSchein(allThrees());
    expect(r.totalScore).toBe(100);
    expect(r.riskLevel).toBe('red');
  });

  it('total = 29.9 → green', () => { /* construct answers yielding 29.9 */ });
  it('total = 30 → amber', () => { /* boundary */ });
  it('total = 60 → amber', () => { /* boundary */ });
  it('total = 60.1 → red', () => { /* boundary */ });

  it('empty category does not produce NaN', () => {
    // Pathological: answers JSONB missing all criteria in one category
    expect(scoreSchein({}).riskLevel).toBe('green');   // 0 + 0 + 0 + 0 = 0
  });

  it('economic-dependency billing-ratio 83.3% maps to rawScore 3', () => { /* ... */ });
  it('economic-dependency billing-ratio 50% maps to rawScore 0', () => { /* ... */ });
});
```

### Locked-phrases guard extension
```typescript
// packages/validators/src/__tests__/locked-phrases-guard.test.ts — EXTEND (Phase 56 existing pattern)
// Source: existing file (VERIFIED, read 2026-04-12)

import {
  LOCKED_DE_PHRASES, RESERVED_LEGAL_KEYS,              // Phase 56 existing
} from '../legal/de.js';
import {
  LOCKED_DISCLAIMERS, RESERVED_DISCLAIMER_KEYS,        // Phase 58 new
} from '../legal/disclaimers.js';

describe('Locked classification phrases (Phase 58 D-07)', () => {
  it.each(['en', 'pl', 'ar', 'de'] as const)(
    'messages/%s.json does not define any reserved classification or disclaimer key',
    (locale) => {
      const messages = loadMessages(locale);
      if (messages === null) return;
      const keys = flatKeys(messages);
      const reserved = [...RESERVED_LEGAL_KEYS, ...RESERVED_DISCLAIMER_KEYS];
      const violations = keys.filter((k) => reserved.some((r) => k === r || k.endsWith(`.${r}`)));
      expect(violations).toEqual([]);
    },
  );

  it('DRV wizard step 4 title renders CLASSIFICATION_SCHEIN_ECONOMIC_DEP verbatim', async () => {
    // Import the step-4 component, render with RTL, grep for the constant value
    const { render } = await import('@testing-library/react');
    const { ScheinStep4 } = await import(
      '../../../apps/web/src/components/contractors/classification/wizard/schein/scheinstep-4'
    );
    const { container } = render(<ScheinStep4 /* ... */ />);
    expect(container.textContent).toContain(
      'Wirtschaftliche Abhängigkeit',        // = CLASSIFICATION_SCHEIN_ECONOMIC_DEP
    );
  });

  it('IR35 disclaimer modal body renders DISCLAIMER_IR35_BODY verbatim', () => { /* ... */ });
  it('DRV disclaimer modal body renders DISCLAIMER_SCHEIN_BODY verbatim', () => { /* ... */ });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Classification rules in DB tables | Typed `as const` TS constants | Phase 56 (D-05/D-06 locked phrases pattern) | Faster review, compile-time safety, git history for rule evolution, easy Steuerberater diff review |
| Weighted-sum for IR35 | Composite-rule (dispositive + leaning) | *PGMOL* [2024] UKSC + *Atholl House* [2022] UKSC | Substitution and MOO as dispositive is post-PGMOL legal standard; simple weighted sum would be legally naive [CITED: CONTEXT.md specifics] |
| Single classification row per contractor | Per-engagement rows (append-only) | CLASS-11 + D-04 | Contractors with multiple concurrent engagements (common for UK PSCs / German freelancers) get independent assessments; Phase 58 is the first to enforce this |
| Client-side scoring for UX responsiveness | Server-side scoring only | D-10 (submit transitions draft → completed on server) | Audit defensibility — the server is the only authority for what the outcome was |
| React-PDF for all PDFs | `window.print()` for Phase 58 basic, React-PDF for Phase 59 regulatory | UI-SPEC Open Item 4 | Phase 58 ships without a PDF dependency; Phase 59 handles the formal SDS / DRV audit bundle |
| CEST tool treats MOO as presumed (pre-2024) | CEST refined post-PGMOL 2024 to ask MOO explicitly | PGMOL [2024] UKSC + CEST April 2025 update | Our rule set asks MOO questions directly [CITED: [Bird & Bird CEST update](https://www.twobirds.com/en/insights/2025/uk/spot-the-difference-a-closer-look-at-hmrcs-updated-cest-tool)] |

**Deprecated/outdated:**
- Pre-2021 IR35 rules (contractor-responsible determination) — superseded by Chapter 10 ITEPA 2003 off-payroll rules [CITED: standard UK tax reference]
- Scheinselbständigkeit § 7 SGB IV pre-2022 framework — replaced by the 2022-04-01 reform via 2022-08-16 Rundschreiben [CITED: [WirtzKraneis — Reform 2022](https://wirtz-kraneis.com/neues-zur-scheinselbstaendigkeit-reform-des-statusfeststellungsverfahrens-zum-01-04-2022/)]
- HMRC CEST v1 (2017) — replaced by "Enhanced CEST" 2019, again refined April 2025 [CITED: [gov.uk CEST enhancement history](https://www.gov.uk/government/publications/check-employment-status-for-tax-cest-2019-enhancement/check-employment-status-for-tax-cest-usage-data)]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DRV category weights 30/30/25/15 are "DRV-guidance-aligned" but NOT published verbatim in Rundschreiben RS 2022/1. They are a Steuerberater-reviewed interpretation. | §Regulatory Domain — DRV, §Scoring D-14 | Steuerberater could recommend different weights (e.g. 35/30/25/10). Impact: re-weight the scoring function + re-run any test cases — pure code change, no migration. Surface as REQUIRED Steuerberater-review checklist item. |
| A2 | DRV-ECO-01 billing-ratio score band (0-50 % → 0, 50-70 % → 1, 70-83 % → 2, >83 % → 3) is derived from the 5/6-test for arbeitnehmerähnliche Selbstständige under § 2 Nr. 9 SGB VI; the exact threshold inside the 0-3 scale is my interpretation. | §Regulatory Domain — DRV-ECO-01 | If wrong, the economic-dependency category score shifts. Phase 60 owns the alert threshold (70 %/83.33 %), so the band should match Phase 60's thresholds. |
| A3 | IR35 question inventory (22-26 questions across 5 areas) is derived from the public CEST taxonomy + post-PGMOL refinements, not from HMRC's exact live CEST question set (which HMRC may revise). | §Regulatory Domain — IR35 | UK tax adviser may add/remove/rephrase questions. Impact: rule-set constant update + tests. |
| A4 | April 2026 CEST threshold changes (small-company IR35 exemption) do NOT affect Phase 58 scope — they alter WHICH engagements need IR35 assessment, not HOW the assessment is done. | §Regulatory Domain — IR35 (Greenberg Traurig citation) | If wrong: Phase 58 still ships unchanged; a separate feature (Phase 60 or later) would add small-company exemption detection. |
| A5 | `structuredClone` is available in all deployment targets (Node 18+ on Vercel). | §Architecture Patterns — Pattern 4 | Verified: Vercel runs Node 20+. Zero risk. |
| A6 | Shadcn `AlertDialog` `onInteractOutside` / `onEscapeKeyDown` preventDefault works in current Radix version. | §Code Examples — Disclaimer | Verified in Radix `@radix-ui/react-alert-dialog` 1.1+ docs; `@base-ui/react` 1.3 also supports. If the repo's wrapper strips these props, we add them to the wrapper. |
| A7 | Steuerberater and UK tax-adviser review can happen in parallel to implementation (mirror of Phase 56 STATE.md flag). | §Regulatory Review Checkpoints | Review delay blocks Wave 3 merge; planner adds explicit review-delivered task before outcome-page merge. |
| A8 | Phase 58's basic `window.print()` export is acceptable to stakeholders as a temporary PDF; Phase 59 will replace with formal SDS / DRV audit bundle. | §Standard Stack alternatives + UI-SPEC Open Item 4 | UI-SPEC explicitly locks this decision — low risk. |
| A9 | `ContractorAssignment` is the correct "engagement" entity for CLASS-11. No separate `Engagement` model exists or is planned for v5.0. | §Storage Model + §Architecture Pattern 5 | Verified against `packages/db/prisma/schema/contractor.prisma` — `ContractorAssignment` has `activeFrom/activeTo`, `status`, `allocationPercent`; it IS the engagement anchor. |
| A10 | The `answerType: 'likert-5'` for IR35 optional questions is correctly reduced to a per-area `Ir35AreaVerdict` by `scoreIr35Area`. | §Regulatory Domain — IR35 scoring function | The reduction logic (Likert 1-2 → outside-leaning, 3 → neutral, 4-5 → inside-leaning, with combinations summing to area verdict) is a standard approach but the exact threshold inside a mixed area (3 Yes/No + 1 Likert) needs UK tax-adviser signoff. Planner should flag. |

**Important:** Every `[ASSUMED]` above corresponds to a place the discuss-phase already anticipated (CONTEXT.md §Claude's Discretion). The Phase 58 plan MUST include a dedicated "Regulatory Review & Assumptions Validation" task that walks the UK tax adviser and Steuerberater through each A-row.

## Open Questions

1. **How many DRV criteria per category?**
   - What we know: CONTEXT.md says "~20 DRV criteria across 4 categories"; STATE.md confirms. The 30/30/25/15 weights suggest something like 6/5/5/4 = 20 or 7/6/5/2 = 20 — many distributions possible.
   - What's unclear: the exact allocation inside each category.
   - Recommendation: planner proposes 6/5/5/4 (integration gets most criteria because it's the highest-weight and most-probed category in DRV practice), Steuerberater adjusts.

2. **Should draft resume be automatic or explicit?**
   - What we know: D-10 says "users can resume on any device".
   - What's unclear: does the engagement page auto-navigate to the existing draft, or show both "Resume draft" + "Start new"?
   - Recommendation: single draft per engagement (D-04 guarantees this); Classification tile shows a "Resume draft" CTA with a [Draft] badge when one exists; else "Run classification assessment" CTA.

3. **IR35 Likert vs Yes/No per question — who decides?**
   - What we know: UI-SPEC Open Item 6: "decided per-question inside the rule-set constant (`answerType` field)". Steuerberater / UK tax adviser review.
   - What's unclear: does this mean IR35 is majority Likert or majority Yes/No?
   - Recommendation: **default to Yes/No** for most questions (CEST is primarily Yes/No), use Likert only for nuanced questions where middle-ground meaningfully changes the area verdict. Expect ~80 % Yes/No, ~20 % Likert.

4. **How is "engagement name" derived for the tile label?**
   - What we know: UI-SPEC §10 shows "Classification · Engagement {name}".
   - What's unclear: `ContractorAssignment` has `teamId`, `projectId`, `costCenterId` but no free-text "name" field.
   - Recommendation: compose from `project.name || team.name || \`Engagement ${assignment.id.slice(-6)}\``. Planner confirms or adds a `displayName` getter on ContractorAssignment.

5. **Can the Phase 57 `isKleinunternehmer` org flag interact with DRV economic-dependency?**
   - What we know: CONTEXT.md canonical refs mentions Phase 57 `isKleinunternehmer` "may interact with Scheinselbständigkeit economic-dependency scoring".
   - What's unclear: what the interaction is.
   - Recommendation: Kleinunternehmer is an ORG-level VAT classification unrelated to CONTRACTOR-level classification. DRV Scheinselbständigkeit assesses the individual contractor's risk, independent of whether the client org is Kleinunternehmer. NO interaction in Phase 58 — flag this in research-closing summary so planner doesn't over-scope.

6. **Do we need a DB-level "draft uniqueness" constraint?**
   - What we know: D-04 "One draft per engagement at a time; completed assessments are append-only".
   - What's unclear: enforced by application (tRPC guard) or by DB partial unique index?
   - Recommendation: BOTH. tRPC `createDraft` guards; Prisma schema adds a partial unique index `@@unique([contractorAssignmentId, status]) where status = 'draft'`. Postgres supports partial indexes natively.

## Environment Availability

Phase 58 introduces no new external dependencies. All tools are already in place.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | Vercel Node 20 | — |
| PostgreSQL (Neon) | `ClassificationAssessment` table | ✓ | via `@prisma/adapter-neon` ^7.7.0 | — |
| Prisma CLI | Migration + generate | ✓ | ^7.7.0 | — |
| shadcn AlertDialog | Disclaimer modal | ✓ | already installed (`apps/web/src/components/ui/alert-dialog.tsx`) | — |
| shadcn Progress, RadioGroup, Collapsible, Checkbox, Textarea, Table | Wizard + outcome | ✓ | all installed | — |
| React Hook Form + Zod + @hookform/resolvers | Wizard form | ✓ | RHF 7.72, Zod 3.25, resolvers 5.2 | — |
| `Intl.RelativeTimeFormat` | Autosave relative time | ✓ | native ES2020 | `date-fns/formatDistance` |
| Vitest + @testing-library/react | Tests | ✓ | existing setup | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.
**Install/bootstrap steps:** `pnpm install` after package.json changes; `pnpm --filter @contractor-ops/db db:generate && db:push` after `classification.prisma` lands. Both are routine.

## Validation Architecture

Nyquist validation is enabled (`.planning/config.json` — `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (existing; used in apps/web + packages/*); Playwright for E2E (not needed in Phase 58) |
| Config file | `vitest.config.ts` per workspace (existing); new `packages/classification/vitest.config.ts` matching sibling packages |
| Quick run command | `pnpm --filter @contractor-ops/classification test` |
| Full suite command | `pnpm test` (workspace root) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLASS-01 | Profile registry resolves GB → IR35, DE → Schein; throws for unknown country | unit | `pnpm --filter @contractor-ops/classification test src/__tests__/registry.test.ts` | ❌ Wave 0 |
| CLASS-01 | Adding a new profile via `registerProfile` works without touching engine core | unit | same | ❌ Wave 0 |
| CLASS-02 | IR35 dispositive rules (strong-inside on Sub/MOO → inside; strong-outside on Sub → outside) | unit | `pnpm --filter @contractor-ops/classification test profiles/ir35/__tests__/scoring.test.ts` | ❌ Wave 0 |
| CLASS-02 | IR35 composite rule (≥3 leaning → verdict; otherwise undetermined) | unit | same | ❌ Wave 0 |
| CLASS-02 | IR35 question inventory has 5 areas with ≥3 questions each; every question has `caseLawCitation` | unit | `.../profiles/ir35/__tests__/rule-set.test.ts` | ❌ Wave 0 |
| CLASS-05 | DRV weighted sum: CATEGORY_WEIGHTS sum to 100; thresholds (29.9 green, 30 amber, 60 amber, 60.1 red) | unit | `.../profiles/scheinselbstandigkeit/__tests__/scoring.test.ts` | ❌ Wave 0 |
| CLASS-05 | DRV "Nicht anwendbar" scores 0 and is distinguishable from missing | unit | same | ❌ Wave 0 |
| CLASS-05 | DRV economic-dependency billing-ratio 83% → rawScore 3; 50% → 0 | unit | same | ❌ Wave 0 |
| CLASS-05 | Every DRV criterion has `drvReference` citation | unit | `.../profiles/scheinselbstandigkeit/__tests__/rule-set.test.ts` | ❌ Wave 0 |
| CLASS-11 | `createDraft` on an engagement with no assessments creates a draft row scoped to org | integration | `packages/api/src/routers/__tests__/classification.test.ts` (tRPC caller with test DB) | ❌ Wave 0 |
| CLASS-11 | `createDraft` on an engagement with existing draft returns existing row (no dup) | integration | same | ❌ Wave 0 |
| CLASS-11 | `submit` creates outcome + snapshot + `immutableAfter`; status → completed | integration | same | ❌ Wave 0 |
| CLASS-11 | `submit` on already-completed row throws | integration | same | ❌ Wave 0 |
| CLASS-11 | Re-run after completion creates a NEW draft row (append-only); old completed row unchanged | integration | same | ❌ Wave 0 |
| CLASS-11 | `listByContractor` returns all assessments across all engagements for that contractor, sorted draft-first then completedAt desc | integration | same | ❌ Wave 0 |
| CLASS-11 | `acknowledgeDisclaimer` sets timestamp; re-ack is idempotent | integration | same | ❌ Wave 0 |
| CLASS-11 | Multi-tenant scoping: Org A cannot read Org B's assessment | integration | same | ❌ Wave 0 |
| CLASS-02 + CLASS-05 | `questionsSnapshot` is frozen on submit; subsequent rule-set constant changes do NOT affect stored snapshot | unit | `packages/classification/src/__tests__/snapshot.test.ts` | ❌ Wave 0 |
| D-07 | Locked phrase guard — `CLASSIFICATION_SCHEIN_*` and `DISCLAIMER_*` keys absent from `messages/*.json` | unit | `packages/validators/src/__tests__/locked-phrases-guard.test.ts` (EXTEND existing) | ✅ EXTEND |
| D-07 | Locked phrase guard — DRV wizard step 4 renders `CLASSIFICATION_SCHEIN_ECONOMIC_DEP` verbatim | integration (RTL) | same | ✅ EXTEND |
| D-07 | Locked phrase guard — disclaimer modal renders `DISCLAIMER_IR35_BODY` / `DISCLAIMER_SCHEIN_BODY` verbatim | integration (RTL) | same | ✅ EXTEND |
| D-12 | Disclaimer modal blocks outcome until acknowledged (Escape + overlay click disabled) | integration (RTL) | `apps/web/src/components/contractors/classification/__tests__/classification-disclaimer-dialog.test.tsx` | ❌ Wave 0 |
| D-10 | Wizard autosave fires on blur + mutates the draft row via tRPC | integration (RTL + MSW) | `apps/web/src/components/contractors/classification/wizard/__tests__/classification-wizard-shell.test.tsx` | ❌ Wave 0 |
| D-09 | Wizard step guard blocks Next until current step Zod validates | integration (RTL) | same | ❌ Wave 0 |
| D-16 | IR35 outcome page renders verdict banner + 5 area cards | integration (RTL snapshot) | `apps/web/src/app/[locale]/contractors/[id]/engagements/[engagementId]/classification/[assessmentId]/__tests__/outcome.test.tsx` | ❌ Wave 0 |
| D-16 | DRV outcome page renders traffic-light banner + 4 category bars + criterion breakdown | integration (RTL snapshot) | same | ❌ Wave 0 |
| D-08 | Outcome page reads from `questionsSnapshot`, NOT live rule-set constant (mocking live constant doesn't affect output) | integration | same | ❌ Wave 0 |
| WCAG AA | Disclaimer modal has `role="alertdialog"`, `aria-labelledby`, `aria-describedby`, initial focus on checkbox | a11y (axe) | `apps/web/src/components/contractors/classification/__tests__/a11y.test.tsx` | ❌ Wave 0 |
| WCAG AA | Wizard progress bar has correct `aria-valuenow` / `aria-valuemax` fractional values | a11y (axe) | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/classification test && pnpm --filter @contractor-ops/validators test` (both affected workspaces — scoring + locked phrases)
- **Per wave merge:** `pnpm test` (workspace root — all tests including router integration)
- **Phase gate:** Full suite green + Steuerberater signoff + UK tax-adviser signoff before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/classification/vitest.config.ts` — new test config (mirror sibling package)
- [ ] `packages/classification/src/__tests__/registry.test.ts` — registry smoke test
- [ ] `packages/classification/src/__tests__/snapshot.test.ts` — snapshot immutability
- [ ] `packages/classification/src/profiles/ir35/__tests__/scoring.test.ts` — dispositive + composite coverage
- [ ] `packages/classification/src/profiles/ir35/__tests__/rule-set.test.ts` — inventory assertions
- [ ] `packages/classification/src/profiles/scheinselbstandigkeit/__tests__/scoring.test.ts` — weighted sum + thresholds
- [ ] `packages/classification/src/profiles/scheinselbstandigkeit/__tests__/rule-set.test.ts` — inventory assertions
- [ ] `packages/api/src/routers/__tests__/classification.test.ts` — tRPC caller with test DB (mirror existing `legal.test.ts` / `equipment.test.ts` patterns)
- [ ] `apps/web/src/components/contractors/classification/**/__tests__/*.test.tsx` — RTL integration tests
- [ ] Extend `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — add CLASSIFICATION_* + DISCLAIMER_* coverage (file exists — EXTEND, don't recreate)
- [ ] Prisma schema change: `packages/db/prisma/schema/classification.prisma` + `[BLOCKING] pnpm --filter @contractor-ops/db db:generate && db:push` — no test runs until this lands

Framework installation: none required — Vitest + RTL + axe are already configured repo-wide.

## Security Domain

`security_enforcement` is not explicitly set to `false` in config.json → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session required on every tRPC call — provided by `authedProcedure` → `tenantProcedure` chain [VERIFIED: `packages/api/src/middleware/auth.ts`] |
| V3 Session Management | yes | Better Auth manages session cookie; no classification-specific session concern |
| V4 Access Control | **yes — critical** | Multi-tenant scoping via `tenantProcedure` + Prisma client extension (`createTenantClientFrom`). Every query through `ctx.db` automatically filters by `organizationId`. RBAC: limit `acknowledgeDisclaimer` + `submit` to users with `contractor:update` permission (planner decides exact permission string); `getLatest` / `listByContractor` open to `contractor:read`. [VERIFIED: `packages/api/src/middleware/tenant.ts`, `rbac.ts`] |
| V5 Input Validation | **yes — critical** | Every answer validated by per-question Zod schema BEFORE writing to `answers` JSONB. Questions IDs validated against the rule-set constant (unknown ID → reject). `outcome` discriminated union schema validated on read. Economic-dependency billing-ratio clamped to 0-100. |
| V6 Cryptography | no | No classification-specific crypto. Transport via HTTPS (Vercel default). |
| V7 Error Handling | yes | Tenant-leakage errors → 404 not 403 (don't reveal existence of another org's data). Scoring errors → TRPCError `INTERNAL_SERVER_ERROR` with logged stack (observability middleware already handles). |
| V8 Data Protection | yes | `answers` JSONB may contain free-text rationale (UI-SPEC §RationaleTextarea 1 000-char limit). PII risk low but non-zero (contractor or client name may slip in). No export to third parties in Phase 58. Retention: append-only forever per D-04 (compliance mandate). |
| V9 Communications | no | Standard TLS, nothing phase-specific. |
| V10 Malicious Code | yes | Rule-set constants are compile-time TS — no dynamic evaluation. Locked phrases module is compile-time — no JSON injection. |
| V12 Files and Resources | yes | Only `window.print()` (client-side) — no server-side PDF generation in Phase 58, no untrusted file handling. Phase 59 will need V12 controls for PDF gen. |
| V13 API | yes | tRPC rate-limit per-org on `saveAnswer` (autosave loops could hammer) via existing `upload-rate-limit` middleware pattern — planner adds a simple `@upstash/ratelimit` budget (e.g. 120 saveAnswer calls per minute per assessment). |

### Known Threat Patterns for Classification Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org read (Org B reads Org A's classification) | Information Disclosure | `tenantProcedure` + Prisma extension guarantee `organizationId` scope on all reads; integration test asserts this |
| Client-side outcome tampering | Tampering | Scoring happens ONLY on server; client renders outcome server-returned value; never accept client-computed outcome |
| Replay / overwrite of completed assessment | Tampering + Repudiation | `immutableAfter` set on submit; Prisma check in `saveAnswer`/`submit` that `status === 'draft'`; append-only re-run creates new row |
| Autosave DoS (client loops saveAnswer) | Denial of Service | Rate-limit per-org via `@upstash/ratelimit`; idempotent upsert (same answer twice is a no-op) |
| Disclaimer bypass via direct URL | Repudiation (user claims they didn't see disclaimer) | Outcome page SSR checks `disclaimerAcknowledgedAt`; modal re-opens on every page load until acknowledged |
| Stored XSS via rationale free-text | Tampering + Info Disclosure | Render rationale through React (escapes by default); never `dangerouslySetInnerHTML`; CSP already configured repo-wide |
| IDOR on assessmentId | Access Control | All reads go through `ctx.db.classificationAssessment.findUnique({ where: { id, organizationId: ctx.organizationId } })` pattern (the Prisma extension enforces org filter) |
| Leak of PII in `answers` to logs | Info Disclosure | Observability middleware must not log request body; audit log entries for classification write ONLY metadata (assessmentId, action, user, timestamp) not answer content |
| Concurrent two-tab editing race | Tampering | `updatedAt` optimistic-concurrency check in `saveAnswer` — reject stale writes |
| Rule-set drift between draft creation and submit | Integrity | Compare `draft.ruleSetVersion` vs current `profile.ruleSetVersion` on resume; block + notify (Pitfall 7) |

## Sources

### Primary (HIGH confidence)

**Codebase (read and verified 2026-04-12):**
- `/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/phases/58-classification-engine-rule-sets/58-CONTEXT.md` — 16 locked decisions D-01..D-16
- `.planning/phases/58-classification-engine-rule-sets/58-UI-SPEC.md` — full approved design contract (667 lines)
- `.planning/REQUIREMENTS.md` — CLASS-01/02/05/11 definitions
- `.planning/ROADMAP.md` §Phase 58 — goal, 4 success criteria, dependencies
- `.planning/STATE.md` — milestone state, blockers, decisions
- `.planning/PROJECT.md` — repo constraints, stack, key decisions table
- `./CLAUDE.md` — project engineering guidelines
- `packages/einvoice/src/index.ts` — profile registry + convenience `register*Profile` exports (mirror pattern)
- `packages/einvoice/src/registry.ts` — Map<string, Profile> registry pattern (mirror verbatim)
- `packages/einvoice/src/types/profile.ts` — `EInvoiceProfile` interface structure (mirror for `ClassificationProfile`)
- `packages/einvoice/src/profiles/ksef/index.ts` — concrete profile class skeleton
- `packages/gov-api/src/client.ts` — abstract base class pattern (reference for abstract base + subclass)
- `packages/db/prisma/schema/contractor.prisma` — `ContractorAssignment` engagement anchor model + existing relations
- `packages/validators/src/legal/de.ts` — Phase 56 locked-phrases module (extend with CLASSIFICATION_SCHEIN_*)
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — CI guard pattern (extend with CLASSIFICATION_* + DISCLAIMER_*)
- `packages/api/src/init.ts` + `middleware/tenant.ts` — tRPC init + tenantProcedure (used for classification router)
- `packages/api/src/middleware/rbac.ts` — permission middleware (used for submit / acknowledge / listByContractor)
- `apps/web/package.json` — dependency versions (VERIFIED: RHF 7.72, Zod 3.25, shadcn 4.2, tRPC 11.16, Prisma 7.7)
- `apps/web/src/components/ui/` directory — shadcn primitives (alert-dialog, progress, radio-group, collapsible, checkbox all present)
- `apps/web/src/components/contractors/compliance/` — Phase 56 CountryComplianceSection pattern
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — D-05/D-06 locked phrases + CI guard pattern

**Regulatory primary sources:**
- HMRC CEST: [gov.uk/guidance/check-employment-status-for-tax](https://www.gov.uk/guidance/check-employment-status-for-tax)
- HMRC CEST enhancement history: [gov.uk/government/publications/check-employment-status-for-tax-cest-2019-enhancement](https://www.gov.uk/government/publications/check-employment-status-for-tax-cest-2019-enhancement/check-employment-status-for-tax-cest-usage-data)
- DRV Rundschreiben (2022 Statusfeststellung): [deutsche-rentenversicherung.de/SharedDocs/Downloads/.../statusfestellung_erwerbstaetige.html](https://www.deutsche-rentenversicherung.de/SharedDocs/Downloads/DE/Fachliteratur_Kommentare_Gesetzestexte/summa_summarum/rundschreiben/2022/statusfestellung_erwerbstaetige.html)
- DRV Scheinselbständigkeit public guide: [deutsche-rentenversicherung.de/.../scheinselbststaendigkeit.html](https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Arbeitnehmer-und-Selbststaendige/03_Selbststaendige/scheinselbststaendigkeit.html)

### Secondary (MEDIUM confidence — verified against primary sources)

- [Bird & Bird — A Closer Look at HMRC's Updated CEST Tool (2025)](https://www.twobirds.com/en/insights/2025/uk/spot-the-difference-a-closer-look-at-hmrcs-updated-cest-tool) — substitution + financial-risk 2025 refinements
- [Kingsbridge — HMRC CEST update April 2025 review](https://www.kingsbridge.co.uk/blog/contractors/ir35/hmrc-cest-update-april-2025-review/) — confirms underlying technical principles unchanged
- [Worksome — UK's Supreme Court on Mutuality of Obligation](https://www.worksome.com/blog/the-uks-supreme-court-takes-a-firm-stand-on-mutuality-of-obligation) — PGMOL 2024 UKSC
- [Greenberg Traurig — Threshold Changes to UK Off-Payroll Working Rules April 2026](https://www.gtlaw.com/en/insights/2026/3/threshold-changes-to-uk-off-payroll-working-rules-ir35-end-user-and-contractor-considerations) — 2026 small-company threshold changes
- [WirtzKraneis — Scheinselbständigkeit Reform 2022](https://wirtz-kraneis.com/neues-zur-scheinselbstaendigkeit-reform-des-statusfeststellungsverfahrens-zum-01-04-2022/) — 2022 reform summary
- [ISDV — Statusfeststellungsverfahren Scheinselbständigkeit](https://www.isdv.net/en/scheinselbstaendigkeit/) — Gesamtwürdigung doctrine
- [IHK Rhein-Neckar — Scheinselbständigkeit vermeiden](https://www.ihk.de/rhein-neckar/recht/arbeitsrecht/arbeitsrecht-a-z/scheinselbstaendigkeit-938372) — criteria overview
- [Handwerkskammer Niederbayern-Oberpfalz — Merkblatt Scheinselbständigkeit (2024)](https://www.hwkno.de/downloads/scheinselbstaendigkeit-76,154.pdf) — practitioner criteria list
- [Sevdesk — Scheinselbständigkeit Kriterien](https://sevdesk.de/lexikon/scheinselbststaendigkeit/) — popular criteria reference
- [LogRocket — Multi-step RHF + Zod form](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/) — wizard pattern
- [BuildWithMatija — Multi-step form with Zustand + Zod + shadcn](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps) — wizard pattern
- [Peturgeorgievv — Complex Form with Zod discriminated union](https://peturgeorgievv.com/blog/complex-form-with-zod-nextjs-and-typescript-discriminated-union) — Zod discriminated union forms

### Tertiary (LOW confidence — flagged for Steuerberater / UK tax-adviser validation)

- [dbits.it — DRV DECODED Selbstcheck Erwerbsstatus](https://www.dbits.it/drv-decoded-selbstcheck-erwerbsstatus-alle-fragen-alle-punkte-alle-fallen/) — third-party DRV question catalog
- [scheinselbstaendigkeit-pruefen.de — Kriterien Erklärung](https://scheinselbstaendigkeit-pruefen.de/scheinselbstaendigkeit-kriterien/) — criterion examples (not authoritative)
- [haufe.de — Scheinselbständigkeit Urteile](https://www.haufe.de/personal/entgelt/urteile-scheinselbststaendigkeit_78_416784.html) — recent case law
- Exact DRV category weight distribution (30/30/25/15 per D-14) — widely used in practice but not published verbatim in Rundschreiben; Steuerberater signoff required.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `apps/web/package.json`; all shadcn primitives verified in `apps/web/src/components/ui/`; profile registry pattern verified by reading `packages/einvoice/src/registry.ts`.
- Architecture: HIGH — direct mirror of shipped `packages/einvoice` pattern; tRPC router pattern verified via `packages/api/src/routers/` sample; Prisma schema pattern verified via existing `contractor.prisma`.
- Regulatory content (IR35): MEDIUM-HIGH — HMRC CEST is a public government tool; case law citations verified against Supreme Court public rulings; exact CEST question wording requires UK tax-adviser pass.
- Regulatory content (DRV): MEDIUM — DRV Rundschreiben RS 2022/1 is public; exact criterion list is a Steuerberater-reviewed interpretation (A1, A2 in §Assumptions Log).
- Pitfalls: HIGH — all pitfalls derived from existing codebase patterns (tenantProcedure, CI guard, append-only models in Phase 51/57) + standard RHF/Zod gotchas.
- Validation Architecture: HIGH — test file paths and commands match existing repo conventions (verified by listing `packages/api/src/__tests__/` and `packages/validators/src/__tests__/`).
- Security: HIGH — all ASVS mitigations use existing repo infrastructure (tenantProcedure, rbac middleware, observability, ratelimit).

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days) for architecture and stack; 2026-04-26 (14 days) for regulatory content (HMRC CEST is a live tool — re-verify before wave 3 merge if the April 2026 threshold change ships first).

Sources:
- [gov.uk — Check employment status for tax](https://www.gov.uk/guidance/check-employment-status-for-tax)
- [gov.uk — CEST 2019 enhancement + usage data](https://www.gov.uk/government/publications/check-employment-status-for-tax-cest-2019-enhancement/check-employment-status-for-tax-cest-usage-data)
- [DRV — Gemeinsames Rundschreiben Statusfeststellung 2022](https://www.deutsche-rentenversicherung.de/SharedDocs/Downloads/DE/Fachliteratur_Kommentare_Gesetzestexte/summa_summarum/rundschreiben/2022/statusfestellung_erwerbstaetige.html)
- [DRV — Scheinselbständigkeit erkennen](https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Arbeitnehmer-und-Selbststaendige/03_Selbststaendige/scheinselbststaendigkeit.html)
- [Bird & Bird — A Closer Look at HMRC's Updated CEST Tool](https://www.twobirds.com/en/insights/2025/uk/spot-the-difference-a-closer-look-at-hmrcs-updated-cest-tool)
- [Kingsbridge — HMRC CEST update April 2025 review](https://www.kingsbridge.co.uk/blog/contractors/ir35/hmrc-cest-update-april-2025-review/)
- [Worksome — Supreme Court on Mutuality of Obligation (PGMOL)](https://www.worksome.com/blog/the-uks-supreme-court-takes-a-firm-stand-on-mutuality-of-obligation)
- [Greenberg Traurig — Threshold Changes to UK Off-Payroll Working Rules April 2026](https://www.gtlaw.com/en/insights/2026/3/threshold-changes-to-uk-off-payroll-working-rules-ir35-end-user-and-contractor-considerations)
- [WirtzKraneis — Scheinselbständigkeit Reform 2022](https://wirtz-kraneis.com/neues-zur-scheinselbstaendigkeit-reform-des-statusfeststellungsverfahrens-zum-01-04-2022/)
- [ISDV — Statusfeststellungsverfahren Scheinselbständigkeit](https://www.isdv.net/en/scheinselbstaendigkeit/)
- [IHK Rhein-Neckar — Scheinselbständigkeit vermeiden](https://www.ihk.de/rhein-neckar/recht/arbeitsrecht/arbeitsrecht-a-z/scheinselbstaendigkeit-938372)
- [Handwerkskammer NBO — Merkblatt Scheinselbständigkeit 2024](https://www.hwkno.de/downloads/scheinselbstaendigkeit-76,154.pdf)
- [LogRocket — Building a reusable multi-step form with RHF + Zod](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/)
- [BuildWithMatija — Multi-step forms with RHF + Zustand + Zod + shadcn](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps)
- [Peturgeorgievv — Zod discriminated union forms](https://peturgeorgievv.com/blog/complex-form-with-zod-nextjs-and-typescript-discriminated-union)
