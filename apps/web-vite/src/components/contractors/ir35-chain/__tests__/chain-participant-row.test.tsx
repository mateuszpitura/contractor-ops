/**
 * web-vite port. Date formatter stubbed (it reads org settings via tRPC).
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (v == null ? '' : 'Mar 10, 2026'),
    formatTime: (v: unknown) => (v == null ? '' : ''),
    formatDateTime: (v: unknown) => (v == null ? '' : ''),
  }),
}));

import { render, screen } from '../../../../test/test-utils.js';
import { ChainParticipantRow } from '../chain-participant-row.js';
import type { Ir35ChainParticipantRow } from '../ir35-chain-panel.js';

function makeRow(overrides: Partial<Ir35ChainParticipantRow> = {}): Ir35ChainParticipantRow {
  return {
    id: 'p_1',
    organizationId: 'org_1',
    contractorAssignmentId: 'cass_1',
    role: 'AGENCY',
    orderIndex: 1,
    displayName: 'Acme Staffing Ltd',
    contactEmail: 'contact@acme.test',
    linkedOrganizationId: null,
    linkedContractorId: null,
    sdsDeliveredAt: null,
    sdsDeliveredNote: null,
    sdsAcknowledgedAt: null,
    sdsAcknowledgedNote: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

function renderRow(
  row: Ir35ChainParticipantRow,
  props: Partial<{
    onMarkDelivered: (note: string | null) => void;
    onMarkAcknowledged: (note: string | null) => void;
    onRemove: () => void;
  }> = {},
) {
  return render(
    <table>
      <tbody>
        <ChainParticipantRow
          row={row}
          onMarkDelivered={props.onMarkDelivered ?? vi.fn()}
          onMarkAcknowledged={props.onMarkAcknowledged ?? vi.fn()}
          onRemove={props.onRemove ?? vi.fn()}
        />
      </tbody>
    </table>,
  );
}

describe('ChainParticipantRow', () => {
  it('renders the participant display name', () => {
    renderRow(makeRow());
    expect(screen.getByText('Acme Staffing Ltd')).toBeInTheDocument();
  });

  it('renders the translated role label', () => {
    renderRow(makeRow({ role: 'AGENCY' }));
    expect(screen.getByText('Agency')).toBeInTheDocument();
  });

  it('shows "Not delivered" when sdsDeliveredAt is null', () => {
    renderRow(makeRow({ sdsDeliveredAt: null }));
    expect(screen.getByText('Not delivered')).toBeInTheDocument();
  });

  it('shows "Not acknowledged" when sdsAcknowledgedAt is null', () => {
    renderRow(makeRow({ sdsAcknowledgedAt: null }));
    expect(screen.getByText('Not acknowledged')).toBeInTheDocument();
  });

  it('shows a formatted date when sdsDeliveredAt is set', () => {
    renderRow(makeRow({ sdsDeliveredAt: new Date('2026-03-10') }));
    expect(screen.queryByText('Not delivered')).not.toBeInTheDocument();
  });

  it('renders Mark delivered and Mark acknowledged buttons', () => {
    renderRow(makeRow());
    expect(screen.getByRole('button', { name: /mark delivered/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark acknowledged/i })).toBeInTheDocument();
  });

  it('renders Remove button for AGENCY role', () => {
    renderRow(makeRow({ role: 'AGENCY' }));
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('does not render Remove button for CLIENT role (auto-populated)', () => {
    renderRow(makeRow({ role: 'CLIENT' }));
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('does not render Remove button for WORKER role (auto-populated)', () => {
    renderRow(makeRow({ role: 'WORKER' }));
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('calls onMarkDelivered when the delivered button is clicked', async () => {
    const onMarkDelivered = vi.fn();
    renderRow(makeRow(), { onMarkDelivered });
    screen.getByRole('button', { name: /mark delivered/i }).click();
    expect(onMarkDelivered).toHaveBeenCalledWith(null);
  });

  it('calls onRemove when the remove button is clicked', async () => {
    const onRemove = vi.fn();
    renderRow(makeRow({ role: 'PSC' }), { onRemove });
    screen.getByRole('button', { name: /remove/i }).click();
    expect(onRemove).toHaveBeenCalled();
  });
});
