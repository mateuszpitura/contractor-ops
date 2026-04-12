import { useMutation } from "@tanstack/react-query";
import { render, screen } from "@/test/test-utils";
import { ConfirmImportStep } from "../confirm-import-step";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useMutation: vi.fn() };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    onboardingImport: {
      startImport: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock("@/components/onboarding/import-progress-tracker", () => ({
  ImportProgressTracker: () => <div data-testid="progress-tracker">Progress</div>,
}));

const mockedUseMutation = vi.mocked(useMutation);

describe("ConfirmImportStep", () => {
  beforeEach(() => {
    mockedUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  const people = [
    { email: "a@test.com", name: "Alice", status: "new" as const, sources: [], conflicts: [] },
  ];

  const projects = [
    { sourceProvider: "JIRA", externalId: "p1", name: "Project A", statuses: [{ name: "Todo" }] },
  ] as any;

  it("renders summary cards", () => {
    render(
      <ConfirmImportStep
        mergedPeople={people}
        personSelections={
          new Map([["a@test.com", { role: "member", skip: false, resolvedConflicts: {} }]])
        }
        projects={projects}
        projectSelections={
          new Map([
            [
              "JIRA-p1",
              { skip: false, name: "Project A", steps: [{ name: "Todo", sortOrder: 0 }] },
            ],
          ])
        }
        jobId={null}
        onJobIdChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Review team|Import projects|Ready to import/)).toBeInTheDocument();
    expect(screen.getByText("People to import")).toBeInTheDocument();
    expect(screen.getByText("Projects to create")).toBeInTheDocument();
  });

  it("renders start import button", () => {
    render(
      <ConfirmImportStep
        mergedPeople={people}
        personSelections={
          new Map([["a@test.com", { role: "member", skip: false, resolvedConflicts: {} }]])
        }
        projects={[]}
        projectSelections={new Map()}
        jobId={null}
        onJobIdChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Start Import")).toBeInTheDocument();
  });

  it("shows progress tracker when jobId is set", () => {
    render(
      <ConfirmImportStep
        mergedPeople={people}
        personSelections={new Map()}
        projects={[]}
        projectSelections={new Map()}
        jobId="job-1"
        onJobIdChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("progress-tracker")).toBeInTheDocument();
  });
});
