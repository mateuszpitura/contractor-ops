import { render, screen } from "@/test/test-utils";
import { UsersTable } from "../users-table";

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ can: () => true }),
}));

const mockMembers = [
  { id: "u1", userId: "u1", name: "Alice Smith", email: "alice@test.com", role: "admin", status: "active" },
  { id: "u2", userId: "u2", name: "Bob Jones", email: "bob@test.com", role: "readonly", status: "invited" },
];

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: mockMembers }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    user: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ["user", "list"] })),
        queryKey: vi.fn(() => ["user", "list"]),
      },
      updateRole: { mutationOptions: vi.fn((o: object) => o) },
      reactivate: { mutationOptions: vi.fn((o: object) => o) },
      deactivate: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/settings/deactivate-dialog", () => ({
  DeactivateDialog: () => null,
}));

describe("UsersTable", () => {
  it("renders table headers", () => {
    render(<UsersTable />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders user names", () => {
    render(<UsersTable />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("renders user emails", () => {
    render(<UsersTable />);
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
  });

  it("renders deactivate button for active users", () => {
    render(<UsersTable />);
    expect(screen.getAllByText("Deactivate").length).toBeGreaterThan(0);
  });
});
