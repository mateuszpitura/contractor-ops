import { render, screen, setup } from "@/test/test-utils";
import { OrgPicker } from "../org-picker";

function makeOrgs() {
  return [
    {
      contractorId: "c-1",
      organizationId: "org-1",
      orgName: "Acme Corp",
      orgLogo: null,
    },
    {
      contractorId: "c-2",
      organizationId: "org-2",
      orgName: "Beta Inc",
      orgLogo: "https://example.com/logo.png",
    },
  ];
}

describe("OrgPicker", () => {
  it("renders title and org names", () => {
    render(<OrgPicker orgs={makeOrgs()} email="jan@example.com" onSelect={vi.fn()} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("shows email at the bottom", () => {
    render(<OrgPicker orgs={makeOrgs()} email="jan@example.com" onSelect={vi.fn()} />);

    expect(screen.getByText(/jan@example.com/)).toBeInTheDocument();
  });

  it("shows initial letter fallback when no logo", () => {
    render(<OrgPicker orgs={[makeOrgs()[0]!]} email="jan@example.com" onSelect={vi.fn()} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows logo image when orgLogo is provided", () => {
    render(<OrgPicker orgs={[makeOrgs()[1]!]} email="jan@example.com" onSelect={vi.fn()} />);

    const img = screen.getByRole("img", { name: "Beta Inc" });
    expect(img).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("calls onSelect when card is clicked", async () => {
    const onSelect = vi.fn();
    const { user } = setup(
      <OrgPicker orgs={makeOrgs()} email="jan@example.com" onSelect={onSelect} />,
    );

    await user.click(screen.getByText("Acme Corp"));
    expect(onSelect).toHaveBeenCalledWith("c-1", "org-1");
  });

  it("disables other cards when loading", async () => {
    const onSelect = vi.fn();
    const { user } = setup(
      <OrgPicker orgs={makeOrgs()} email="jan@example.com" onSelect={onSelect} loading />,
    );

    // Cards should not respond when loading
    await user.click(screen.getByText("Acme Corp"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
