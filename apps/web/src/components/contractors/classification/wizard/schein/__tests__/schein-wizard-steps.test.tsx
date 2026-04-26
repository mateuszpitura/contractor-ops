import type { RuleSetQuestion } from '@contractor-ops/classification';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/classification', () => ({
  CATEGORY_WEIGHTS: {
    integration: 30,
    entrepreneurial: 30,
    'personal-dep': 20,
    'economic-dep': 20,
  },
  SCHEIN_QUESTIONS: [
    {
      id: 'drv-int-01',
      category: 'integration',
      prompt: { en: 'Are you integrated into the org?', pl: '', de: '' },
      helpText: { en: '', pl: '', de: '' },
      answerType: 'score-0-3',
      required: true,
    },
  ] satisfies RuleSetQuestion[],
}));

vi.mock('@contractor-ops/validators', () => ({
  CLASSIFICATION_SCHEIN_NOT_APPLICABLE: 'Nicht anwendbar',
}));

import { render, screen } from '@/test/test-utils';
import type { ScheinStepDefinition } from '../schein-wizard-steps';
import { ScheinStepContent } from '../schein-wizard-steps';

const integrationStep: ScheinStepDefinition = {
  id: 'integration',
  label: 'Integration',
  subtitle: '30% Gewichtung',
  questions: [
    {
      id: 'drv-int-01',
      category: 'integration',
      prompt: { en: 'Are you integrated into the org?', pl: '', de: '' },
      helpText: { en: '', pl: '', de: '' },
      answerType: 'score-0-3',
      required: true,
    },
  ],
};

describe('ScheinStepContent', () => {
  it('renders questions for the given step', () => {
    render(
      <ScheinStepContent
        step={integrationStep}
        locale="en"
        answers={{}}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Are you integrated into the org?')).toBeInTheDocument();
  });

  it('renders score-0-3 answer inputs (4 radios)', () => {
    render(
      <ScheinStepContent
        step={integrationStep}
        locale="en"
        answers={{}}
        onAnswerChange={vi.fn()}
      />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('passes disabled to all question inputs', () => {
    render(
      <ScheinStepContent
        step={integrationStep}
        locale="en"
        answers={{}}
        onAnswerChange={vi.fn()}
        disabled
      />,
    );

    const radios = screen.getAllByRole('radio');
    for (const radio of radios) {
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
