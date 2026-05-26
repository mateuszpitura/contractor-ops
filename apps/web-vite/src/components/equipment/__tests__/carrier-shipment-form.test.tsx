/**
 * Web-vite port of apps/web/src/components/equipment/__tests__/carrier-shipment-form.test.tsx.
 *
 * CarrierShipmentFormView is presentational; tRPC mutations live in
 * `useCarrierShipmentForm`. The test injects a stub `submitShipment`
 * and mocks the heavyweight fieldset/picker children so assertions
 * stay focused on dialog branching and parcel-size interaction.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

vi.mock('../paczkomat-picker', () => ({
  PaczkomatPicker: () => <div data-testid="paczkomat-picker">Picker</div>,
}));

vi.mock('../paczkomat-display', () => ({
  PaczkomatDisplay: () => <div data-testid="paczkomat-display">Display</div>,
}));

vi.mock('../dpd-fieldset', () => ({
  DpdFieldset: () => <div data-testid="dpd-fieldset">DPD fields</div>,
}));

vi.mock('../ups-fieldset', () => ({
  UpsFieldset: () => <div data-testid="ups-fieldset">UPS fields</div>,
}));

import { CarrierShipmentFormView } from '../carrier-shipment-form';

type ViewProps = React.ComponentProps<typeof CarrierShipmentFormView>;

interface Overrides extends Partial<Omit<ViewProps, 'submitShipment'>> {
  submitShipment?: ViewProps['submitShipment'];
}

function makeView(props: Overrides = {}) {
  return (
    <CarrierShipmentFormView
      open={props.open ?? true}
      onOpenChange={props.onOpenChange ?? vi.fn()}
      equipmentIds={props.equipmentIds ?? ['eq-1', 'eq-2']}
      contractorName={props.contractorName ?? 'Acme Corp'}
      preferredPaczkomat={props.preferredPaczkomat ?? null}
      direction={props.direction ?? 'OUTBOUND'}
      configuredCarriers={props.configuredCarriers ?? ['inpost', 'dpd', 'ups']}
      onSuccess={props.onSuccess ?? vi.fn()}
      isPending={props.isPending ?? false}
      submitShipment={props.submitShipment ?? vi.fn()}
    />
  );
}

describe('CarrierShipmentForm (web-vite)', () => {
  it('renders dialog title', () => {
    render(makeView());
    expect(screen.getAllByText('Create shipment').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Cancel button', () => {
    render(makeView());
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows the no-carriers empty state when none are configured', () => {
    render(makeView({ configuredCarriers: [] }));
    expect(screen.getByText('No carriers configured')).toBeInTheDocument();
    expect(screen.getByText(/Set up carrier credentials/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(makeView({ open: false }));
    expect(screen.queryByText('Create shipment')).not.toBeInTheDocument();
  });

  it('auto-selects DPD when only DPD is configured', () => {
    render(makeView({ configuredCarriers: ['dpd'] }));
    expect(screen.getByTestId('dpd-fieldset')).toBeInTheDocument();
    expect(screen.queryByTestId('ups-fieldset')).not.toBeInTheDocument();
  });

  it('auto-selects UPS when only UPS is configured', () => {
    render(makeView({ configuredCarriers: ['ups'] }));
    expect(screen.getByTestId('ups-fieldset')).toBeInTheDocument();
    expect(screen.queryByTestId('dpd-fieldset')).not.toBeInTheDocument();
  });

  it('auto-selects InPost when only InPost is configured', () => {
    render(makeView({ configuredCarriers: ['inpost'] }));
    expect(screen.getByText('Select Paczkomat')).toBeInTheDocument();
  });

  it('renders recipient name for InPost branch', () => {
    render(makeView({ configuredCarriers: ['inpost'] }));
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('shows paczkomat display when preferredPaczkomat is provided', () => {
    render(
      makeView({
        configuredCarriers: ['inpost'],
        preferredPaczkomat: {
          id: 'WAW01A',
          name: 'Paczkomat WAW01A',
          address: 'ul. Testowa 1',
        },
      }),
    );
    expect(screen.getByTestId('paczkomat-display')).toBeInTheDocument();
  });

  it('disables submit when no carrier is selected', () => {
    render(makeView());
    const submitButtons = screen.getAllByText('Create shipment');
    const submitBtn = submitButtons.find(el => el.closest('button'));
    expect(submitBtn?.closest('button')).toBeDisabled();
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(makeView({ onOpenChange }));
    await user.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows parcel size options for InPost', () => {
    render(makeView({ configuredCarriers: ['inpost'] }));
    expect(screen.getByText('Small')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('does not auto-select a fieldset when multiple carriers are configured', () => {
    render(makeView({ configuredCarriers: ['inpost', 'dpd', 'ups'] }));
    expect(screen.queryByTestId('dpd-fieldset')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ups-fieldset')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('marks Medium as the default parcel size for InPost', () => {
    render(makeView({ configuredCarriers: ['inpost'] }));
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    const checked = radios.find(r => r.getAttribute('aria-checked') === 'true');
    expect(checked).toBeTruthy();
    expect(radios.indexOf(checked!)).toBe(1);
  });

  it('changes parcel size when a different radio is clicked', async () => {
    const { user } = setup(makeView({ configuredCarriers: ['inpost'] }));
    const radios = screen.getAllByRole('radio');
    await user.click(radios[2]);
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');
  });

  it('invokes submitShipment with InPost payload when paczkomat is preselected', async () => {
    const submitShipment = vi.fn();
    const { user } = setup(
      makeView({
        configuredCarriers: ['inpost'],
        preferredPaczkomat: {
          id: 'WAW01A',
          name: 'Paczkomat WAW01A',
          address: 'ul. Testowa 1',
        },
        submitShipment,
      }),
    );
    const submitButtons = screen.getAllByText('Create shipment');
    const submitBtn = submitButtons.find(
      el => el.closest('button') && !el.closest('button')?.disabled,
    );
    expect(submitBtn).toBeTruthy();
    await user.click(submitBtn!);
    expect(submitShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        carrier: 'inpost',
        equipmentIds: ['eq-1', 'eq-2'],
        direction: 'OUTBOUND',
        parcelSize: 'medium',
      }),
    );
  });

  it('disables Cancel while isPending', () => {
    render(makeView({ configuredCarriers: ['dpd'], isPending: true }));
    expect(screen.getByText('Cancel').closest('button')).toBeDisabled();
  });
});
