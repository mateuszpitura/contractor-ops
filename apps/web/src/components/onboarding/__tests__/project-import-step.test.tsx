import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, setup } from "@/test/test-utils";
import { useQuery } from "@tanstack/react-query";
import { ProjectImportStep } from "../project-import-step";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    onboardingImport: {
      fetchProjects: { queryOptions: () => ({ queryKey: ["fetchProjects"] }) },
    },
  },
}));

vi.mock("@/components/integrations/brand-icons", () => ({
  JiraBrandIcon: () => <span>Jira</span>,
  LinearBrandIcon: () => <span>Linear</span>,
}));

const mockedUseQuery = vi.mocked(useQuery);

const sampleProjects = [
  {
    sourceProvider: "JIRA",
    externalId: "p1",
    name: "Alpha Project",
    statuses: [
      { name: "To Do" },
      { name: "In Progress" },
      { name: "Done" },
    ],
  },
  {
    sourceProvider: "LINEAR",
    externalId: "p2",
    name: "Beta Project",
    statuses: [{ name: "Backlog" }, { name: "Completed" }],
  },
] as any;

function makeSelections(projects: typeof sampleProjects) {
  const map = new Map();
  for (const p of projects) {
    const key = `${p.sourceProvider}-${p.externalId}`;
    map.set(key, {
      skip: false,
      name: p.name,
      steps: p.statuses.map((s: { name: string }, i: number) => ({
        name: s.name,
        sortOrder: i,
      })),
    });
  }
  return map;
}

