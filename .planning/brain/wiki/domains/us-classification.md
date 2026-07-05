---
title: US worker classification (IRS common-law + CA AB5 + §530) and determination letter
type: domain
tags: [us, classification, ab5, section-530, irs-common-law, determination-letter, advisory, audit-log]
source_commit: 2aabc35c8
verify_with:
  - packages/classification/src/profiles/us/
  - packages/classification/src/types/outcome.ts
  - packages/api/src/routers/compliance/classification-override.ts
  - packages/api/src/pdf-templates/us-determination-letter.tsx
  - packages/api/src/services/classification-document-render.ts
  - packages/api/src/routers/compliance/classification-document.tsx
  - apps/web-vite/src/components/contractors/classification/us-classification-result.tsx
  - apps/web-vite/src/components/contractors/classification/ab5-watchlist-flag.tsx
  - apps/web-vite/src/components/contractors/classification/classification-override-dialog.tsx
  - apps/web-vite/src/components/contractors/classification-documents/generate-determination-letter-button.tsx
  - packages/db/prisma/schema/classification.prisma
  - packages/db/prisma/schema/contractor.prisma
updated: 2026-07-05
---

# US worker classification (IRS common-law + CA AB5 + §530) and determination letter

## Purpose

Score whether a US engagement reads as an employee or an independent contractor against the federal
IRS common-law three-category test, apply the stricter **California AB5 ABC** overlay where the work is
performed in CA, and flag **§530 safe-harbor relief** eligibility — then archive a deterministic
Determination Letter recording the scored factors, flags, and citations. This is **advisory
decision-support, never a legal determination** (D-05); every result carries the adviser-verify note.

The whole surface is dark behind `module.us-expansion`. It reuses the country-agnostic classification
engine ([[domains/classification-ir35]]) — the US profile is a registry plugin, not a fork.

## Flow

```
assessment answers (+ server-injected US_WORK_STATE)
  → scoreUsClassification  (federal common-law base → dispositive CA-ABC overlay → §530 relief flag)
  → UsClassificationOutcome { verdict, federalFactors, ab5Flag, section530ReliefEligible }
  → staff result surface (banner + blocking disclaimer → verdict pill + AB5/§530 chips + citations)
  → [optional] classification.override  (reason-required, audit-logged; scored outcome preserved)
  → [optional] classificationDocument.generateUsDeterminationLetter  (append-only US_DETERMINATION_LETTER PDF)
```

