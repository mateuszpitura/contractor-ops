# Classification Rule-Set Review — Phase 58

> **Status:** Local-only build. External legal-entity sign-off is deferred
> post-deploy per the standing project policy captured in
> `.planning/STATE.md §"Standing Project Constraints"`. The rule-set + locked
> phrases + disclaimer bodies listed below are the working copy and have
> shipped to the local app. This file is the placeholder artifact that will
> receive Steuerberater + UK tax-adviser sign-off once commissioned.

## Scope

Reviewers are asked to sign off on the content shipped under
`packages/classification` + `packages/validators/src/legal/`:

- IR35 question inventory (5 areas × 5 questions each = 25 questions),
  each with `caseLawCitation`.
- DRV Scheinselbständigkeit criterion inventory (4 categories × 5 = 20
  criteria), each with `drvReference` and DE-formal-Sie register.
- DRV category weights (30 / 30 / 25 / 15) + traffic-light thresholds
  (< 30 → green; ≤ 60 → amber; > 60 → red) — see D-14.
- Bilingual disclaimer bodies (`DISCLAIMER_IR35_BODY` EN;
  `DISCLAIMER_SCHEIN_BODY` DE) + acknowledgements.
- DE category titles locked in `packages/validators/src/legal/de.ts` as
  `CLASSIFICATION_SCHEIN_INTEGRATION`, `CLASSIFICATION_SCHEIN_ENTREPRENEURIAL`,
  `CLASSIFICATION_SCHEIN_PERSONAL_DEP`, `CLASSIFICATION_SCHEIN_ECONOMIC_DEP`.

## IR35 Question Inventory

File: `packages/classification/src/profiles/ir35/rule-set.ts`
(`IR35_QUESTIONS`, `RULE_SET_VERSION = 'IR35-2024-CEST'`).

- 25 questions covering the five HMRC CEST areas:
  - `substitution` — Ready Mixed Concrete [1968], Atholl House [2022]
    UKSC, PGMOL [2024] UKSC case-law citations.
  - `control` — Autoclenz [2011] UKSC, Atholl House [2022] UKSC.
  - `financial-risk` — Lorimer [1994] STC.
  - `part-and-parcel` — Carmichael [1999] UKHL.
  - `moo` — Ready Mixed Concrete [1968], PGMOL [2024] UKSC.
- Each question carries:
  - `prompt` (EN primary; PL + DE flagged `REVIEW:PL` / `REVIEW:DE` in the
    translation QA sweep).
  - `helpText` — explanatory supplement for non-lawyer users.
  - `caseLawCitation` — exact citation string.
  - `answerType` — one of `yes-no`, `likert-5`.

## DRV Criterion Inventory

File: `packages/classification/src/profiles/scheinselbstandigkeit/rule-set.ts`
(`SCHEIN_QUESTIONS`, `RULE_SET_VERSION = 'SCHEINSELBSTANDIGKEIT-DRV-2024'`).

- 20 criteria across 4 DRV categories (German formal Sie register):
  - `integration` (Eingliederung in die Arbeitsorganisation) — 6 criteria;
    weight 30%.
  - `entrepreneurial` (Unternehmerische Tätigkeit) — 5 criteria; weight 30%.
  - `personal-dep` (Persönliche Abhängigkeit) — 5 criteria; weight 25%.
  - `economic-dep` (Wirtschaftliche Abhängigkeit) — 4 criteria; weight 15%.
- Each criterion carries:
  - `prompt` (DE verbatim + EN translation + PL translation).
  - `helpText` (DE + EN + PL).
  - `drvReference` — e.g. `"DRV-Katalog § 7 SGB IV, Merkmal 3.1"`.
  - `answerType` — `score-0-3` (with `Nicht anwendbar`) for most criteria;
    `billing-ratio` for the economic-dependency billing share input.
- `CATEGORY_WEIGHTS = { integration: 30, entrepreneurial: 30,
  'personal-dep': 25, 'economic-dep': 15 }` — justification anchored in
  RESEARCH §Regulatory Domain (DRV Rundschreiben RS 2022/1).
- `THRESHOLDS = { green: 30, amber: 60 }` — boundary cases pinned by
  unit tests at 29.9 (green), 30 (amber), 60 (amber), 60.1 (red).

## Disclaimer Bodies

File: `packages/validators/src/legal/disclaimers.ts`.

- `DISCLAIMER_IR35_BODY` — verbatim English text quoted below:

  > This tool does not constitute legal advice. The Status Determination
  > Statement (SDS) under Chapter 10 ITEPA 2003 remains your responsibility;
  > HMRC does not recognise third-party tool output as a substitute for
  > reasonable care. Consult a qualified UK tax adviser before acting on this
  > result.

- `DISCLAIMER_IR35_ACKNOWLEDGEMENT` — `"I understand this is not legal advice"`.

- `DISCLAIMER_SCHEIN_BODY` — verbatim German text quoted below:

  > Dieses Ergebnis ersetzt keine rechtsverbindliche Statusfeststellung nach
  > § 7a SGB IV. Eine abschließende Beurteilung obliegt ausschließlich der
  > Deutschen Rentenversicherung im Rahmen des Statusfeststellungsverfahrens.
  > Konsultieren Sie vor einer Entscheidung eine qualifizierte Steuerberatung
  > oder Fachanwältin/Fachanwalt für Sozialrecht.

- `DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT` — `"Ich verstehe, dass diese Bewertung
  keine rechtsverbindliche Statusfeststellung ersetzt."`.

## Screenshots

Screenshots are captured on demand by running the local wizard through the
three outcome paths each (IR35: inside / outside / indeterminate; DRV: green
/ amber / red) and the disclaimer modal (EN + DE). Paths land under
`.planning/phases/58-classification-engine-rule-sets/screenshots/` when
the maintainer captures them; the directory is intentionally absent until
the reviewers request visual evidence.

## Checklist

- [ ] IR35 case-law citations are accurate and current (Atholl House [2022],
      PGMOL [2024] included).
- [ ] German formal Sie register is consistent across all DRV criteria,
      help text, and disclaimer bodies.
- [ ] `drvReference` for every criterion points to a real DRV Katalog §,
      Merkmal, or Rundschreiben line.
- [ ] Category-weight split (30/30/25/15) is acceptable for Phase 58 (may
      be amended in Phase 59+ via 58-06 follow-up).
- [ ] Locked phrases in `packages/validators/src/legal/de.ts` and
      `disclaimers.ts` are unmodified.

## Steuerberater sign-off

_Pending — local-only build; external sign-off is deferred post-deploy per
policy._

- **Name:** *(pending)*
- **Date:** *(pending)*
- **Signature reference:** *(pending — e.g. WKN-id / qualified e-signature)*
- **Amendments captured:** *(none yet)*

## UK tax-adviser sign-off

_Pending — local-only build; external sign-off is deferred post-deploy per
policy._

- **Name:** *(pending — CIOT/ATT or CTA certified)*
- **Date:** *(pending)*
- **Signature reference:** *(pending)*
- **Amendments captured:** *(none yet)*

---

When sign-off lands, replace the _Pending_ blocks with the reviewer's name,
date, and signature reference, capture any amendments, integrate non-material
corrections in a follow-up commit, and schedule material changes as
`58-06-PLAN.md`. After both sign-offs land, flip
`.planning/phases/58-classification-engine-rule-sets/58-VALIDATION.md`
frontmatter `nyquist_compliant: false` → `nyquist_compliant: true` and set
`status: approved YYYY-MM-DD`.
