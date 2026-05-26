/**
 * Web-vite port of apps/web/src/components/settings/e-invoicing/__tests__/leitweg-id-create-dialog.test.tsx.
 *
 * The dialog renders inside a Dialog portal. Tests inject the hook
 * return + `tCommon` + form-error helpers directly and assert on the
 * create/edit titles, save-button disabled state, and cancel handler.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { useLeitwegIdCreateDialog } from '../hooks/use-leitweg-id-create-dialog';
import { LeitwegIdCreateDialog } from '../leitweg-id-create-dialog';

type HookReturn = ReturnType<typeof useLeitwegIdCreateDialog>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];
const tCommonStub = ((key: string) => key) as Parameters<
  typeof LeitwegIdCreateDialog
>[0]['tCommon'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    contractors: [],
    save: vi.fn(),
    isPending: false,
    ...overrides,
  } as HookReturn;
}

function baseProps(overrides: Partial<Parameters<typeof LeitwegIdCreateDialog>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    initial: null,
    tCommon: tCommonStub,
    formError: null,
    setFormError: vi.fn(),
    ...buildHook(),
    ...overrides,
  } as Parameters<typeof LeitwegIdCreateDialog>[0];
}

describe('LeitwegIdCreateDialog', () => {
  it('renders the create heading by default', () => {
    render(<LeitwegIdCreateDialog {...baseProps()} />);
    expect(screen.getByText('headingCreate')).toBeInTheDocument();
    expect(screen.queryByText('headingEdit')).not.toBeInTheDocument();
  });

  it('renders the edit heading when initial is provided', () => {
    render(
      <LeitwegIdCreateDialog
        {...baseProps({
          initial: {
            id: 'lw-1',
            value: '991-12345TEST-83',
            description: 'Bundeswehr',
            isDefaultForContractor: true,
          },
        })}
      />,
    );
    expect(screen.getByText('headingEdit')).toBeInTheDocument();
  });

  it('disables the save button while value is empty', () => {
    render(<LeitwegIdCreateDialog {...baseProps()} />);
    expect(screen.getByTestId('leitweg-save')).toBeDisabled();
  });

  it('shows the formError alert when supplied', () => {
    render(<LeitwegIdCreateDialog {...baseProps({ formError: 'Generic error — please retry' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Generic error — please retry');
  });

  it('fires onOpenChange(false) when the cancel button is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<LeitwegIdCreateDialog {...baseProps({ onOpenChange })} />);

    await user.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render dialog body when closed', () => {
    render(<LeitwegIdCreateDialog {...baseProps({ open: false })} />);
    expect(screen.queryByText('headingCreate')).not.toBeInTheDocument();
  });
});
