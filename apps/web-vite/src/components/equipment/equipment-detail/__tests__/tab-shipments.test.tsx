/**
 * Web-vite splits the tab into a container (owns the useEquipmentShipments hook
 * + selected shipment state) and `TabShipmentsView`. The view is single-path
 * (renders the populated table); loading/error/empty variants are exported as
 * sibling components (`TabShipmentsSkeleton`, `TabShipmentsError`,
 * `TabShipmentsEmpty`) picked by the container. Tests inject the hook return
 * shape directly so we never call tRPC.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import {
  TabShipmentsEmpty,
  TabShipmentsError,
  TabShipmentsSkeleton,
  TabShipmentsView,
} from '../tab-shipments.js';

vi.mock('../shipment-timeline-container.js', () => ({
  ShipmentTimelineContainer: () => <div data-testid="shipment-timeline" />,
}));

vi.mock('../return-approval-banner-container.js', () => ({
  ReturnApprovalBannerContainer: () => <div data-testid="return-banner" />,
}));

vi.mock('../../shipment-status-badge.js', () => ({
  ShipmentStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

type ViewProps = React.ComponentProps<typeof TabShipmentsView>;
type Shipment = ViewProps['shipments'][number];

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 's-1',
    direction: 'OUTBOUND',
    carrier: 'InPost',
    carrierCustom: null,
    trackingNumber: 'TR-12345',
    currentStatus: 'CREATED',
    expectedDeliveryAt: null,
    createdAt: '2026-03-01T00:00:00Z',
    events: [],
    ...overrides,
  } as Shipment;
}

function makeProps(overrides: Partial<ViewProps> = {}): ViewProps {
  const listQuery = {
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ViewProps['listQuery'];
  const detailQuery = {
    isLoading: false,
    isError: false,
    data: undefined,
  } as unknown as ViewProps['detailQuery'];
  const deleteMutation = {
    isPending: false,
    mutate: vi.fn(),
  } as unknown as ViewProps['deleteMutation'];
  return {
    equipmentId: 'eq-1',
    onCreateShipment: vi.fn(),
    pendingReturn: null,
    listQuery,
    shipments: [makeShipment()],
    detailQuery,
    deleteMutation,
    fetchLabel: vi.fn().mockResolvedValue(undefined),
    selectedShipmentId: null,
    setSelectedShipmentId: vi.fn(),
    ...overrides,
  } as ViewProps;
}

describe('TabShipmentsView (web-vite)', () => {
  it('renders shipment row with tracking number and carrier', () => {
    render(<TabShipmentsView {...makeProps({ shipments: [makeShipment()] })} />);
    expect(screen.getByText('TR-12345')).toBeInTheDocument();
    expect(screen.getByText('InPost')).toBeInTheDocument();
  });

  it('renders return approval banner when pendingReturn is provided', () => {
    render(
      <TabShipmentsView
        {...makeProps({
          pendingReturn: {
            id: 'r-1',
            contractorName: 'Jan',
            itemCount: 2,
            targetPointName: 'WAW123',
            createdAt: '2026-03-01',
          },
        })}
      />,
    );
    expect(screen.getByTestId('return-banner')).toBeInTheDocument();
  });

  it('shows delete button only for CREATED shipments', () => {
    const { container } = render(
      <TabShipmentsView
        {...makeProps({ shipments: [makeShipment({ currentStatus: 'CREATED' })] })}
      />,
    );
    expect(container.querySelector('.text-destructive')).toBeTruthy();
  });

  it('hides delete button for non-CREATED shipments', () => {
    const { container } = render(
      <TabShipmentsView
        {...makeProps({ shipments: [makeShipment({ currentStatus: 'IN_TRANSIT' })] })}
      />,
    );
    expect(container.querySelector('button.text-destructive')).toBeNull();
  });

  it('renders multiple shipments as table rows', () => {
    render(
      <TabShipmentsView
        {...makeProps({
          shipments: [
            makeShipment({ id: 's-1' }),
            makeShipment({ id: 's-2', trackingNumber: 'TR-99999' }),
          ],
        })}
      />,
    );
    expect(screen.getByText('TR-12345')).toBeInTheDocument();
    expect(screen.getByText('TR-99999')).toBeInTheDocument();
  });

  it('shows label action only for InPost shipments', () => {
    render(
      <TabShipmentsView
        {...makeProps({
          shipments: [
            makeShipment({ id: 's-inpost', carrier: 'InPost' }),
            makeShipment({ id: 's-other', carrier: 'DPD' }),
          ],
        })}
      />,
    );
    const labelButtons = screen.queryAllByLabelText(/open carrier label/i);
    expect(labelButtons.length).toBe(1);
  });

  it('calls setSelectedShipmentId when View action is clicked', async () => {
    const setSelectedShipmentId = vi.fn();
    const { user } = setup(
      <TabShipmentsView
        {...makeProps({
          shipments: [makeShipment()],
          setSelectedShipmentId,
        })}
      />,
    );
    const viewButtons = screen.getAllByLabelText(/view shipment details/i);
    expect(viewButtons.length).toBeGreaterThan(0);
    await user.click(viewButtons[0] as HTMLButtonElement);
    expect(setSelectedShipmentId).toHaveBeenCalledWith('s-1');
  });

  it('renders shipment timeline inside detail sheet when detail data is present', () => {
    const detailQuery = {
      isLoading: false,
      isError: false,
      data: makeShipment(),
    } as unknown as ViewProps['detailQuery'];
    render(
      <TabShipmentsView
        {...makeProps({
          shipments: [makeShipment()],
          selectedShipmentId: 's-1',
          detailQuery,
        })}
      />,
    );
    expect(screen.getByTestId('shipment-timeline')).toBeInTheDocument();
  });
});

describe('TabShipmentsSkeleton (web-vite)', () => {
  it('renders skeleton rows', () => {
    const { container } = render(<TabShipmentsSkeleton />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length,
    ).toBeGreaterThan(0);
  });

  it('renders return banner above skeleton when pendingReturn is provided', () => {
    render(
      <TabShipmentsSkeleton
        pendingReturn={{
          id: 'r-1',
          contractorName: 'Jan',
          itemCount: 1,
          targetPointName: 'WAW1',
          createdAt: '2026-03-01',
        }}
      />,
    );
    expect(screen.getByTestId('return-banner')).toBeInTheDocument();
  });
});

describe('TabShipmentsError (web-vite)', () => {
  it('renders retry button and invokes onRetry on click', async () => {
    const onRetry = vi.fn();
    const { user } = setup(<TabShipmentsError onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('TabShipmentsEmpty (web-vite)', () => {
  it('renders empty heading and CTA', () => {
    render(<TabShipmentsEmpty onCreateShipment={vi.fn()} />);
    expect(screen.getByText(/no shipments/i)).toBeInTheDocument();
  });

  it('invokes onCreateShipment from CTA', async () => {
    const onCreateShipment = vi.fn();
    const { user } = setup(<TabShipmentsEmpty onCreateShipment={onCreateShipment} />);
    await user.click(screen.getByRole('button', { name: /create shipment/i }));
    expect(onCreateShipment).toHaveBeenCalledTimes(1);
  });

  it('renders return banner above empty state when pendingReturn is provided', () => {
    render(
      <TabShipmentsEmpty
        onCreateShipment={vi.fn()}
        pendingReturn={{
          id: 'r-1',
          contractorName: 'Jan',
          itemCount: 1,
          targetPointName: 'WAW1',
          createdAt: '2026-03-01',
        }}
      />,
    );
    expect(screen.getByTestId('return-banner')).toBeInTheDocument();
  });
});
