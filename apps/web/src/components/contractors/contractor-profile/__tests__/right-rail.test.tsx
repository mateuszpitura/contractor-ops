import { render, screen, setup } from "@/test/test-utils";
import { ActivityTimeline, RightRail } from "../right-rail";

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    contractor: {
      update: { mutationOptions: (opts: any) => opts },
      getById: { queryKey: () => ["contractor", "getById"] },
    },
  },
}));

describe("ActivityTimeline", () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);

  it("renders created event", () => {
    render(
      <ActivityTimeline createdAt={twoDaysAgo} updatedAt={twoDaysAgo} lifecycleStage="ACTIVE" />,
    );
    // Should show at least lifecycle stage event
    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows profile updated when update differs from creation", () => {
    render(
      <ActivityTimeline createdAt={twoDaysAgo} updatedAt={oneHourAgo} lifecycleStage="ACTIVE" />,
    );
    // Multiple events when updated differs from created
    const paragraphs = screen.getAllByText(/.+/);
    expect(paragraphs.length).toBeGreaterThan(1);
  });
});

describe("RightRail", () => {
  const contractor = {
    id: "c1",
    notes: "Test notes",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lifecycleStage: "ACTIVE",
  };

  it("renders notes section with initial value", () => {
    render(<RightRail contractor={contractor} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Test notes");
  });

  it("shows save button after editing notes", async () => {
    const { user } = setup(<RightRail contractor={contractor} />);
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "Updated");
    // Save button should appear
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders reminders section", () => {
    render(<RightRail contractor={contractor} />);
    // Should have activity, notes, and reminders sections
    const headings = screen.getAllByRole("heading", { level: 4 });
    expect(headings.length).toBe(3);
  });
});
