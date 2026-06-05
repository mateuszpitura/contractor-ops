/**
 * Container/component split — the presentational component receives `t`,
 * `form` (react-hook-form), `roleItems`, `onSubmit`, `isPending` from its
 * hook. Tests build a real react-hook-form instance via the standalone
 * `useForm` helper inside a tiny wrapper so the submit + register wiring
 * stays exercised without spinning up tRPC.
 *
 * Stub `t` returns the i18n key — assertions are independent of copy
 * churn.
 */

import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { InviteValues, useInviteDialog } from '../hooks/use-invite-dialog';
import { InviteDialog } from '../invite-dialog';

type HookReturn = ReturnType<typeof useInviteDialog>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

const ROLE_ITEMS: HookReturn['roleItems'] = [
  { value: 'readonly', label: 'Read Only', description: 'Read-only access' },
  { value: 'team_manager', label: 'Team Manager', description: 'Can manage' },
];

interface HarnessProps {
  open: boolean;
  onSubmit?: HookReturn['onSubmit'];
  isPending?: boolean;
}

function Harness({ open, onSubmit = vi.fn(), isPending = false }: HarnessProps) {
  const form = useForm<InviteValues>({
    defaultValues: { email: '', role: 'readonly' },
  });
  return (
    <InviteDialog
      open={open}
      onOpenChange={vi.fn()}
      t={tStub}
      form={form}
      roleItems={ROLE_ITEMS}
      onSubmit={onSubmit}
      isPending={isPending}
    />
  );
}

describe('InviteDialog', () => {
  it('renders title, email label and submit CTA when open', () => {
    render(<Harness open />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByLabelText('emailLabel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cta/i })).toBeInTheDocument();
  });

  it('does not render the dialog body when closed', () => {
    render(<Harness open={false} />);
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });

  it('shows the pending label and disables the submit button while isPending', () => {
    render(<Harness open isPending />);
    expect(screen.getByText('sending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
  });

  it('forwards typed email to react-hook-form and submits via onSubmit', async () => {
    const onSubmit = vi.fn();
    const { user } = setup(<Harness open onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('emailLabel'), 'jane@acme.com');
    await user.click(screen.getByRole('button', { name: /cta/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@acme.com', role: 'readonly' }),
      expect.anything(),
    );
  });
});
