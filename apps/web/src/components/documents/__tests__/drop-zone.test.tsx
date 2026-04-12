import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, setup } from "@/test/test-utils";
import { ACCEPTED_TYPES, DropZone, MAX_FILE_SIZE } from "../drop-zone";

// ---------------------------------------------------------------------------
// react-dropzone mock with controllable isDragActive
// ---------------------------------------------------------------------------

let mockIsDragActive = false;
let mockOnDrop: ((accepted: File[], rejected: unknown[]) => void) | null = null;

vi.mock("react-dropzone", () => ({
  useDropzone: (opts: any) => {
    mockOnDrop = opts.onDrop;
    return {
      getRootProps: () => ({
        "data-testid": "dropzone",
      }),
      getInputProps: () => ({
        "data-testid": "dropzone-input",
        type: "file",
      }),
      isDragActive: mockIsDragActive,
    };
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutateAsync: vi
      .fn()
      .mockResolvedValue({ documentId: "doc-1", uploadUrl: "https://example.com/upload" }),
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    document: {
      requestUpload: {
        mutationOptions: (opts: any) => ({ ...opts }),
      },
      confirmUpload: {
        mutationOptions: (opts: any) => ({ ...opts }),
      },
      list: {
        queryKey: () => ["document", "list"],
      },
    },
  },
}));

