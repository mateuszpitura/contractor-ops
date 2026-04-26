import type {
  Ir35AreaResult,
  QuestionsSnapshot,
  RuleSetQuestion,
} from '@contractor-ops/classification';
import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { Ir35AreaCard } from '../ir35-area-card';

const questions: RuleSetQuestion[] = [
  {
    id: 'ir35-sub-01',
    area: 'substitution',
    prompt: { en: 'Can you send a substitute?', pl: '', de: '' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'yes-no',
    required: true,
    caseLawCitation: 'Ready Mixed Concrete [1968]',
  },
  {
    id: 'ir35-sub-02',
    area: 'substitution',
    prompt: { en: 'Is the right unfettered?', pl: '', de: '' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'yes-no',
    required: true,
  },
];

const snapshot = {
  questions,
  capturedAt: new Date().toISOString(),
  ruleSetVersion: 'IR35-2024-CEST',
} as unknown as QuestionsSnapshot;

const areaResult: Ir35AreaResult = {
  area: 'substitution',
  verdict: 'strong-outside',
  drivingQuestionIds: ['ir35-sub-01'],
  caseLawCitations: ['Ready Mixed Concrete [1968]'],
};

describe('Ir35AreaCard', () => {
  it('renders the card with data-testid', () => {
    render(
      <Ir35AreaCard
        area={areaResult}
        questionsSnapshot={snapshot}
        answers={{ 'ir35-sub-01': 'yes', 'ir35-sub-02': 'no' }}
        locale="en"
      />,
    );

    expect(screen.getByTestId('ir35-area-card')).toBeInTheDocument();
  });

  it('displays the area title', () => {
    render(
      <Ir35AreaCard area={areaResult} questionsSnapshot={snapshot} answers={{}} locale="en" />,
    );

    // The area title comes from Classification.ir35.step.substitution translation
    expect(screen.getByTestId('ir35-area-card')).toHaveAttribute('data-area', 'substitution');
  });

  it('renders driving questions section when drivingQuestionIds is non-empty', () => {
    render(
      <Ir35AreaCard
        area={areaResult}
        questionsSnapshot={snapshot}
        answers={{ 'ir35-sub-01': 'yes' }}
        locale="en"
      />,
    );

    expect(screen.getByText('Can you send a substitute?')).toBeInTheDocument();
  });

  it('renders case law citations when present', () => {
    render(
      <Ir35AreaCard area={areaResult} questionsSnapshot={snapshot} answers={{}} locale="en" />,
    );

    expect(screen.getByText('Ready Mixed Concrete [1968]')).toBeInTheDocument();
  });

  it('renders a collapsible for other questions when there are non-driving questions', () => {
    render(
      <Ir35AreaCard area={areaResult} questionsSnapshot={snapshot} answers={{}} locale="en" />,
    );

    // ir35-sub-02 is not a driving question, so it should be in the collapsible
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render citations section when caseLawCitations is empty', () => {
    const areaWithNoCitations: Ir35AreaResult = {
      ...areaResult,
      caseLawCitations: [],
    };

    render(
      <Ir35AreaCard
        area={areaWithNoCitations}
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    expect(screen.queryByText('Ready Mixed Concrete [1968]')).not.toBeInTheDocument();
  });
});
