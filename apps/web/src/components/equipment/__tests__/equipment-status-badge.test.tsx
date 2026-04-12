import { render, screen } from '@/test/test-utils';
import { EquipmentStatusBadge } from '../equipment-status-badge';

const ALL_STATUSES = [
  { status: 'AVAILABLE', label: 'Available', variant: 'success' },
  { status: 'ASSIGNED', label: 'Assigned', variant: 'default' },
  { status: 'IN_TRANSIT', label: 'In transit', variant: 'info' },
  { status: 'DELIVERED', label: 'Delivered', variant: 'success' },
  { status: 'RETURN_REQUESTED', label: 'Return requested', variant: 'warning' },
  { status: 'RETURN_IN_TRANSIT', label: 'Return in transit', variant: 'info' },
  { status: 'RETURNED', label: 'Returned', variant: 'secondary' },
  { status: 'RETIRED', label: 'Retired', variant: 'outline' },
] as const;

describe('EquipmentStatusBadge', () => {
  it.each(ALL_STATUSES)("renders $status with translated label '$label'", ({ status, label }) => {
    render(<EquipmentStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(ALL_STATUSES)("sets aria-label to '$label' for status $status", ({ status, label }) => {
    render(<EquipmentStatusBadge status={status} />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('falls back to secondary variant for unknown status', () => {
    // The component falls back to "secondary" variant for unknown statuses via
    // `STATUS_VARIANT_MAP[status] ?? "secondary"`. next-intl returns the raw key
    // as the fallback label when no translation exists.
    render(<EquipmentStatusBadge status="UNKNOWN_STATUS" />);
    // next-intl returns the full key path as fallback when no translation exists
    const badge = screen.getByLabelText('Equipment.status.UNKNOWN_STATUS');
    expect(badge).toBeInTheDocument();
    // Verify it uses the secondary variant (no colored variant classes)
    expect(badge.className).not.toContain('bg-green');
    expect(badge.className).not.toContain('bg-blue');
    expect(badge.className).not.toContain('bg-amber');
  });

  it('passes custom className', () => {
    render(<EquipmentStatusBadge status="AVAILABLE" className="extra" />);
    const badge = screen.getByText('Available');
    expect(badge.className).toContain('extra');
  });

  // Polish locale
  it('renders in Polish locale', () => {
    render(<EquipmentStatusBadge status="AVAILABLE" />, { locale: 'pl' });
    expect(screen.getByText('Dostepny')).toBeInTheDocument();
  });
});
