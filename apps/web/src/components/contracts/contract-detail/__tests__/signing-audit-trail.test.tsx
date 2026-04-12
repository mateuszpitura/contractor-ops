import { render, screen } from "@/test/test-utils";
import { SigningAuditTrail } from "../signing-audit-trail";

const mockUseQuery = vi.fn(() => ({
  data: null,
  isPending: false,
  isLoading: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    esign: {
      getEnvelopeDetail: {
        queryOptions: (input: any, opts: any) => ({
          queryKey: ["esign", "detail", input],
          ...opts,
        }),
      },
    },
  },
}));

describe("SigningAuditTrail", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: null,
      isPending: false,
      isLoading: false,
    });
  });

  it("renders empty state when no events", () => {
    render(<SigningAuditTrail envelopeId="env1" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("No Signing History")).toBeInTheDocument();
  });

  it("renders events when data is available", () => {
    mockUseQuery.mockReturnValue({
      data: {
        events: [
          {
            id: "e1",
            eventType: "ENVELOPE_SENT",
            description: "Envelope sent to signer",
            actorName: "Jan",
            occurredAt: new Date().toISOString(),
          },
        ],
      },
      isPending: false,
      isLoading: false,
    });

    render(<SigningAuditTrail envelopeId="env1" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Envelope sent to signer")).toBeInTheDocument();
    expect(screen.getByText("Jan")).toBeInTheDocument();
  });
});
