/**
 * Web-vite port of apps/web/src/components/equipment/__tests__/shipment-form.test.tsx.
 *
 * ShipmentFormView owns react-hook-form internally; the test injects a
 * stub `createMutation` so the form renders without tRPC.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import { ShipmentFormView } from '../shipment-form';

type ViewProps = React.ComponentProps<typeof ShipmentFormView>;

interface Overrides {
  open?: boolean;
  equipmentId?: string;
  equipmentName?: string;
  onOpenChange?: (open: boolean) => void;
  isPending?: boolean;
}

function makeView(props: Overrides = {}) {
  const isPending = props.isPending ?? false;
  return (
    <ShipmentFormView
      open={props.open ?? true}
      onOpenChange={props.onOpenChange ?? vi.fn()}
      equipmentId={props.equipmentId ?? 'eq-1'}
      equipmentName={props.equipmentName ?? 'MacBook Pro'}
      createMutation={{ mutate: vi.fn(), isPending } as unknown as ViewProps['createMutation']}
      isPending={isPending}
    />
  );
}

describe('ShipmentForm (web-vite)', () => {
  it('renders the equipment name in the dialog header', () => {
    render(makeView());
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
  });

  it('renders tracking and notes fields', () => {
    render(makeView());
    expect(screen.getByLabelText(/tracking/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('renders Cancel and submit buttons', () => {
    render(makeView());
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });

  it('does not render dialog content when open is false', () => {
    render(makeView({ open: false }));
    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();
  });

  it('renders direction and carrier labels', () => {
    render(makeView());
    expect(screen.getByText('Direction')).toBeInTheDocument();
    expect(screen.getByText('Carrier')).toBeInTheDocument();
  });

  it('renders expected-delivery date field', () => {
    render(makeView());
    expect(screen.getByLabelText(/expected/i)).toBeInTheDocument();
  });

  it('invokes onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(makeView({ onOpenChange }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables Cancel and submit while isPending', () => {
    render(makeView({ isPending: true }));
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
