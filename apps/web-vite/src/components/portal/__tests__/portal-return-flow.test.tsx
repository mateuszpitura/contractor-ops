/**
 * `PortalReturnFlow` calls `usePortalReturnFlow` internally (the
 * container/component split was not applied here). Mock the hook module
 * so the dialog renders with controllable state instead of hitting tRPC.
 * Picker / label-display nested components are stubbed to inert
 * markers so the assertions stay narrow.
 */

const useReturnFlowMock = vi.fn();

vi.mock('../hooks/use-portal-return-flow', () => ({
  usePortalReturnFlow: (...args: unknown[]) => useReturnFlowMock(...args),
}));

vi.mock('../../equipment/paczkomat-picker', () => ({
  PaczkomatPicker: () => null,
}));

vi.mock('../../equipment/paczkomat-display', () => ({
  PaczkomatDisplay: ({ pointName }: { pointName: string }) => <span>display:{pointName}</span>,
}));

vi.mock('../../equipment/shipment-label-view', () => ({
  LabelDisplay: () => <div data-testid="label-display" />,
}));

import { render, screen, setup } from '@/test/test-utils';

import { PortalReturnFlow } from '../portal-return-flow';

const equipmentItems = [
  { name: 'Laptop', serialNumber: 'SN-001' },
  { name: 'Charger', serialNumber: null },
];

function defaultFlow(overrides: Partial<ReturnType<typeof useReturnFlowMock>> = {}) {
  return {
    step: 1,
    setStep: vi.fn(),
    selectedPoint: null,
    setSelectedPoint: vi.fn(),
    pickerOpen: false,
    setPickerOpen: vi.fn(),
    handleOpenChange: vi.fn(),
    handleRequestReturn: vi.fn(),
    requestMutation: { isPending: false, isSuccess: false },
    labelQuery: { isPending: false },
    labelData: undefined,
    geowidgetToken: '',
    ...overrides,
  };
}

function renderFlow(
  flowOverrides: Partial<ReturnType<typeof useReturnFlowMock>> = {},
  open = true,
) {
  useReturnFlowMock.mockReset();
  useReturnFlowMock.mockReturnValue(defaultFlow(flowOverrides));
  return render(
    <PortalReturnFlow
      open={open}
      onOpenChange={vi.fn()}
      equipmentItems={equipmentItems}
      returnRequest={null}
      onSuccess={vi.fn()}
    />,
  );
}

describe('PortalReturnFlow', () => {
  it('renders nothing when closed', () => {
    renderFlow({}, false);
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });

  it('renders the localized title at step 1', () => {
    renderFlow();
    expect(screen.getByText('Return equipment')).toBeInTheDocument();
  });

  it('shows the items-to-return list at step 1', () => {
    renderFlow();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Charger')).toBeInTheDocument();
  });

  it('disables Next at step 1 when no point is selected', () => {
    renderFlow();
    const nextBtn = screen.getByRole('button', { name: /^Next$/ });
    expect(nextBtn).toBeDisabled();
  });

  it('enables Next once a point is selected and shows the selected display', () => {
    renderFlow({
      selectedPoint: { id: 'p-1', name: 'Locker 1', address: 'Main St 1' },
    });
    expect(screen.getByText('display:Locker 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next$/ })).toBeEnabled();
  });

  it('invokes setStep(2) when Next is clicked', async () => {
    const setStep = vi.fn();
    useReturnFlowMock.mockReset();
    useReturnFlowMock.mockReturnValue(
      defaultFlow({
        setStep,
        selectedPoint: { id: 'p-1', name: 'Locker 1', address: 'Main St 1' },
      }),
    );
    const { user } = setup(
      <PortalReturnFlow
        open
        onOpenChange={vi.fn()}
        equipmentItems={equipmentItems}
        returnRequest={null}
        onSuccess={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(setStep).toHaveBeenCalledWith(2);
  });

  it('renders the request-return button at step 2 and triggers the mutation', async () => {
    const handleRequestReturn = vi.fn();
    useReturnFlowMock.mockReset();
    useReturnFlowMock.mockReturnValue(
      defaultFlow({
        step: 2,
        selectedPoint: { id: 'p-1', name: 'Locker 1', address: 'Main St 1' },
        handleRequestReturn,
      }),
    );
    const { user } = setup(
      <PortalReturnFlow
        open
        onOpenChange={vi.fn()}
        equipmentItems={equipmentItems}
        returnRequest={null}
        onSuccess={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Request return/i }));
    expect(handleRequestReturn).toHaveBeenCalled();
  });

  it('renders the label display at step 3 when label data is available', () => {
    renderFlow({
      step: 3,
      labelData: { data: 'BASE64', contentType: 'application/pdf' },
    });
    expect(screen.getByTestId('label-display')).toBeInTheDocument();
  });

  it('renders skeleton at step 3 while label query is pending', () => {
    renderFlow({
      step: 3,
      labelQuery: { isPending: true },
    });
    // Dialog content renders in a portal, query document.body
    expect(document.body.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});
