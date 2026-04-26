import type {
  QuestionsSnapshot,
  RuleSetQuestion,
  ScheinCategoryResult,
} from '@contractor-ops/classification';
import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { classifyCategoryVerdict, DrvCategoryBar } from '../drv-category-bar';

const questions: RuleSetQuestion[] = [
  {
    id: 'drv-int-01',
    category: 'integration',
    prompt: { en: 'Are you integrated?', pl: '', de: '' },
    helpText: { en: '', pl: '', de: '' },
    answerType: 'score-0-3',
    required: true,
  },
];

const snapshot = {
  questions,
  capturedAt: new Date().toISOString(),
  ruleSetVersion: 'DRV-2024-v1',
} as unknown as QuestionsSnapshot;

const categoryResult = {
  category: 'integration',
  weight: 30,
  weightedScore: 15,
} as unknown as ScheinCategoryResult;

describe('classifyCategoryVerdict', () => {
  it('returns green when ratio < 0.3', () => {
    expect(classifyCategoryVerdict(2, 90)).toBe('green');
  });

  it('returns amber when ratio is between 0.3 and 0.6', () => {
    expect(classifyCategoryVerdict(45, 90)).toBe('amber');
  });

  it('returns red when ratio > 0.6', () => {
    expect(classifyCategoryVerdict(60, 90)).toBe('red');
  });

  it('returns green when maxWeightedScore is 0', () => {
    expect(classifyCategoryVerdict(0, 0)).toBe('green');
  });
});

describe('DrvCategoryBar', () => {
  it('renders the bar container with data-testid', () => {
    render(
      <DrvCategoryBar
        category={categoryResult}
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    expect(screen.getByTestId('drv-category-bar')).toBeInTheDocument();
  });

  it('sets data-category attribute', () => {
    render(
      <DrvCategoryBar
        category={categoryResult}
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    expect(screen.getByTestId('drv-category-bar')).toHaveAttribute('data-category', 'integration');
  });

  it('renders the bar track with an accessible img role', () => {
    render(
      <DrvCategoryBar
        category={categoryResult}
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    expect(screen.getByTestId('drv-category-bar-track')).toHaveAttribute('role', 'img');
  });

  it('renders threshold markers', () => {
    render(
      <DrvCategoryBar
        category={categoryResult}
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    expect(screen.getByTestId('drv-threshold-green')).toBeInTheDocument();
    expect(screen.getByTestId('drv-threshold-amber')).toBeInTheDocument();
  });

  it('renders a collapsible for criterion breakdown', () => {
    render(
      <DrvCategoryBar
        category={categoryResult}
        questionsSnapshot={snapshot}
        answers={{}}
        locale="en"
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
