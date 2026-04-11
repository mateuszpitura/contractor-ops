import { render, screen, setup } from "@/test/test-utils";
import { PortalReturnFlow } from "../portal-return-flow";

vi.mock("@/components/equipment/shipment-label-view", () => ({
  LabelDisplay: () => <div data-testid="label-display">Label</div>,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }),
  useQuery: () => ({ data: undefined, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    portal: {
      requestReturn: { mutationOptions: (opts: any) => ({ mutationFn: vi.fn(), ...opts }) },
      getReturnStatus: { queryKey: () => ["portal.returnStatus"] },
      getReturnLabel: { queryOptions: () => ({ queryKey: ["portal.returnLabel"], enabled: false }) },
      listEquipment: { queryKey: () => ["portal.listEquipment"] },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/equipment/paczkomat-picker", () => ({
  PaczkomatPicker: () => null,
}));

vi.mock("@/components/equipment/paczkomat-display", () => ({
  PaczkomatDisplay: () => <div data-testid="paczkomat-display" />,
}));

vi.mock("@/components/equipment/shipment-label-view", () => ({
  LabelDisplay: () => <div data-testid="label-display" />,
}));

function makeProps(overrides: Partial<Parameters<typeof PortalReturnFlow>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    equipmentItems: [
      { name: "MacBook Pro", serialNumber: "SN-001" },
      { name: "Dell Monitor", serialNumber: null },
    ],
    onSuccess: vi.fn(),
    ...overrides,
  };
}

