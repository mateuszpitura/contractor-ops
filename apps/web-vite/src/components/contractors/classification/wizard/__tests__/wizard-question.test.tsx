import type { RuleSetQuestion } from '@contractor-ops/classification';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/validators', () => ({
  CLASSIFICATION_SCHEIN_NOT_APPLICABLE: 'Nicht anwendbar',
}));

import { render, screen } from '@/test/test-utils';

import { WizardQuestion } from '../wizard-question';

function makeQuestion(overrides: Partial<RuleSetQuestion> = {}): RuleSetQuestion {
  return {
    id: 'test-q1',
    prompt: {
      en: 'Do you control your schedule?',
      pl: 'Kontrolujesz harmonogram?',
      de: 'Kontrollieren Sie Ihren Zeitplan?',
    },
    helpText: { en: 'Consider if the client dictates hours.', pl: '', de: '' },
    answerType: 'yes-no',
    required: true,
    ...overrides,
  };
}

describe('WizardQuestion', () => {
  it('renders the question prompt text', () => {
    const question = makeQuestion();
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    expect(screen.getByText('Do you control your schedule?')).toBeInTheDocument();
  });

  it('renders required indicator for required questions', () => {
    const question = makeQuestion({ required: true });
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not render required indicator for optional questions', () => {
    const question = makeQuestion({ required: false });
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('renders yes-no answer input for answerType yes-no', () => {
    const question = makeQuestion({ answerType: 'yes-no' });
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });

  it('renders likert answer input for answerType likert-5', () => {
    const question = makeQuestion({ answerType: 'likert-5' });
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
  });

  it('renders score-0-3 answer input for answerType score-0-3', () => {
    const question = makeQuestion({ answerType: 'score-0-3' });
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('renders null for answerType rationale', () => {
    const question = makeQuestion({ answerType: 'rationale' });
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders help text toggle when helpText is present', () => {
    const question = makeQuestion({
      helpText: { en: 'Some help text here.', pl: '', de: '' },
    });
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    // The show/hide trigger for help text
    const buttons = document.querySelectorAll('[data-slot="collapsible-trigger"]');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders legal reference when caseLawCitation is present', () => {
    const question = makeQuestion({
      caseLawCitation: 'Ready Mixed Concrete [1968] 2 QB 497',
      helpText: { en: '', pl: '', de: '' },
    });
    render(<WizardQuestion question={question} locale="en" onChange={vi.fn()} />);

    // At least a trigger for the legal reference collapsible
    const triggers = document.querySelectorAll('[data-slot="collapsible-trigger"]');
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });
});
