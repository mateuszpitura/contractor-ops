import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';

import type { ZatcaBadgeStatus } from '../zatca-status-badge';
import { ZatcaStatusBadge } from '../zatca-status-badge';

describe('ZatcaStatusBadge', () => {
  const statuses: { status: ZatcaBadgeStatus; label: string }[] = [
    { status: 'PENDING', label: 'ZATCA Pending' },
    { status: 'SUBMITTED', label: 'ZATCA Submitted' },
    { status: 'CLEARED', label: 'ZATCA Cleared' },
    { status: 'REPORTED', label: 'ZATCA Reported' },
    { status: 'REJECTED', label: 'ZATCA Rejected' },
    { status: 'WARNING', label: 'ZATCA Warning' },
  ];

  it.each(statuses)('renders "$label" for status $status', ({ status, label }) => {
    render(<ZatcaStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('sets aria-label without date', () => {
    render(<ZatcaStatusBadge status="CLEARED" />);
    expect(screen.getByLabelText('ZATCA status: Cleared')).toBeInTheDocument();
  });

  it('sets aria-label with date context', () => {
    render(<ZatcaStatusBadge status="REJECTED" date="2026-01-15" />);
    expect(screen.getByLabelText('ZATCA status: Rejected on 2026-01-15')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ZatcaStatusBadge status="PENDING" className="my-class" />);
    expect(container.querySelector('.my-class')).toBeTruthy();
  });

  it('returns null for an unknown status', () => {
    const { container } = render(<ZatcaStatusBadge status={'UNKNOWN' as ZatcaBadgeStatus} />);
    expect(container.innerHTML).toBe('');
  });
});
