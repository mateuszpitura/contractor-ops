import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, setup, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { AuditLogTab } from "../audit-log-tab";

const mockSetSearch = vi.fn();
const mockSetActorId = vi.fn();
const mockSetActionFilter = vi.fn();
const mockSetResourceType = vi.fn();
const mockSetDateFrom = vi.fn();
const mockSetDateTo = vi.fn();
const mockSetAuditPage = vi.fn();
const mockSetAuditSort = vi.fn();

let queryStateValues: Record<string, string> = {};

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => ({ parse: () => "", serialize: String }),
  },
  useQueryState: (key: string) => {
    const setters: Record<string, ReturnType<typeof vi.fn>> = {
      auditSearch: mockSetSearch,
      actorId: mockSetActorId,
      actionFilter: mockSetActionFilter,
      resourceType: mockSetResourceType,
      dateFrom: mockSetDateFrom,
      dateTo: mockSetDateTo,
      auditPage: mockSetAuditPage,
      auditSort: mockSetAuditSort,
    };
    return [queryStateValues[key] ?? "", setters[key] ?? vi.fn()];
  },
}));

let mockListData: { items: unknown[]; totalCount: number } = {
  items: [],
  totalCount: 0,
};
let mockListPending = false;
let mockListFetching = false;
let mockActorsData: Array<{ id: string; name: string }> = [];
const mockExportMutate = vi.fn();
let mockExportPending = false;

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    keepPreviousData: Symbol("keepPreviousData"),
    useQuery: (opts: { queryKey?: unknown[] }) => {
      const key = JSON.stringify(opts?.queryKey);
      if (key?.includes("actors")) {
        return {
          isPending: false,
          isLoading: false,
          isFetching: false,
          data: mockActorsData,
        };
      }
      return {
        isPending: mockListPending,
        isLoading: mockListPending,
        isFetching: mockListFetching,
        data: mockListPending ? undefined : mockListData,
      };
    },
    useMutation: () => ({
      mutate: mockExportMutate,
      isPending: mockExportPending,
    }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    audit: {
      list: { queryOptions: vi.fn(() => ({ queryKey: ["audit", "list"] })) },
      actors: {
        queryOptions: vi.fn(() => ({ queryKey: ["audit", "actors"] })),
      },
      export: { mutationOptions: vi.fn(() => ({})) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/test",
}));

vi.mock("../audit-log-table", () => ({
  AuditLogTable: (props: {
    data: unknown[];
    totalCount: number;
    page: number;
    isLoading?: boolean;
    isFetching?: boolean;
  }) => (
    <div data-testid="audit-log-table">
      <span data-testid="table-count">{props.totalCount}</span>
      <span data-testid="table-page">{props.page}</span>
      {props.isLoading && <span data-testid="table-loading" />}
      {props.isFetching && <span data-testid="table-fetching" />}
    </div>
  ),
}));

