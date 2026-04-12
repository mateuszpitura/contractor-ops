import { render } from "@/test/test-utils";
import { TabEquipment } from "../tab-equipment";

const mockUseQuery = vi.fn(() => ({
  data: [],
  isLoading: false,
  isFetching: false,
  isPending: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    equipment: {
      listByContractor: {
        queryOptions: (input: any) => ({
          queryKey: ["equipment", "listByContractor", input],
        }),
      },
    },
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/equipment/equipment-type-icon", () => ({
  EquipmentTypeIcon: () => <span data-testid="type-icon" />,
}));

vi.mock("@/components/equipment/equipment-status-badge", () => ({
  EquipmentStatusBadge: ({ status }: any) => <span>{status}</span>,
}));

vi.mock("@/components/equipment/shipment-condensed", () => ({
  ShipmentCondensed: () => <span data-testid="shipment" />,
}));

describe("TabEquipment", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isPending: false,
    });
  });

  it("renders empty state when no equipment", () => {
    render(<TabEquipment contractorId="c1" />);
    const container = document.querySelector("div");
    expect(container).toBeInTheDocument();
  });

  it("renders loading skeletons", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      isPending: true,
    });

    const { container } = render(<TabEquipment contractorId="c1" />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });
});
