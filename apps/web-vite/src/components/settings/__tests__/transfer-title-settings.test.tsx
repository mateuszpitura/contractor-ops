/**
 * Container/component split. The presentational form receives a
 * pre-bound `register` and `handleSubmit` from react-hook-form via the
 * hook return. We build a real `useForm` instance inside a tiny harness
 * so the form wiring is exercised end-to-end.
 */

import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { useTransferTitleSettings } from '../hooks/use-transfer-title-settings';
import { TransferTitleSettingsView } from '../transfer-title-settings';

type HookReturn = ReturnType<typeof useTransferTitleSettings>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

interface HarnessProps {
  isPending?: boolean;
  onSubmit?: (values: { template: string }) => void;
  initialTemplate?: string;
}

function Harness({
  isPending = false,
  onSubmit = vi.fn(),
  initialTemplate = '{invoice_number}',
}: HarnessProps) {
  const form = useForm<{ template: string }>({
    defaultValues: { template: initialTemplate },
  });

  return (
    <TransferTitleSettingsView
      id="ts"
      t={tStub}
      register={form.register}
      handleSubmit={form.handleSubmit(onSubmit)}
      preview={initialTemplate.replace('{invoice_number}', 'FV/2026/03/001')}
      isDirty={form.formState.isDirty}
      errors={form.formState.errors}
      isPending={isPending}
    />
  );
}

describe('TransferTitleSettings', () => {
  it('renders heading, label and save button', () => {
    render(<Harness />);
    expect(screen.getByText('settingsHeading')).toBeInTheDocument();
    expect(screen.getByLabelText('templateLabel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'saveChanges' })).toBeInTheDocument();
  });

  it('disables the save button when not dirty', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'saveChanges' })).toBeDisabled();
  });

  it('shows a spinner and disables save while isPending', () => {
    const { container } = render(<Harness isPending />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'saveChanges' })).toBeDisabled();
  });

  it('enables save once the input changes and submits via react-hook-form', async () => {
    const onSubmit = vi.fn();
    const { user } = setup(<Harness onSubmit={onSubmit} />);

    const input = screen.getByLabelText('templateLabel');
    await user.type(input, '/new');

    const submit = screen.getByRole('button', { name: 'saveChanges' });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ template: '{invoice_number}/new' }),
      expect.anything(),
    );
  });
});
