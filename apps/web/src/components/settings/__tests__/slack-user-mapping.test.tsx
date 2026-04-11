import { render, screen } from "@/test/test-utils";
import { SlackUserMapping } from "../slack-user-mapping";

const mockMappings = {
  mappings: [
    {
      userId: "u1",
      user: { id: "u1", name: "Alice", email: "alice@test.com", image: null },
      role: "admin",
      slackLink: null,
      status: "unlinked" as const,
    },
    {
      userId: "u2",
      user: { id: "u2", name: "Bob", email: "bob@test.com", image: null },
      role: "member",
      slackLink: {
        externalLinkId: "el1",
        externalId: "U123",
        externalUrl: null,
        metadata: { displayName: "bob.slack" },
      },
      status: "linked" as const,
    },
  ],
};

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: mockMappings }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    integration: {
      listUserMappings: {
        queryOptions: vi.fn(() => ({ queryKey: ["integration", "listUserMappings"] })),
        queryKey: vi.fn(() => ["integration", "listUserMappings"]),
      },
      unlinkUser: { mutationOptions: vi.fn((o: object) => o) },
      linkUser: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/avatar-initials", () => ({
  getAvatarInitials: (name: string | null, email: string) =>
    name ? name.charAt(0) : email.charAt(0),
}));

describe("SlackUserMapping", () => {
  it("renders heading", () => {
    render(<SlackUserMapping />);
    expect(screen.getByText("User mapping")).toBeInTheDocument();
  });

  it("renders user names", () => {
    render(<SlackUserMapping />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders mapping stats", () => {
    render(<SlackUserMapping />);
    expect(screen.getByText(/of 2 users matched/)).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<SlackUserMapping />);
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders unlink button for linked users", () => {
    render(<SlackUserMapping />);
    expect(screen.getByText("Unlink user")).toBeInTheDocument();
  });

  it("renders link button for unlinked users", () => {
    render(<SlackUserMapping />);
    expect(screen.getByText("Link user")).toBeInTheDocument();
  });
});
