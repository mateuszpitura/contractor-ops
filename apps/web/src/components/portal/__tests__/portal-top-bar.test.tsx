import { render, screen } from "@/test/test-utils";
import { PortalTopBar } from "../portal-top-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/avatar-initials", () => ({
  getAvatarInitials: (name: string) =>
    name
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
}));

vi.mock("./portal-mobile-menu", () => ({
  PortalMobileMenu: () => null,
}));

function makeProps(overrides: Partial<Parameters<typeof PortalTopBar>[0]> = {}) {
  return {
    orgName: "Acme Corp",
    contractorName: "Jan Kowalski",
    contractorEmail: "jan@acme.com",
    ...overrides,
  };
}

describe("PortalTopBar", () => {
  it("renders org name", () => {
    render(<PortalTopBar {...makeProps()} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders org logo when provided", () => {
    render(<PortalTopBar {...makeProps({ orgLogo: "https://example.com/logo.png" })} />);

    const img = screen.getByRole("img", { name: "Acme Corp" });
    expect(img).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("renders nav links", () => {
    render(<PortalTopBar {...makeProps()} />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Contracts")).toBeInTheDocument();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
  });

  it("renders mobile hamburger button", () => {
    render(<PortalTopBar {...makeProps()} />);

    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
  });
});
