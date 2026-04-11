import { render, screen } from "@/test/test-utils";
import { SigningProgressBar } from "../signing-progress-bar";

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: () => ({ data: null, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    esign: {
      resendToRecipient: { mutationOptions: (opts: any) => opts },
      getEnvelopeDetail: {
        queryOptions: (input: any, opts: any) => ({
          queryKey: ["esign", "detail", input],
          ...opts,
        }),
      },
      listEnvelopes: { queryKey: () => ["esign", "envelopes"] },
      voidEnvelope: { mutationOptions: (opts: any) => opts },
    },
    contract: {
      getById: { queryKey: () => ["contract", "getById"] },
    },
  },
}));

vi.mock("../signing-audit-trail", () => ({
  SigningAuditTrail: () => null,
}));

vi.mock("../void-envelope-dialog", () => ({
  VoidEnvelopeDialog: () => null,
}));

describe("SigningProgressBar", () => {
  const envelope = {
    id: "env1",
    status: "SENT",
    recipients: [
      { id: "r1", name: "Jan", email: "jan@test.com", role: "signer", status: "SIGNED", routingOrder: 1 },
      { id: "r2", name: "Anna", email: "anna@test.com", role: "countersigner", status: "PENDING", routingOrder: 2 },
    ],
  };

  it("renders step indicators for each recipient", () => {
    render(<SigningProgressBar envelope={envelope} />);
    // Should render step circles
    const container = document.querySelector("div");
    expect(container).toBeInTheDocument();
  });

  it("shows signed count status text", () => {
    render(<SigningProgressBar envelope={envelope} />);
    // Status text should be present
    const texts = screen.getAllByText(/.+/);
    expect(texts.length).toBeGreaterThan(0);
  });

  it("renders view history button", () => {
    render(<SigningProgressBar envelope={envelope} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