describe("ProjectImportStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
  });

  // ---- Empty state ----
  it("shows empty state when no PM sources selected", () => {
    render(
      <ProjectImportStep
        selectedSources={["GOOGLE_WORKSPACE"]}
        projects={[]}
        onProjectsChange={vi.fn()}
        projectSelections={new Map()}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("No projects found")).toBeInTheDocument();
  });

  it("shows empty state description text", () => {
    render(
      <ProjectImportStep
        selectedSources={["GOOGLE_WORKSPACE"]}
        projects={[]}
        onProjectsChange={vi.fn()}
        projectSelections={new Map()}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/No projects were found/i),
    ).toBeInTheDocument();
  });

  // ---- Loading state ----
  it("shows loading skeleton when fetching", () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    const { container } = render(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[]}
        onProjectsChange={vi.fn()}
        projectSelections={new Map()}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    expect(
      container.querySelectorAll("[data-slot='skeleton']").length,
    ).toBeGreaterThan(0);
  });

  // ---- Project cards ----
  it("renders project cards when data exists", () => {
    render(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={sampleProjects}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections(sampleProjects)}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Alpha Project")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta Project")).toBeInTheDocument();
  });

  it("renders step badges in collapsed view", () => {
    render(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  // ---- Skip project ----
  it("calls onProjectSelectionsChange when skip is toggled", async () => {
    const onSelectionsChange = vi.fn();
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={onSelectionsChange}
      />,
    );
    const skipBtn = screen.getByText("Skip this project");
    await user.click(skipBtn);
    expect(onSelectionsChange).toHaveBeenCalledTimes(1);
    const updatedMap = onSelectionsChange.mock.calls[0][0];
    expect(updatedMap.get("JIRA-p1").skip).toBe(true);
  });

  // ---- Expand steps ----
  it("shows editable step inputs when expanded", async () => {
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    const editBtn = screen.getByText("Edit steps");
    await user.click(editBtn);
    // Should show step input fields
    const inputs = screen.getAllByPlaceholderText(/Step \d+/);
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it("shows add step button when expanded", async () => {
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Edit steps"));
    expect(screen.getByText("Add step")).toBeInTheDocument();
  });

  // ---- Add step ----
  it("calls onProjectSelectionsChange when add step is clicked", async () => {
    const onSelectionsChange = vi.fn();
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={onSelectionsChange}
      />,
    );
    await user.click(screen.getByText("Edit steps"));
    await user.click(screen.getByText("Add step"));
    expect(onSelectionsChange).toHaveBeenCalled();
  });

  // ---- Remove step ----
  it("calls onProjectSelectionsChange when remove step is clicked", async () => {
    const onSelectionsChange = vi.fn();
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={onSelectionsChange}
      />,
    );
    await user.click(screen.getByText("Edit steps"));
    const removeButtons = screen.getAllByLabelText("Remove step");
    await user.click(removeButtons[0]);
    expect(onSelectionsChange).toHaveBeenCalled();
  });

  // ---- Move step ----
  it("has move up disabled for first step and move down disabled for last step", async () => {
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Edit steps"));
    const moveUpButtons = screen.getAllByLabelText("Move up");
    const moveDownButtons = screen.getAllByLabelText("Move down");
    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
  });

  // ---- Project name edit ----
  it("calls onProjectSelectionsChange when project name is edited", async () => {
    const onSelectionsChange = vi.fn();
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={onSelectionsChange}
      />,
    );
    const nameInput = screen.getByDisplayValue("Alpha Project");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");
    expect(onSelectionsChange).toHaveBeenCalled();
  });

  // ---- Sync note ----
  it("renders sync note at the bottom", () => {
    render(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={sampleProjects}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections(sampleProjects)}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Bidirectional sync/i),
    ).toBeInTheDocument();
  });

  // ---- Source icons ----
  it("renders source provider icons", () => {
    render(
      <ProjectImportStep
        selectedSources={["JIRA", "LINEAR"]}
        projects={sampleProjects}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections(sampleProjects)}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Jira")).toBeInTheDocument();
    expect(screen.getByText("Linear")).toBeInTheDocument();
  });

  // ---- Move step actions ----
  it("calls onProjectSelectionsChange when move down is clicked", async () => {
    const onSelectionsChange = vi.fn();
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={onSelectionsChange}
      />,
    );
    await user.click(screen.getByText("Edit steps"));
    const moveDownButtons = screen.getAllByLabelText("Move down");
    // Click the first enabled move down button
    const enabledBtn = moveDownButtons.find((b) => !b.hasAttribute("disabled"));
    if (enabledBtn) {
      await user.click(enabledBtn);
      expect(onSelectionsChange).toHaveBeenCalled();
    }
  });

  it("calls onProjectSelectionsChange when move up is clicked on non-first step", async () => {
    const onSelectionsChange = vi.fn();
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={onSelectionsChange}
      />,
    );
    await user.click(screen.getByText("Edit steps"));
    const moveUpButtons = screen.getAllByLabelText("Move up");
    // Second step's move up should be enabled
    if (moveUpButtons.length > 1 && !moveUpButtons[1]!.hasAttribute("disabled")) {
      await user.click(moveUpButtons[1]!);
      expect(onSelectionsChange).toHaveBeenCalled();
    }
  });

  // ---- Rename step ----
  it("calls onProjectSelectionsChange when step is renamed", async () => {
    const onSelectionsChange = vi.fn();
    const { user } = setup(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections([sampleProjects[0]])}
        onProjectSelectionsChange={onSelectionsChange}
      />,
    );
    await user.click(screen.getByText("Edit steps"));
    const inputs = screen.getAllByPlaceholderText(/Step \d+/);
    await user.clear(inputs[0]!);
    await user.type(inputs[0]!, "Renamed Step");
    expect(onSelectionsChange).toHaveBeenCalled();
  });

  // ---- Heading and subtitle ----
  it("renders heading and subtitle", () => {
    render(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={sampleProjects}
        onProjectsChange={vi.fn()}
        projectSelections={makeSelections(sampleProjects)}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Import projects")).toBeInTheDocument();
  });

  // ---- Data initialization ----
  it("calls onProjectsChange when data arrives and projects is empty", () => {
    const onProjectsChange = vi.fn();
    const onProjectSelectionsChange = vi.fn();
    mockedUseQuery.mockReturnValue({ data: sampleProjects, isLoading: false } as any);

    render(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[]}
        onProjectsChange={onProjectsChange}
        projectSelections={new Map()}
        onProjectSelectionsChange={onProjectSelectionsChange}
      />,
    );

    expect(onProjectsChange).toHaveBeenCalledWith(sampleProjects);
    expect(onProjectSelectionsChange).toHaveBeenCalled();
  });

  // ---- Skipped project opacity ----
  it("applies opacity class when project is skipped", () => {
    const selections = makeSelections([sampleProjects[0]]);
    selections.get("JIRA-p1").skip = true;
    const { container } = render(
      <ProjectImportStep
        selectedSources={["JIRA"]}
        projects={[sampleProjects[0]]}
        onProjectsChange={vi.fn()}
        projectSelections={selections}
        onProjectSelectionsChange={vi.fn()}
      />,
    );
    const card = container.querySelector(".opacity-50");
    expect(card).toBeInTheDocument();
  });
});
