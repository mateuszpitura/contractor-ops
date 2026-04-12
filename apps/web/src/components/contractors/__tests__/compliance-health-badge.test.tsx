import { render, screen } from '@/test/test-utils';
import { ComplianceHealthBadge } from '../compliance-health-badge';

describe('ComplianceHealthBadge', () => {
  // ---------------------------------------------------------------------------
  // Health states & i18n
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Polish locale
  // ---------------------------------------------------------------------------

  it('renders green health in Polish', () => {
    render(<ComplianceHealthBadge health="green" />, { locale: 'pl' });
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('renders yellow health in Polish', () => {
    render(<ComplianceHealthBadge health="yellow" />, { locale: 'pl' });
    expect(screen.getByText('Ostrzeżenie')).toBeInTheDocument();
  });

  it('renders red health in Polish', () => {
    render(<ComplianceHealthBadge health="red" />, { locale: 'pl' });
    expect(screen.getByText('Krytyczne')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Color classes
  // ---------------------------------------------------------------------------

  it('applies green color classes for green health', () => {
    const { container } = render(<ComplianceHealthBadge health="green" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-green-600');
  });

  it('applies amber color classes for yellow health', () => {
    const { container } = render(<ComplianceHealthBadge health="yellow" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-amber-600');
  });

  it('applies red color classes for red health', () => {
    const { container } = render(<ComplianceHealthBadge health="red" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-red-500');
  });

  // ---------------------------------------------------------------------------
  // Size prop
  // ---------------------------------------------------------------------------

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