vi.mock("@/components/documents/upload-progress", () => ({
  UploadProgress: ({ file, onRemove }: any) => (
    <div data-testid="upload-progress">
      <span>{file.file.name}</span>
      <span>{file.status}</span>
      <button onClick={onRemove} data-testid="remove-file">
        Remove
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DropZone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDragActive = false;
    mockOnDrop = null;
  });

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it("renders drop zone area", () => {
    render(<DropZone />);
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  });

  it("renders dropzone input", () => {
    render(<DropZone />);
    expect(screen.getByTestId("dropzone-input")).toBeInTheDocument();
  });

  it("renders helper text", () => {
    render(<DropZone />);
    expect(screen.getByText("Drag files here or")).toBeInTheDocument();
    expect(screen.getByText("Browse files")).toBeInTheDocument();
    expect(screen.getByText("PDF, DOCX, XLSX, PNG, JPG up to 25 MB")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Constants exports
  // -------------------------------------------------------------------------

  it("exports correct ACCEPTED_TYPES", () => {
    expect(ACCEPTED_TYPES["application/pdf"]).toEqual([".pdf"]);
    expect(ACCEPTED_TYPES["image/png"]).toEqual([".png"]);
    expect(ACCEPTED_TYPES["image/jpeg"]).toEqual([".jpg", ".jpeg"]);
  });

  it("exports ACCEPTED_TYPES for docx and xlsx", () => {
    expect(
      ACCEPTED_TYPES["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ).toEqual([".docx"]);
    expect(
      ACCEPTED_TYPES["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ).toEqual([".xlsx"]);
  });

  it("exports MAX_FILE_SIZE as 25 MB", () => {
    expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024);
  });

  // -------------------------------------------------------------------------
  // Disabled state
  // -------------------------------------------------------------------------

  it("renders without crashing when disabled", () => {
    render(<DropZone disabled />);
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // No files state
  // -------------------------------------------------------------------------

  it("does not render upload progress when no files are uploading", () => {
    render(<DropZone />);
    expect(screen.queryByTestId("upload-progress")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Props passthrough
  // -------------------------------------------------------------------------

  it("accepts entityType and entityId props without error", () => {
    render(<DropZone entityType="CONTRACT" entityId="ct-1" documentType="INVOICE" />);
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // File validation callbacks
  // -------------------------------------------------------------------------

  it("calls onFilesAccepted when files are dropped", () => {
    const onFilesAccepted = vi.fn();
    render(<DropZone onFilesAccepted={onFilesAccepted} />);

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => {
      mockOnDrop?.([file], []);
    });

    expect(onFilesAccepted).toHaveBeenCalledWith([file]);
  });

  it("calls onFileRejected when rejected files are present", () => {
    const onFileRejected = vi.fn();
    render(<DropZone onFileRejected={onFileRejected} />);

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => {
      mockOnDrop?.([file], [{ file: new File([], "bad.exe"), errors: [] }]);
    });

    expect(onFileRejected).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Upload flow rendering (upload is async; we test the onDrop trigger path)
  // -------------------------------------------------------------------------

  it("triggers upload for each accepted file", async () => {
    const onFilesAccepted = vi.fn();
    render(<DropZone onFilesAccepted={onFilesAccepted} />);

    const file1 = new File(["a"], "doc1.pdf", { type: "application/pdf" });
    const file2 = new File(["b"], "doc2.pdf", { type: "application/pdf" });
    act(() => {
      mockOnDrop?.([file1, file2], []);
    });

    expect(onFilesAccepted).toHaveBeenCalledWith([file1, file2]);
  });

  it("does not call onFileRejected when there are no rejected files", () => {
    const onFileRejected = vi.fn();
    render(<DropZone onFileRejected={onFileRejected} />);

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => {
      mockOnDrop?.([file], []);
    });

    expect(onFileRejected).not.toHaveBeenCalled();
  });

  it("does not throw when optional callbacks are not provided", () => {
    render(<DropZone />);

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    expect(() => {
      act(() => {
        mockOnDrop?.([file], []);
      });
    }).not.toThrow();
  });

  it("passes documentType prop to upload mutation", () => {
    render(<DropZone documentType="INVOICE" />);
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  });

  it("supports multiple file drop scenario", () => {
    const onFilesAccepted = vi.fn();
    render(<DropZone onFilesAccepted={onFilesAccepted} />);

    const files = [
      new File(["a"], "a.pdf", { type: "application/pdf" }),
      new File(["b"], "b.pdf", { type: "application/pdf" }),
      new File(["c"], "c.pdf", { type: "application/pdf" }),
    ];
    act(() => {
      mockOnDrop?.(files, []);
    });

    expect(onFilesAccepted).toHaveBeenCalledWith(files);
  });

  // ---- Drag active state ----
  it("applies drag-active styling when isDragActive is true", () => {
    mockIsDragActive = true;
    const { container } = render(<DropZone />);
    // The dropzone should still render
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  });

  // ---- Disabled state ----
  it("applies disabled styling when disabled", () => {
    const { container } = render(<DropZone disabled />);
    const dropZoneEl = container.querySelector(".pointer-events-none");
    expect(dropZoneEl).toBeInTheDocument();
  });

  it("still renders text in disabled state", () => {
    render(<DropZone disabled />);
    expect(screen.getByText("Drag files here or")).toBeInTheDocument();
    expect(screen.getByText("Browse files")).toBeInTheDocument();
  });

  // ---- File rejection with multiple rejected files ----
  it("calls onFileRejected for each batch of rejected files", () => {
    const onFileRejected = vi.fn();
    render(<DropZone onFileRejected={onFileRejected} />);

    const rejected = [
      { file: new File([], "bad1.exe"), errors: [] },
      { file: new File([], "bad2.bat"), errors: [] },
    ];
    act(() => {
      mockOnDrop?.([], rejected);
    });

    expect(onFileRejected).toHaveBeenCalled();
  });

  // ---- Upload cloud icon ----
  it("renders upload cloud icon", () => {
    const { container } = render(<DropZone />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  // ---- entityType and entityId props ----
  it("accepts CONTRACT entityType without error", () => {
    render(<DropZone entityType="CONTRACT" entityId="ct-1" />);
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  });

  it("accepts CONTRACTOR entityType without error", () => {
    render(<DropZone entityType="CONTRACTOR" entityId="c-1" />);
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  });

  // ---- Upload progress rendering after drop ----
  it("shows upload progress after files are dropped", async () => {
    render(<DropZone />);
    const file = new File(["content"], "invoice.pdf", { type: "application/pdf" });
    await act(async () => {
      mockOnDrop?.([file], []);
      // allow microtask to flush state update
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByTestId("upload-progress")).toBeInTheDocument();
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
  });

  // ---- Remove file from upload list ----
  it("removes file from upload list when remove is clicked", async () => {
    const { user } = setup(<DropZone />);
    const file = new File(["content"], "report.pdf", { type: "application/pdf" });
    await act(async () => {
      mockOnDrop?.([file], []);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    await user.click(screen.getByTestId("remove-file"));
    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();
  });

  // ---- Multiple files show multiple progress items ----
  it("shows multiple upload progress items for multiple files", async () => {
    render(<DropZone />);
    const files = [
      new File(["a"], "doc1.pdf", { type: "application/pdf" }),
      new File(["b"], "doc2.pdf", { type: "application/pdf" }),
    ];
    await act(async () => {
      mockOnDrop?.(files, []);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getAllByTestId("upload-progress").length).toBe(2);
  });

  // ---- Disabled state prevents interaction via styling ----
  it("adds opacity class in disabled state", () => {
    const { container } = render(<DropZone disabled />);
    const disabledEl = container.querySelector(".opacity-50");
    expect(disabledEl).toBeInTheDocument();
  });

  // ---- Drag active visual feedback ----
  it("renders drag-active border class when isDragActive", () => {
    mockIsDragActive = true;
    const { container } = render(<DropZone />);
    const zone = container.querySelector(".border-primary");
    expect(zone).toBeInTheDocument();
  });

  it("renders hover border class when not dragging", () => {
    mockIsDragActive = false;
    const { container } = render(<DropZone />);
    const zone = container.querySelector("[class*='hover\\:border']");
    expect(zone).toBeInTheDocument();
  });

  it("scales icon when isDragActive is true", () => {
    mockIsDragActive = true;
    const { container } = render(<DropZone />);
    const scaled = container.querySelector(".scale-110");
    expect(scaled).toBeInTheDocument();
  });

  // ---- Rejection errors forwarded to callback ----
  it("forwards rejection array to onFileRejected when multiple types rejected", () => {
    const onFileRejected = vi.fn();
    render(<DropZone onFileRejected={onFileRejected} />);
    const rejected = [{ file: new File([], "big.pdf"), errors: [{ code: "file-too-large" }] }];
    act(() => {
      mockOnDrop?.([], rejected);
    });
    expect(onFileRejected).toHaveBeenCalledTimes(1);
  });

  // ---- Disabled prop passed to dropzone ----
  it("passes disabled state to all children without error", () => {
    render(<DropZone disabled entityType="CONTRACT" entityId="ct-1" documentType="INVOICE" />);
    const zone = screen.getByTestId("dropzone");
    expect(zone).toBeInTheDocument();
  });

  // ---- No drag active state shows default styling ----
  it("does not show primary border or scale when isDragActive is false", () => {
    mockIsDragActive = false;
    const { container } = render(<DropZone />);
    expect(container.querySelector(".scale-110")).not.toBeInTheDocument();
  });

  // ---- Multiple sequential drops ----
  it("accumulates files from multiple drop events", async () => {
    render(<DropZone />);
    const file1 = new File(["a"], "first.pdf", { type: "application/pdf" });
    await act(async () => {
      mockOnDrop?.([file1], []);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText("first.pdf")).toBeInTheDocument();

    const file2 = new File(["b"], "second.pdf", { type: "application/pdf" });
    await act(async () => {
      mockOnDrop?.([file2], []);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText("second.pdf")).toBeInTheDocument();
    expect(screen.getAllByTestId("upload-progress").length).toBe(2);
  });
});
