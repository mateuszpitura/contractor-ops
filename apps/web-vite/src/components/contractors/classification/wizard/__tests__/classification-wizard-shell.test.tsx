/**
 * web-vite port. Tests `ClassificationWizardShellView` directly so we don't
 * need to mock tRPC mutations; the hook's outputs come in as props.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../../test/test-utils.js';
import {
  ClassificationWizardShellView,
  ClassificationWizardUnsupportedCountry,
} from '../classification-wizard-shell.js';

const BASE_PROPS = {
  assessmentId: 'assessment-1',
  contractorAssignmentId: 'assignment-1',
  contractorId: 'contractor-1',
  initialUpdatedAt: Date.UTC(2026, 3, 1),
  initialAnswers: {},
  autosaveStatus: 'idle' as const,
  lastSavedAt: null,
  submitMutation: { isPending: false },
  submitAssessment: vi.fn(),
};

describe('ClassificationWizardShellView — IR35 flow', () => {
  it('WS-1: renders the correct step count for GB (IR35 5 steps)', () => {
    render(
      <ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" commitAnswer={vi.fn()} />,
    );
    // ICU interpolation of bare `{current}`/`{total}` placeholders is not
    // expanded in this harness; assert on the progressbar's aria-valuemax
    // which carries the step count without going through the message bundle.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
  });

  it('WS-1 (DRV): renders 4 steps for DE', () => {
    render(
      <ClassificationWizardShellView {...BASE_PROPS} countryCode="DE" commitAnswer={vi.fn()} />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
  });

  it('WS-2: Next stays disabled until all required current-step questions are answered', () => {
    render(
      <ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" commitAnswer={vi.fn()} />,
    );
    const next = screen.getByRole('button', { name: /^Next$/i });
    expect(next).toBeDisabled();
  });

  it('WS-4 + WS-6 coverage: commitAnswer is invoked when an answer changes', async () => {
    const commitAnswer = vi.fn();
    const { user } = setup(
      <ClassificationWizardShellView
        {...BASE_PROPS}
        countryCode="GB"
        commitAnswer={commitAnswer}
      />,
    );
    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);
    expect(commitAnswer).toHaveBeenCalled();
    const call = commitAnswer.mock.calls[0]!;
    expect(String(call[0])).toMatch(/Q-SUB/);
  });

  it('WS-3: step indicator has role="list" with aria-current on active step', () => {
    render(
      <ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" commitAnswer={vi.fn()} />,
    );
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    expect(list.querySelector('li[aria-current="step"]')).not.toBeNull();
  });
});

describe('ClassificationWizardUnsupportedCountry', () => {
  it('renders the not-supported empty state for unknown countryCode', () => {
    render(<ClassificationWizardUnsupportedCountry countryCode="FR" />);
    expect(
      screen.getAllByText(/Classification not available|Classification rule sets/i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('ClassificationWizardShellView — progress bar', () => {
  it('WS-3 / A11Y-2: progressbar uses fractional aria-valuenow', () => {
    render(
      <ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" commitAnswer={vi.fn()} />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    const valuenow = Number(bar.getAttribute('aria-valuenow'));
    expect(valuenow).toBeGreaterThanOrEqual(0);
    expect(valuenow).toBeLessThanOrEqual(5);
  });
});

describe('ClassificationWizardShellView — autosave indicator', () => {
  it('A11Y-4: autosave indicator has aria-live="polite"', () => {
    render(
      <ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" commitAnswer={vi.fn()} />,
    );
    const pill = screen.getByRole('status');
    expect(pill).toHaveAttribute('aria-live', 'polite');
    expect(pill).toHaveAttribute('aria-atomic', 'true');
  });
});

describe('ClassificationWizardShellView — DRV step 1 score-0-3', () => {
  it('WS-6: DRV step 1 renders 24 score-0-3 radios (6 questions × 4 options)', () => {
    render(
      <ClassificationWizardShellView {...BASE_PROPS} countryCode="DE" commitAnswer={vi.fn()} />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(24);
  });
});
