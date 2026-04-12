import { render, screen, setup } from "@/test/test-utils";
import { KsefSetupDialog } from "../ksef-setup-dialog";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    ksef: {
      connect: { mutationOptions: vi.fn(() => ({})) },
      connectionStatus: { queryKey: vi.fn(() => ["ksef", "connectionStatus"]) },
    },
    integration: {
      getHealth: { queryKey: vi.fn(() => ["integration", "getHealth"]) },
      getAllHealth: { queryKey: vi.fn(() => ["integration", "getAllHealth"]) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("KsefSetupDialog", () => {
  it("renders dialog with NIP field when open", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="1234567890" />);
    expect(screen.getByText("connectTitle")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1234567890")).toBeInTheDocument();
  });

  it("shows orgNipMissing warning when NIP is null", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip={null} />);
    expect(screen.getByText("orgNipMissing")).toBeInTheDocument();
  });

  it("renders token and certificate tabs", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="123" />);
    const tokenMatches = screen.getAllByText("tokenLabel");
    expect(tokenMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("certificateLabel")).toBeInTheDocument();
  });

  it("renders save and discard buttons", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="123" />);
    expect(screen.getByText("saveCredentials")).toBeInTheDocument();
    expect(screen.getByText("discard")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<KsefSetupDialog open={false} onOpenChange={vi.fn()} orgNip="123" />);
    expect(screen.queryByText("connectTitle")).not.toBeInTheDocument();
  });

  it("renders dialog description", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="123" />);
    expect(screen.getByText("connectDescription")).toBeInTheDocument();
  });

  it("renders NIP label", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="123" />);
    expect(screen.getByText("orgNipLabel")).toBeInTheDocument();
  });

  it("shows NIP helper text when NIP is present", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="9876543210" />);
    expect(screen.getByText("orgNipHelper")).toBeInTheDocument();
  });

  it("renders token textarea in token tab", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="123" />);
    expect(screen.getByPlaceholderText("tokenPlaceholder")).toBeInTheDocument();
  });

  it("renders token helper text", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="123" />);
    expect(screen.getByText("tokenHelper")).toBeInTheDocument();
  });

  it("save button is disabled when token is empty", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="123" />);
    const saveBtn = screen.getByText("saveCredentials").closest("button");
    expect(saveBtn).toBeDisabled();
  });

  it("NIP field is disabled and read-only", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip="123" />);
    const nipInput = screen.getByDisplayValue("123");
    expect(nipInput).toBeDisabled();
  });

  it("save button is disabled when NIP is null", () => {
    render(<KsefSetupDialog open={true} onOpenChange={vi.fn()} orgNip={null} />);
    const saveBtn = screen.getByText("saveCredentials").closest("button");
    expect(saveBtn).toBeDisabled();
  });

  it("calls onOpenChange when discard is clicked", async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <KsefSetupDialog open={true} onOpenChange={onOpenChange} orgNip="123" />,
    );
    await user.click(screen.getByText("discard"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