`UsClassificationProfile` registers via a side-effect `registerProfile(new UsClassificationProfile())`
on import (resolvable through `getProfileForCountry('US')`) — no `registry.ts` edit. The US scoring
reuses the shared single-arg `scoreAssessment(answers)`; the **work-state** reaches it through a
reserved `US_WORK_STATE` answer-map key injected server-side (engagement work-state primary, the
contractor's US state as the fallback). No new `ClassificationAssessment` column — `countryCode='US'`
+ the existing outcome `Json` carry the AB5/§530 scoring.

The **CA AB5 overlay is dispositive**: a CA work-state defaults to employee unless all three ABC prongs
pass. **§530 is a relief-eligibility flag, never a verdict change.** The verdict values follow the
executable contract (`employee` | `independent-contractor` | `indeterminate`).

## Determination Letter

`classificationDocument.generateUsDeterminationLetter` (staff-only, `classificationProcedure` +
`assertUsExpansionEnabled`) renders `us-determination-letter.tsx` — a **deterministic no-LLM/no-network**
react-pdf (verdict + federal factors + AB5/§530 flags + citations + locked advisory footer), byte-stable
via pinned Document creation/modification dates. `renderDeterminationLetterPdfBuffer` archives an
**append-only** `US_DETERMINATION_LETTER` `ClassificationDocument` with the `ruleSetVersion` **frozen**
from the assessment (never recomputed) and writes `writeAuditLog({action:'classification.determinationLetter.generate'})`.
There is **no server-side approval row** (unlike the SDS): the typed-name approval gate is UI-side; the
server records `generatedByUserId` + the audit event.

## Entry points

| Piece | Path |
|-------|------|
| US profile | `packages/classification/src/profiles/us/` (`rule-set.ts` / `scoring.ts` / `index.ts` — `scoreUsClassification`, `UsClassificationProfile`) |
| Outcome type | `packages/classification/src/types/outcome.ts` (`UsClassificationOutcome` — added to the Outcome union + Zod discriminated branch) |
| Audited override | `packages/api/src/routers/compliance/classification-override.ts` (`classification.override` — reason-required, AuditLog-only) |
| Determination letter | `packages/api/src/pdf-templates/us-determination-letter.tsx` + `services/classification-document-render.ts` (`renderDeterminationLetterPdfBuffer`) + `routers/compliance/classification-document.tsx` (`generateUsDeterminationLetter`) |
| Prisma | `US_DETERMINATION_LETTER` kind (`schema/classification.prisma`); `ContractorAssignment.workState` (`schema/contractor.prisma`, nullable-additive) |
| Flag gate | `packages/api/src/middleware/require-us-expansion-flag.ts` (`assertUsExpansionEnabled`) |

## UI surface

- Staff result: `apps/web-vite/src/components/contractors/classification/us-classification-result.tsx`
  (wired 4-state) + `hooks/use-us-classification.ts` (sole tRPC boundary → `classification.getLatest`
  + reason-required `classification.override`). A sticky `ClassificationAdvisoryBanner` (`role="note"`)
  and a blocking disclaimer gate (reuses `classification.acknowledgeDisclaimer`) precede the verdict pill.
- `ab5-watchlist-flag.tsx` — amber `warning` chip + tooltip (**never** `destructive`); the §530 chip is `info`.
- `classification-override-dialog.tsx` — DialogBody/DialogFooter + required reason + acknowledgement.
- Determination letter: `classification-documents/generate-determination-letter-button.tsx` +
  `hooks/use-generate-determination-letter.ts` — an SDS-mirror typed-name approval gate unlocking
  `generateUsDeterminationLetter`; the archived letter surfaces as the `US_DETERMINATION_LETTER` row in
  `document-history-list.tsx`, wired for `countryCode === 'US'` in `classification-documents-panel.tsx`.
- i18n namespace `UsClassification` at en/en-US/de/pl/ar parity.

## Invariants

- **Advisory-not-verdict:** the surface always carries the sticky advisory banner + the blocking
  disclaimer before the outcome; the AB5 flag is amber `warning` (never `destructive`) and the §530 chip
  is `info`. The verdict pill itself may use the destructive tone for a likely-employee outcome (a genuine
  risk signal), but it is framed by the banner + disclaimer + adviser-verify note as decision-support.
- The **AB5 overlay is dispositive** on a CA work-state (defaults to employee unless all three ABC prongs
  pass) but is a decision-support signal, not a legal determination. **§530 is a relief-eligibility flag,
  never a verdict change.**
- The **override** is reason-required + audit-logged server-side into the append-only `AuditLog` (no new
  schema column); the scored outcome stays server-derived — the client never asserts the verdict.
- The Determination Letter renders from the **frozen** assessment snapshot with a **frozen** `ruleSetVersion`
  (no recompute), no LLM/network path, archived append-only + audit-logged.
- `workState` is nullable-additive (existing rows stay NULL) and reaches scoring only through the
  server-injected `US_WORK_STATE` answer key.

## Agent mistakes

- Do NOT present the US classification as a legal verdict — keep the advisory banner + blocking disclaimer,
  the AB5 flag amber, and the §530 chip `info`. Never let the client assert the verdict.
- Do NOT add a new `ClassificationAssessment` column for US — use `countryCode='US'` + the outcome `Json`.
- Do NOT edit `registry.ts` to register the US profile — it is a side-effect `registerProfile` plugin
  (mirrors IR35 / Schein).
- Do NOT recompute the determination letter's `ruleSetVersion` — render from the frozen snapshot; the
  letter is deterministic + no-LLM.
- Do NOT add a server-side determination-letter approval row — the gate is UI-side (typed name + checkbox);
  the server records the generator + audit event.

## Related

- [[domains/classification-ir35]]
- [[domains/us-tax-forms]]
- [[integrations/irs-1042s]]
- [[domains/contractors-engagements]]
- [[structure/prisma-schema-areas]]
