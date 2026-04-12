import { render, screen } from '@/test/test-utils';
import { ShipmentStatusBadge } from '../shipment-status-badge';

const ALL_STATUSES = [
  { status: 'CREATED', label: 'Created' },
  { status: 'LABEL_GENERATED', label: 'Label generated' },
  { status: 'PICKED_UP', label: 'Picked up' },
  { status: 'IN_TRANSIT', label: 'In transit' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
  { status: 'FAILED', label: 'Failed' },
  { status: 'RETURNED', label: 'Returned' },
] as const;

describe('ShipmentStatusBadge', () => {
  it.each(ALL_STATUSES)("renders $status with label '$label'", ({ status, label }) => {
    render(<ShipmentStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(ALL_STATUSES)("sets aria-label to '$label' for status $status", ({ status, label }) => {
    render(<ShipmentStatusBadge status={status} />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('falls back to secondary variant for unknown status', () => {
    render(<ShipmentStatusBadge status="UNKNOWN" />);
    const badge = screen.getByLabelText('Equipment.shipment.status.UNKNOWN');
    expect(badge).toBeInTheDocument();
  });

  it('passes custom className', () => {
    render(<ShipmentStatusBadge status="CREATED" className="extra" />);
    const badge = screen.getByText('Created');
    expect(badge.className).toContain('extra');
  });
});
