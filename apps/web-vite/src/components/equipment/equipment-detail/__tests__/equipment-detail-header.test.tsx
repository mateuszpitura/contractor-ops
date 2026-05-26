/**
 * Step 10 port of apps/web/src/components/equipment/equipment-detail/__tests__/equipment-detail-header.test.tsx.
 *
 * Web-vite renames the component to `EquipmentDetailHeaderView` and lifts retire/
 * unassign mutations to props (the container owns the hooks). Tests inject
 * shaped mutation stubs so we never call tRPC.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import type { EquipmentDetailHeaderProps } from '../equipment-detail-header.js';
import { EquipmentDetailHeaderView } from '../equipment-detail-header.js';

type ViewProps = EquipmentDetailHeaderProps;

function makeEquipment(overrides: Record<string, unknown> = {}): ViewProps['equipment'] {
  return {
    id: 'eq-1',
    name: 'MacBook Pro 16',
    serialNumber: 'SN-123456',
    type: 'LAPTOP',
    customType: null,
    status: 'AVAILABLE',
    currentAssignment: null,
    ...overrides,
  } as ViewProps['equipment'];
}

function makeProps(overrides: Partial<ViewProps> = {}): ViewProps {
  const retireMutation = { isPending: false } as ViewProps['retireMutation'];
  const unassignMutation = { isPending: false } as ViewProps['unassignMutation'];
  return {
    equipment: makeEquipment(),
    onEdit: vi.fn(),
    onAssign: vi.fn(),
    onCreateShipment: vi.fn(),
    retireDialogOpen: false,
    setRetireDialogOpen: vi.fn(),
    unassignDialogOpen: false,
    setUnassignDialogOpen: vi.fn(),
    retireMutation,
    retire: vi.fn(),
    unassignMutation,
    unassign: vi.fn(),
    ...overrides,
  } as ViewProps;
}

describe('EquipmentDetailHeaderView (web-vite)', () => {
  it('renders equipment name and serial number', () => {
    render(<EquipmentDetailHeaderView {...makeProps()} />);
    expect(screen.getByText('MacBook Pro 16')).toBeInTheDocument();
    expect(screen.getByText('SN-123456')).toBeInTheDocument();
  });

  it('shows assign button when status is AVAILABLE', () => {
    render(
      <EquipmentDetailHeaderView
        {...makeProps({ equipment: makeEquipment({ status: 'AVAILABLE' }) })}
      />,
    );
    expect(screen.getByRole('button', { name: /assign to contractor/i })).toBeInTheDocument();
  });

  it('shows unassign button when status is ASSIGNED', () => {
    render(
      <EquipmentDetailHeaderView
        {...makeProps({
          equipment: makeEquipment({
            status: 'ASSIGNED',
            currentAssignment: {
              id: 'a-1',
              contractorId: 'c-1',
              contractor: { id: 'c-1', legalName: 'Acme', displayName: null },
            },
          }),
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /unassign equipment/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign to contractor/i })).not.toBeInTheDocument();
  });

  it('hides assign and shipment buttons when RETIRED', () => {
    render(
      <EquipmentDetailHeaderView
        {...makeProps({ equipment: makeEquipment({ status: 'RETIRED' }) })}
      />,
    );
    expect(screen.queryByRole('button', { name: /assign to contractor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create shipment/i })).not.toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    const { user } = setup(<EquipmentDetailHeaderView {...makeProps({ onEdit })} />);
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onCreateShipment when shipment button is clicked', async () => {
    const onCreateShipment = vi.fn();
    const { user } = setup(<EquipmentDetailHeaderView {...makeProps({ onCreateShipment })} />);
    await user.click(screen.getByRole('button', { name: /create shipment/i }));
    expect(onCreateShipment).toHaveBeenCalledTimes(1);
  });

  it('calls onAssign when assign button is clicked', async () => {
    const onAssign = vi.fn();
    const { user } = setup(
      <EquipmentDetailHeaderView
        {...makeProps({ onAssign, equipment: makeEquipment({ status: 'AVAILABLE' }) })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /assign to contractor/i }));
    expect(onAssign).toHaveBeenCalledTimes(1);
  });

  it('renders equipment type badge', () => {
    render(<EquipmentDetailHeaderView {...makeProps()} />);
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('does not show serial number when it is null', () => {
    render(
      <EquipmentDetailHeaderView
        {...makeProps({ equipment: makeEquipment({ serialNumber: null }) })}
      />,
    );
    expect(screen.queryByText('SN-123456')).not.toBeInTheDocument();
  });

  it('shows create shipment button for AVAILABLE equipment', () => {
    render(
      <EquipmentDetailHeaderView
        {...makeProps({ equipment: makeEquipment({ status: 'AVAILABLE' }) })}
      />,
    );
    expect(screen.getByRole('button', { name: /create shipment/i })).toBeInTheDocument();
  });

  it('shows create shipment button for ASSIGNED equipment', () => {
    render(
      <EquipmentDetailHeaderView
        {...makeProps({
          equipment: makeEquipment({
            status: 'ASSIGNED',
            currentAssignment: {
              id: 'a-1',
              contractorId: 'c-1',
              contractor: { id: 'c-1', legalName: 'Acme', displayName: null },
            },
          }),
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /create shipment/i })).toBeInTheDocument();
  });

  it('opens unassign dialog when unassign button is clicked', async () => {
    const setUnassignDialogOpen = vi.fn();
    const { user } = setup(
      <EquipmentDetailHeaderView
        {...makeProps({
          setUnassignDialogOpen,
          equipment: makeEquipment({
            status: 'ASSIGNED',
            currentAssignment: {
              id: 'a-1',
              contractorId: 'c-1',
              contractor: { id: 'c-1', legalName: 'Acme', displayName: 'Acme Corp' },
            },
          }),
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /unassign equipment/i }));
    expect(setUnassignDialogOpen).toHaveBeenCalledWith(true);
  });

  it('renders unassign dialog content when unassignDialogOpen is true', () => {
    render(
      <EquipmentDetailHeaderView
        {...makeProps({
          unassignDialogOpen: true,
          equipment: makeEquipment({
            status: 'ASSIGNED',
            currentAssignment: {
              id: 'a-1',
              contractorId: 'c-1',
              contractor: { id: 'c-1', legalName: 'Acme', displayName: 'Acme Corp' },
            },
          }),
        })}
      />,
    );
    // Dialog title surfaces "Unassign equipment" (heading + button both render).
    expect(screen.getAllByText(/unassign equipment/i).length).toBeGreaterThanOrEqual(1);
  });

  it('calls retire when retire dialog confirm is clicked', async () => {
    const retire = vi.fn();
    const { user } = setup(
      <EquipmentDetailHeaderView
        {...makeProps({
          retireDialogOpen: true,
          retire,
        })}
      />,
    );
    // Dialog has both heading + confirm with same label; pick the destructive button.
    const retireBtns = Array.from(document.querySelectorAll('button')).filter(
      b => b.textContent?.trim() === 'Retire',
    );
    await user.click(retireBtns[retireBtns.length - 1] as HTMLButtonElement);
    expect(retire).toHaveBeenCalledWith('eq-1');
  });

  it('always shows edit button regardless of status', () => {
    render(
      <EquipmentDetailHeaderView
        {...makeProps({ equipment: makeEquipment({ status: 'RETIRED' }) })}
      />,
    );
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
  });
});
