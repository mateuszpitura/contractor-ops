import type { QuestionsSnapshot, RuleSetQuestion } from '@contractor-ops/classification';
import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { DrvCriterionBreakdownList } from '../drv-criterion-breakdown-list';

const questions: RuleSetQuestion[] = [
  {
    id: 'drv-int-01',
    category: 'integration',
    prompt: { en: 'Are you integrated?', pl: 'Zintegrowany?', de: 'Integriert?' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'score-0-3',
    required: true,
    drvReference: 'DRV-Katalog § 7 SGB IV',
  },
  {
    id: 'drv-int-02',
    category: 'integration',
    prompt: { en: 'Do you follow instructions?', pl: '', de: '' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'score-0-3',
    required: true,
  },
];

const snapshot: QuestionsSnapshot = {
  questions,
  capturedAt: new Date().toISOString(),
  ruleSetVersion: 'DRV-2024-v1',
};

describe('DrvCriterionBreakdownList', () => {
  it('renders a table with the correct test id', () => {
    render(
      <DrvCriterionBreakdownList
        category="integration"
        categoryLabel="Integration"
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    expect(screen.getByTestId('drv-criterion-table')).toBeInTheDocument();
  });

  it('renders table headers for criterion, answer, and score', () => {
    render(
      <DrvCriterionBreakdownList
        category="integration"
        categoryLabel="Integration"
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
  });

  it('renders one row per question in the category', () => {
    render(
      <DrvCriterionBreakdownList
        category="integration"
        categoryLabel="Integration"
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    // 2 questions + 1 header row
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('displays question prompts', () => {
    render(
      <DrvCriterionBreakdownList
        category="integration"
        categoryLabel="Integration"
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    expect(screen.getByText('Are you integrated?')).toBeInTheDocument();
    expect(screen.getByText('Do you follow instructions?')).toBeInTheDocument();
  });

  it('displays drvReference when present', () => {
    render(
      <DrvCriterionBreakdownList
        category="integration"
        categoryLabel="Integration"
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    expect(screen.getByText('DRV-Katalog § 7 SGB IV')).toBeInTheDocument();
  });

  it('shows answer values when provided', () => {
    render(
      <DrvCriterionBreakdownList
        category="integration"
        categoryLabel="Integration"
        questionsSnapshot={snapshot}
        answers={{
          'drv-int-01': { rawScore: 2, isNotApplicable: false },
        }}
        locale="en"
      />,
    );

    // rawScore 2 appears in both answer and score columns
    const cells = screen.getAllByText('2');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });
});
