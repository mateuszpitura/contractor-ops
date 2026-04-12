import { render, screen } from "@/test/test-utils";
import { TransferTitleSettings } from "../transfer-title-settings";

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({
      isLoading: false,
      data: { metadata: { settingsJson: { paymentTransferTitleTemplate: "{invoice_number}" } } },
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    settings: {
      get: {
        queryOptions: vi.fn(() => ({ queryKey: ["settings", "get"] })),
        queryKey: vi.fn(() => ["settings", "get"]),
      },
      update: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("TransferTitleSettings", () => {
  it("renders heading and description", () => {
    render(<TransferTitleSettings />);
    expect(screen.getByText("Payment transfer title")).toBeInTheDocument();
    expect(
      screen.getByText("Configure the default transfer title used in bank export files."),
    ).toBeInTheDocument();
  });

  it("renders template input field", () => {
    render(<TransferTitleSettings />);
    expect(screen.getByLabelText("Title template")).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<TransferTitleSettings />);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("renders preview with resolved template", () => {
    render(<TransferTitleSettings />);
    expect(screen.getByText(/Preview/)).toBeInTheDocument();
  });
});
