import { fireEvent } from "@testing-library/react";
import { render, screen } from "@/test/test-utils";
import {
  NotificationItem,
  getEntityUrl,
  type NotificationData,
} from "../notification-item";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(
  overrides: Partial<NotificationData> = {},
): NotificationData {
  return {
    id: "notif-1",
    type: "APPROVAL_REQUEST",
    title: "New approval request",
    body: "Invoice #1234 needs your approval",
    entityType: "INVOICE",
    entityId: "inv-1",
    status: "UNREAD",
    readAt: null,
    createdAt: "2026-04-04T11:59:30Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NotificationItem", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it("renders title and body", () => {
    render(
      <NotificationItem notification={makeNotification()} onClick={vi.fn()} />,
    );

    expect(screen.getByText("New approval request")).toBeInTheDocument();
    expect(
      screen.getByText("Invoice #1234 needs your approval"),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Unread indicator
  // -------------------------------------------------------------------------

  it("shows unread dot when readAt is null", () => {
    const { container } = render(
      <NotificationItem
        notification={makeNotification({ readAt: null })}
        onClick={vi.fn()}
      />,
    );

    expect(
      container.querySelector(".rounded-full.bg-primary"),
    ).toBeInTheDocument();
  });

  it("does NOT show unread dot when readAt is set", () => {
    const { container } = render(
      <NotificationItem
        notification={makeNotification({
          readAt: "2026-04-04T10:00:00Z",
        })}
        onClick={vi.fn()}
      />,
    );

    expect(
      container.querySelector(".rounded-full.bg-primary"),
    ).not.toBeInTheDocument();
  });

  it("applies bg-muted class for unread notifications", () => {
    render(
      <NotificationItem notification={makeNotification()} onClick={vi.fn()} />,
    );

    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-muted");
  });

  it("applies bg-transparent for read notifications (not bg-muted)", () => {
    render(
      <NotificationItem
        notification={makeNotification({
          readAt: "2026-04-04T10:00:00Z",
        })}
        onClick={vi.fn()}
      />,
    );

    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-transparent");
    expect(button.className).not.toContain("bg-muted");
  });

  // -------------------------------------------------------------------------
  // Click handler
  // -------------------------------------------------------------------------

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();

    render(
      <NotificationItem notification={makeNotification()} onClick={onClick} />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Relative time
  // -------------------------------------------------------------------------

  it('shows "now" for <60 seconds ago', () => {
    render(
      <NotificationItem
        notification={makeNotification({
          createdAt: "2026-04-04T11:59:30Z",
        })}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("now")).toBeInTheDocument();
  });

  it('shows "5m ago" for 5 minutes ago', () => {
    render(
      <NotificationItem
        notification={makeNotification({
          createdAt: "2026-04-04T11:55:00Z",
        })}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it('shows "3h ago" for 3 hours ago', () => {
    render(
      <NotificationItem
        notification={makeNotification({
          createdAt: "2026-04-04T09:00:00Z",
        })}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("3h ago")).toBeInTheDocument();
  });

  it('shows "2d ago" for 2 days ago', () => {
    render(
      <NotificationItem
        notification={makeNotification({
          createdAt: "2026-04-02T12:00:00Z",
        })}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Compact mode
  // -------------------------------------------------------------------------

  it("applies smaller padding in compact mode", () => {
    render(
      <NotificationItem
        notification={makeNotification()}
        onClick={vi.fn()}
        compact
      />,
    );

    const button = screen.getByRole("button");
    expect(button.className).toContain("px-3");
    expect(button.className).toContain("py-2");
  });
});

// ---------------------------------------------------------------------------
// getEntityUrl
// ---------------------------------------------------------------------------

describe("getEntityUrl", () => {
  it("returns /invoices/{id} for INVOICE", () => {
    expect(getEntityUrl("INVOICE", "inv-1")).toBe("/invoices/inv-1");
  });

  it("returns /contracts/{id} for CONTRACT", () => {
    expect(getEntityUrl("CONTRACT", "c-1")).toBe("/contracts/c-1");
  });

  it("returns /contractors/{id} for CONTRACTOR", () => {
    expect(getEntityUrl("CONTRACTOR", "ctr-1")).toBe("/contractors/ctr-1");
  });

  it("returns /workflows/{id} for WORKFLOW_RUN", () => {
    expect(getEntityUrl("WORKFLOW_RUN", "wr-1")).toBe("/workflows/wr-1");
  });

  it("returns /workflows for WORKFLOW_TASK_RUN", () => {
    expect(getEntityUrl("WORKFLOW_TASK_RUN", "wtr-1")).toBe("/workflows");
  });

  it("returns /settings for ORGANIZATION", () => {
    expect(getEntityUrl("ORGANIZATION", "org-1")).toBe("/settings");
  });

  it('returns "/notifications" for null entityType', () => {
    expect(getEntityUrl(null, null)).toBe("/notifications");
  });

  it('returns "/notifications" for unknown entityType', () => {
    expect(getEntityUrl("UNKNOWN", "x")).toBe("/notifications");
  });
});
