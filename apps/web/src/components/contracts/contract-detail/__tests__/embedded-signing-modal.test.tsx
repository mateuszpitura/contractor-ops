import { render, screen, setup } from "@/test/test-utils";
import { EmbeddedSigningModal } from "../embedded-signing-modal";

const mockedUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockedUseQuery(...args),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    esign: {
      getSigningUrl: {
        queryOptions: (input: any, opts: any) => ({
          queryKey: ["esign", "getSigningUrl", input],
          ...opts,
        }),
      },
      getPortalSigningUrl: {
        queryOptions: (input: any, opts: any) => ({
          queryKey: ["esign", "getPortalSigningUrl", input],
          ...opts,
        }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("EmbeddedSigningModal", () => {
  const defaultProps = {
    envelopeId: "env1",
    recipientEmail: "signer@example.com",
    documentTitle: "Contract.pdf",
    provider: "DOCUSIGN" as const,
    open: true,
    onOpenChange: vi.fn(),
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseQuery.mockReturnValue({
      data: null,
      isPending: true,
      isLoading: true,
    });
  });

  it("returns null when not open", () => {
    const { container } = render(<EmbeddedSigningModal {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders document title in top bar when open", () => {
    render(<EmbeddedSigningModal {...defaultProps} />);
    expect(screen.getByText("Contract.pdf")).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(<EmbeddedSigningModal {...defaultProps} />);
    const closeButton = screen.getByRole("button");
    expect(closeButton).toBeInTheDocument();
  });

  it("shows loading state when query is pending", () => {
    render(<EmbeddedSigningModal {...defaultProps} />);
    expect(screen.getByText(/preparing/i)).toBeInTheDocument();
  });

  it("renders iframe when embedded signing URL is available", () => {
    mockedUseQuery.mockReturnValue({
      data: { embedded: true, url: "https://sign.example.com/embed" },
      isPending: false,
      isLoading: false,
    });
    render(<EmbeddedSigningModal {...defaultProps} />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute("src")).toBe("https://sign.example.com/embed");
  });

  it("renders redirect fallback for non-embedded URL with AUTENTI provider", () => {
    mockedUseQuery.mockReturnValue({
      data: { embedded: false, url: "https://sign.example.com/redirect" },
      isPending: false,
      isLoading: false,
    });
    render(<EmbeddedSigningModal {...defaultProps} provider="AUTENTI" />);
    expect(screen.getByText("Autenti")).toBeInTheDocument();
  });

  it("renders redirect message for non-embedded URL", () => {
    mockedUseQuery.mockReturnValue({
      data: { embedded: false, url: "https://sign.example.com/redirect" },
      isPending: false,
      isLoading: false,
    });
    render(<EmbeddedSigningModal {...defaultProps} provider="AUTENTI" />);
    expect(screen.getByText(/continue.*autenti/i)).toBeInTheDocument();
    expect(screen.getByText(/return to contract/i)).toBeInTheDocument();
  });

  it("renders error state when no URL is available", () => {
    mockedUseQuery.mockReturnValue({
      data: { embedded: false, url: undefined },
      isPending: false,
      isLoading: false,
    });
    render(<EmbeddedSigningModal {...defaultProps} />);
    expect(screen.getByText(/unable to load/i)).toBeInTheDocument();
    expect(screen.getByText(/return to contract/i)).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when close button is clicked", async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<EmbeddedSigningModal {...defaultProps} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders error state return button that calls onOpenChange", async () => {
    mockedUseQuery.mockReturnValue({
      data: { embedded: false, url: undefined },
      isPending: false,
      isLoading: false,
    });
    const onOpenChange = vi.fn();
    const { user } = setup(<EmbeddedSigningModal {...defaultProps} onOpenChange={onOpenChange} />);
    const returnBtn = screen.getByText(/return to contract/i);
    await user.click(returnBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders iframe with correct title attribute", () => {
    mockedUseQuery.mockReturnValue({
      data: { embedded: true, url: "https://sign.example.com/embed" },
      isPending: false,
      isLoading: false,
    });
    render(<EmbeddedSigningModal {...defaultProps} />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("title");
  });

  it("renders redirect fallback with DOCUSIGN provider text", () => {
    mockedUseQuery.mockReturnValue({
      data: { embedded: false, url: "https://sign.example.com/redirect" },
      isPending: false,
      isLoading: false,
    });
    render(<EmbeddedSigningModal {...defaultProps} provider="DOCUSIGN" />);
    expect(screen.getByText("Complete Signing")).toBeInTheDocument();
  });
});
