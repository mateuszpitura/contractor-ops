// SDS template fixtures.
// Each fixture is a completed IR35 ClassificationAssessment with a fully populated
// outcome + questionsSnapshot, sufficient to exercise every branch of IR35SDSDocument.

import type { Assessment, Ir35AreaResult, RuleSetQuestion } from '@contractor-ops/classification';

const FIXED_DATE = new Date('2026-04-10T10:00:00.000Z');

const FIXTURE_QUESTIONS: RuleSetQuestion[] = [
  {
    id: 'q-sub-1',
    area: 'substitution',
    prompt: {
      en: 'Do you have an unfettered right of substitution?',
      pl: '',
      de: '',
    },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'yes-no',
    required: true,
    caseLawCitation: 'Ready Mixed Concrete v MPNI [1968] 2 QB 497',
  },
  {
    id: 'q-ctrl-1',
    area: 'control',
    prompt: { en: 'Who decides how the work is performed?', pl: '', de: '' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'likert-5',
    required: true,
    caseLawCitation: 'Hall v Lorimer [1994] STC 23',
  },
  {
    id: 'q-fin-1',
    area: 'financial-risk',
    prompt: {
      en: 'Do you bear the cost of rectifying defective work?',
      pl: '',
      de: '',
    },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'yes-no',
    required: true,
    caseLawCitation: 'Market Investigations v Ministry [1969] 2 QB 173',
  },
  {
    id: 'q-pnp-1',
    area: 'part-and-parcel',
    prompt: { en: 'Are you integrated into the client organisation?', pl: '', de: '' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'q-moo-1',
    area: 'moo',
    prompt: {
      en: 'Is there a mutual obligation to offer and accept work?',
      pl: '',
      de: '',
    },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'yes-no',
    required: true,
  },
];

function areaResult(
  area: Ir35AreaResult['area'],
  verdict: Ir35AreaResult['verdict'],
  drivingQuestionIds: readonly string[],
  caseLawCitations: readonly string[],
): Ir35AreaResult {
  return { area, verdict, drivingQuestionIds, caseLawCitations };
}

const BASE_ASSESSMENT = {
  id: 'ca_fixture',
  organizationId: 'org_fixture',
  contractorAssignmentId: 'cass_fixture',
  countryCode: 'GB',
  ruleSetVersion: 'ir35-v2',
  status: 'completed' as const,
  questionsSnapshot: {
    ruleSetVersion: 'ir35-v2',
    profileId: 'ir35',
    questions: FIXTURE_QUESTIONS,
  },
  answers: {
    'q-sub-1': { value: 'yes' },
    'q-ctrl-1': { rawScore: 3 as const },
    'q-fin-1': { value: 'yes' },
    'q-pnp-1': { value: 'no' },
    'q-moo-1': { value: 'no' },
  },
  completedAt: FIXED_DATE,
  disclaimerAcknowledgedAt: FIXED_DATE,
  immutableAfter: FIXED_DATE,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

/** Verdict 'outside' — all areas lean outside or strong-outside. */
export const fixtureIr35Outside: Assessment = {
  ...BASE_ASSESSMENT,
  outcome: {
    kind: 'IR35',
    ruleSetVersion: 'ir35-v2',
    verdict: 'outside',
    computedAt: '2026-04-10T10:00:00.000Z',
    areas: [
      areaResult(
        'substitution',
        'strong-outside',
        ['q-sub-1'],
        ['Ready Mixed Concrete v MPNI [1968] 2 QB 497'],
      ),
      areaResult('control', 'leaning-outside', ['q-ctrl-1'], ['Hall v Lorimer [1994] STC 23']),
      areaResult('financial-risk', 'leaning-outside', ['q-fin-1'], []),
      areaResult('part-and-parcel', 'neutral', ['q-pnp-1'], []),
      areaResult('moo', 'leaning-outside', ['q-moo-1'], []),
    ],
  },
};

/** Verdict 'inside' — strong-inside substitution + MOO, leaning-inside elsewhere. */
export const fixtureIr35Inside: Assessment = {
  ...BASE_ASSESSMENT,
  id: 'ca_fixture_inside',
  answers: {
    'q-sub-1': { value: 'no' },
    'q-ctrl-1': { rawScore: 0 as const },
    'q-fin-1': { value: 'no' },
    'q-pnp-1': { value: 'yes' },
    'q-moo-1': { value: 'yes' },
  },
  outcome: {
    kind: 'IR35',
    ruleSetVersion: 'ir35-v2',
    verdict: 'inside',
    computedAt: '2026-04-10T10:00:00.000Z',
    areas: [
      areaResult('substitution', 'strong-inside', ['q-sub-1'], []),
      areaResult('control', 'leaning-inside', ['q-ctrl-1'], []),
      areaResult('financial-risk', 'leaning-inside', ['q-fin-1'], []),
      areaResult('part-and-parcel', 'strong-inside', ['q-pnp-1'], []),
      areaResult('moo', 'strong-inside', ['q-moo-1'], []),
    ],
  },
};

/** Verdict 'indeterminate' — all 5 areas neutral. */
export const fixtureIr35Indeterminate: Assessment = {
  ...BASE_ASSESSMENT,
  id: 'ca_fixture_indeterminate',
  answers: {
    'q-sub-1': { isNotApplicable: true },
    'q-ctrl-1': { rawScore: 1 as const },
    'q-fin-1': { value: 'no' },
    'q-pnp-1': { value: 'no' },
    'q-moo-1': { value: 'no' },
  },
  outcome: {
    kind: 'IR35',
    ruleSetVersion: 'ir35-v2',
    verdict: 'indeterminate',
    computedAt: '2026-04-10T10:00:00.000Z',
    areas: [
      areaResult('substitution', 'neutral', ['q-sub-1'], []),
      areaResult('control', 'neutral', ['q-ctrl-1'], []),
      areaResult('financial-risk', 'neutral', ['q-fin-1'], []),
      areaResult('part-and-parcel', 'neutral', ['q-pnp-1'], []),
      areaResult('moo', 'neutral', ['q-moo-1'], []),
    ],
  },
};

/** Back-compat alias — the real Ir35Verdict is 'indeterminate', not 'undetermined'. */
export const fixtureIr35Undetermined = fixtureIr35Indeterminate;

export const SDS_FIXTURE_ENGAGEMENT = {
  id: 'cass_fixture',
  displayName: 'Project Apex — Q2 2026',
  activeFrom: new Date('2026-04-01T00:00:00.000Z'),
  activeTo: new Date('2026-09-30T00:00:00.000Z'),
};

export const SDS_FIXTURE_CONTRACTOR = {
  id: 'c_fixture',
  displayName: 'Acme Consulting Ltd',
};

export const SDS_FIXTURE_ORGANIZATION = {
  id: 'org_fixture',
  name: 'Example Client Plc',
  countryCode: 'GB',
};

export const SDS_FIXTURE_RENDERED_AT = FIXED_DATE;