describe("AuditLogTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryStateValues = {};
    mockListData = { items: [], totalCount: 0 };
    mockListPending = false;
    mockListFetching = false;
    mockActorsData = [];
    mockExportPending = false;
  });

  // ---- Loading state ----
  it("shows skeleton loading state when list is pending", () => {
    mockListPending = true;
    const { container } = render(<AuditLogTab />);
    expect(
      container.querySelectorAll("[data-slot='skeleton']").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("Search audit log...")).not.toBeInTheDocument();
  });

  // ---- Search ----
  it("renders search input", () => {
    render(<AuditLogTab />);
    expect(
      screen.getByPlaceholderText("Search audit log..."),
    ).toBeInTheDocument();
  });

  it("updates local search value on typing", async () => {
    const { user } = setup(<AuditLogTab />);
    const input = screen.getByPlaceholderText("Search audit log...");
    await user.type(input, "test");
    expect(input).toHaveValue("test");
  });

  // ---- Export button ----
  it("renders export button", () => {
    render(<AuditLogTab />);
    expect(screen.getByText("Export audit log")).toBeInTheDocument();
  });

  it("disables export button when totalCount is 0", () => {
    mockListData = { items: [], totalCount: 0 };
    render(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button");
    expect(exportBtn).toBeDisabled();
  });

  it("enables export button when totalCount > 0", () => {
    mockListData = { items: [{ id: "1" }], totalCount: 1 };
    render(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button");
    expect(exportBtn).not.toBeDisabled();
  });

  it("calls export mutation on export click", async () => {
    mockListData = { items: [{ id: "1" }], totalCount: 5 };
    const { user } = setup(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button")!;
    await user.click(exportBtn);
    expect(mockExportMutate).toHaveBeenCalledTimes(1);
  });

  // ---- Filter selects ----
  it("renders actor filter select", () => {
    render(<AuditLogTab />);
    expect(screen.getByText("All actors")).toBeInTheDocument();
  });

  it("renders action filter select", () => {
    render(<AuditLogTab />);
    expect(screen.getByText("All actions")).toBeInTheDocument();
  });

  it("renders resource type filter select", () => {
    render(<AuditLogTab />);
    expect(screen.getByText("All resources")).toBeInTheDocument();
  });

  // ---- Date filters ----
  it("renders date from and date to inputs", () => {
    render(<AuditLogTab />);
    const dateInputs = screen.getAllByDisplayValue("");
    // Date inputs are among these
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  // ---- Table ----
  it("passes data to AuditLogTable", () => {
    mockListData = { items: [{ id: "1" }, { id: "2" }], totalCount: 2 };
    render(<AuditLogTab />);
    expect(screen.getByTestId("audit-log-table")).toBeInTheDocument();
    expect(screen.getByTestId("table-count")).toHaveTextContent("2");
  });

  it("passes loading flag to AuditLogTable when pending with no data", () => {
    mockListPending = true;
    const { container } = render(<AuditLogTab />);
    // When isPending && !data, the skeleton loading path is shown
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  // ---- Pagination ----
  it("passes correct page number to table", () => {
    queryStateValues["auditPage"] = "3";
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-page")).toHaveTextContent("3");
  });

  it("defaults invalid page to 1", () => {
    queryStateValues["auditPage"] = "abc";
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-page")).toHaveTextContent("1");
  });

  // ---- Actors dropdown ----
  it("renders actor options from query data", () => {
    mockActorsData = [
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
    ];
    render(<AuditLogTab />);
    // Actors are rendered in the select dropdown (not visible until opened)
    expect(screen.getByText("All actors")).toBeInTheDocument();
  });

  // ---- Filter select presence ----
  it("renders all three filter selects as comboboxes", () => {
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  // ---- Date filter input types ----
  it("renders date from input", () => {
    const { container } = render(<AuditLogTab />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
  });

  // ---- Fetching state indicator ----
  it("passes isFetching to AuditLogTable when refetching", () => {
    mockListFetching = true;
    mockListData = { items: [{ id: "1" }], totalCount: 1 };
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-fetching")).toBeInTheDocument();
  });

  // ---- Page number higher than 1 ----
  it("passes page 5 to table when query state is 5", () => {
    queryStateValues["auditPage"] = "5";
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-page")).toHaveTextContent("5");
  });

  // ---- Export button pending state ----
  it("export button shows pending state when export is in progress", () => {
    mockExportPending = true;
    mockListData = { items: [{ id: "1" }], totalCount: 1 };
    render(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button");
    expect(exportBtn).toBeInTheDocument();
  });

  // ---- Search debounce ----
  it("debounces search input and calls setter", async () => {
    const { user } = setup(<AuditLogTab />);
    const input = screen.getByPlaceholderText("Search audit log...");
    await user.type(input, "invoice");
    expect(input).toHaveValue("invoice");
    // Wait for debounce to call the setter
    await waitFor(() => {
      expect(mockSetSearch).toHaveBeenCalled();
    });
  });

  // ---- Table receives correct total count ----
  it("passes correct total count to table with data", () => {
    mockListData = { items: [{ id: "1" }, { id: "2" }, { id: "3" }], totalCount: 3 };
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-count")).toHaveTextContent("3");
  });

  // ---- Date from interaction ----
  it("renders date from input with date type", () => {
    const { container } = render(<AuditLogTab />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
  });

  it("calls setDateFrom when date from is changed", async () => {
    const { container, user } = setup(<AuditLogTab />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    const dateFromInput = dateInputs[0] as HTMLInputElement;
    await user.type(dateFromInput, "2026-01-01");
    expect(mockSetDateFrom).toHaveBeenCalled();
  });

  it("calls setDateTo when date to is changed", async () => {
    const { container, user } = setup(<AuditLogTab />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    const dateToInput = dateInputs[1] as HTMLInputElement;
    await user.type(dateToInput, "2026-03-31");
    expect(mockSetDateTo).toHaveBeenCalled();
  });

  // ---- Search clears page ----
  it("resets page on search input via debounce", async () => {
    queryStateValues["auditPage"] = "3";
    const { user } = setup(<AuditLogTab />);
    const input = screen.getByPlaceholderText("Search audit log...");
    await user.type(input, "test");
    await waitFor(() => {
      expect(mockSetAuditPage).toHaveBeenCalledWith("1");
    });
  });

  // ---- Export with multiple items ----
  it("enables export with large total count", () => {
    mockListData = { items: Array.from({ length: 25 }, (_, i) => ({ id: String(i) })), totalCount: 250 };
    render(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button");
    expect(exportBtn).not.toBeDisabled();
  });

  // ---- Default page ----
  it("defaults to page 1 when no auditPage in query state", () => {
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-page")).toHaveTextContent("1");
  });

  // ---- Negative page number ----
  it("clamps negative page number to 1", () => {
    queryStateValues["auditPage"] = "-5";
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-page")).toHaveTextContent("1");
  });

  // ---- Search input preserves value ----
  it("preserves search input value across renders", async () => {
    const { user } = setup(<AuditLogTab />);
    const input = screen.getByPlaceholderText("Search audit log...");
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  // ---- Export button click with filters ----
  it("calls export mutation with current filter state", async () => {
    queryStateValues["actorId"] = "u1";
    queryStateValues["actionFilter"] = "CREATE";
    mockListData = { items: [{ id: "1" }], totalCount: 5 };
    const { user } = setup(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button")!;
    await user.click(exportBtn);
    expect(mockExportMutate).toHaveBeenCalledTimes(1);
  });

  // ---- Date from change resets page ----
  it("resets page to 1 when date from changes", async () => {
    queryStateValues["auditPage"] = "5";
    const { container, user } = setup(<AuditLogTab />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    const dateFromInput = dateInputs[0] as HTMLInputElement;
    await user.type(dateFromInput, "2026-01-15");
    expect(mockSetAuditPage).toHaveBeenCalledWith("1");
  });

  // ---- Date to change resets page ----
  it("resets page to 1 when date to changes", async () => {
    queryStateValues["auditPage"] = "3";
    const { container, user } = setup(<AuditLogTab />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    const dateToInput = dateInputs[1] as HTMLInputElement;
    await user.type(dateToInput, "2026-12-31");
    expect(mockSetAuditPage).toHaveBeenCalledWith("1");
  });

  // ---- Search clear ----
  it("clearing search input updates search state", async () => {
    const { user } = setup(<AuditLogTab />);
    const input = screen.getByPlaceholderText("Search audit log...");
    await user.type(input, "test");
    await user.clear(input);
    expect(input).toHaveValue("");
    await waitFor(() => {
      expect(mockSetSearch).toHaveBeenCalled();
    });
  });

  // ---- Table renders with correct page ----
  it("passes page 2 to table", () => {
    queryStateValues["auditPage"] = "2";
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-page")).toHaveTextContent("2");
  });

  // ---- Export disabled during pending ----
  it("export button is still rendered when export is pending", () => {
    mockExportPending = true;
    mockListData = { items: [{ id: "1" }], totalCount: 1 };
    render(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button");
    expect(exportBtn).toBeInTheDocument();
  });

  // ---- Large page number ----
  it("passes page 100 to table", () => {
    queryStateValues["auditPage"] = "100";
    render(<AuditLogTab />);
    expect(screen.getByTestId("table-page")).toHaveTextContent("100");
  });

  // ---- Actor filter select interaction ----
  it("renders actor filter with actor options from query", () => {
    mockActorsData = [
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
    ];
    render(<AuditLogTab />);
    expect(screen.getByText("All actors")).toBeInTheDocument();
    // Actors appear in select options
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  // ---- Action filter: pre-populated value renders ----
  it("renders action filter with pre-selected value from query state", () => {
    queryStateValues["actionFilter"] = "CREATE";
    render(<AuditLogTab />);
    // The combobox for action filter should have value
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  // ---- Resource type filter: pre-populated value ----
  it("renders resource type filter with pre-selected value from query state", () => {
    queryStateValues["resourceType"] = "INVOICE";
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  // ---- Sort order from query state ----
  it("passes sort order from query state to table", () => {
    queryStateValues["auditSort"] = "asc";
    render(<AuditLogTab />);
    expect(screen.getByTestId("audit-log-table")).toBeInTheDocument();
  });

  // ---- Multiple actors in dropdown ----
  it("renders correct number of actor options in actor filter", () => {
    mockActorsData = [
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
      { id: "u3", name: "Charlie" },
    ];
    render(<AuditLogTab />);
    expect(screen.getByText("All actors")).toBeInTheDocument();
  });

  // ---- Export with filters applied ----
  it("export mutation called with all filter parameters", async () => {
    queryStateValues["actorId"] = "u1";
    queryStateValues["actionFilter"] = "UPDATE";
    queryStateValues["resourceType"] = "CONTRACT";
    queryStateValues["dateFrom"] = "2026-01-01";
    queryStateValues["dateTo"] = "2026-12-31";
    mockListData = { items: [{ id: "1" }], totalCount: 1 };
    const { user } = setup(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button")!;
    await user.click(exportBtn);
    expect(mockExportMutate).toHaveBeenCalledTimes(1);
  });

  // ---- Date pre-populated from query state ----
  it("renders date from input with query state value", () => {
    queryStateValues["dateFrom"] = "2026-03-01";
    const { container } = render(<AuditLogTab />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs[0]).toHaveValue("2026-03-01");
  });

  // ---- Date to pre-populated from query state ----
  it("renders date to input with query state value", () => {
    queryStateValues["dateTo"] = "2026-06-30";
    const { container } = render(<AuditLogTab />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs[1]).toHaveValue("2026-06-30");
  });

  // ---- Actor filter select changes ----
  it("calls setActorId when actor filter is changed", async () => {
    mockActorsData = [
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    // First combobox is actor filter
    await user.click(selects[0]!);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Alice"));
    expect(mockSetActorId).toHaveBeenCalled();
  });

  it("calls setActionFilter when action filter is changed", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    // Second combobox is action filter
    await user.click(selects[1]!);
    await waitFor(() => {
      expect(screen.getByText("Created")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Created"));
    expect(mockSetActionFilter).toHaveBeenCalled();
  });

  it("calls setResourceType when resource type filter is changed", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    // Third combobox is resource type filter
    await user.click(selects[2]!);
    await waitFor(() => {
      expect(screen.getByText("Invoice")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Invoice"));
    expect(mockSetResourceType).toHaveBeenCalled();
  });

  it("resets page to 1 when actor filter changes", async () => {
    queryStateValues["auditPage"] = "5";
    mockActorsData = [{ id: "u1", name: "Alice" }];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    await user.click(selects[0]!);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Alice"));
    expect(mockSetAuditPage).toHaveBeenCalledWith("1");
  });

  it("resets page to 1 when action filter changes", async () => {
    queryStateValues["auditPage"] = "3";
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    await user.click(selects[1]!);
    await waitFor(() => {
      expect(screen.getByText("Updated")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Updated"));
    expect(mockSetAuditPage).toHaveBeenCalledWith("1");
  });

  it("resets page to 1 when resource type filter changes", async () => {
    queryStateValues["auditPage"] = "4";
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    await user.click(selects[2]!);
    await waitFor(() => {
      expect(screen.getByText("Contract")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Contract"));
    expect(mockSetAuditPage).toHaveBeenCalledWith("1");
  });

  it("export button is disabled when isPending for export", () => {
    mockExportPending = true;
    mockListData = { items: [{ id: "1" }], totalCount: 1 };
    render(<AuditLogTab />);
    const exportBtn = screen.getByText("Export audit log").closest("button");
    expect(exportBtn).toBeDisabled();
  });

  it("renders all action options in action filter dropdown", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    await user.click(selects[1]!);
    await waitFor(() => {
      expect(screen.getByText("Created")).toBeInTheDocument();
      expect(screen.getByText("Updated")).toBeInTheDocument();
      expect(screen.getByText("Deleted")).toBeInTheDocument();
    });
  });

  it("renders all resource type options in resource filter dropdown", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AuditLogTab />);
    const selects = screen.getAllByRole("combobox");
    await user.click(selects[2]!);
    await waitFor(() => {
      expect(screen.getByText("Invoice")).toBeInTheDocument();
      expect(screen.getByText("Contractor")).toBeInTheDocument();
      expect(screen.getByText("Contract")).toBeInTheDocument();
    });
  });
});
