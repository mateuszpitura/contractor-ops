import { render, screen } from '@/test/test-utils';
import { ConfidenceBadge, getConfidenceConfig } from '../confidence-badge';

describe('getConfidenceConfig', () => {
  it('returns success for confidence > 90', () => {
    const config = getConfidenceConfig(95);
    expect(config.variant).toBe('success');
    expect(config.tooltip).toBe('High confidence: 95%');
    expect(config.icon).toBeDefined();
  });

  it('returns success for confidence = 91', () => {
    expect(getConfidenceConfig(91).variant).toBe('success');
  });

  it('returns warning for confidence = 90 (boundary)', () => {
    expect(getConfidenceConfig(90).variant).toBe('warning');
  });

  it('returns warning for confidence = 70', () => {
    expect(getConfidenceConfig(70).variant).toBe('warning');
    expect(getConfidenceConfig(70).tooltip).toContain('please verify');
  });

  it('returns destructive for confidence = 69', () => {
    expect(getConfidenceConfig(69).variant).toBe('destructive');
  });

  it('returns destructive for confidence = 0', () => {
    expect(getConfidenceConfig(0).variant).toBe('destructive');
    expect(getConfidenceConfig(0).tooltip).toContain('manual review needed');
  });
});

describe('ConfidenceBadge', () => {
  it('shows percentage by default', () => {
    render(<ConfidenceBadge confidence={85} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('hides percentage when showPercentage=false', () => {
    render(<ConfidenceBadge confidence={85} showPercentage={false} />);
    expect(screen.queryByText('85%')).not.toBeInTheDocument();
  });

  it('sets aria-label when showPercentage=false', () => {
    render(<ConfidenceBadge confidence={72} showPercentage={false} />);
    expect(screen.getByLabelText('72% confidence')).toBeInTheDocument();
  });

  it('does not set aria-label when showPercentage=true', () => {
    render(<ConfidenceBadge confidence={72} showPercentage />);
    expect(screen.queryByLabelText('72% confidence')).not.toBeInTheDocument();
  });

  it('renders high confidence with success variant', () => {
    const { container } = render(<ConfidenceBadge confidence={95} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('green');
  });

  it('renders low confidence with destructive variant', () => {
    const { container } = render(<ConfidenceBadge confidence={40} />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('destructive');
  });

  it('uses tabular-nums for percentage display', () => {
    render(<ConfidenceBadge confidence={85} />);
    const pctSpan = screen.getByText('85%');
    expect(pctSpan.className).toContain('tabular-nums');
  });

  // Edge values
  it('handles confidence = 100', () => {
    render(<ConfidenceBadge confidence={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('handles confidence = 0', () => {
    render(<ConfidenceBadge confidence={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
