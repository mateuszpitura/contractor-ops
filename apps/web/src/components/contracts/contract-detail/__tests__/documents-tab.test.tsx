import { render, screen } from "@/test/test-utils";
import { DocumentsTab } from "../documents-tab";

const mockUseQuery = vi.fn(() => ({
  data: null,
  isLoading: false,
  isFetching: false,
  isPending: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    esign: {
      listConnections: {
        queryOptions: () => ({ queryKey: ["esign", "listConnections"] }),
      },
    },
    document: {
      list: {
        queryOptions: (input: any) => ({ queryKey: ["document", "list", input] }),
      },
    },
  },
}));

vi.mock("@/components/documents/drop-zone", () => ({
  DropZone: () => <div data-testid="drop-zone" />,
}));

vi.mock("@/components/documents/document-list", () => ({
  DocumentList: () => <div data-testid="document-list" />,
}));

vi.mock("../send-for-signature-dialog", () => ({
  SendForSignatureDialog: () => null,
}));

describe("DocumentsTab", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      isPending: false,
    });
  });

  it("renders drop zone", () => {
    render(<DocumentsTab contractId="ct1" />);
    expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
  });

  it("renders document list", () => {
    render(<DocumentsTab contractId="ct1" />);
    expect(screen.getByTestId("document-list")).toBeInTheDocument();
  });

  it("does not show sign buttons when no providers connected", () => {
    render(<DocumentsTab contractId="ct1" />);
    expect(screen.queryByText(/send for signature/i)).not.toBeInTheDocument();
  });

  it("shows sign buttons when provider is connected and documents exist", () => {
    let callIndex = 0;
    mockUseQuery.mockImplementation(() => {
      callIndex++;
      // First call: esign connections
      if (callIndex === 1) {
        return {
          data: [{ id: "conn-1", provider: "DOCUSIGN", status: "active", displayName: null }],
          isLoading: false,
          isFetching: false,
          isPending: false,
        };
      }
      // Second call: documents
      return {
        data: {
          items: [{ id: "doc-1", originalFileName: "contract.pdf" }],
        },
        isLoading: false,
        isFetching: false,
        isPending: false,
      };
    });

    render(<DocumentsTab contractId="ct1" />);
    expect(screen.getByText(/send for signature: contract.pdf/i)).toBeInTheDocument();
  });

  it("renders with contractParties prop", () => {
    render(
      <DocumentsTab
        contractId="ct1"
        contractParties={[
          { name: "Jan", email: "jan@test.com", role: "signer" },
        ]}
      />,
    );
    expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
  });

  it("renders without contractParties prop (defaults to empty)", () => {
    render(<DocumentsTab contractId="ct1" />);
    expect(screen.getByTestId("document-list")).toBeInTheDocument();
  });
});
