/**
 * web-vite port. Tests the wizard shell view (container/component split).
 * The view receives autosaveStatus, lastSavedAt, submitMutation, commitAnswer,
 * submitAssessment as props — no tRPC needed.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '../../../../../test/test-utils.js';
import { ClassificationWizardShellView } from '../classification-wizard-shell.js';

const BASE_PROPS = {
  assessmentId: 'assessment-1',
  contractorAssignmentId: 'assignment-1',
  contractorId: 'contractor-1',
  initialUpdatedAt: Date.UTC(2026, 3, 1),
  initialAnswers: {},
  autosaveStatus: 'idle' as const,
  lastSavedAt: null,
  submitMutation: { isPending: false },
  commitAnswer: vi.fn(),
  submitAssessment: vi.fn(),
};

describe('Wizard shell — accessibility contract', () => {
  it('A11Y-2: progress bar has role, valuenow, valuemin, valuemax, label', () => {
    render(<ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuenow');
    expect(bar).toHaveAttribute('aria-label');
  });

  it('A11Y-3: step indicator renders aria-current="step" on the active step', () => {
    render(<ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" />);
    const list = screen.getByRole('list');
    const current = list.querySelector('li[aria-current="step"]');
    expect(current).not.toBeNull();
  });

  it('A11Y-3: step indicator includes sr-only full labels on every step', () => {
    render(<ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" />);
    const list = screen.getByRole('list');
    const srItems = list.querySelectorAll('.sr-only');
    expect(srItems.length).toBeGreaterThanOrEqual(5);
  });

  it('A11Y-4: autosave indicator has aria-live="polite" and aria-atomic="true"', () => {
    render(<ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveAttribute('aria-live', 'polite');
    expect(pill).toHaveAttribute('aria-atomic', 'true');
  });

  it('A11Y-6: radio-option label container carries a ≥44px touch-target class', () => {
    render(<ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" />);
    const radios = screen.getAllByRole('radio');
    for (const radio of radios.slice(0, 2)) {
      let parent: HTMLElement | null = radio.parentElement;
      let found = false;
      while (parent) {
        if (parent.className.includes('h-11')) {
          found = true;
          break;
        }
        parent = parent.parentElement;
      }
      expect(found).toBe(true);
    }
  });

  it('A11Y-1 (smoke): every button has an accessible name', () => {
    render(<ClassificationWizardShellView {...BASE_PROPS} countryCode="GB" />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      const name = btn.textContent?.trim() ?? btn.getAttribute('aria-label') ?? '';
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
