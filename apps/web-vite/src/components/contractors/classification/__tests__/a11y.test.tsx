/**
 * web-vite port — accessibility contract for disclaimer + outcome (Plan 05 AX-3..AX-5).
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '../../../../test/test-utils.js';
import { ClassificationDisclaimerDialogView } from '../classification-disclaimer-dialog.js';
import { DrvCategoryBar } from '../outcome/drv-category-bar.js';
import { VerdictBanner } from '../outcome/verdict-banner.js';

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

describe('Plan 05 accessibility contract', () => {
  it('AX-3: disclaimer dialog exposes aria-labelledby + aria-describedby', () => {
    render(
      <ClassificationDisclaimerDialogView
        assessmentId="a1"
        countryCode="GB"
        open={true}
        onAcknowledged={vi.fn()}
        onDeferred={vi.fn()}
        acknowledge={vi.fn()}
        isPending={false}
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

  it('AX-5: DRV category bar track exposes role="img" + aria-label with category + score + level', () => {
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
    expect(ariaLabel.length).toBeGreaterThan(0);
    // Weighted score 45 and max 90 should appear in the interpolated label.
    expect(ariaLabel).toMatch(/45/);
    expect(ariaLabel).toMatch(/90/);
  });
});
