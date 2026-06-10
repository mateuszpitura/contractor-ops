/**
 * Page-level test for OnboardingImportPageContent (formerly OnboardingImportContainer).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../layout/feature-gate.js', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const pickJira = (onSourcesChange: (s: string[]) => void) => () => onSourcesChange(['JIRA']);

vi.mock('../source-selection-step.js', () => ({
  SourceSelectionStepContainer: ({
    onSourcesChange,
  }: {
    onSourcesChange: (s: string[]) => void;
  }) => (
    <div data-testid="step1">
      <button type="button" onClick={pickJira(onSourcesChange)}>
        pick-jira
      </button>
    </div>
  ),
}));

vi.mock('../people-review-step.js', () => ({
  PeopleReviewStepContainer: () => <div data-testid="step2">step2</div>,
}));

vi.mock('../project-import-step.js', () => ({
  ProjectImportStepContainer: () => <div data-testid="step3">step3</div>,
}));

vi.mock('../confirm-import-step.js', () => ({
  ConfirmImportStepContainer: () => <div data-testid="step4">step4</div>,
}));

import { OnboardingImportPageContent } from '../../../pages/dashboard/onboarding-import.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('OnboardingImportPageContent (web-vite)', () => {
  it('renders the page title + subtitle', async () => {
    const { container } = await mount(<OnboardingImportPageContent />);
    expect(container.textContent).toContain('Import Your Team');
    expect(container.textContent).toContain('Pull in team members');
  });

  it('renders step 1 (source selection) by default', async () => {
    const { container } = await mount(<OnboardingImportPageContent />);
    expect(container.querySelector('[data-testid="step1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="step2"]')).toBeNull();
  });

  it.skip('marks the current step with aria-current="step"', async () => {
    const { container } = await mount(<OnboardingImportPageContent />);
    const current = container.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
    expect(current?.textContent ?? '').toContain('Select Sources');
  });

  it('renders all four step labels in the indicator', async () => {
    const { container } = await mount(<OnboardingImportPageContent />);
    const text = container.textContent ?? '';
    expect(text).toContain('Select Sources');
    expect(text).toContain('Review People');
    expect(text).toContain('Import Projects');
    expect(text).toContain('Confirm & Import');
  });

  it('disables Continue on step 1 until a source is selected', async () => {
    const { container } = await mount(<OnboardingImportPageContent />);
    const cont = findButton(container, 'Continue');
    expect(cont).not.toBeNull();
    expect(cont?.disabled).toBe(true);

    const pick = Array.from(container.querySelectorAll('button')).find(b =>
      (b.textContent ?? '').includes('pick-jira'),
    );
    await click(pick as HTMLButtonElement);

    const contAfter = findButton(container, 'Continue');
    expect(contAfter?.disabled).toBe(false);
  });

  it('advances to step 2 when Continue is clicked with a valid source', async () => {
    const { container } = await mount(<OnboardingImportPageContent />);
    const pick = Array.from(container.querySelectorAll('button')).find(b =>
      (b.textContent ?? '').includes('pick-jira'),
    );
    await click(pick as HTMLButtonElement);
    const cont = findButton(container, 'Continue');
    await click(cont as HTMLButtonElement);
    expect(container.querySelector('[data-testid="step2"]')).not.toBeNull();
  });

  it('renders Back once past step 1', async () => {
    const { container } = await mount(<OnboardingImportPageContent />);
    const pick = Array.from(container.querySelectorAll('button')).find(b =>
      (b.textContent ?? '').includes('pick-jira'),
    );
    await click(pick as HTMLButtonElement);
    await click(findButton(container, 'Continue') as HTMLButtonElement);
    expect(findButton(container, 'Back')).not.toBeNull();
  });
});
