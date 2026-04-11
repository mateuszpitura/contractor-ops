import { render, screen } from "@/test/test-utils";
import { SlaBadge } from "../sla-badge";

describe("SlaBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Renders nothing for non-PENDING or no deadline
  // ---------------------------------------------------------------------------

  it("returns null when status is not PENDING", () => {
    const { container } = render(
      <SlaBadge slaDeadline="2099-12-31T00:00:00Z" status="APPROVED" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when slaDeadline is null", () => {
    const { container } = render(
      <SlaBadge slaDeadline={null} status="PENDING" />,
    );
    expect(container.innerHTML).toBe("");
  });

  // ---------------------------------------------------------------------------
  // Countdown display
  // ---------------------------------------------------------------------------

  it("shows hours remaining for future deadline", () => {
    const futureDate = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 10 * 3600000).toISOString(); // +10h
    render(<SlaBadge slaDeadline={futureDate} status="PENDING" />);
    expect(screen.getByText("10h left")).toBeInTheDocument();
  });

  it("shows OVERDUE for past deadline", () => {
    const pastDate = new Date(new Date("2026-01-15T12:00:00Z").getTime() - 5 * 3600000).toISOString(); // -5h
    render(<SlaBadge slaDeadline={pastDate} status="PENDING" />);
    expect(screen.getByText(/^OVERDUE \d+h$/)).toBeInTheDocument();
  });

  it("rounds up hours (e.g. 2.5h → 3h left)", () => {
    const futureDate = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 2.5 * 3600000).toISOString();
    render(<SlaBadge slaDeadline={futureDate} status="PENDING" />);
    expect(screen.getByText("3h left")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Color thresholds with slaHours
  // ---------------------------------------------------------------------------

  it("shows green when >50% time remaining", () => {
    // 24h SLA, 20h remaining → 83%
    const deadline = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 20 * 3600000).toISOString();
    const { container } = render(
      <SlaBadge slaDeadline={deadline} status="PENDING" slaHours={24} />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-green-600");
  });

  it("shows yellow when 25-50% time remaining", () => {
    // 24h SLA, 10h remaining → 42%
    const deadline = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 10 * 3600000).toISOString();
    const { container } = render(
      <SlaBadge slaDeadline={deadline} status="PENDING" slaHours={24} />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-amber-600");
  });

  it("shows red when <25% time remaining", () => {
    // 24h SLA, 4h remaining → 17%
    const deadline = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 4 * 3600000).toISOString();
    const { container } = render(
      <SlaBadge slaDeadline={deadline} status="PENDING" slaHours={24} />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-destructive");
  });

  it("shows overdue styling for past deadline", () => {
    const pastDate = new Date(new Date("2026-01-15T12:00:00Z").getTime() - 2 * 3600000).toISOString();
    const { container } = render(
      <SlaBadge slaDeadline={pastDate} status="PENDING" slaHours={24} />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-destructive");
    expect(badge?.className).toContain("border");
  });

  // ---------------------------------------------------------------------------
  // Fallback thresholds (no slaHours)
  // ---------------------------------------------------------------------------

  it("falls back to green when >24h remaining (no slaHours)", () => {
    const deadline = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 48 * 3600000).toISOString();
    const { container } = render(
      <SlaBadge slaDeadline={deadline} status="PENDING" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-green-600");
  });

  it("falls back to yellow when 8-24h remaining (no slaHours)", () => {
    const deadline = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 12 * 3600000).toISOString();
    const { container } = render(
      <SlaBadge slaDeadline={deadline} status="PENDING" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-amber-600");
  });

  it("falls back to red when <8h remaining (no slaHours)", () => {
    const deadline = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 3 * 3600000).toISOString();
    const { container } = render(
      <SlaBadge slaDeadline={deadline} status="PENDING" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-destructive");
  });

  // ---------------------------------------------------------------------------
  // Tabular nums for countdown
  // ---------------------------------------------------------------------------

  it("uses tabular-nums for consistent digit width", () => {
    const deadline = new Date(new Date("2026-01-15T12:00:00Z").getTime() + 5 * 3600000).toISOString();
    const { container } = render(
      <SlaBadge slaDeadline={deadline} status="PENDING" />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("tabular-nums");
  });
});
