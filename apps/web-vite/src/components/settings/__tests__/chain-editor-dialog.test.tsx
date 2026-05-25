/**
 * Web-vite port of apps/web/src/components/settings/__tests__/chain-editor-dialog.test.tsx.
 *
 * The dialog mounts inside a Portal and depends on a `useFieldArray` form
 * instance. We mock the user picker container (tRPC-bound) and build a
 * real form + fields array inside a harness so the rendered surface is
 * exercised without a tRPC harness.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../chain-editor-user-picker-container', () => ({
  ChainEditorUserPickerContainer: () => null,
}));

import { useFieldArray, useForm } from 'react-hook-form';
import { render, screen, setup } from '@/test/test-utils';
import type { ChainEditorDialogProps } from '../chain-editor-dialog';
import { ChainEditorDialog } from '../chain-editor-dialog';
import type { ChainFormValues } from '../hooks/use-chain-editor-dialog';
import { DEFAULT_CHAIN_STEP } from '../hooks/use-chain-editor-dialog';

type DialogForm = ChainEditorDialogProps['form'];
type DialogAppend = ChainEditorDialogProps['append'];
type DialogRemove = ChainEditorDialogProps['remove'];
type DialogFields = ChainEditorDialogProps['fields'];

const tStub = ((key: string) => key) as never;

interface HarnessProps {
  open?: boolean;
  isEditMode?: boolean;
  isPending?: boolean;
  onSubmit?: (values: ChainFormValues) => void;
  initialSteps?: number;
}

function Harness({
  open = true,
  isEditMode = false,
  isPending = false,
  onSubmit = vi.fn(),
  initialSteps = 1,
}: HarnessProps) {
  const form = useForm<ChainFormValues>({
    defaultValues: {
      name: '',
      isDefault: false,
      steps: Array.from({ length: initialSteps }, () => ({ ...DEFAULT_CHAIN_STEP })),
      conditions: [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  return (
    <ChainEditorDialog
      open={open}
      onOpenChange={vi.fn()}
      chainData={null}
      t={tStub}
      form={form as unknown as DialogForm}
      fields={fields as unknown as DialogFields}
      append={append as unknown as DialogAppend}
      remove={remove as unknown as DialogRemove}
      isEditMode={isEditMode}
      isPending={isPending}
      onSubmit={onSubmit}
    />
  );
}

describe('ChainEditorDialog', () => {
  it('renders the create-mode title and description by default', () => {
    render(<Harness />);
    expect(screen.getByText('approvals.editor.createTitle')).toBeInTheDocument();
    expect(screen.getByText('approvals.editor.createDescription')).toBeInTheDocument();
  });

  it('renders the edit-mode title when isEditMode is true', () => {
    render(<Harness isEditMode />);
    expect(screen.getByText('approvals.editor.editTitle')).toBeInTheDocument();
    expect(screen.getByText('approvals.editor.editDescription')).toBeInTheDocument();
  });

  it('does not render the dialog body when closed', () => {
    render(<Harness open={false} />);
    expect(screen.queryByText('approvals.editor.createTitle')).not.toBeInTheDocument();
  });

  it('renders the chain name input and a single default step card', () => {
    render(<Harness />);
    expect(screen.getByLabelText('approvals.editor.chainName')).toBeInTheDocument();
    expect(screen.getByLabelText('approvals.editor.levelName')).toBeInTheDocument();
  });

  it('shows the add-level button when fewer than 3 levels exist', () => {
    render(<Harness initialSteps={2} />);
    expect(screen.getByRole('button', { name: /approvals\.editor\.addLevel/i })).toBeEnabled();
  });

  it('disables the add-level button at the 3-level cap', () => {
    render(<Harness initialSteps={3} />);
    expect(screen.getByRole('button', { name: /approvals\.editor\.addLevel/i })).toBeDisabled();
  });

  it('disables save and discard while isPending', () => {
    render(<Harness isPending />);
    expect(screen.getByRole('button', { name: /approvals\.editor\.save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /approvals\.editor\.discard/i })).toBeDisabled();
  });

  it('fires append when add-level is clicked', async () => {
    const { user } = setup(<Harness initialSteps={1} />);
    await user.click(screen.getByRole('button', { name: /approvals\.editor\.addLevel/i }));

    // After append a second level-name input should appear.
    expect(screen.getAllByLabelText('approvals.editor.levelName').length).toBe(2);
  });
});
