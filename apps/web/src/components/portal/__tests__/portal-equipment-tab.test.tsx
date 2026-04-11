import { render, screen } from "@/test/test-utils";
import { PortalEquipmentTab } from "../portal-equipment-tab";

vi.mock("@/components/equipment/shipment-label-view", () => ({
  LabelDisplay: () => <div data-testid="label-display">Label</div>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockImplementation((opts: any) => {
    // Return empty equipment by default
    if (opts?.queryKey?.[0] === "portal.listEquipment") {
      return { data: [], isPending: false };
    }
    return { data: null, isPending: false };
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    portal: {
      listEquipment: {
        queryOptions: () => ({ queryKey: ["portal.listEquipment"] }),
        queryKey: () => ["portal.listEquipment"],
      },
      getReturnStatus: {
        queryOptions: () => ({ queryKey: ["portal.returnStatus"] }),
        queryKey: () => ["portal.returnStatus"],
      },
      cancelReturn: {
        mutationOptions: (opts: any) => ({ mutationFn: vi.fn(), ...opts }),
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/equipment/equipment-type-icon", () => ({
  EquipmentTypeIcon: () => <span data-testid="type-icon" />,
}));

vi.mock("@/components/equipment/equipment-status-badge", () => ({
  EquipmentStatusBadge: ({ status }: any) => <span>{status}</span>,
}));

vi.mock("@/components/portal/portal-return-flow", () => ({
  PortalReturnFlow: () => null,
}));

vi.mock("./portal-return-flow", () => ({
  PortalReturnFlow: () => null,
}));

const { useQuery: mockedUseQuery } = vi.mocked(
  await import("@tanstack/react-query"),
);

const MOCK_EQUIPMENT = [
  {
    assignmentId: "a1",
    assignedAt: "2025-01-01",
    equipment: {
      id: "e1",
      name: "MacBook Pro",
      serialNumber: "SN-12345",
      type: "LAPTOP",
      status: "ASSIGNED",
    },
    latestShipment: {
      currentStatus: "DELIVERED",
      deliveredAt: "2025-01-15",
    },
  },
];

describe("PortalEquipmentTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default empty equipment
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: [], isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
  });

  it("renders empty state when no equipment", () => {
    render(<PortalEquipmentTab />);
    expect(screen.getByText(/no equipment/i)).toBeInTheDocument();
  });

  it("renders page title", () => {
    render(<PortalEquipmentTab />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders loading skeletons when equipment query is pending", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: undefined, isPending: true } as any;
      }
      return { data: null, isPending: false } as any;
    });
    const { container } = render(<PortalEquipmentTab />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it("renders equipment card with name when equipment exists", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
  });

  it("renders serial number for equipment", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByText("SN-12345")).toBeInTheDocument();
  });

  it("renders equipment status badge", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByText("ASSIGNED")).toBeInTheDocument();
  });

  it("renders return all button when returnable equipment exists", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByText("Return equipment")).toBeInTheDocument();
  });

  it("shows pending approval banner when return request is pending", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      if (opts?.queryKey?.[0] === "portal.returnStatus") {
        return {
          data: { id: "r1", status: "PENDING_APPROVAL", shipmentId: null, targetPointName: null },
          isPending: false,
        } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByText(/pending approval/i)).toBeInTheDocument();
    expect(screen.getByText("Cancel return")).toBeInTheDocument();
  });

  it("shows shipment created banner when return is approved", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      if (opts?.queryKey?.[0] === "portal.returnStatus") {
        return {
          data: { id: "r1", status: "SHIPMENT_CREATED", shipmentId: "s1", targetPointName: null },
          isPending: false,
        } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByText(/return approved/i)).toBeInTheDocument();
  });

  it("hides return button when active return exists", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      if (opts?.queryKey?.[0] === "portal.returnStatus") {
        return {
          data: { id: "r1", status: "PENDING_APPROVAL", shipmentId: null, targetPointName: null },
          isPending: false,
        } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.queryByText("Return equipment")).not.toBeInTheDocument();
  });

  it("opens cancel return confirmation dialog when cancel is clicked", async () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      if (opts?.queryKey?.[0] === "portal.returnStatus") {
        return {
          data: { id: "r1", status: "PENDING_APPROVAL", shipmentId: null, targetPointName: null },
          isPending: false,
        } as any;
      }
      return { data: null, isPending: false } as any;
    });
    const { setup: setupUtil, waitFor: wf } = await import("@/test/test-utils");
    const { user } = setupUtil(<PortalEquipmentTab />);
    await user.click(screen.getByText("Cancel return"));
    await wf(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });

  it("renders equipment without serial number", () => {
    const noSerialEquipment = [{
      ...MOCK_EQUIPMENT[0],
      equipment: { ...MOCK_EQUIPMENT[0].equipment, serialNumber: null },
    }];
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: noSerialEquipment, isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
  });

  it("renders equipment without delivery date", () => {
    const noDeliveryEquipment = [{
      ...MOCK_EQUIPMENT[0],
      latestShipment: null,
    }];
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: noDeliveryEquipment, isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
  });

  it("renders empty state description", () => {
    render(<PortalEquipmentTab />);
    expect(screen.getByText(/no equipment assigned/i)).toBeInTheDocument();
  });

  it("hides return button when no returnable equipment", () => {
    const returnedEquipment = [{
      ...MOCK_EQUIPMENT[0],
      equipment: { ...MOCK_EQUIPMENT[0].equipment, status: "RETURNED" },
    }];
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: returnedEquipment, isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.queryByText("Return equipment")).not.toBeInTheDocument();
  });

  it("renders type icon for each equipment item", () => {
    mockedUseQuery.mockImplementation((opts: any) => {
      if (opts?.queryKey?.[0] === "portal.listEquipment") {
        return { data: MOCK_EQUIPMENT, isPending: false } as any;
      }
      return { data: null, isPending: false } as any;
    });
    render(<PortalEquipmentTab />);
    expect(screen.getByTestId("type-icon")).toBeInTheDocument();
  });
});
