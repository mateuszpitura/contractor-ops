/**
 * web-vite port. View receives mutations as props; AddParticipantDialog
 * is mocked to avoid tRPC.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../chain-participant-row.js', () => ({
  ChainParticipantRow: ({ row }: { row: { id: string; displayName: string } }) => (
    <tr data-testid={`row-${row.id}`}>
      <td>{row.displayName}</td>
    </tr>
  ),
}));

vi.mock('../add-participant-dialog.js', () => ({
  AddParticipantDialog: () => <div data-testid="add-participant-dialog" />,
}));

import { render, screen } from '../../../../test/test-utils.js';
import type { Ir35ChainParticipantRow } from '../ir35-chain-panel.js';
import { Ir35ChainPanelEmpty, Ir35ChainPanelView } from '../ir35-chain-panel.js';

function makeMutation<I>() {
  return { mutate: vi.fn() as (vars: I) => void, isPending: false };
}

const baseMutations = {
  markDelivered: makeMutation<{ id: string; note: string | null }>(),
  markAcknowledged: makeMutation<{ id: string; note: string | null }>(),
  removeParticipant: makeMutation<{ id: string }>(),
};

describe('Ir35ChainPanelView', () => {
  it('renders as a labelled section with the chain heading', () => {
    render(<Ir35ChainPanelEmpty engagementId="cass_1" />);
    const heading = screen.getByRole('heading', { name: 'IR35 chain' });
    expect(heading.id).toBeTruthy();
    const section = heading.closest('section');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('shows empty state copy when there are no participants', () => {
    render(<Ir35ChainPanelEmpty engagementId="cass_1" />);
    expect(screen.getByText('No chain participants yet.')).toBeInTheDocument();
  });

  it('renders the Add participant button', () => {
    render(<Ir35ChainPanelEmpty engagementId="cass_1" />);
    expect(screen.getByRole('button', { name: 'Add participant' })).toBeInTheDocument();
  });

  it('renders participant rows + a <table> when rows are supplied', () => {
    const rows: Ir35ChainParticipantRow[] = [
      {
        id: 'p1',
        organizationId: 'org_1',
        contractorAssignmentId: 'cass_1',
        role: 'CLIENT',
        orderIndex: 0,
        displayName: 'Client Co',
        contactEmail: 'client@example.com',
        linkedOrganizationId: null,
        linkedContractorId: null,
        sdsDeliveredAt: null,
        sdsDeliveredNote: null,
        sdsAcknowledgedAt: null,
        sdsAcknowledgedNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'p2',
        organizationId: 'org_1',
        contractorAssignmentId: 'cass_1',
        role: 'WORKER',
        orderIndex: 1,
        displayName: 'Worker Ltd',
        contactEmail: 'worker@example.com',
        linkedOrganizationId: null,
        linkedContractorId: null,
        sdsDeliveredAt: null,
        sdsDeliveredNote: null,
        sdsAcknowledgedAt: null,
        sdsAcknowledgedNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    render(<Ir35ChainPanelView engagementId="cass_1" rows={rows} {...baseMutations} />);
    expect(screen.getByTestId('row-p1')).toBeInTheDocument();
    expect(screen.getByTestId('row-p2')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('No chain participants yet.')).not.toBeInTheDocument();
  });

  it('mounts the add-participant dialog container', () => {
    render(<Ir35ChainPanelEmpty engagementId="cass_1" />);
    expect(screen.getByTestId('add-participant-dialog')).toBeInTheDocument();
  });
});
