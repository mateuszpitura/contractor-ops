/**
 * Container-level test for OnboardingImportContainer (formerly ImportWizard).
 *
 * The wizard composition was lifted from a presentational `ImportWizard`
 * view into the decisive `OnboardingImportContainer` (composes 4 step
 * containers + owns step state + FeatureGate). We mock all 5 children to
 * isolate the container's own concerns:
 *  - step indicator state (`aria-current="step"` on the active circle)
 *  - the page title/subtitle from the OnboardingImport namespace
 *  - the Back/Continue footer disabled-state rules
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../billing/feature-gate-container.js', () => ({
  FeatureGateContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../source-selection-step-container.js', () => ({
  SourceSelectionStepContainer: ({
    onSourcesChange,
  }: {
    onSourcesChange: (s: string[]) => void;
  }) => (
    <div data-testid="step1">
      <button type="button" onClick={() => onSourcesChange(['JIRA'])}>
        pick-jira
      </button>
    </div>
  ),
}));

vi.mock('../people-review-step-container.js', () => ({
  PeopleReviewStepContainer: () => <div data-testid="step2">step2</div>,
}));

vi.mock('../project-import-step-container.js', () => ({
  ProjectImportStepContainer: () => <div data-testid="step3">step3</div>,
}));

vi.mock('../confirm-import-step-container.js', () => ({
  ConfirmImportStepContainer: () => <div data-testid="step4">step4</div>,
}));

import { OnboardingImportContainer } from '../onboarding-import-container.js';
import { click, findButton, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('OnboardingImportContainer (web-vite)', () => {
  it('renders the page title + subtitle', async () => {
    const { container } = await mount(<OnboardingImportContainer />);
    expect(container.textContent).toContain('Import Your Team');
    expect(container.textContent).toContain('Pull in team members');
  });

  it('renders step 1 (source selection) by default', async () => {
    const { container } = await mount(<OnboardingImportContainer />);
    expect(container.querySelector('[data-testid="step1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="step2"]')).toBeNull();
  });

  it('marks the current step with aria-current="step"', async () => {
    const { container } = await mount(<OnboardingImportContainer />);
    const current = container.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
    expect(current?.textContent ?? '').toContain('Select Sources');
  });

  it('renders all four step labels in the indicator', async () => {
    const { container } = await mount(<OnboardingImportContainer />);
    const text = container.textContent ?? '';
    expect(text).toContain('Select Sources');
    expect(text).toContain('Review People');
    expect(text).toContain('Import Projects');
    expect(text).toContain('Confirm & Import');
  });

  it('disables Continue on step 1 until a source is selected', async () => {
    const { container } = await mount(<OnboardingImportContainer />);
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
    const { container } = await mount(<OnboardingImportContainer />);
    const pick = Array.from(container.querySelectorAll('button')).find(b =>
      (b.textContent ?? '').includes('pick-jira'),
    );
    await click(pick as HTMLButtonElement);
    const cont = findButton(container, 'Continue');
    await click(cont as HTMLButtonElement);
    expect(container.querySelector('[data-testid="step2"]')).not.toBeNull();
    const current = container.querySelector('[aria-current="step"]');
    expect(current?.textContent ?? '').toContain('Review People');
  });

  it('renders Back once past step 1', async () => {
    const { container } = await mount(<OnboardingImportContainer />);
    const pick = Array.from(container.querySelectorAll('button')).find(b =>
      (b.textContent ?? '').includes('pick-jira'),
    );
    await click(pick as HTMLButtonElement);
    await click(findButton(container, 'Continue') as HTMLButtonElement);
    expect(findButton(container, 'Back')).not.toBeNull();
  });
});
