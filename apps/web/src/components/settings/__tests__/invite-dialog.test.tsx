import { render, screen } from "@/test/test-utils";
import { InviteDialog } from "../invite-dialog";

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    user: {
      invite: { mutationOptions: vi.fn((o: object) => o) },
      list: { queryKey: vi.fn(() => ["user", "list"]) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("InviteDialog", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("renders dialog title and form when open", () => {
    render(<InviteDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText("Invite a new member")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<InviteDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText("Send invite")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<InviteDialog open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText("Invite a new member")).not.toBeInTheDocument();
  });
});
