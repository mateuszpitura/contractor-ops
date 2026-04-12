import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { EInvoiceComplianceDetail } from "../compliance-detail";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let queryData: unknown = null;
let queryLoading = false;

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: queryData, isLoading: queryLoading }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    einvoice: {
      complianceStatuses: {
        queryOptions: vi.fn(() => ({ queryKey: ["einvoice", "complianceStatuses"] })),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EInvoiceComplianceDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryData = null;
    queryLoading = false;
  });

  it("renders loading skeletons when isLoading is true", () => {
    queryLoading = true;
    const { container } = render(<EInvoiceComplianceDetail />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders heading and description when loaded", () => {
    queryData = { statuses: [] };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("E-Invoicing Compliance")).toBeInTheDocument();
    expect(screen.getByText(/Status of connected e-invoicing profiles/)).toBeInTheDocument();
  });

  it("renders empty state when no profiles configured", () => {
    queryData = { statuses: [] };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("No e-invoicing profiles configured.")).toBeInTheDocument();
  });

  it("renders profile card with display name and state badge", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "KSeF Poland",
          state: "active",
          country: "PL",
          healthScore: 95,
          lastSyncAt: new Date().toISOString(),
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: true, canSign: true, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("KSeF Poland")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("PL")).toBeInTheDocument();
  });

  it("renders health bar with percentage", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "KSeF Poland",
          state: "active",
          country: "PL",
          healthScore: 80,
          lastSyncAt: null,
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: true, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("renders capability items correctly", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Test Profile",
          state: "active",
          country: "DE",
          healthScore: 100,
          lastSyncAt: new Date().toISOString(),
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: false, canSign: true, canQRCode: true },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Capabilities")).toBeInTheDocument();
    expect(screen.getByText("Generate")).toBeInTheDocument();
    expect(screen.getByText("Parse")).toBeInTheDocument();
    expect(screen.getByText("Sign")).toBeInTheDocument();
    expect(screen.getByText("QR Code")).toBeInTheDocument();
  });

  it("renders error message when lastErrorMessage is set", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Error Profile",
          state: "error",
          country: "PL",
          healthScore: 10,
          lastSyncAt: null,
          lastErrorMessage: "Connection timeout",
          capabilities: { canGenerate: false, canParse: false, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Connection timeout")).toBeInTheDocument();
  });

  it("renders sandbox badge variant for sandbox state", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Sandbox Profile",
          state: "sandbox",
          country: "PL",
          healthScore: 50,
          lastSyncAt: null,
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: true, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Sandbox")).toBeInTheDocument();
  });

  it("renders 'Never' for last sync when lastSyncAt is null", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Never Synced",
          state: "onboarding",
          country: "PL",
          healthScore: 0,
          lastSyncAt: null,
          lastErrorMessage: null,
          capabilities: { canGenerate: false, canParse: false, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
  });

  it("renders 'Just now' for very recent sync", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Recent Sync",
          state: "active",
          country: "PL",
          healthScore: 99,
          lastSyncAt: new Date().toISOString(),
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: true, canSign: true, canQRCode: true },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });

  it("renders multiple profile cards", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "KSeF Poland",
          state: "active",
          country: "PL",
          healthScore: 95,
          lastSyncAt: new Date().toISOString(),
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: true, canSign: true, canQRCode: false },
        },
        {
          profileId: "p2",
          displayName: "XRechnung Germany",
          state: "degraded",
          country: "DE",
          healthScore: 40,
          lastSyncAt: null,
          lastErrorMessage: "API rate limited",
          capabilities: { canGenerate: true, canParse: false, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("KSeF Poland")).toBeInTheDocument();
    expect(screen.getByText("XRechnung Germany")).toBeInTheDocument();
    expect(screen.getByText("API rate limited")).toBeInTheDocument();
  });

  it("renders suspended state badge", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Suspended Profile",
          state: "suspended",
          country: "PL",
          healthScore: 0,
          lastSyncAt: null,
          lastErrorMessage: null,
          capabilities: { canGenerate: false, canParse: false, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Suspended")).toBeInTheDocument();
  });

  it("renders not_connected state badge", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Disconnected",
          state: "not_connected",
          country: "PL",
          healthScore: 0,
          lastSyncAt: null,
          lastErrorMessage: null,
          capabilities: { canGenerate: false, canParse: false, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Not Connected")).toBeInTheDocument();
  });

  it("renders health bar with amber color for medium score", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Medium Health",
          state: "degraded",
          country: "PL",
          healthScore: 55,
          lastSyncAt: null,
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: false, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("55%")).toBeInTheDocument();
  });

  it("renders health bar with red color for low score", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Low Health",
          state: "error",
          country: "PL",
          healthScore: 20,
          lastSyncAt: null,
          lastErrorMessage: null,
          capabilities: { canGenerate: false, canParse: false, canSign: false, canQRCode: false },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("renders section with id='einvoice'", () => {
    queryData = { statuses: [] };
    const { container } = render(<EInvoiceComplianceDetail />);
    expect(container.querySelector("#einvoice")).toBeInTheDocument();
  });

  it("renders Last Sync label", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Test",
          state: "active",
          country: "PL",
          healthScore: 90,
          lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: true, canSign: true, canQRCode: true },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("Last Sync:")).toBeInTheDocument();
    expect(screen.getByText("1h ago")).toBeInTheDocument();
  });

  it("renders time ago with minutes for recent sync", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Test",
          state: "active",
          country: "PL",
          healthScore: 90,
          lastSyncAt: new Date(Date.now() - 300000).toISOString(),
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: true, canSign: true, canQRCode: true },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("renders time ago with days for old sync", () => {
    queryData = {
      statuses: [
        {
          profileId: "p1",
          displayName: "Test",
          state: "active",
          country: "PL",
          healthScore: 90,
          lastSyncAt: new Date(Date.now() - 172800000).toISOString(),
          lastErrorMessage: null,
          capabilities: { canGenerate: true, canParse: true, canSign: true, canQRCode: true },
        },
      ],
    };
    render(<EInvoiceComplianceDetail />);
    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });
});
