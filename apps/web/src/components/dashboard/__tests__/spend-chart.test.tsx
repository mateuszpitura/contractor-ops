import { fireEvent, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { SpendChart } from "../spend-chart";
import { render as renderWithProviders } from "@/test/test-utils";

const { mockSetSpendRange } = vi.hoisted(() => ({
  mockSetSpendRange: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    dashboard: {
      spendTrend: { queryOptions: () => ({ queryKey: ["dashboard", "spendTrend"] }) },
    },
  },
}));

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => ({}) },
  useQueryState: () => ["6", mockSetSpendRange],
}));

vi.mock("recharts", () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: ({ dataKey }: { dataKey?: string }) => (
    <span data-testid={dataKey ? `area-${dataKey}` : "area"} />
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

const mockedUseQuery = vi.mocked(useQuery);

describe("SpendChart", () => {
  beforeEach(() => {
    mockSetSpendRange.mockClear();
  });

  it("shows loading skeleton", () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = renderWithProviders(<SpendChart />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("shows empty state when no data", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByText("No spend data for this period")).toBeInTheDocument();
  });

  it("renders chart title", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByText("Monthly spend")).toBeInTheDocument();
  });

  it("renders range toggle buttons", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByText("6 months")).toBeInTheDocument();
    expect(screen.getByText("12 months")).toBeInTheDocument();
    expect(screen.getByText("Year to date")).toBeInTheDocument();
  });

  it("renders chart when data is available", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { month: "2026-01-01", currency: "PLN", totalMinor: 500000 },
        { month: "2026-02-01", currency: "PLN", totalMinor: 750000 },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area-PLN")).toBeInTheDocument();
  });

  it("renders EUR area when EUR spend is present", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { month: "2026-01-01", currency: "PLN", totalMinor: 500000 },
        { month: "2026-01-01", currency: "EUR", totalMinor: 120000 },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByTestId("area-PLN")).toBeInTheDocument();
    expect(screen.getByTestId("area-EUR")).toBeInTheDocument();
  });

  it("calls spend range setter when selecting 12 months", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<SpendChart />);
    fireEvent.click(screen.getByText("12 months"));
    expect(mockSetSpendRange).toHaveBeenCalledWith("12");
  });

  it("calls spend range setter when selecting YTD", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<SpendChart />);
    fireEvent.click(screen.getByText("Year to date"));
    expect(mockSetSpendRange).toHaveBeenCalledWith("ytd");
  });

  it("does not render EUR area when no EUR data", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { month: "2026-01-01", currency: "PLN", totalMinor: 500000 },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByTestId("area-PLN")).toBeInTheDocument();
    expect(screen.queryByTestId("area-EUR")).not.toBeInTheDocument();
  });

  it("formats multiple months into chart data", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { month: "2026-01-01", currency: "PLN", totalMinor: 100000 },
        { month: "2026-02-01", currency: "PLN", totalMinor: 200000 },
        { month: "2026-03-01", currency: "PLN", totalMinor: 300000 },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("calls spend range setter when selecting 6 months", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<SpendChart />);
    fireEvent.click(screen.getByText("6 months"));
    expect(mockSetSpendRange).toHaveBeenCalledWith("6");
  });

  it("renders chart with PLN data", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { month: "2026-01-01", currency: "PLN", totalMinor: 500000 },
        { month: "2026-02-01", currency: "PLN", totalMinor: 600000 },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area-PLN")).toBeInTheDocument();
  });

  it("renders single month data correctly", () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { month: "2026-03-01", currency: "PLN", totalMinor: 999999 },
      ],
      isLoading: false,
    } as any);
    renderWithProviders(<SpendChart />);
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area-PLN")).toBeInTheDocument();
  });

  it("renders three range toggle buttons", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as any);
    renderWithProviders(<SpendChart />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });
});
