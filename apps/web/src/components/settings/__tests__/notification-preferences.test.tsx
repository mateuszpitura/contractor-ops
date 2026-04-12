import { render, screen } from "@/test/test-utils";
import { NotificationPreferences } from "../notification-preferences";

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      isLoading: false,
      data: [],
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    notification: {
      getPreferences: {
        queryOptions: vi.fn(() => ({ queryKey: ["notification", "getPreferences"] })),
        queryKey: vi.fn(() => ["notification", "getPreferences"]),
      },
      updatePreferences: { mutationOptions: vi.fn((o: object) => o) },
    },
    integration: {
      getSlackStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ["integration", "getSlackStatus"] })),
      },
      getHealth: {
        queryOptions: vi.fn(() => ({ queryKey: ["integration", "getHealth"] })),
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("NotificationPreferences", () => {
  it("renders heading and description", () => {
    render(<NotificationPreferences />);
    expect(screen.getByText("Notification preferences")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose how you want to be notified for each event type. In-app notifications are always enabled.",
      ),
    ).toBeInTheDocument();
  });

  it("renders table column headers", () => {
    render(<NotificationPreferences />);
    expect(screen.getByText("Event")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<NotificationPreferences />);
    expect(screen.getByText("Save preferences")).toBeInTheDocument();
  });
});
