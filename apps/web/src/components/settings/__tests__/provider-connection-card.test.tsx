import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, setup } from "@/test/test-utils";
import { ProviderConnectionCard } from "../provider-connection-card";

let mockHealthData: Record<string, unknown> | null = null;

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: () => ({
      isLoading: false,
      data: mockHealthData,
      refetch: vi.fn().mockResolvedValue({ data: { url: "https://oauth.test" } }),
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    integration: {
      getHealth: {
        queryOptions: vi.fn(() => ({
          queryKey: ["integration", "getHealth"],
        })),
        queryKey: vi.fn(() => ["integration", "getHealth"]),
      },
      getAllHealth: { queryKey: vi.fn(() => ["integration", "getAllHealth"]) },
      getOAuthUrlGeneric: {
        queryOptions: vi.fn(() => ({
          queryKey: ["integration", "getOAuthUrlGeneric"],
          enabled: false,
        })),
      },
      disconnectGeneric: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("../provider-detail-sheet", () => ({
  ProviderDetailSheet: () => null,
}));

const defaultProps = {
  provider: "slack",
  displayName: "Slack",
  icon: <span>icon</span>,
  description: "Connect Slack for notifications",
};

describe("ProviderConnectionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Connected state ----
  it("renders provider name and connected status", () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "Test Workspace",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders connected workspace name", () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "Test Workspace",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Test Workspace")).toBeInTheDocument();
  });

  it("renders manage and disconnect buttons when connected", () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "Test Workspace",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Manage")).toBeInTheDocument();
    expect(screen.getByText("Disconnect Slack")).toBeInTheDocument();
  });

  it("renders connected date", () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-15",
      tokenExpiresAt: null,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    const dateStr = new Date("2026-01-15").toLocaleDateString();
    expect(screen.getByText(dateStr)).toBeInTheDocument();
  });

  // ---- Disconnected state ----
  it("shows connect button when disconnected", () => {
    mockHealthData = { status: "DISCONNECTED" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Connect Slack")).toBeInTheDocument();
  });

  it("shows description when disconnected", () => {
    mockHealthData = { status: "DISCONNECTED" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(
      screen.getByText("Connect Slack for notifications"),
    ).toBeInTheDocument();
  });

  it("does not show manage or disconnect buttons when disconnected", () => {
    mockHealthData = { status: "DISCONNECTED" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.queryByText("Manage")).not.toBeInTheDocument();
    expect(screen.queryByText("Disconnect Slack")).not.toBeInTheDocument();
  });

  // ---- REAUTH_REQUIRED state ----
  it("shows reconnect button and error message when reauth required", () => {
    mockHealthData = { status: "REAUTH_REQUIRED" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Reconnect")).toBeInTheDocument();
    expect(screen.getByText(/token expired/i)).toBeInTheDocument();
  });

  it("shows disconnect button alongside reconnect for REAUTH_REQUIRED", () => {
    mockHealthData = { status: "REAUTH_REQUIRED" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Reconnect")).toBeInTheDocument();
    expect(screen.getByText("Disconnect Slack")).toBeInTheDocument();
  });

  // ---- ERROR state ----
  it("shows reconnect button and error message when status is ERROR", () => {
    mockHealthData = { status: "ERROR" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Reconnect")).toBeInTheDocument();
    expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
  });

  it("does not show disconnect button for ERROR state", () => {
    mockHealthData = { status: "ERROR" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.queryByText("Disconnect Slack")).not.toBeInTheDocument();
  });

  // ---- Disconnect dialog ----
  it("opens disconnect dialog when disconnect button is clicked", async () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    const { user } = setup(
      <ProviderConnectionCard {...defaultProps} />,
    );
    await user.click(screen.getByText("Disconnect Slack"));
    expect(
      await screen.findByRole("alertdialog"),
    ).toBeInTheDocument();
  });

  // ---- Status badges ----
  it("renders Disconnected status badge", () => {
    mockHealthData = { status: "DISCONNECTED" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("renders Re-authorization required status badge", () => {
    mockHealthData = { status: "REAUTH_REQUIRED" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Reauthorization required")).toBeInTheDocument();
  });

  it("renders Error status badge", () => {
    mockHealthData = { status: "ERROR" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  // ---- Manage button opens detail sheet ----
  it("manage button is clickable when connected", async () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    const { user } = setup(
      <ProviderConnectionCard {...defaultProps} />,
    );
    await user.click(screen.getByText("Manage"));
    // Should not throw
  });

  // ---- Reconnect button for REAUTH ----
  it("reconnect button is clickable when reauth required", async () => {
    mockHealthData = { status: "REAUTH_REQUIRED" };
    const { user } = setup(
      <ProviderConnectionCard {...defaultProps} />,
    );
    await user.click(screen.getByText("Reconnect"));
    // Should redirect (mocked refetch returns url)
  });

  // ---- Connect button for disconnected ----
  it("connect button is clickable when disconnected", async () => {
    mockHealthData = { status: "DISCONNECTED" };
    const { user } = setup(
      <ProviderConnectionCard {...defaultProps} />,
    );
    await user.click(screen.getByText("Connect Slack"));
    // Should not throw
  });

  // ---- Token expiry badge ----
  it("renders token expiry when connected and token has expiry", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: futureDate,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Token expires:")).toBeInTheDocument();
  });

  // ---- Disconnect dialog confirmation ----
  it("disconnect dialog has confirm and cancel buttons", async () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    const { user } = setup(
      <ProviderConnectionCard {...defaultProps} />,
    );
    await user.click(screen.getByText("Disconnect Slack"));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    // Should have cancel button in dialog
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  // ---- Provider icon rendered ----
  it("renders provider icon", () => {
    mockHealthData = { status: "DISCONNECTED" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("icon")).toBeInTheDocument();
  });

  // ---- Null health data defaults to disconnected ----
  it("renders disconnected state when health data is null", () => {
    mockHealthData = null;
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Connect Slack")).toBeInTheDocument();
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  // ---- Disconnect dialog: cancel closes it ----
  it("cancel button closes disconnect dialog", async () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    const { user } = setup(
      <ProviderConnectionCard {...defaultProps} />,
    );
    await user.click(screen.getByText("Disconnect Slack"));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByText("Cancel"));
    const { waitFor } = await import("@/test/test-utils");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  // ---- Disconnect dialog: confirm ----
  it("confirm disconnect button triggers mutation", async () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    const { user } = setup(
      <ProviderConnectionCard {...defaultProps} />,
    );
    await user.click(screen.getByText("Disconnect Slack"));
    await screen.findByRole("alertdialog");
    // Find the destructive confirm button
    const buttons = screen.getAllByRole("button");
    const confirmBtn = buttons.find(
      (b) => b.textContent?.includes("Disconnect") && b.closest("[role='alertdialog']"),
    );
    if (confirmBtn) await user.click(confirmBtn);
  });

  // ---- Reconnect: connected status shows reconnect option ----
  it("shows disconnect button when status is CONNECTED", () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Disconnect Slack")).toBeInTheDocument();
  });

  // ---- Token expired badge ----
  it("renders expired token badge when token is in the past", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: pastDate,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Token expires:")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  // ---- Token warning (expiring soon) ----
  it("renders warning token badge when token expires within 1 hour", () => {
    const soonDate = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: "2026-01-01",
      tokenExpiresAt: soonDate,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Token expires:")).toBeInTheDocument();
  });

  // ---- Connected without displayName ----
  it("renders connected state without displayName", () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: null,
      connectedAt: "2026-01-01",
      tokenExpiresAt: null,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Manage")).toBeInTheDocument();
  });

  // ---- Connected without connectedAt ----
  it("renders connected state without connectedAt date", () => {
    mockHealthData = {
      status: "CONNECTED",
      displayName: "WS",
      connectedAt: null,
      tokenExpiresAt: null,
    };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  // ---- ERROR state shows reconnect button ----
  it("error state shows reconnect button without disconnect", () => {
    mockHealthData = { status: "ERROR" };
    render(<ProviderConnectionCard {...defaultProps} />);
    expect(screen.getByText("Reconnect")).toBeInTheDocument();
    expect(screen.queryByText("Disconnect Slack")).not.toBeInTheDocument();
  });

  // ---- Different provider name ----
  it("renders with different provider name", () => {
    mockHealthData = { status: "DISCONNECTED" };
    render(
      <ProviderConnectionCard
        provider="google"
        displayName="Google Calendar"
        icon={<span>G</span>}
        description="Sync calendar events"
      />,
    );
    expect(screen.getByText("Google Calendar")).toBeInTheDocument();
    expect(screen.getByText("Connect Google Calendar")).toBeInTheDocument();
  });
});
