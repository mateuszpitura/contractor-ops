/**
 * Web-vite port of apps/web/src/components/equipment/__tests__/equipment-form.test.tsx.
 *
 * EquipmentFormView owns react-hook-form internally. The container/hook
 * (useEquipmentForm) provides `submit` + `isPending`; the test stubs
 * those out so the form renders, react-hook-form binds defaults, and the
 * cancel handler closes the dialog.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { EquipmentFormView } from '../equipment-form';

type ViewProps = React.ComponentProps<typeof EquipmentFormView>;

interface Overrides {
  open?: boolean;
  equipment?: ViewProps['equipment'];
  onOpenChange?: (open: boolean) => void;
  submit?: ViewProps['submit'];
  isPending?: boolean;
}

function makeView(props: Overrides = {}) {
  return (
    <EquipmentFormView
      open={props.open ?? true}
      equipment={props.equipment}
      onOpenChange={props.onOpenChange ?? vi.fn()}
      submit={props.submit ?? vi.fn()}
      isPending={props.isPending ?? false}
    />
  );
}

describe('EquipmentForm (web-vite)', () => {
  it('shows the create title when no equipment is provided', () => {
    render(makeView());
    expect(screen.getAllByText('Add equipment')).toHaveLength(2);
  });

  it('shows the edit title when equipment is provided', () => {
    render(
      makeView({
        equipment: {
          id: 'eq-1',
          name: 'Monitor',
          serialNumber: null,
          type: 'MONITOR',
          customType: null,
          notes: null,
          purchaseDate: null,
        },
      }),
    );
    expect(screen.getAllByText('Edit equipment')).toHaveLength(2);
  });

  it('does not render content when open is false', () => {
    render(makeView({ open: false }));
    expect(screen.queryByText(/Add equipment/i)).not.toBeInTheDocument();
  });

  it('renders name, serial, and notes fields', () => {
    render(makeView());
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/serial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('renders Cancel and Save buttons', () => {
    render(makeView());
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('renders the purchase-date field label', () => {
    render(makeView());
    expect(screen.getByText('Purchase date')).toBeInTheDocument();
  });

  it('pre-fills fields when editing existing equipment', () => {
    render(
      makeView({
        equipment: {
          id: 'eq-1',
          name: 'Dell XPS 15',
          serialNumber: 'SN-999',
          type: 'LAPTOP',
          customType: null,
          notes: 'Work laptop',
          purchaseDate: '2025-06-01',
        },
      }),
    );
    expect(screen.getByLabelText(/name/i)).toHaveValue('Dell XPS 15');
    expect(screen.getByLabelText(/serial/i)).toHaveValue('SN-999');
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(makeView({ onOpenChange }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables Save and Cancel while isPending', () => {
    render(makeView({ isPending: true }));
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
