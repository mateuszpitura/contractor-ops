import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const useQueryMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (values) return `${key}:${JSON.stringify(values)}`;
    return key;
  },
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    integration: {
      getHealth: {
        queryOptions: (input: unknown) => ({ queryKey: ["integration.getHealth", input] }),
      },
    },
    billing: {
      getSubscription: { queryOptions: () => ({ queryKey: ["billing.getSubscription"] }) },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/components/settings/provider-connection-card", () => ({
  ProviderConnectionCard: () => <div data-testid="provider-card">ProviderConnectionCard</div>,
}));

vi.mock("../teams-logo", () => ({
  TeamsLogo: () => <span>TeamsLogo</span>,
}));

vi.mock("../teams-channel-mapping-card", () => ({
  TeamsChannelMappingCard: () => <div data-testid="channel-mapping">TeamsChannelMapping</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockUseQuery(_queryKey: unknown[], data: unknown, isLoading = false) {
  return { data, isLoading, error: null, isError: false, isPending: isLoading };
}

function setupStarterTier() {
  useQueryMock.mockImplementation((opts: { queryKey: unknown[] }) => {
    const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : "";
    if (key === "billing.getSubscription") {
      return mockUseQuery(opts.queryKey, { tier: "STARTER" });
    }
    return mockUseQuery(opts.queryKey, { status: "DISCONNECTED" });
  });
}

function setupProTier() {
  useQueryMock.mockImplementation((opts: { queryKey: unknown[] }) => {
    const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : "";
    if (key === "billing.getSubscription") {
      return mockUseQuery(opts.queryKey, { tier: "PRO" });
    }
    return mockUseQuery(opts.queryKey, { status: "CONNECTED" });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { TeamsProviderSection } from "../teams-provider-section";

describe("TeamsProviderSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wraps content with FeatureGate requiring Pro tier — STARTER sees upgrade banner", () => {
    setupStarterTier();
    render(<TeamsProviderSection />);

    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("Microsoft Teams integration");

    expect(screen.queryByTestId("provider-card")).not.toBeInTheDocument();
  });

  it("PRO tier users see provider section normally", () => {
    setupProTier();
    render(<TeamsProviderSection />);

    expect(screen.getByTestId("provider-card")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
