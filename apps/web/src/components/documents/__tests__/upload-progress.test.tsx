import { describe, it, expect, vi } from "vitest";
import { render, screen, setup } from "@/test/test-utils";
import { UploadProgress, type UploadingFile } from "../upload-progress";

function makeFile(overrides: Partial<UploadingFile> = {}): UploadingFile {
  return {
    id: "file-1",
    file: new File(["hello"], "invoice.pdf", { type: "application/pdf" }),
    status: "uploading",
    progress: 50,
    ...overrides,
  };
}

describe("UploadProgress", () => {
  const onRemove = vi.fn();

  it("renders file name", () => {
    render(<UploadProgress file={makeFile()} onRemove={onRemove} />);
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
  });

  it("renders progress bar when uploading", () => {
    render(<UploadProgress file={makeFile()} onRemove={onRemove} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders scanning status when scanning", () => {
    render(
      <UploadProgress
        file={makeFile({ status: "scanning" })}
        onRemove={onRemove}
      />,
    );
    expect(
      screen.getByText("Scanning for threats..."),
    ).toBeInTheDocument();
  });

  it("renders clean status", () => {
    render(
      <UploadProgress
        file={makeFile({ status: "clean" })}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText("Scan passed")).toBeInTheDocument();
  });

  it("renders infected status", () => {
    render(
      <UploadProgress
        file={makeFile({ status: "infected" })}
        onRemove={onRemove}
      />,
    );
    expect(
      screen.getByText("Threat detected - file quarantined"),
    ).toBeInTheDocument();
  });

  it("renders failed scan status", () => {
    render(
      <UploadProgress
        file={makeFile({ status: "failed" })}
        onRemove={onRemove}
      />,
    );
    expect(
      screen.getByText("Scan could not complete"),
    ).toBeInTheDocument();
  });

  it("renders error status", () => {
    render(
      <UploadProgress
        file={makeFile({ status: "error" })}
        onRemove={onRemove}
      />,
    );
    expect(
      screen.getByText("Upload failed. Try again."),
    ).toBeInTheDocument();
  });

  it("renders confirming status as scanning", () => {
    render(
      <UploadProgress
        file={makeFile({ status: "confirming" })}
        onRemove={onRemove}
      />,
    );
    expect(
      screen.getByText("Scanning for threats..."),
    ).toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", async () => {
    const { user } = setup(
      <UploadProgress file={makeFile()} onRemove={onRemove} />,
    );
    const removeButton = screen.getByRole("button");
    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("shows file size", () => {
    render(<UploadProgress file={makeFile()} onRemove={onRemove} />);
    // "hello" = 5 bytes -> "5 B"
    expect(screen.getByText("5 B")).toBeInTheDocument();
  });
});
