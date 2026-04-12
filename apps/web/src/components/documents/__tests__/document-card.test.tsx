import { render, screen } from "@/test/test-utils";
import { DocumentCard } from "../document-card";

vi.mock("../pdf-preview", () => ({
  PdfPreview: () => null,
}));
vi.mock("../version-history", () => ({
  VersionHistory: () => null,
}));
vi.mock("@/trpc/init", () => ({ trpc: {} }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    originalFileName: "contract-v1.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 2048,
    virusScanStatus: "CLEAN",
    createdAt: "2026-03-15T10:00:00Z",
    uploadedByUserId: "user-1",
    status: "ACTIVE",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DocumentCard", () => {
  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it("renders filename", () => {
    render(<DocumentCard document={makeDocument()} />);

    expect(screen.getByText("contract-v1.pdf")).toBeInTheDocument();
  });

  it("renders formatted date", () => {
    render(<DocumentCard document={makeDocument()} />);

    expect(screen.getByText("Mar 15, 2026")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // File size formatting
  // -------------------------------------------------------------------------

  it("formats file size in bytes", () => {
    render(<DocumentCard document={makeDocument({ fileSizeBytes: 512 })} />);

    expect(screen.getByText("512 B")).toBeInTheDocument();
  });

  it("formats file size in KB", () => {
    render(<DocumentCard document={makeDocument({ fileSizeBytes: 5120 })} />);

    expect(screen.getByText("5.0 KB")).toBeInTheDocument();
  });

  it("formats file size in MB", () => {
    render(<DocumentCard document={makeDocument({ fileSizeBytes: 2_621_440 })} />);

    expect(screen.getByText("2.5 MB")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Version badge
  // -------------------------------------------------------------------------

  it("shows version badge when versionNumber is provided", () => {
    render(<DocumentCard document={makeDocument()} versionNumber={3} />);

    expect(screen.getByText("Version 3")).toBeInTheDocument();
  });

  it("does NOT show version badge when versionNumber is not provided", () => {
    render(<DocumentCard document={makeDocument()} />);

    expect(screen.queryByText(/Version/)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Scan status
  // -------------------------------------------------------------------------

  it("shows scan status for PENDING", () => {
    render(<DocumentCard document={makeDocument({ virusScanStatus: "PENDING" })} />);

    expect(screen.getByText("Scanning for threats...")).toBeInTheDocument();
  });

  it("shows scan status for CLEAN", () => {
    render(<DocumentCard document={makeDocument({ virusScanStatus: "CLEAN" })} />);

    expect(screen.getByText("Scan passed")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Preview button
  // -------------------------------------------------------------------------

  it("shows preview button for PDF mime type", () => {
    render(<DocumentCard document={makeDocument()} />);

    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("does NOT show preview button for non-PDF", () => {
    render(<DocumentCard document={makeDocument({ mimeType: "image/png" })} />);

    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });

  it("does NOT show preview button for infected PDF", () => {
    render(<DocumentCard document={makeDocument({ virusScanStatus: "INFECTED" })} />);

    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Download button
  // -------------------------------------------------------------------------

  it("disables download when infected", () => {
    render(<DocumentCard document={makeDocument({ virusScanStatus: "INFECTED" })} />);

    const downloadButton = screen.getByText("Download").closest("button");
    expect(downloadButton).toBeDisabled();
  });

  it("enables download when clean", () => {
    render(<DocumentCard document={makeDocument()} />);

    const downloadButton = screen.getByText("Download").closest("button");
    expect(downloadButton).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Upload new version button
  // -------------------------------------------------------------------------

  it("shows upload button when onUploadNewVersion provided and status is ACTIVE", () => {
    render(<DocumentCard document={makeDocument()} onUploadNewVersion={vi.fn()} />);

    expect(screen.getByText("Upload new version")).toBeInTheDocument();
  });

  it("does NOT show upload button when onUploadNewVersion not provided", () => {
    render(<DocumentCard document={makeDocument()} />);

    expect(screen.queryByText("Upload new version")).not.toBeInTheDocument();
  });

  it("does NOT show upload button when status is not ACTIVE", () => {
    render(
      <DocumentCard
        document={makeDocument({ status: "SUPERSEDED" })}
        onUploadNewVersion={vi.fn()}
      />,
    );

    expect(screen.queryByText("Upload new version")).not.toBeInTheDocument();
  });
});
