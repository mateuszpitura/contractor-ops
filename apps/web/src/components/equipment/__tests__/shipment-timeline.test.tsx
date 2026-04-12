import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@/test/test-utils";

vi.mock("@/trpc/init", () => ({
  trpc: {
    equipment: {
      addShipmentEvent: {
        mutationOptions: (opts: any) => ({
          mutationFn: vi.fn(),
          ...opts,
        }),
      },
      getById: { queryKey: () => ["equipment", "getById"] },
    },
  },
}));

import { ShipmentTimeline } from "../shipment-timeline";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseProps = {
  shipmentId: "ship-1",
  direction: "OUTBOUND",
};

describe("ShipmentTimeline", () => {
  it("renders all status steps as list items", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="IN_TRANSIT"
        events={[
          {
            id: "e1",
            status: "CREATED",
            notes: null,
            occurredAt: "2025-01-01T10:00:00Z",
            createdByUserId: null,
          },
          {
            id: "e2",
            status: "PICKED_UP",
            notes: null,
            occurredAt: "2025-01-02T10:00:00Z",
            createdByUserId: null,
          },
          {
            id: "e3",
            status: "IN_TRANSIT",
            notes: "On the way",
            occurredAt: "2025-01-03T10:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(6); // 6 ordered statuses
  });

  it("displays event notes", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="IN_TRANSIT"
        events={[
          {
            id: "e1",
            status: "IN_TRANSIT",
            notes: "Shipped via express",
            occurredAt: "2025-01-03T10:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("Shipped via express")).toBeInTheDocument();
  });

  it("shows add status update form when not terminal", () => {
    renderWithQuery(<ShipmentTimeline {...baseProps} currentStatus="IN_TRANSIT" events={[]} />);
    expect(screen.getByText("Add status update")).toBeInTheDocument();
  });

  it("hides add status update form when status is terminal (DELIVERED)", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="DELIVERED"
        events={[
          {
            id: "e1",
            status: "DELIVERED",
            notes: null,
            occurredAt: "2025-01-05T10:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    expect(screen.queryByText("Add status update")).not.toBeInTheDocument();
  });

  it("renders FAILED as terminal event", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="FAILED"
        events={[
          {
            id: "e1",
            status: "FAILED",
            notes: "Address invalid",
            occurredAt: "2025-01-05T10:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Address invalid")).toBeInTheDocument();
  });

  it("renders RETURNED as terminal event", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="RETURNED"
        events={[
          {
            id: "e1",
            status: "RETURNED",
            notes: "Refused by recipient",
            occurredAt: "2025-01-05T10:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("Returned")).toBeInTheDocument();
    expect(screen.getByText("Refused by recipient")).toBeInTheDocument();
  });

  it("hides add status update form for RETURNED terminal status", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="RETURNED"
        events={[
          {
            id: "e1",
            status: "RETURNED",
            notes: null,
            occurredAt: "2025-01-05T10:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    expect(screen.queryByText("Add status update")).not.toBeInTheDocument();
  });

  it("shows pending label for future statuses", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="CREATED"
        events={[
          {
            id: "e1",
            status: "CREATED",
            notes: null,
            occurredAt: "2025-01-01T10:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    expect(screen.getAllByText("(pending)").length).toBeGreaterThan(0);
  });

  it("renders DELIVERED as terminal and hides form", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="DELIVERED"
        events={[
          {
            id: "e1",
            status: "CREATED",
            notes: null,
            occurredAt: "2025-01-01T10:00:00Z",
            createdByUserId: null,
          },
          {
            id: "e2",
            status: "DELIVERED",
            notes: "Left at door",
            occurredAt: "2025-01-05T10:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    expect(screen.queryByText("Add status update")).not.toBeInTheDocument();
    expect(screen.getByText("Left at door")).toBeInTheDocument();
  });

  it("disables add button when no status is selected", () => {
    renderWithQuery(<ShipmentTimeline {...baseProps} currentStatus="IN_TRANSIT" events={[]} />);
    const addBtn = screen.getByRole("button", { name: "Add" });
    expect(addBtn).toBeDisabled();
  });

  it("renders event timestamps", () => {
    renderWithQuery(
      <ShipmentTimeline
        {...baseProps}
        currentStatus="PICKED_UP"
        events={[
          {
            id: "e1",
            status: "CREATED",
            notes: null,
            occurredAt: "2025-01-15T14:30:00Z",
            createdByUserId: null,
          },
          {
            id: "e2",
            status: "PICKED_UP",
            notes: null,
            occurredAt: "2025-01-16T09:00:00Z",
            createdByUserId: null,
          },
        ]}
      />,
    );
    // format is "MMM d, HH:mm" - check for date fragment
    expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 16/)).toBeInTheDocument();
  });
});
