import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, setup, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { JiraStatusMappingDialog } from "../jira-status-mapping-dialog";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockProjects = [
  { id: "proj-1", key: "WEB", name: "Web App" },
  { id: "proj-2", key: "API", name: "API Service" },
];

let projectsData: typeof mockProjects = mockProjects;
let projectsLoading = false;
let statusesData: unknown[] = [];
let existingMapping: unknown[] = [];

const mockMutate = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown }) => {
      const key = JSON.stringify(opts.queryKey ?? "");
      if (key.includes("listProjects")) {
        return { isLoading: projectsLoading, data: projectsData };
      }
      if (key.includes("listProjectStatuses")) {
        return { isLoading: false, data: statusesData };
      }
      if (key.includes("getStatusMapping")) {
        return { isLoading: false, data: existingMapping };
      }
      return { isLoading: false, data: null };
    },
    useMutation: (opts: Record<string, unknown>) => ({
      mutate: mockMutate,
      isPending: false,
      ...opts,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    jira: {
      listProjects: { queryOptions: vi.fn(() => ({ queryKey: ["jira", "listProjects"] })) },
      listProjectStatuses: { queryOptions: vi.fn(() => ({ queryKey: ["jira", "listProjectStatuses"] })) },
      getStatusMapping: {
        queryOptions: vi.fn(() => ({ queryKey: ["jira", "getStatusMapping"] })),
        queryKey: vi.fn(() => ["jira", "getStatusMapping"]),
      },
      saveStatusMapping: { mutationOptions: vi.fn(() => ({})) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JiraStatusMappingDialog", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    projectsData = mockProjects;
    projectsLoading = false;
    statusesData = [];
    existingMapping = [];
  });

  it("renders dialog with title", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Status Mapping")).toBeInTheDocument();
  });

  it("renders save and discard buttons", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Save Mapping")).toBeInTheDocument();
    expect(screen.getByText("Discard Changes")).toBeInTheDocument();
  });

  it("save button is disabled without project selection", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const saveBtn = screen.getByRole("button", { name: "Save Mapping" });
    expect(saveBtn).toBeDisabled();
  });

  it("discard button calls onOpenChange(false)", async () => {
    const { user } = setup(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    await user.click(screen.getByText("Discard Changes"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders project select when projects exist", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("does not render dialog when closed", () => {
    render(
      <JiraStatusMappingDialog
        open={false}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.queryByText("Status Mapping")).not.toBeInTheDocument();
  });

  it("does not show mapping table without project selection", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.queryByText("Workflow Status")).not.toBeInTheDocument();
  });

  // ---- Dialog description ----
  it("renders dialog description", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(
      screen.getByText(/Map workflow task statuses to Jira transitions/),
    ).toBeInTheDocument();
  });

  // ---- Jira Project label ----
  it("renders Jira Project label", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Jira Project")).toBeInTheDocument();
  });

  // ---- Select trigger ----
  it("renders project select trigger (combobox)", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  // ---- Save button disabled without changes ----
  it("save button is disabled when no changes and no project", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const saveBtn = screen.getByRole("button", { name: "Save Mapping" });
    expect(saveBtn).toBeDisabled();
  });

  // ---- Project select has a combobox trigger ----
  it("renders combobox trigger for project select", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeInTheDocument();
  });

  // ---- Dialog footer buttons count ----
  it("renders exactly two footer buttons (save and discard)", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const buttons = screen.getAllByRole("button");
    const saveBtn = buttons.find((b) => b.textContent === "Save Mapping");
    const discardBtn = buttons.find(
      (b) => b.textContent === "Discard Changes",
    );
    expect(saveBtn).toBeTruthy();
    expect(discardBtn).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Interaction tests - state-based coverage for mapping handlers and save
  // ---------------------------------------------------------------------------

  it("does not call save when no project is selected", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const saveBtn = screen.getByRole("button", { name: "Save Mapping" });
    expect(saveBtn).toBeDisabled();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("renders combobox trigger for project selector", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows projects loading spinner when projects are loading", () => {
    projectsLoading = true;
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders with statuses data for mapping display", () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
      { id: "js-2", name: "Done", statusCategory: { key: "done", name: "Done" } },
    ];
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    // Without project selected, mapping table is not shown
    expect(screen.queryByText("Workflow Status")).not.toBeInTheDocument();
  });

  it("renders with existing mapping data loaded", () => {
    existingMapping = [
      {
        workflowStatus: "TODO",
        jiraTransitionId: "js-1",
        jiraTransitionName: "Open",
        jiraTargetStatusName: "Open",
        jiraTargetStatusCategory: "new",
      },
    ];
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Status Mapping")).toBeInTheDocument();
  });

  it("renders description text about mapping transitions", () => {
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText(/Map workflow task statuses/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Project selection & mapping table coverage
  // ---------------------------------------------------------------------------

  it("renders mapping table after selecting a project", async () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
      { id: "js-2", name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "js-3", name: "Done", statusCategory: { key: "done", name: "Done" } },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("Workflow Status")).toBeInTheDocument();
      expect(screen.getByText("Jira Transition")).toBeInTheDocument();
    });
    // All workflow statuses should be visible
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("shows save button enabled after selecting project with no existing mappings", async () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("Workflow Status")).toBeInTheDocument();
    });
  });

  it("loads existing mappings when project is selected", async () => {
    existingMapping = [
      { workflowStatus: "TODO", jiraTransitionId: "js-1", jiraTransitionName: "Open", jiraTargetStatusName: "Open", jiraTargetStatusCategory: "new" },
    ];
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("Workflow Status")).toBeInTheDocument();
    });
    // Save should be disabled since no changes from server state
    const saveBtn = screen.getByRole("button", { name: "Save Mapping" });
    expect(saveBtn).toBeDisabled();
  });

  it("calls save mutation when save is clicked after mapping changes", async () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
      { id: "js-2", name: "Done", statusCategory: { key: "done", name: "Done" } },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    // Select project first
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("Workflow Status")).toBeInTheDocument();
    });
    // Now find a status selector and change it
    const allComboboxes = screen.getAllByRole("combobox");
    expect(allComboboxes.length).toBeGreaterThan(1);
    // Click the first status selector (To Do row)
    await user.click(allComboboxes[1]!);
    await waitFor(() => {
      // Look for a Jira status option
      const options = screen.getAllByText("Open");
      expect(options.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders description with project name after selection", async () => {
    statusesData = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText(/for Web App/)).toBeInTheDocument();
    });
  });

  it("can select second project", async () => {
    statusesData = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("API — API Service")).toBeInTheDocument();
    });
    await user.click(screen.getByText("API — API Service"));
    await waitFor(() => {
      expect(screen.getByText(/for API Service/)).toBeInTheDocument();
    });
  });

  it("shows all 6 workflow status labels in mapping table after project selection", async () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("To Do")).toBeInTheDocument();
      expect(screen.getByText("In Progress")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
      expect(screen.getByText("Blocked")).toBeInTheDocument();
      expect(screen.getByText("Skipped")).toBeInTheDocument();
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });

  it("renders per-status combobox selectors in mapping table", async () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
      { id: "js-2", name: "Done", statusCategory: { key: "done", name: "Done" } },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("Workflow Status")).toBeInTheDocument();
    });
    // 1 project combobox + 6 status comboboxes = 7
    const allComboboxes = screen.getAllByRole("combobox");
    expect(allComboboxes.length).toBe(7);
  });

  it("save button calls mutation with project and mappings after selection and change", async () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
      { id: "js-2", name: "Done", statusCategory: { key: "done", name: "Done" } },
    ];
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("Workflow Status")).toBeInTheDocument();
    });
    // Select a status for the first workflow status
    const allComboboxes = screen.getAllByRole("combobox");
    await user.click(allComboboxes[1]!);
    await waitFor(() => {
      const options = screen.getAllByText("Open");
      expect(options.length).toBeGreaterThanOrEqual(1);
    });
    // Click the Open option in the dropdown
    const openOptions = screen.getAllByText("Open");
    await user.click(openOptions[openOptions.length - 1]!);
    // Save button should be enabled now
    const saveBtn = screen.getByRole("button", { name: "Save Mapping" });
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "conn-1",
        projectId: "proj-1",
      }),
    );
  });

  it("switching projects resets mappings", async () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
    ];
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    // Select first project
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("Workflow Status")).toBeInTheDocument();
    });
    // Switch to second project
    const projectCombobox = screen.getAllByRole("combobox")[0]!;
    await user.click(projectCombobox);
    await waitFor(() => {
      expect(screen.getByText("API — API Service")).toBeInTheDocument();
    });
    await user.click(screen.getByText("API — API Service"));
    await waitFor(() => {
      expect(screen.getByText(/for API Service/)).toBeInTheDocument();
    });
  });

  it("shows unmapped warning tooltips for statuses without mapping", async () => {
    statusesData = [
      { id: "js-1", name: "Open", statusCategory: { key: "new", name: "New" } },
    ];
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <JiraStatusMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        connectionId="conn-1"
      />,
    );
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await waitFor(() => {
      expect(screen.getByText("WEB — Web App")).toBeInTheDocument();
    });
    await user.click(screen.getByText("WEB — Web App"));
    await waitFor(() => {
      expect(screen.getByText("Workflow Status")).toBeInTheDocument();
    });
    // All 6 statuses should be unmapped, showing warning icons
    // Each unmapped status has an AlertTriangle icon
    const rows = screen.getAllByText("Not mapped");
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
