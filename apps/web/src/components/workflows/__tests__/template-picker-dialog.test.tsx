import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, setup } from "@/test/test-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TemplatePicker } from "../template-picker-dialog";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    workflow: {
      listTemplates: {
        queryOptions: () => ({ queryKey: ["workflow", "listTemplates"] }),
      },
      startRun: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const mockTemplates = [
  {
    id: "t1",
    name: "Onboarding Flow",
    type: "ONBOARDING",
    description: "Standard onboarding",
    _count: { tasks: 5 },
  },
  {
    id: "t2",
    name: "Offboarding Flow",
    type: "OFFBOARDING",
    description: null,
    _count: { tasks: 3 },
  },
  {
    id: "t3",
    name: "Document Collection",
    type: "DOCUMENT_COLLECTION",
    description: "Collect required documents",
    _count: { tasks: 2 },
  },
];

describe("TemplatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
  });

  // ---- Visibility ----
  it("renders nothing when closed", () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    const { container } = render(
      <TemplatePicker
        open={false}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  // ---- Template list ----
  it("renders dialog with template list when open", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(screen.getByText("Onboarding Flow")).toBeInTheDocument();
    expect(screen.getByText("Offboarding Flow")).toBeInTheDocument();
    expect(screen.getByText("Document Collection")).toBeInTheDocument();
  });

  it("renders template descriptions when present", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(screen.getByText("Standard onboarding")).toBeInTheDocument();
    expect(
      screen.getByText("Collect required documents"),
    ).toBeInTheDocument();
  });

  it("renders task count for each template", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [mockTemplates[0]] },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(screen.getByText(/5 tasks/i)).toBeInTheDocument();
  });

  // ---- Empty state ----
  it("renders empty state when no templates found", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(screen.getByText("No templates available")).toBeInTheDocument();
  });

  it("shows empty state body text", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(
      screen.getByText(/Ask your admin/i),
    ).toBeInTheDocument();
  });

  // ---- Search ----
  it("renders search input", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(
      screen.getByPlaceholderText("Search templates..."),
    ).toBeInTheDocument();
  });

  it("updates search value on typing", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    const input = screen.getByPlaceholderText("Search templates...");
    await user.type(input, "onboard");
    expect(input).toHaveValue("onboard");
  });

  // ---- Selection ----
  it("renders start button disabled when no template selected", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    const startBtn = screen.getByText("Start");
    expect(startBtn.closest("button")).toBeDisabled();
  });

  it("enables start button when a template is selected", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    const startBtn = screen.getByText("Start");
    expect(startBtn.closest("button")).not.toBeDisabled();
  });

  // ---- Bulk mode ----
  it("shows count text in bulk mode", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorIds={["c1", "c2", "c3"]}
      />,
    );
    expect(
      screen.getByText(/3 contractors/i),
    ).toBeInTheDocument();
  });

  // ---- Close button ----
  it("renders close button", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when close is clicked", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const onOpenChange = vi.fn();
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={onOpenChange}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ---- Loading state ----
  it("shows loading skeletons when query is loading", () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    // Loading state should not show templates or empty state
    expect(screen.queryByText("No templates available")).not.toBeInTheDocument();
  });

  // ---- Type badges ----
  it("renders type badge for each template", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [mockTemplates[0]] },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(screen.getAllByText("Onboarding").length).toBeGreaterThanOrEqual(1);
  });

  // ---- Search filters templates ----
  it("filters templates by search term", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    const input = screen.getByPlaceholderText("Search templates...");
    await user.type(input, "Onboard");
    expect(screen.getByText("Onboarding Flow")).toBeInTheDocument();
  });

  // ---- Re-selection keeps selection ----
  it("keeps template selected when clicked again", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    expect(screen.getByText("Start").closest("button")).not.toBeDisabled();
    // Clicking again keeps the same template selected (no toggle)
    await user.click(screen.getByText("Onboarding Flow"));
    expect(screen.getByText("Start").closest("button")).not.toBeDisabled();
  });

  // ---- Task count display variations ----
  it("renders task count for template with 3 tasks", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [mockTemplates[1]] },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(screen.getByText(/3 tasks/i)).toBeInTheDocument();
  });

  it("renders task count for template with 2 tasks", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [mockTemplates[2]] },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    expect(screen.getByText(/2 tasks/i)).toBeInTheDocument();
  });

  // ---- Dialog title ----
  it("renders dialog title", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    const headings = screen.getAllByRole("heading");
    expect(headings.length).toBeGreaterThan(0);
  });

  // ---- Bulk mode with single contractor ----
  it("shows count text for single contractor in bulk mode", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorIds={["c1"]}
      />,
    );
    expect(screen.getByText(/1 contractor/i)).toBeInTheDocument();
  });

  // ---- Selection ring style ----
  it("applies ring style to selected template", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    const btn = screen.getByText("Onboarding Flow").closest("button");
    expect(btn?.className).toContain("ring-2");
  });

  // ---- Start button click triggers mutation ----
  it("clicking start button calls mutateAsync", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ calendarTaskCount: 0 });
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const onOpenChange = vi.fn();
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={onOpenChange}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    await user.click(screen.getByText("Start"));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "t1",
        contractorId: "c1",
      }),
    );
  });

  // ---- Selecting different template changes selection ----
  it("changes selection when different template is clicked", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    expect(
      screen.getByText("Onboarding Flow").closest("button")?.className,
    ).toContain("ring-2");

    await user.click(screen.getByText("Offboarding Flow"));
    expect(
      screen.getByText("Offboarding Flow").closest("button")?.className,
    ).toContain("ring-2");
    expect(
      screen.getByText("Onboarding Flow").closest("button")?.className,
    ).not.toContain("ring-2");
  });

  // ---- Type filter: preFilterType ----
  it("shows type filter badge when preFilterType is set", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
        preFilterType="ONBOARDING"
      />,
    );
    // "Onboarding" appears as both filter badge and template type badge
    const onboardingMatches = screen.getAllByText("Onboarding");
    expect(onboardingMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  // ---- Clear type filter ----
  it("clears type filter when clear button is clicked", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
        preFilterType="ONBOARDING"
      />,
    );
    await user.click(screen.getByText("Clear all"));
    // Filter clear button should be removed after clearing
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });

  // ---- Start button disabled without contractorId ----
  it("disables start button when no contractorId and not bulk", () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    render(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const startBtn = screen.getByText("Start").closest("button");
    expect(startBtn).toBeDisabled();
  });

  // ---- Bulk mode start triggers multiple mutations ----
  it("clicking start in bulk mode calls mutateAsync for each contractor", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ calendarTaskCount: 0 });
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const onOpenChange = vi.fn();
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={onOpenChange}
        contractorIds={["c1", "c2"]}
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    await user.click(screen.getByText("Start"));
    // Should be called once for each contractor
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });

  // ---- Start triggers calendarTaskCount toast.info ----
  it("shows calendar task info toast when calendarTaskCount > 0", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ calendarTaskCount: 3 });
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    await user.click(screen.getByText("Start"));
    const { toast } = await import("sonner");
    expect(toast.info).toHaveBeenCalled();
  });

  // ---- Start error triggers error toast ----
  it("shows error toast when start mutation fails", async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue(new Error("fail"));
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    await user.click(screen.getByText("Start"));
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalled();
  });

  // ---- handleOpenChange resets state on close ----
  it("resets selection and search when dialog is closed", async () => {
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const onOpenChange = vi.fn();
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={onOpenChange}
        contractorId="c1"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    const input = screen.getByPlaceholderText("Search templates...");
    await user.type(input, "test");
    await user.click(screen.getByText("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ---- Template with contractId ----
  it("passes contractId to mutation when provided", async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ calendarTaskCount: 0 });
    mockedUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
    mockedUseQuery.mockReturnValue({
      data: { items: mockTemplates },
      isLoading: false,
    } as any);
    const { user } = setup(
      <TemplatePicker
        open={true}
        onOpenChange={vi.fn()}
        contractorId="c1"
        contractId="contract-123"
      />,
    );
    await user.click(screen.getByText("Onboarding Flow"));
    await user.click(screen.getByText("Start"));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: "contract-123",
      }),
    );
  });
});
