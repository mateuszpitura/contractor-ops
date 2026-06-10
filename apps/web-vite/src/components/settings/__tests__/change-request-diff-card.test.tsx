/**
 * Container/component split. The card receives the request payload as a
 * prop plus `t`, `rejectDialogOpen`, comment state, both mutations, and
 * approve/reject handlers from `useChangeRequestDiffCard`. Tests inject
 * shaped stubs.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { ChangeRequestDiffCardProps } from '../change-request-diff-card';
import { ChangeRequestDiffCardView } from '../change-request-diff-card';
import type { useChangeRequestDiffCard } from '../hooks/use-change-request-diff-card';

type HookReturn = ReturnType<typeof useChangeRequestDiffCard>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    rejectDialogOpen: false,
    setRejectDialogOpen: vi.fn(),
    rejectComment: '',
    setRejectComment: vi.fn(),
    approveMutation: { isPending: false } as HookReturn['approveMutation'],
    rejectMutation: { isPending: false } as HookReturn['rejectMutation'],
    handleApprove: vi.fn(),
    handleRejectConfirm: vi.fn(),
    ...overrides,
  } as HookReturn;
}

const baseRequest: ChangeRequestDiffCardProps['request'] = {
  id: 'cr-1',
  contractorName: 'Acme GmbH',
  contractorEmail: 'billing@acme.test',
  requestedChanges: { bankAccountNumber: 'DE000', phone: '+49 30 123' },
  previousValues: { bankAccountNumber: 'DE111', phone: '+49 30 999' },
  createdAt: new Date('2026-05-01T00:00:00Z'),
  status: 'PENDING',
};

describe('ChangeRequestDiffCardView', () => {
  it('renders the title, contractor details and changed-field rows', () => {
    render(<ChangeRequestDiffCardView request={baseRequest} {...buildHook()} />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText(/Acme GmbH/)).toBeInTheDocument();
    expect(screen.getByText(/billing@acme\.test/)).toBeInTheDocument();
    expect(screen.getByText('DE000')).toBeInTheDocument();
    expect(screen.getByText('DE111')).toBeInTheDocument();
    expect(screen.getByText('+49 30 123')).toBeInTheDocument();
  });

  it('renders approve and reject buttons when status is PENDING', () => {
    render(<ChangeRequestDiffCardView request={baseRequest} {...buildHook()} />);

    expect(screen.getByRole('button', { name: 'approveChanges' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'rejectChanges' })).toBeInTheDocument();
  });

  it('hides approve/reject actions when status is APPROVED', () => {
    render(
      <ChangeRequestDiffCardView
        request={{ ...baseRequest, status: 'APPROVED' }}
        {...buildHook()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'approveChanges' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'rejectChanges' })).not.toBeInTheDocument();
  });

  it('fires handleApprove when the approve button is clicked', async () => {
    const handleApprove = vi.fn();
    const { user } = setup(
      <ChangeRequestDiffCardView request={baseRequest} {...buildHook({ handleApprove })} />,
    );

    await user.click(screen.getByRole('button', { name: 'approveChanges' }));
    expect(handleApprove).toHaveBeenCalledTimes(1);
  });

  it('opens the reject dialog when the reject button is clicked', async () => {
    const setRejectDialogOpen = vi.fn();
    const { user } = setup(
      <ChangeRequestDiffCardView request={baseRequest} {...buildHook({ setRejectDialogOpen })} />,
    );

    await user.click(screen.getByRole('button', { name: 'rejectChanges' }));
    expect(setRejectDialogOpen).toHaveBeenCalledWith(true);
  });

  it('renders reject dialog body and disables the confirm button while rejecting', () => {
    render(
      <ChangeRequestDiffCardView
        request={baseRequest}
        {...buildHook({
          rejectDialogOpen: true,
          rejectMutation: { isPending: true } as HookReturn['rejectMutation'],
        })}
      />,
    );

    expect(screen.getByText('rejectTitle')).toBeInTheDocument();
    expect(screen.getByText('rejecting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'rejecting' })).toBeDisabled();
  });
});
