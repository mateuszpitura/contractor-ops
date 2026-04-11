import { render, screen } from "@/test/test-utils";
import { useQuery } from "@tanstack/react-query";
import { DeadlinesWidget } from "../deadlines-widget";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    dashboard: {
      deadlines: { queryOptions: () => ({ queryKey: ["dashboard", "deadlines"] }) },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

const mockedUseQuery = vi.mocked(useQuery);

describe("DeadlinesWidget", () => {
  it("shows loading skeletons", () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<DeadlinesWidget />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("shows empty state when no deadlines", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    render(<DeadlinesWidget />);
    expect(screen.getByText("No upcoming deadlines")).toBeInTheDocument();
  });

  it("renders widget title", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    render(<DeadlinesWidget />);
    expect(screen.getByText("Upcoming deadlines")).toBeInTheDocument();
  });

  it("renders deadline items with entity name", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        {
          type: "CONTRACT_EXPIRING",
          entityId: "c1",
          entityName: "NDA with Acme",
          daysRemaining: 14,
        },
      ],
      isLoading: false,
    } as any);
    render(<DeadlinesWidget />);
    expect(screen.getByText("NDA with Acme")).toBeInTheDocument();
  });

  it("renders see all link", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    render(<DeadlinesWidget />);
    expect(screen.getByText("See all deadlines")).toBeInTheDocument();
  });

  it("renders overdue task with daysOverdue copy and workflows link", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        {
          type: "TASK_OVERDUE",
          entityId: "run-1",
          entityName: "Sign contract",
          daysOverdue: 3,
        },
      ],
      isLoading: false,
    } as any);
    render(<DeadlinesWidget />);
    expect(screen.getByText("Sign contract")).toBeInTheDocument();
    expect(screen.getByText("Overdue by 3 days")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Sign contract" });
    expect(link.getAttribute("href")).toBe("/workflows?tab=my-tasks");
  });

  it("links invoice due items to the invoice detail route", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        {
          type: "INVOICE_DUE",
          entityId: "inv-99",
          entityName: "FV/2026/01",
          daysRemaining: 2,
        },
      ],
      isLoading: false,
    } as any);
    render(<DeadlinesWidget />);
    const link = screen.getByRole("link", { name: "FV/2026/01" });
    expect(link.getAttribute("href")).toBe("/invoices/inv-99");
    expect(screen.getByText("In 2 days")).toBeInTheDocument();
  });
});
