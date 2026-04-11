import { render, screen } from "@/test/test-utils";
import { FeatureGate } from "../feature-gate";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let subscriptionData: any = null;
let isLoading = false;

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: subscriptionData, isLoading }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    billing: {
      getSubscription: { queryOptions: () => ({}) },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/test",
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FeatureGate", () => {
  beforeEach(() => {
    subscriptionData = null;
    isLoading = false;
  });

  it("shows children while loading (no flash of upgrade banner)", () => {
    isLoading = true;
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR">
        <div>Protected content</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("shows upgrade banner when no subscription", () => {
    subscriptionData = null;
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR">
        <div>Protected content</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows upgrade banner when tier is insufficient", () => {
    subscriptionData = { tier: "STARTER" };
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR">
        <div>Protected content</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders children when tier meets requirement", () => {
    subscriptionData = { tier: "PRO" };
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR">
        <div>Protected content</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("renders children when tier exceeds requirement", () => {
    subscriptionData = { tier: "ENTERPRISE" };
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR">
        <div>Protected content</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("shows upgrade banner for Enterprise gate when on Pro tier", () => {
    subscriptionData = { tier: "PRO" };
    render(
      <FeatureGate requiredTier="Enterprise" featureName="API access">
        <div>Enterprise content</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Enterprise content")).not.toBeInTheDocument();
  });

  it("renders children for Enterprise tier with Enterprise gate", () => {
    subscriptionData = { tier: "ENTERPRISE" };
    render(
      <FeatureGate requiredTier="Enterprise" featureName="API access">
        <div>Enterprise content</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Enterprise content")).toBeInTheDocument();
  });

  it("shows upgrade banner for Starter tier with Pro gate", () => {
    subscriptionData = { tier: "STARTER" };
    render(
      <FeatureGate requiredTier="Pro" featureName="Workflows">
        <div>Pro content</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Pro content")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows upgrade banner for Starter tier with Enterprise gate", () => {
    subscriptionData = { tier: "STARTER" };
    render(
      <FeatureGate requiredTier="Enterprise" featureName="Custom API">
        <div>Enterprise only</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Enterprise only")).not.toBeInTheDocument();
  });

  it("renders children with unknown high-rank tier", () => {
    subscriptionData = { tier: "ENTERPRISE" };
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR">
        <div>Any content</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Any content")).toBeInTheDocument();
  });

  it("shows children during loading even for restricted tier", () => {
    isLoading = true;
    subscriptionData = { tier: "STARTER" };
    render(
      <FeatureGate requiredTier="Enterprise" featureName="API">
        <div>Loading content</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Loading content")).toBeInTheDocument();
  });

  // ---- Pro tier passes Pro gate ----
  it("renders children for Pro tier with Pro gate", () => {
    subscriptionData = { tier: "PRO" };
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR">
        <div>Pro OCR content</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Pro OCR content")).toBeInTheDocument();
  });

  // ---- Enterprise passes both Pro and Enterprise gates ----
  it("renders children for Enterprise tier with Pro gate", () => {
    subscriptionData = { tier: "ENTERPRISE" };
    render(
      <FeatureGate requiredTier="Pro" featureName="Workflows">
        <div>Pro workflows content</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Pro workflows content")).toBeInTheDocument();
  });

  // ---- No subscription shows upgrade banner ----
  it("shows upgrade banner when no subscription exists", () => {
    subscriptionData = null;
    render(
      <FeatureGate requiredTier="Pro" featureName="Advanced">
        <div>Gated content</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Gated content")).not.toBeInTheDocument();
  });

  // ---- Unknown tier shows upgrade banner ----
  it("shows upgrade banner for unknown tier", () => {
    subscriptionData = { tier: "UNKNOWN" };
    render(
      <FeatureGate requiredTier="Pro" featureName="Feature">
        <div>Feature content</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Feature content")).not.toBeInTheDocument();
  });

  // ---- Loading shows children regardless ----
  it("shows children during loading for Pro gate", () => {
    isLoading = true;
    subscriptionData = null;
    render(
      <FeatureGate requiredTier="Pro" featureName="Feature">
        <div>Loading Pro</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Loading Pro")).toBeInTheDocument();
  });
});
