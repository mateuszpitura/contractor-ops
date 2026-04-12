import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@/test/test-utils";
import { CalendarTaskConfig } from "../calendar-task-config";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    calendar: {
      getTaskConfig: {
        queryOptions: () => ({ queryKey: ["calendar", "getTaskConfig"] }),
        queryKey: () => ["calendar", "getTaskConfig"],
      },
      saveTaskConfig: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

vi.mock("./calendar-event-config-dialog", () => ({
  CalendarEventConfigDialog: () => null,
}));

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

describe("CalendarTaskConfig", () => {
  beforeEach(() => {
    mockedUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  it("shows loading skeleton when loading", () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<CalendarTaskConfig taskTemplateId="t1" />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("shows not configured text when no title template", () => {
    mockedUseQuery.mockReturnValue({
      data: { calendarEnabled: false, duration: "1h", attendees: [] },
      isLoading: false,
    } as any);
    render(<CalendarTaskConfig taskTemplateId="t1" />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("shows summary text when configured", () => {
    mockedUseQuery.mockReturnValue({
      data: { calendarEnabled: true, titleTemplate: "Meeting", duration: "1h", attendees: [] },
      isLoading: false,
    } as any);
    render(<CalendarTaskConfig taskTemplateId="t1" />);
    expect(screen.getByText(/Meeting - 1 hour/)).toBeInTheDocument();
  });

  it("renders configure button", () => {
    mockedUseQuery.mockReturnValue({
      data: { calendarEnabled: false, duration: "1h", attendees: [] },
      isLoading: false,
    } as any);
    render(<CalendarTaskConfig taskTemplateId="t1" />);
    expect(screen.getByText("Configure")).toBeInTheDocument();
  });
});
