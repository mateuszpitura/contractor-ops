// Phase 60 · CLASS-07 — EconomicDependencyBandChip behaviour contract.
//
// Verifies the WCAG 1.4.1 semantic triad (colour + icon + text) + i18n.

import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { EconomicDependencyBandChip } from '../band-chip';

describe('EconomicDependencyBandChip', () => {
  it('renders the safe band with a CircleCheck icon + bandSafe label', () => {
    const { container } = render(<EconomicDependencyBandChip band="safe" billingShare={0.4} />);
    const chip = container.querySelector('[data-band="safe"]');
    expect(chip).not.toBeNull();
    expect(chip?.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(/Within thresholds/i)).toBeInTheDocument();
    expect(chip?.getAttribute('aria-label')).toMatch(/40%/);
  });

  it('renders the warning band with a ShieldAlert icon + bandWarning label', () => {
    const { container } = render(
      <EconomicDependencyBandChip band="warning" billingShare={0.75} />,
    );
    const chip = container.querySelector('[data-band="warning"]');
    expect(chip).not.toBeNull();
    expect(screen.getByText(/70%/i)).toBeInTheDocument();
    expect(chip?.getAttribute('aria-label')).toMatch(/75%/);
  });

  it('renders the critical band with a ShieldX icon + bandCritical label', () => {
    const { container } = render(
      <EconomicDependencyBandChip band="critical" billingShare={0.9} />,
    );
    const chip = container.querySelector('[data-band="critical"]');
    expect(chip).not.toBeNull();
    expect(screen.getByText(/83%/i)).toBeInTheDocument();
    expect(chip?.getAttribute('aria-label')).toMatch(/90%/);
  });

  it('aria-label contains both the band label and the rounded percent', () => {
    const { container } = render(
      <EconomicDependencyBandChip band="warning" billingShare={0.7234} />,
    );
    const chip = container.querySelector('[data-band="warning"]');
    expect(chip?.getAttribute('aria-label')).toMatch(/72%/);
    expect(chip?.getAttribute('aria-label')).toMatch(/Warning/i);
  });

  it('marks the icon as decorative (aria-hidden) so screen readers rely on the text label', () => {
    const { container } = render(
      <EconomicDependencyBandChip band="warning" billingShare={0.75} />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
