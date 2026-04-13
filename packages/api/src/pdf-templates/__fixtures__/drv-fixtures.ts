// Phase 59 · Plan 04 Task 1 — DRV defense bundle fixtures.

import type {
  Assessment,
  RuleSetQuestion,
  ScheinCategoryResult,
} from '@contractor-ops/classification';

const BASE_DATE = new Date('2026-04-10T10:00:00.000Z');

const SCHEIN_QUESTIONS: RuleSetQuestion[] = [
  {
    id: 'scq-int-1',
    category: 'integration',
    prompt: { en: '', pl: '', de: 'Arbeiten Sie weisungsgebunden in den Räumen des Auftraggebers?' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'score-0-3',
    required: true,
    drvReference: 'DRV-Katalog § 7 SGB IV, Merkmal 3.1',
  },
  {
    id: 'scq-ent-1',
    category: 'entrepreneurial',
    prompt: {
      en: '',
      pl: '',
      de: 'Tragen Sie wesentliches unternehmerisches Risiko?',
    },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'score-0-3',
    required: true,
    drvReference: 'DRV-Katalog § 7 SGB IV, Merkmal 4.2',
  },
  {
    id: 'scq-pd-1',
    category: 'personal-dep',
    prompt: { en: '', pl: '', de: 'Dürfen Sie Ihre Leistung durch Dritte erbringen lassen?' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'scq-ed-1',
    category: 'economic-dep',
    prompt: { en: '', pl: '', de: 'Wie hoch ist der Anteil dieses Auftraggebers an Ihrem Gesamtumsatz?' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'billing-ratio',
    required: true,
  },
];

function cat(
  category: ScheinCategoryResult['category'],
  weight: number,
  rawScore: number,
  verdict: ScheinCategoryResult['verdict'],
  drivingQuestionIds: readonly string[],
  drvReferences: readonly string[] = [],
): ScheinCategoryResult {
  return {
    category,
    weight,
    rawScore,
    weightedScore: rawScore * (weight / 100),
    verdict,
    drvReferences,
    // drivingQuestionIds is not part of ScheinCategoryResult — we keep it only
    // in the fixture via a side-channel for convenience; DRV template reads
    // questionsSnapshot directly by category.
  } as ScheinCategoryResult & { drivingQuestionIds: readonly string[] };
}

const BASE_ASSESSMENT = {
  id: 'ca_schein_red',
  organizationId: 'org_fixture',
  contractorAssignmentId: 'cass_fixture',
  countryCode: 'DE',
  ruleSetVersion: 'schein-v3',
  status: 'completed' as const,
  questionsSnapshot: {
    ruleSetVersion: 'schein-v3',
    profileId: 'scheinselbstandigkeit',
    questions: SCHEIN_QUESTIONS,
  },
  answers: {
    'scq-int-1': { rawScore: 2 as const },
    'scq-ent-1': { rawScore: 1 as const },
    'scq-pd-1': { value: 'no' },
    'scq-ed-1': { value: 80 },
  },
  completedAt: BASE_DATE,
  disclaimerAcknowledgedAt: BASE_DATE,
  immutableAfter: BASE_DATE,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

export const fixtureScheinRed: Assessment = {
  ...BASE_ASSESSMENT,
  outcome: {
    kind: 'SCHEINSELBSTANDIGKEIT',
    ruleSetVersion: 'schein-v3',
    verdict: 'red',
    totalScore: 78,
    computedAt: '2026-04-10T10:00:00.000Z',
    categories: [
      cat('integration', 30, 2, 'red', ['scq-int-1']),
      cat('entrepreneurial', 30, 1, 'red', ['scq-ent-1']),
      cat('personal-dep', 20, 3, 'amber', ['scq-pd-1']),
      cat('economic-dep', 20, 3, 'red', ['scq-ed-1']),
    ],
  },
};

export const fixtureScheinAmber: Assessment = {
  ...BASE_ASSESSMENT,
  id: 'ca_schein_amber',
  outcome: {
    kind: 'SCHEINSELBSTANDIGKEIT',
    ruleSetVersion: 'schein-v3',
    verdict: 'amber',
    totalScore: 55,
    computedAt: '2026-03-10T10:00:00.000Z',
    categories: [
      cat('integration', 30, 1, 'amber', ['scq-int-1']),
      cat('entrepreneurial', 30, 1, 'amber', ['scq-ent-1']),
      cat('personal-dep', 20, 2, 'amber', ['scq-pd-1']),
      cat('economic-dep', 20, 2, 'amber', ['scq-ed-1']),
    ],
  },
  completedAt: new Date('2026-03-10T10:00:00.000Z'),
};

export const fixtureScheinGreen: Assessment = {
  ...BASE_ASSESSMENT,
  id: 'ca_schein_green',
  outcome: {
    kind: 'SCHEINSELBSTANDIGKEIT',
    ruleSetVersion: 'schein-v3',
    verdict: 'green',
    totalScore: 22,
    computedAt: '2026-02-10T10:00:00.000Z',
    categories: [
      cat('integration', 30, 0, 'green', ['scq-int-1']),
      cat('entrepreneurial', 30, 0, 'green', ['scq-ent-1']),
      cat('personal-dep', 20, 0, 'green', ['scq-pd-1']),
      cat('economic-dep', 20, 1, 'green', ['scq-ed-1']),
    ],
  },
  completedAt: new Date('2026-02-10T10:00:00.000Z'),
};

export const fixturePriorHistory: Assessment[] = [
  // Newest first per DRV Section 3 contract.
  fixtureScheinAmber,
  fixtureScheinGreen,
];

export interface DrvAttestationFixture {
  statementText: string;
  signedName: string;
  signedAt: Date;
}

export const fixtureAttestation: DrvAttestationFixture = {
  statementText:
    'Ich arbeite aktuell für drei weitere Auftraggeber: Beispiel AG (Berlin, seit 2024), Muster GmbH (München, seit 2023) und Demo eG (Köln, seit 2025). Mein Anteil beim gegenständlichen Auftraggeber liegt bei ca. 40 %.',
  signedName: 'Dr. Max Mustermann',
  signedAt: BASE_DATE,
};

export interface DrvCrossReferenceFixtureRow {
  id: string;
  activeFrom: Date;
  activeTo: Date | null;
  status: string;
  organization: { name: string };
  project: { name: string } | null;
}

export const fixtureCrossReference: DrvCrossReferenceFixtureRow[] = [
  {
    id: 'cass_sibling_1',
    activeFrom: new Date('2025-06-01T00:00:00.000Z'),
    activeTo: new Date('2025-12-31T00:00:00.000Z'),
    status: 'ENDED',
    organization: { name: 'Beispiel AG' },
    project: { name: 'Datenmigration Q3' },
  },
  {
    id: 'cass_sibling_2',
    activeFrom: new Date('2024-03-01T00:00:00.000Z'),
    activeTo: null,
    status: 'ACTIVE',
    organization: { name: 'Muster GmbH' },
    project: null,
  },
];

export const DRV_FIXTURE_ENGAGEMENT = {
  id: 'cass_fixture',
  displayName: 'DRV Projekt Apex — Q2 2026',
  activeFrom: new Date('2026-04-01T00:00:00.000Z'),
  activeTo: new Date('2026-09-30T00:00:00.000Z'),
};

export const DRV_FIXTURE_CONTRACTOR = {
  id: 'c_fixture',
  displayName: 'Acme Consulting GmbH',
};

export const DRV_FIXTURE_ORGANIZATION = {
  id: 'org_fixture',
  name: 'Beispielkunde AG',
  countryCode: 'DE',
};

export const DRV_FIXTURE_RENDERED_AT = BASE_DATE;
