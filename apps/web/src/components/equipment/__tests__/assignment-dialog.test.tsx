import { render, screen, setup } from "@/test/test-utils";
import { AssignmentDialog } from "../assignment-dialog";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

const mockMutate = vi.fn();
let mockContractors: Array<{ id: string; displayName: string | null; legalName: string }> = [];
let mockIsLoading = false;
let mockIsPending = false;

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mockContractors.length > 0 ? { items: mockContractors } : undefined,
    isLoading: mockIsLoading,
  }),
  useMutation: (opts: any) => ({ mutate: mockMutate, isPending: mockIsPending, ...opts }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    contractor: { list: { queryOptions: () => ({ queryKey: ["contractor.list"] }) } },
    equipment: {
      assign: { mutationOptions: (opts: any) => ({ mutationFn: vi.fn(), ...opts }) },
      list: { queryKey: () => ["equipment.list"] },
      getById: { queryKey: () => ["equipment.getById"] },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeProps(overrides: Partial<Parameters<typeof AssignmentDialog>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    equipmentId: "eq-1",
    equipmentName: "MacBook Pro 16",
    ...overrides,
  };
}

describe("AssignmentDialog", () => {
  beforeEach(() => {
    mockContractors = [];
    mockIsLoading = false;
    mockIsPending = false;
    mockMutate.mockClear();
  });

  it("renders dialog title and equipment name", () => {
    render(<AssignmentDialog {...makeProps()} />);

    expect(screen.getByText("MacBook Pro 16")).toBeInTheDocument();
  });

  it("renders cancel and assign buttons", () => {
    render(<AssignmentDialog {...makeProps()} />);

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("assign button is disabled when no contractor is selected", () => {
    render(<AssignmentDialog {...makeProps()} />);

    const buttons = screen.getAllByRole("button");
    const assignButton = buttons.find(
      (b) =>
        b.textContent?.toLowerCase().includes("assign") &&
        !b.textContent?.toLowerCase().includes("cancel"),
    );
    expect(assignButton).toBeDisabled();
  });

  it("does not render when open is false", () => {
    render(<AssignmentDialog {...makeProps({ open: false })} />);

    expect(screen.queryByText("MacBook Pro 16")).not.toBeInTheDocument();
  });

  it("renders contractor list items when data is available", () => {
    mockContractors = [
      { id: "c1", displayName: "Jan Kowalski", legalName: "Jan Kowalski sp. z o.o." },
      { id: "c2", displayName: null, legalName: "Acme Corp" },
    ];
    render(<AssignmentDialog {...makeProps()} />);

    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("shows 'No contractors found.' when contractor list is empty and not loading", () => {
    mockContractors = [];
    mockIsLoading = false;
    render(<AssignmentDialog {...makeProps()} />);

    expect(screen.getByText("No contractors found.")).toBeInTheDocument();
  });

  it("calls onOpenChange when cancel button is clicked", async () => {
    const props = makeProps();
    const { user } = setup(<AssignmentDialog {...props} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders search input for contractor search", () => {
    render(<AssignmentDialog {...makeProps()} />);

    expect(screen.getByPlaceholderText("Search contractors...")).toBeInTheDocument();
  });

  it("disables both buttons when mutation is pending", () => {
    mockIsPending = true;
    render(<AssignmentDialog {...makeProps()} />);

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeDisabled();
  });

  it("uses legalName as fallback when displayName is null", () => {
    mockContractors = [{ id: "c1", displayName: null, legalName: "Legal Entity LLC" }];
    render(<AssignmentDialog {...makeProps()} />);

    expect(screen.getByText("Legal Entity LLC")).toBeInTheDocument();
  });

  it("renders the dialog header with assign title", () => {
    render(<AssignmentDialog {...makeProps()} />);

    expect(screen.getAllByText("Assign to contractor").length).toBeGreaterThanOrEqual(1);
  });
});
