/**
 * Ported from apps/web/src/components/portal/__tests__/portal-equipment-tab.test.tsx.
 *
 * Web-vite split: PortalEquipmentTab is fully presentational. Translators
 * + queries arrive as props; the test passes stub translators so the
 * key-as-text assertions stay stable across copy edits.
 */

vi.mock('../../equipment/equipment-status-badge', () => ({
  EquipmentStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('../../equipment/equipment-type-icon', () => ({
  EquipmentTypeIcon: () => <span data-testid="type-icon" />,
}));

import { render, screen, setup } from '@/test/test-utils';
import type { PortalEquipmentItem, PortalReturnRequest } from '../hooks/use-portal-equipment.js';
import { PortalEquipmentTab } from '../portal-equipment-tab';

const t = (key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}:${JSON.stringify(vars)}` : key;
const tReturn = (key: string) => `return.${key}`;

const equipmentItems: PortalEquipmentItem[] = [
  {
    assignmentId: 'asg-1',
    equipment: {
      id: 'eq-1',
      name: 'MacBook Pro 16',
      type: 'LAPTOP',
      status: 'ASSIGNED',
      serialNumber: 'SN-001',
    } as PortalEquipmentItem['equipment'],
    latestShipment: null,
  } as unknown as PortalEquipmentItem,
];

function makeProps(overrides: Partial<Parameters<typeof PortalEquipmentTab>[0]> = {}) {
  return {
    t,
    tReturn,
    isPending: false,
    isError: false,
    equipment: equipmentItems,
    returnRequest: null as PortalReturnRequest,
    canReturn: true,
    hasActiveReturn: false,
    onReturnClick: vi.fn(),
    onViewLabelClick: vi.fn(),
    onCancelReturnClick: vi.fn(),
    cancelDialogOpen: false,
    onCancelDialogOpenChange: vi.fn(),
    onConfirmCancelReturn: vi.fn(),
    isCancelling: false,
    errorMessage: 'Something went wrong',
    ...overrides,
  };
}

describe('PortalEquipmentTab', () => {
  it('renders skeleton state when isPending is true', () => {
    const { container } = render(
      <PortalEquipmentTab {...makeProps({ isPending: true, equipment: [] })} />,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders the error message when isError is true', () => {
    render(
      <PortalEquipmentTab {...makeProps({ isError: true, equipment: [], errorMessage: 'Boom' })} />,
    );
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('renders the empty state when equipment array is empty', () => {
    render(<PortalEquipmentTab {...makeProps({ equipment: [] })} />);
    expect(screen.getByText('emptyTitle')).toBeInTheDocument();
  });

  it('renders each equipment item with name and serial', () => {
    render(<PortalEquipmentTab {...makeProps()} />);
    expect(screen.getByText('MacBook Pro 16')).toBeInTheDocument();
    expect(screen.getByText('SN-001')).toBeInTheDocument();
  });

  it('renders the Return-all button when canReturn is true and no active return', () => {
    render(<PortalEquipmentTab {...makeProps()} />);
    expect(screen.getByText('returnAll')).toBeInTheDocument();
  });

  it('hides the Return-all button when canReturn is false', () => {
    render(<PortalEquipmentTab {...makeProps({ canReturn: false })} />);
    expect(screen.queryByText('returnAll')).not.toBeInTheDocument();
  });

  it('renders the pending-approval banner with a cancel button when returnRequest is pending', () => {
    render(
      <PortalEquipmentTab
        {...makeProps({
          hasActiveReturn: true,
          returnRequest: {
            status: 'PENDING_APPROVAL',
          } as unknown as PortalReturnRequest,
        })}
      />,
    );
    expect(screen.getByText('pendingApproval')).toBeInTheDocument();
    expect(screen.getByText('cancelReturn')).toBeInTheDocument();
  });

  it('renders the approved banner with a view-label button when shipment is created', () => {
    render(
      <PortalEquipmentTab
        {...makeProps({
          hasActiveReturn: true,
          returnRequest: {
            status: 'SHIPMENT_CREATED',
          } as unknown as PortalReturnRequest,
        })}
      />,
    );
    expect(screen.getByText('returnApproved')).toBeInTheDocument();
    expect(screen.getByText('viewLabel')).toBeInTheDocument();
  });

  it('invokes onReturnClick when the Return-all button is clicked', async () => {
    const onReturnClick = vi.fn();
    const { user } = setup(<PortalEquipmentTab {...makeProps({ onReturnClick })} />);
    await user.click(screen.getByText('returnAll'));
    expect(onReturnClick).toHaveBeenCalled();
  });
});
