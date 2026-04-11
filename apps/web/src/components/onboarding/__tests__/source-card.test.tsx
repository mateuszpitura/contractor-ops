import { render, screen, setup } from "@/test/test-utils";
import { SourceCard } from "../source-card";

describe("SourceCard", () => {
  const defaultProps = {
    provider: "JIRA",
    name: "Jira",
    icon: <span>JiraIcon</span>,
    connected: true,
    selected: false,
    onToggle: vi.fn(),
    onConnect: vi.fn(),
  };

  it("renders provider name", () => {
    render(<SourceCard {...defaultProps} />);
    expect(screen.getByText("Jira")).toBeInTheDocument();
  });

  it("shows connected badge when connected", () => {
    render(<SourceCard {...defaultProps} />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows not connected text and connect button when not connected", () => {
    render(<SourceCard {...defaultProps} connected={false} />);
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("Connect")).toBeInTheDocument();
  });

  it("shows toggle switch when connected", () => {
    render(<SourceCard {...defaultProps} />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("has checkbox role for keyboard accessibility", () => {
    render(<SourceCard {...defaultProps} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("calls onToggle when card is clicked and connected", async () => {
    const onToggle = vi.fn();
    const { user } = setup(<SourceCard {...defaultProps} onToggle={onToggle} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("calls onConnect when connect button is clicked", async () => {
    const onConnect = vi.fn();
    const { user } = setup(
      <SourceCard {...defaultProps} connected={false} onConnect={onConnect} />,
    );
    await user.click(screen.getByText("Connect"));
    expect(onConnect).toHaveBeenCalled();
  });

  it("applies selected ring when selected", () => {
    render(<SourceCard {...defaultProps} selected={true} />);
    const card = screen.getByRole("checkbox");
    expect(card.className).toContain("ring-2");
  });
});
