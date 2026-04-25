import { BANNER_IR35_ADVISORY_EN, BANNER_SCHEIN_ADVISORY_DE } from '@contractor-ops/validators';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClassificationAdvisoryBanner } from '../advisory-banner';

describe('ClassificationAdvisoryBanner', () => {
  it('renders IR35 English phrase for GB jurisdiction', () => {
    render(<ClassificationAdvisoryBanner jurisdiction="GB" />);
    expect(screen.getByRole('note')).toHaveTextContent(BANNER_IR35_ADVISORY_EN.slice(0, 40));
  });

  it('renders Schein German phrase for DE jurisdiction', () => {
    render(<ClassificationAdvisoryBanner jurisdiction="DE" />);
    expect(screen.getByRole('note')).toHaveTextContent(BANNER_SCHEIN_ADVISORY_DE.slice(0, 40));
  });

  it('renders IR35 phrase by default for unknown jurisdiction', () => {
    render(<ClassificationAdvisoryBanner jurisdiction="PL" />);
    expect(screen.getByRole('note')).toHaveTextContent(BANNER_IR35_ADVISORY_EN.slice(0, 40));
  });

  it('has role="note" for accessibility', () => {
    render(<ClassificationAdvisoryBanner jurisdiction="GB" />);
    expect(screen.getByRole('note')).toBeDefined();
  });

  it('does not render a close button (non-dismissible)', () => {
    render(<ClassificationAdvisoryBanner jurisdiction="GB" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses amber colour classes (not red/blue/green)', () => {
    const { container } = render(<ClassificationAdvisoryBanner jurisdiction="GB" />);
    const el = container.querySelector('[role="note"]');
    expect(el?.className).toContain('amber');
  });
});
