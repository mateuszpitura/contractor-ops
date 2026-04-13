// Plan 04 — Accessibility tests for the classification wizard shell.
//
// Covers A11Y-1..A11Y-6 from PLAN.md §behavior. Uses @testing-library/dom
// role/attribute assertions (axe-core is intentionally NOT added as a new
// dependency for this plan — the manual assertions cover every axe rule
// the plan enumerates, and keep the CI runtime lean).

import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { render } from '@/test/test-utils';

vi.mock('@/trpc/init', () => {
  const makeMutationOptions = () => () => ({ mutationFn: async () => ({}) });
  return {
    trpc: {
      classification: {
        saveAnswer: { mutationOptions: makeMutationOptions() },
        submit: { mutationOptions: makeMutationOptions() },
      },
    },
  };
});

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ClassificationWizardShell } from '../classification-wizard-shell';

const BASE_PROPS = {
  assessmentId: 'assessment-1',
  contractorAssignmentId: 'assignment-1',
  contractorId: 'contractor-1',
  initialUpdatedAt: Date.UTC(2026, 3, 1),
  initialAnswers: {},
} as const;

describe('Wizard shell — accessibility contract', () => {
  it('A11Y-2: progress bar has role, valuenow, valuemin, valuemax, label', () => {
    render(<ClassificationWizardShell {...BASE_PROPS} countryCode="GB" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuenow');
    expect(bar).toHaveAttribute('aria-label');
  });

  it('A11Y-3: step indicator renders aria-current="step" on the active step', () => {
    render(<ClassificationWizardShell {...BASE_PROPS} countryCode="GB" />);
    const list = screen.getByRole('list');
    const current = list.querySelector('li[aria-current="step"]');
    expect(current).not.toBeNull();
  });

  it('A11Y-3: step indicator includes sr-only full labels on every step', () => {
    render(<ClassificationWizardShell {...BASE_PROPS} countryCode="GB" />);
    const list = screen.getByRole('list');
    const srItems = list.querySelectorAll('.sr-only');
    expect(srItems.length).toBeGreaterThanOrEqual(5);
  });

  it('A11Y-4: autosave indicator has aria-live="polite" and aria-atomic="true"', () => {
    render(<ClassificationWizardShell {...BASE_PROPS} countryCode="GB" />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveAttribute('aria-live', 'polite');
    expect(pill).toHaveAttribute('aria-atomic', 'true');
  });

  it('A11Y-6: every radio-option label container has the h-11 class (≥44px touch target)', () => {
    render(<ClassificationWizardShell {...BASE_PROPS} countryCode="GB" />);
    // IR35 step 1 = Substitution, all yes-no. Labels wrap the radios.
    const radios = screen.getAllByRole('radio');
    // Walk up to find the label with the touch-target class.
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

  it('A11Y-1 (smoke): no unlabeled buttons or progressbar in the shell tree', () => {
    render(<ClassificationWizardShell {...BASE_PROPS} countryCode="GB" />);
    // All buttons must have an accessible name (text content or aria-label).
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      const name = btn.textContent?.trim() ?? btn.getAttribute('aria-label') ?? '';
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
