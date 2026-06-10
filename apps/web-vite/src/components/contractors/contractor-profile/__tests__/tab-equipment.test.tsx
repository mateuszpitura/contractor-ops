/**
 * Container/component split — `TabEquipmentView` takes the
 * `useContractorTabEquipment` hook return as props.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../equipment/equipment-type-icon.js', () => ({
  EquipmentTypeIcon: () => <span data-testid="type-icon" />,
}));

vi.mock('../../../equipment/equipment-status-badge.js', () => ({
  EquipmentStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('../../../equipment/shipment-condensed.js', () => ({
  ShipmentCondensed: () => <span data-testid="shipment" />,
}));

import { render, screen } from '../../../../test/test-utils.js';
import type { ContractorTabEquipmentItem } from '../../hooks/use-contractor-tab-equipment.js';
import { TabEquipmentEmpty, TabEquipmentView } from '../tab-equipment.js';

type ViewProps = Parameters<typeof TabEquipmentView>[0];

interface Overrides {
  items?: ContractorTabEquipmentItem[];
  isLoading?: boolean;
  isFetching?: boolean;
}

function buildProps(override: Overrides = {}): ViewProps {
  return {
    contractorId: 'c1',
    items: override.items ?? [],
    isLoading: override.isLoading ?? false,
    isFetching: override.isFetching ?? false,
  };
}

const sampleItem = (over: Partial<ContractorTabEquipmentItem> = {}): ContractorTabEquipmentItem =>
  ({
    assignmentId: 'a1',
    assignedAt: new Date('2025-01-15T10:00:00Z'),
    equipment: {
      id: 'eq-1',
      name: 'MacBook Pro 16',
      serialNumber: 'SN-12345',
      type: 'LAPTOP',
      status: 'ASSIGNED',
    },
    latestShipment: null,
    ...over,
  }) as ContractorTabEquipmentItem;

describe('TabEquipmentView', () => {
  it('renders empty state when items is empty', () => {
    const { container } = render(<TabEquipmentEmpty />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton rows when loading', () => {
    const { container } = render(<TabEquipmentView {...buildProps({ isLoading: true })} />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders equipment name and link when item exists', () => {
    render(<TabEquipmentView {...buildProps({ items: [sampleItem()] })} />);
    const link = screen.getByText('MacBook Pro 16');
    expect(link.closest('a')?.getAttribute('href')).toMatch(/\/equipment\/eq-1$/);
  });

  it('renders serial number when present', () => {
    render(<TabEquipmentView {...buildProps({ items: [sampleItem()] })} />);
    expect(screen.getByText('SN-12345')).toBeInTheDocument();
  });

  it('renders em dash for missing serial number', () => {
    render(
      <TabEquipmentView
        {...buildProps({
          items: [sampleItem({ equipment: { ...sampleItem().equipment, serialNumber: null } })],
        })}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the EquipmentStatusBadge with item status', () => {
    render(<TabEquipmentView {...buildProps({ items: [sampleItem()] })} />);
    expect(screen.getByTestId('status-badge').textContent).toBe('ASSIGNED');
  });

  it('renders type icon for each row', () => {
    render(<TabEquipmentView {...buildProps({ items: [sampleItem()] })} />);
    expect(screen.getByTestId('type-icon')).toBeInTheDocument();
  });

  it('renders shipment cell via ShipmentCondensed', () => {
    render(<TabEquipmentView {...buildProps({ items: [sampleItem()] })} />);
    expect(screen.getByTestId('shipment')).toBeInTheDocument();
  });

  it('renders table column headers when items exist', () => {
    render(<TabEquipmentView {...buildProps({ items: [sampleItem()] })} />);
    expect(document.querySelectorAll('th').length).toBeGreaterThanOrEqual(3);
  });
});
