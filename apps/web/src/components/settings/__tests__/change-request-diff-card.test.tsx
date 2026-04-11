import { render, screen } from "@/test/test-utils";
import { ChangeRequestDiffCard } from "../change-request-diff-card";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    settings: {
      reviewChangeRequest: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseRequest = {
  id: "req-1",
  contractorName: "Jan Kowalski",
  contractorEmail: "jan@test.com",
  requestedChanges: { bankAccountNumber: "PL12345" },
  previousValues: { bankAccountNumber: "PL00000" },
  createdAt: new Date("2026-03-01"),
  status: "PENDING" as const,
};

describe("ChangeRequestDiffCard", () => {
  it("renders contractor info", () => {
    render(<ChangeRequestDiffCard request={baseRequest} />);
    expect(screen.getByText(/Jan Kowalski/)).toBeInTheDocument();
    expect(screen.getByText(/jan@test.com/)).toBeInTheDocument();
  });

  it("renders diff table headers", () => {
    render(<ChangeRequestDiffCard request={baseRequest} />);
    expect(screen.getByText("Field")).toBeInTheDocument();
    expect(screen.getByText("Current Value")).toBeInTheDocument();
    expect(screen.getByText("Requested Value")).toBeInTheDocument();
  });

  it("renders diff values", () => {
    render(<ChangeRequestDiffCard request={baseRequest} />);
    expect(screen.getByText("PL12345")).toBeInTheDocument();
    expect(screen.getByText("PL00000")).toBeInTheDocument();
  });

  it("shows approve/reject buttons for PENDING status", () => {
    render(<ChangeRequestDiffCard request={baseRequest} />);
    expect(screen.getByText("Approve Changes")).toBeInTheDocument();
    expect(screen.getByText("Reject Changes")).toBeInTheDocument();
  });

  it("hides action buttons for non-PENDING status", () => {
    render(
      <ChangeRequestDiffCard
        request={{ ...baseRequest, status: "APPROVED" }}
      />,
    );
    expect(screen.queryByText("Approve Changes")).not.toBeInTheDocument();
  });

  it("shows status badge for APPROVED requests", () => {
    render(
      <ChangeRequestDiffCard
        request={{ ...baseRequest, status: "APPROVED" }}
      />,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });
});
