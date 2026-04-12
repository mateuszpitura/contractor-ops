import { render, screen } from '@/test/test-utils';
import { ShipmentCondensed } from '../shipment-condensed';

describe('ShipmentCondensed', () => {
  it('renders nothing when shipment is null', () => {
    const { container } = render(<ShipmentCondensed shipment={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders carrier name', () => {
    render(
      <ShipmentCondensed
        shipment={{
          carrier: 'DPD',
          currentStatus: 'IN_TRANSIT',
          trackingNumber: 'TR123',
        }}
      />,
    );
    expect(screen.getByText('DPD')).toBeInTheDocument();
  });

  it('renders shipment status badge', () => {
    render(
      <ShipmentCondensed
        shipment={{
          carrier: 'InPost',
          currentStatus: 'DELIVERED',
          trackingNumber: null,
        }}
      />,
    );
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('renders tracking number when provided', () => {
    render(
      <ShipmentCondensed
        shipment={{
          carrier: 'UPS',
          currentStatus: 'CREATED',
          trackingNumber: '1Z999AA10123456784',
        }}
      />,
    );
    expect(screen.getByText('1Z999AA10123456784')).toBeInTheDocument();
  });

  it('does not render tracking number when null', () => {
    render(
      <ShipmentCondensed
        shipment={{
          carrier: 'DPD',
          currentStatus: 'CREATED',
          trackingNumber: null,
        }}
      />,
    );
    expect(screen.queryByText(/^[A-Z0-9]{10,}$/)).toBeNull();
  });
});
