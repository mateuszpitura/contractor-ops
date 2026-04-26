// Phase 58 Plan 05 Task 1 — accessibility contract for outcome + disclaimer.
//
// Asserts the ARIA contracts that the behaviour tests don't explicitly
// cover (WCAG 2.1 AA). We use role/attribute assertions rather than
// @axe-core/react to keep the CI surface lean; the Nyquist rule-set still
// enumerates these exact checks (AX-3/4/5 etc).

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/trpc/init', () => ({
  trpc: {
    classification: {
      acknowledgeDisclaimer: {
        mutationOptions: () => ({ mutationFn: async () => ({ ok: true }) }),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { render, screen } from '@/test/test-utils';

import { ClassificationDisclaimerDialog } from '../classification-disclaimer-dialog';
import { DrvCategoryBar } from '../outcome/drv-category-bar';
import { VerdictBanner } from '../outcome/verdict-banner';

const ir35Outcome = {
  kind: 'IR35' as const,
  ruleSetVersion: 'IR35-2024-CEST',
  verdict: 'outside' as const,
  areas: [],
  computedAt: new Date().toISOString(),
};

const drvCategory = {
  category: 'integration' as const,
  weight: 30,
  rawScore: 1.5,
  weightedScore: 45,
  verdict: 'amber' as const,
  drvReferences: [],
};

const questionsSnapshot = {
  ruleSetVersion: 'SCHEINSELBSTANDIGKEIT-DRV-2024',
  profileId: 'scheinselbstandigkeit',
  questions: [],
};

describe('Phase 58 Plan 05 — accessibility contract', () => {
  it('AX-3: disclaimer dialog exposes aria-labelledby + aria-describedby', () => {
    render(
      <ClassificationDisclaimerDialog
        assessmentId="a1"
        countryCode="GB"
        open={true}
        onAcknowledged={vi.fn()}
        onDeferred={vi.fn()}
      />,
    );
    const alertdialog = screen.getByRole('alertdialog');
    expect(alertdialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(alertdialog.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('AX-4: verdict banner carries role="status" + aria-label matching the text label', () => {
    render(<VerdictBanner kind="ir35" outcome={ir35Outcome} label="Outside IR35" />);
    const banner = screen.getByRole('status');
    expect(banner.getAttribute('aria-label')).toBe('Outside IR35');
  });

  it('AX-5: DRV category bar track exposes role="img" + aria-label with category/score/level', () => {
    render(
      <DrvCategoryBar
        category={drvCategory}
        questionsSnapshot={questionsSnapshot}
        answers={{}}
        locale="en"
      />,
    );
    const bar = screen.getByTestId('drv-category-bar-track');
    expect(bar.getAttribute('role')).toBe('img');
    const ariaLabel = bar.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toMatch(/Integration/);
    expect(ariaLabel).toMatch(/45/);
    expect(ariaLabel).toMatch(/Moderate risk/);
  });
});
