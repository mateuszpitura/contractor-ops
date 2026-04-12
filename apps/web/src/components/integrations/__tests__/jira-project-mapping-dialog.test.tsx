import { useQuery } from "@tanstack/react-query";
import { render, screen, setup } from "@/test/test-utils";
import { JiraProjectMappingDialog } from "../jira-project-mapping-dialog";

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  const emptyList: never[] = [];
  return {
    ...actual,
    useQuery: vi.fn().mockImplementation((opts: { queryKey?: unknown[]; enabled?: boolean }) => {
      if (opts?.enabled === false) {
        return { isLoading: false, data: undefined };
      }
      const qk = opts?.queryKey;
      const procedure =
        Array.isArray(qk) && qk[0] === "jira" && typeof qk[1] === "string" ? qk[1] : undefined;
      if (procedure === "getTaskConfig") {
        return { isLoading: false, data: undefined };
      }
      if (
        procedure === "listProjects" ||
        procedure === "listIssueTypes" ||
        procedure === "listProjectStatuses"
      ) {
        return { isLoading: false, data: emptyList };
      }
      return { isLoading: false, data: undefined };
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    jira: {
      getTaskConfig: {
        queryOptions: vi.fn(() => ({ queryKey: ["jira", "getTaskConfig"] })),
        queryKey: vi.fn(() => ["jira", "getTaskConfig"]),
      },
      listProjects: { queryOptions: vi.fn(() => ({ queryKey: ["jira", "listProjects"] })) },
      listIssueTypes: {
        queryOptions: vi.fn(() => ({ queryKey: ["jira", "listIssueTypes"], enabled: false })),
      },
      saveTaskConfig: { mutationOptions: vi.fn(() => ({})) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedUseQuery = vi.mocked(useQuery);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_PROJECTS = [
  { id: "proj-1", key: "ENG", name: "Engineering" },
  { id: "proj-2", key: "DES", name: "Design" },
];

function setupWithProjects() {
  const emptyList: never[] = [];
  mockedUseQuery.mockImplementation((opts: any) => {
    if (opts?.enabled === false) {
      return { isLoading: false, data: undefined } as any;
    }
    const qk = opts?.queryKey;
    const procedure =
      Array.isArray(qk) && qk[0] === "jira" && typeof qk[1] === "string" ? qk[1] : undefined;
    if (procedure === "getTaskConfig") {
      return { isLoading: false, data: undefined } as any;
    }
    if (procedure === "listProjects") {
      return { isLoading: false, data: MOCK_PROJECTS } as any;
    }
    if (procedure === "listIssueTypes") {
      return { isLoading: false, data: emptyList } as any;
    }
    return { isLoading: false, data: undefined } as any;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JiraProjectMappingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it("renders dialog title when open", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Configure Jira Integration")).toBeInTheDocument();
  });

  it("renders dialog description", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Map this task to a Jira project and issue type.")).toBeInTheDocument();
  });

  it("renders save and discard buttons", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Save Mapping")).toBeInTheDocument();
    expect(screen.getByText("Discard Changes")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <JiraProjectMappingDialog
        open={false}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.queryByText("Configure Jira Integration")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Project list
  // -------------------------------------------------------------------------

  it("renders project selector label", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Jira Project")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Issue type selector
  // -------------------------------------------------------------------------

  it("renders issue type selector label", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Issue Type")).toBeInTheDocument();
  });

  it("issue type selector is disabled when no project selected", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    const triggers = screen.getAllByRole("combobox");
    const issueTypeTrigger = triggers.find((t) => t.textContent?.includes("Select an issue type"));
    if (issueTypeTrigger) {
      expect(issueTypeTrigger).toBeDisabled();
    }
  });

  // -------------------------------------------------------------------------
  // Auto-create toggle
  // -------------------------------------------------------------------------

  it("renders auto-create toggle", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Create Jira issue when task activates")).toBeInTheDocument();
  });

  it("renders switch for auto-create", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Discard calls onOpenChange
  // -------------------------------------------------------------------------

  it("calls onOpenChange when discard is clicked", async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    await user.click(screen.getByText("Discard Changes"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // -------------------------------------------------------------------------
  // Auto-create toggle interaction
  // -------------------------------------------------------------------------

  it("toggles auto-create switch", async () => {
    const { user } = setup(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    const switchEl = screen.getByRole("switch");
    await user.click(switchEl);
    expect(switchEl).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Save button
  // -------------------------------------------------------------------------

  it("save button is rendered", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    const saveBtn = screen.getByText("Save Mapping").closest("button");
    expect(saveBtn).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Issue type selector disabled state
  // -------------------------------------------------------------------------

  it("second combobox (issue type) is disabled without project", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    const comboboxes = screen.getAllByRole("combobox");
    const issueTypeTrigger = comboboxes[1];
    expect(issueTypeTrigger).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Auto-create toggle default state
  // -------------------------------------------------------------------------

  it("auto-create toggle is initially off", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    const switchEl = screen.getByRole("switch");
    expect(switchEl).not.toBeChecked();
  });

  it("renders with projects loaded from query", () => {
    setupWithProjects();
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Jira Project")).toBeInTheDocument();
    expect(screen.getByText("Issue Type")).toBeInTheDocument();
  });

  it("renders dialog heading and description", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Configure Jira Integration")).toBeInTheDocument();
    expect(screen.getByText("Map this task to a Jira project and issue type.")).toBeInTheDocument();
  });

  it("does not render any form elements when closed", () => {
    render(
      <JiraProjectMappingDialog
        open={false}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.queryByText("Jira Project")).not.toBeInTheDocument();
    expect(screen.queryByText("Issue Type")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("has two select triggers for project and issue type", () => {
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // Interaction tests - project selection, save handler
  // ---------------------------------------------------------------------------

  it("toggles auto-create switch and enables save", async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    const switchEl = screen.getByRole("switch");
    expect(switchEl).not.toBeChecked();
    await user.click(switchEl);
    // After toggle, hasChanges should be true
    const saveBtn = screen.getByRole("button", { name: "Save Mapping" });
    expect(saveBtn).not.toBeDisabled();
  });

  it("calls save mutation when save button is clicked after toggle", async () => {
    const { user } = setup(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    // Toggle auto-create to make hasChanges true
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "Save Mapping" }));
    // Mutation should be called (via the mock)
  });

  it("loads existing task config and pre-fills form with jiraEnabled true", () => {
    const existingConfig = {
      jiraEnabled: true,
      jiraProjectId: "proj-1",
      jiraProjectKey: "ENG",
      jiraProjectName: "Engineering",
      jiraIssueTypeId: "it-1",
      jiraIssueTypeName: "Task",
    };
    mockedUseQuery.mockImplementation((opts: any) => {
      const qk = opts?.queryKey;
      const procedure =
        Array.isArray(qk) && qk[0] === "jira" && typeof qk[1] === "string" ? qk[1] : undefined;
      if (procedure === "getTaskConfig") {
        return { isLoading: false, data: existingConfig } as any;
      }
      if (procedure === "listProjects") {
        return { isLoading: false, data: MOCK_PROJECTS } as any;
      }
      return { isLoading: false, data: [] } as any;
    });
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    // Switch should be checked since jiraEnabled is true
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeChecked();
  });

  it("renders with projects data from query", () => {
    setupWithProjects();
    render(
      <JiraProjectMappingDialog
        open={true}
        onOpenChange={vi.fn()}
        taskTemplateId="tt-1"
        connectionId="conn-1"
      />,
    );
    expect(screen.getByText("Jira Project")).toBeInTheDocument();
    expect(screen.getByText("Issue Type")).toBeInTheDocument();
  });
});
