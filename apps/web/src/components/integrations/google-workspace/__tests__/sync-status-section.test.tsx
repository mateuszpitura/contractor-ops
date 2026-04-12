import { render, screen } from "@/test/test-utils";
import { SyncStatusSection } from "../sync-status-section";

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({
      isLoading: false,
      data: { connected: true, lastSyncAt: new Date().toISOString() },
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    googleWorkspace: {
      syncStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ["gw", "syncStatus"] })),
        queryKey: vi.fn(() => ["gw", "syncStatus"]),
      },
      triggerSync: { mutationOptions: vi.fn(() => ({})) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("SyncStatusSection", () => {
  it("renders sync now button", () => {
    render(<SyncStatusSection onImportClick={vi.fn()} />);
    expect(screen.getByText("Sync now")).toBeInTheDocument();
  });

  it("renders import users button", () => {
    render(<SyncStatusSection onImportClick={vi.fn()} />);
    expect(screen.getByText("Import users")).toBeInTheDocument();
  });

  it("renders next sync text", () => {
    render(<SyncStatusSection onImportClick={vi.fn()} />);
    expect(screen.getByText("Next: Tomorrow 2:00 AM")).toBeInTheDocument();
  });
});
