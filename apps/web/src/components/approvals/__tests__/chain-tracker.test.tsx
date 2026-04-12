import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: any) => {
      if (params?.chainName) return `${key}(${params.chainName})`;
      return key;
    },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    approval: {
      getAuditTrail: { queryOptions: (opts: any) => opts },
    },
  },
}));

vi.mock("@/lib/avatar-initials", () => ({
  getAvatarInitials: (name: string | null, email: string) => (name ? name[0] : email[0]),
}));

vi.mock("@/components/approvals/sla-badge", () => ({
  SlaBadge: () => <span data-testid="sla-badge">SLA</span>,
}));

import { useQuery } from "@tanstack/react-query";
import { ChainTracker } from "../chain-tracker";

const mockUseQuery = vi.mocked(useQuery);

describe("ChainTracker", () => {
  it("renders loading skeleton when isLoading", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    const { container } = render(<ChainTracker invoiceId="inv-1" />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it("returns null when flow has no steps", () => {
    mockUseQuery.mockReturnValue({
      data: { flow: { steps: [] } },
      isLoading: false,
    } as any);
    const { container } = render(<ChainTracker invoiceId="inv-1" />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when flow is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: {},
      isLoading: false,
    } as any);
    const { container } = render(<ChainTracker invoiceId="inv-1" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders step circles for each step", () => {
    mockUseQuery.mockReturnValue({
      data: {
        flow: {
          steps: [
            {
              id: "s1",
              stepOrder: 0,
              name: "Level 1",
              status: "APPROVED",
              approverUserId: null,
              approverRole: "MANAGER",
              slaDeadline: null,
              actedAt: "2026-01-01T00:00:00Z",
              decision: "APPROVED",
              approver: null,
            },
            {
              id: "s2",
              stepOrder: 1,
              name: "Level 2",
              status: "PENDING",
              approverUserId: "u-2",
              approverRole: "DIRECTOR",
              slaDeadline: "2026-02-01T00:00:00Z",
              actedAt: null,
              decision: null,
              approver: {
                id: "u-2",
                name: "Anna",
                email: "anna@test.com",
                image: null,
              },
            },
          ],
          chainName: "Finance Chain",
        },
      },
      isLoading: false,
    } as any);
    render(<ChainTracker invoiceId="inv-1" />);
    expect(screen.getByText("chainTracker.heading")).toBeInTheDocument();
    // APPROVED step shows icon (not number), PENDING step shows "2"
    expect(screen.getByText("2")).toBeInTheDocument();
    // Chain name
    expect(screen.getByText("chainTracker.chain(Finance Chain)")).toBeInTheDocument();
    // Approver name
    expect(screen.getByText("Anna")).toBeInTheDocument();
  });

  it("renders SLA badge for pending steps with deadline", () => {
    mockUseQuery.mockReturnValue({
      data: {
        flow: {
          steps: [
            {
              id: "s1",
              stepOrder: 0,
              name: "L1",
              status: "PENDING",
              approverUserId: null,
              approverRole: null,
              slaDeadline: "2026-06-01T00:00:00Z",
              actedAt: null,
              decision: null,
              approver: null,
            },
          ],
        },
      },
      isLoading: false,
    } as any);
    render(<ChainTracker invoiceId="inv-1" />);
    expect(screen.getByTestId("sla-badge")).toBeInTheDocument();
  });

  it("greys out steps after a rejected step", () => {
    mockUseQuery.mockReturnValue({
      data: {
        flow: {
          steps: [
            {
              id: "s1",
              stepOrder: 0,
              name: "L1",
              status: "REJECTED",
              approverUserId: null,
              approverRole: "MANAGER",
              slaDeadline: null,
              actedAt: null,
              decision: null,
              approver: null,
            },
            {
              id: "s2",
              stepOrder: 1,
              name: "L2",
              status: "NOT_STARTED",
              approverUserId: null,
              approverRole: "DIRECTOR",
              slaDeadline: null,
              actedAt: null,
              decision: null,
              approver: null,
            },
          ],
        },
      },
      isLoading: false,
    } as any);
    const { container } = render(<ChainTracker invoiceId="inv-1" />);
    // The second step should use muted styling (bg-muted)
    const circles = container.querySelectorAll(".rounded-full");
    const lastCircle = circles[circles.length - 1];
    expect(lastCircle?.className).toContain("bg-muted");
  });
});
