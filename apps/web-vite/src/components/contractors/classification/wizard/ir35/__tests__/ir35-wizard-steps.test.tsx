import type { RuleSetQuestion } from '@contractor-ops/classification';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/classification', () => ({
  IR35_QUESTIONS: [
    {
      id: 'ir35-sub-01',
      area: 'substitution',
      prompt: {
        en: 'Can you send a substitute?',
        pl: 'Czy mozesz wyslac zastepce?',
        de: 'Können Sie einen Ersatz senden?',
      },
      helpText: { en: '', pl: '', de: '' },
      answerType: 'yes-no',
      required: true,
    },
    {
      id: 'ir35-ctrl-01',
      area: 'control',
      prompt: { en: 'Does the client control how you work?', pl: '', de: '' },
      helpText: { en: '', pl: '', de: '' },
      answerType: 'likert-5',
      required: true,
    },
  ] satisfies RuleSetQuestion[],
}));

vi.mock('@contractor-ops/validators', () => ({
  CLASSIFICATION_SCHEIN_NOT_APPLICABLE: 'Nicht anwendbar',
}));

import { render, screen } from '@/test/test-utils';
import type { Ir35StepDefinition } from '../ir35-wizard-steps';
import { Ir35StepContent } from '../ir35-wizard-steps';

const substitutionStep: Ir35StepDefinition = {
  id: 'substitution',
  label: 'Substitution',
  questions: [
    {
      id: 'ir35-sub-01',
      area: 'substitution',
      prompt: {
        en: 'Can you send a substitute?',
        pl: 'Czy mozesz wyslac zastepce?',
        de: 'Können Sie einen Ersatz senden?',
      },
      helpText: { en: '', pl: '', de: '' },
      answerType: 'yes-no',
      required: true,
    },
  ],
};

describe('Ir35StepContent', () => {
  it('renders questions for the given step', () => {
    render(
      <Ir35StepContent step={substitutionStep} locale="en" answers={{}} onAnswerChange={vi.fn()} />,
    );

    expect(screen.getByText('Can you send a substitute?')).toBeInTheDocument();
  });

  it('renders answer inputs for each question', () => {
    render(
      <Ir35StepContent step={substitutionStep} locale="en" answers={{}} onAnswerChange={vi.fn()} />,
    );

    // yes-no question => 2 radio buttons
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });

  it('passes disabled to all question inputs', () => {
    render(
      <Ir35StepContent
        step={substitutionStep}
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
