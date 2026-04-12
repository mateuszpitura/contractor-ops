import { render, screen } from "@/test/test-utils";
import { PortalMobileMenu } from "../portal-mobile-menu";

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal",
  useRouter: () => ({ push: vi.fn() }),
}));

function makeProps(overrides: Partial<Parameters<typeof PortalMobileMenu>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    orgName: "Acme Corp",
    contractorName: "Jan Kowalski",
    contractorEmail: "jan@acme.com",
    ...overrides,
  };
}

describe("PortalMobileMenu", () => {
  it("renders org name in header", () => {
    render(<PortalMobileMenu {...makeProps()} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders contractor name and email", () => {
    render(<PortalMobileMenu {...makeProps()} />);

    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.getByText("jan@acme.com")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<PortalMobileMenu {...makeProps()} />);

    expect(screen.getByText(/overview/i)).toBeInTheDocument();
    expect(screen.getByText(/contracts/i)).toBeInTheDocument();
    expect(screen.getByText(/invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
  });

  it("renders sign out button", () => {
    render(<PortalMobileMenu {...makeProps()} />);

    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
