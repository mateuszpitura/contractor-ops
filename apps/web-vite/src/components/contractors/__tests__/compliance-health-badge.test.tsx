import { describe, expect, it } from 'vitest';

import { render, screen } from '../../../test/test-utils.js';
import { ComplianceHealthBadge } from '../compliance-health-badge.js';

describe('ComplianceHealthBadge', () => {
  it("renders green health with 'Healthy' label (en)", () => {
    render(<ComplianceHealthBadge health="green" />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it("renders yellow health with 'Warning' label (en)", () => {
    render(<ComplianceHealthBadge health="yellow" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it("renders red health with 'Critical' label (en)", () => {
    render(<ComplianceHealthBadge health="red" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders green health in Polish', async () => {
    render(<ComplianceHealthBadge health="green" />, { locale: 'pl' });
    expect(await screen.findByText('OK')).toBeInTheDocument();
  });

  it('renders yellow health in Polish', async () => {
    render(<ComplianceHealthBadge health="yellow" />, { locale: 'pl' });
    expect(await screen.findByText('Ostrzeżenie')).toBeInTheDocument();
  });

  it('renders red health in Polish', async () => {
    render(<ComplianceHealthBadge health="red" />, { locale: 'pl' });
    expect(await screen.findByText('Krytyczne')).toBeInTheDocument();
  });

  it('applies green color classes for green health', () => {
    const { container } = render(<ComplianceHealthBadge health="green" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-green-800');
  });

  it('applies amber color classes for yellow health', () => {
    const { container } = render(<ComplianceHealthBadge health="yellow" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-amber-800');
  });

  it('applies red color classes for red health', () => {
    const { container } = render(<ComplianceHealthBadge health="red" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-red-500');
  });

  it('renders sm size by default', () => {
    const { container } = render(<ComplianceHealthBadge health="green" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-xs');
  });

  it('renders md size when specified', () => {
    const { container } = render(<ComplianceHealthBadge health="green" size="md" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-sm');
  });
});