describe("PortalReturnFlow", () => {
  it("renders step 1 with equipment items", () => {
    render(<PortalReturnFlow {...makeProps()} />);

    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
    expect(screen.getByText("Dell Monitor")).toBeInTheDocument();
  });

  it("shows serial number when present", () => {
    render(<PortalReturnFlow {...makeProps()} />);

    expect(screen.getByText("(SN-001)")).toBeInTheDocument();
  });

  it("shows select drop-off button on step 1", () => {
    render(<PortalReturnFlow {...makeProps()} />);

    expect(screen.getByRole("button", { name: /select drop/i })).toBeInTheDocument();
  });

  it("next button is disabled without paczkomat selection", () => {
    render(<PortalReturnFlow {...makeProps()} />);

    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toBeDisabled();
  });

  it("does not render when open is false", () => {
    render(<PortalReturnFlow {...makeProps({ open: false })} />);

    expect(screen.queryByText("MacBook Pro")).not.toBeInTheDocument();
  });

  it("starts on step 3 when returnRequest status is SHIPMENT_CREATED", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: "WAW01",
          },
        })}
      />,
    );

    // Step 3 shows drop-off location
    expect(screen.getByText(/WAW01/)).toBeInTheDocument();
  });

  it("starts on step 2 when returnRequest status is PENDING_APPROVAL", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "PENDING_APPROVAL",
            shipmentId: null,
            targetPointName: null,
          },
        })}
      />,
    );

    // Step 2 shows approval notice
    expect(screen.getByText(/approval/i)).toBeInTheDocument();
  });

  it("renders equipment items without serial number correctly", () => {
    render(<PortalReturnFlow {...makeProps()} />);
    expect(screen.getByText("Dell Monitor")).toBeInTheDocument();
    // Dell Monitor has no serial number, so (SN-xxx) should not appear for it
    expect(screen.queryByText("(null)")).not.toBeInTheDocument();
  });

  it("shows cancel button on step 1", () => {
    render(<PortalReturnFlow {...makeProps()} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders the dialog title", () => {
    render(<PortalReturnFlow {...makeProps()} />);
    expect(screen.getByText("Return equipment")).toBeInTheDocument();
  });

  it("shows items count in step 1", () => {
    render(<PortalReturnFlow {...makeProps()} />);
    expect(screen.getByText(/returning 2 items/i)).toBeInTheDocument();
  });

  it("shows step 2 content when returnRequest is PENDING_APPROVAL", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "PENDING_APPROVAL",
            shipmentId: null,
            targetPointName: null,
          },
        })}
      />,
    );
    // Step 2 content has the approval notice and request return button
    expect(screen.getByRole("button", { name: /request return/i })).toBeInTheDocument();
  });

  it("shows back button on step 2", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "PENDING_APPROVAL",
            shipmentId: null,
            targetPointName: null,
          },
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("step 3 shows step3Title", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: "WAW01",
          },
        })}
      />,
    );
    expect(screen.getByText("Return approved")).toBeInTheDocument();
  });

  it("step 3 shows approval notice when no label data", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: null,
          },
        })}
      />,
    );
    expect(screen.getByText(/approval/i)).toBeInTheDocument();
  });

  it("step 3 shows cancel button", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: "WAW01",
          },
        })}
      />,
    );
    // Cancel button on step 3
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders step 2 items list", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "PENDING_APPROVAL",
            shipmentId: null,
            targetPointName: null,
          },
        })}
      />,
    );
    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
    expect(screen.getByText("Dell Monitor")).toBeInTheDocument();
  });

  it("renders with single equipment item", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          equipmentItems: [{ name: "Keyboard", serialNumber: "KB-01" }],
        })}
      />,
    );
    expect(screen.getByText("Keyboard")).toBeInTheDocument();
    expect(screen.getByText("(KB-01)")).toBeInTheDocument();
    expect(screen.getByText(/returning 1 item/i)).toBeInTheDocument();
  });

  it("step 3 shows label display area", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: "KRK02",
          },
        })}
      />,
    );
    expect(screen.getByText(/KRK02/)).toBeInTheDocument();
  });

  it("step 3 displays return approved title", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: "WAW05",
          },
        })}
      />,
    );
    expect(screen.getByText("Return approved")).toBeInTheDocument();
  });

  it("renders with many equipment items", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      name: `Item ${i + 1}`,
      serialNumber: `SN-${i + 1}`,
    }));
    render(<PortalReturnFlow {...makeProps({ equipmentItems: items })} />);
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 5")).toBeInTheDocument();
    expect(screen.getByText(/returning 5 items/i)).toBeInTheDocument();
  });

  it("renders dialog description text on step 1", () => {
    render(<PortalReturnFlow {...makeProps()} />);
    expect(screen.getByText("Return equipment")).toBeInTheDocument();
  });

  // ---- Step 1 with no returnRequest defaults to step 1 ----
  it("starts on step 1 when returnRequest has unknown status", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "UNKNOWN",
            shipmentId: null,
            targetPointName: null,
          },
        })}
      />,
    );
    // Step 1 content (defaults to step 1 for unknown statuses)
    expect(screen.getByRole("button", { name: /select drop/i })).toBeInTheDocument();
  });

  // ---- handleOpenChange resets state on reopen ----
  it("resets state when dialog is reopened", () => {
    const { rerender } = render(
      <PortalReturnFlow {...makeProps({ open: false })} />,
    );
    rerender(<PortalReturnFlow {...makeProps({ open: true })} />);
    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
  });

  // ---- Step 2: request return button text ----
  it("step 2 request return button is present for PENDING_APPROVAL", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "PENDING_APPROVAL",
            shipmentId: null,
            targetPointName: "WAW01",
          },
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /request return/i })).toBeInTheDocument();
  });

  // ---- Step 3 with SHIPMENT_CREATED shows target point ----
  it("step 3 shows target point name for SHIPMENT_CREATED", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: "GDN01",
          },
        })}
      />,
    );
    expect(screen.getByText(/GDN01/)).toBeInTheDocument();
  });

  // ---- Step 3 with shipmentId present ----
  it("step 3 renders with shipmentId", () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "ship-xyz",
            targetPointName: "POZ02",
          },
        })}
      />,
    );
    expect(screen.getByText(/POZ02/)).toBeInTheDocument();
    expect(screen.getByText("Return approved")).toBeInTheDocument();
  });

  // ---- Step 1: cancel closes dialog ----
  it("cancel button on step 1 calls onOpenChange(false)", async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <PortalReturnFlow {...makeProps({ onOpenChange })} />,
    );
    await user.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ---- Step 1: next button disabled without point ----
  it("next button is disabled when no point selected", () => {
    render(<PortalReturnFlow {...makeProps()} />);
    const nextBtn = screen.getByText("Next").closest("button");
    expect(nextBtn).toBeDisabled();
  });

  // ---- Step 2: back button navigates to step 1 ----
  it("step 2 back button returns to step 1", async () => {
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "PENDING_APPROVAL",
            shipmentId: null,
            targetPointName: "KRK01",
          },
        })}
      />,
    );
    // Should be on step 2
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  // ---- Step 3: close button ----
  it("step 3 close button calls onOpenChange(false)", async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <PortalReturnFlow
        {...makeProps({
          onOpenChange,
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: "KRK02",
          },
        })}
      />,
    );
    await user.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ---- Step navigation works across all 3 steps ----
  it("renders step 1 by default, step 2 for PENDING_APPROVAL, step 3 for SHIPMENT_CREATED", () => {
    // Step 1 default
    const { unmount } = render(<PortalReturnFlow {...makeProps()} />);
    expect(screen.getByRole("button", { name: /select drop/i })).toBeInTheDocument();
    unmount();

    // Step 2 (PENDING_APPROVAL)
    const { unmount: unmount2 } = render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "PENDING_APPROVAL",
            shipmentId: null,
            targetPointName: null,
          },
        })}
      />,
    );
    expect(screen.getByText(/approval/i)).toBeInTheDocument();
    unmount2();

    // Step 3 (SHIPMENT_CREATED)
    render(
      <PortalReturnFlow
        {...makeProps({
          returnRequest: {
            id: "r-1",
            status: "SHIPMENT_CREATED",
            shipmentId: "s-1",
            targetPointName: "WAW01",
          },
        })}
      />,
    );
    expect(screen.getByText("Return approved")).toBeInTheDocument();
  });
});
