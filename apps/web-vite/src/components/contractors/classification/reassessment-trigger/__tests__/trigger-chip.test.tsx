// ReassessmentTriggerChip behaviour contract.
// Verifies the semantic triad (icon + text + accessible label).

import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { ReassessmentTriggerChip } from '../trigger-chip';

describe('ReassessmentTriggerChip', () => {
  it('renders the chipLabel with a RefreshCcw icon and tooltip', () => {
    const { container } = render(<ReassessmentTriggerChip />);
    const chip = container.querySelector('[data-slot="reassessment-trigger-chip"]');
    expect(chip).not.toBeNull();
    expect(chip?.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(/Reassessment recommended/i)).toBeInTheDocument();
    expect(chip?.getAttribute('title')).toBeTruthy();
  });

  it('exposes an aria-label carrying the count when multiple triggers exist', () => {
    const { container } = render(<ReassessmentTriggerChip count={3} />);
    const chip = container.querySelector('[data-slot="reassessment-trigger-chip"]');
    expect(chip?.getAttribute('aria-label')).toMatch(/3/);
  });

  it('falls back to the plain label when count is absent or one', () => {
    const { container } = render(<ReassessmentTriggerChip count={1} />);
    const chip = container.querySelector('[data-slot="reassessment-trigger-chip"]');
    expect(chip?.getAttribute('aria-label')).toBe('Reassessment recommended');
  });
});
