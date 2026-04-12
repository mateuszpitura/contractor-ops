import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, setup } from "@/test/test-utils";
import { downloadBase64File, ExportButtons } from "../export-buttons";

describe("ExportButtons", () => {
  const defaultProps = {
    onExportPage: vi.fn(),
    onExportAll: vi.fn(),
    isExporting: false,
  };

  it("renders export page and export all buttons", () => {
    render(<ExportButtons {...defaultProps} />);
    expect(screen.getByText("Export page")).toBeInTheDocument();
    expect(screen.getByText("Export all")).toBeInTheDocument();
  });

  it("calls onExportPage when export page is clicked", async () => {
    const onExportPage = vi.fn();
    const { user } = setup(<ExportButtons {...defaultProps} onExportPage={onExportPage} />);
    await user.click(screen.getByText("Export page"));
    expect(onExportPage).toHaveBeenCalledTimes(1);
  });

  it("calls onExportAll when export all is clicked", async () => {
    const onExportAll = vi.fn();
    const { user } = setup(<ExportButtons {...defaultProps} onExportAll={onExportAll} />);
    await user.click(screen.getByText("Export all"));
    expect(onExportAll).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons when isExporting is true", () => {
    render(<ExportButtons {...defaultProps} isExporting />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("shows icons in buttons", () => {
    const { container } = render(<ExportButtons {...defaultProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("shows loading spinners on both buttons when isExporting", () => {
    const { container } = render(<ExportButtons {...defaultProps} isExporting />);
    const spinners = container.querySelectorAll(".animate-spin");
    expect(spinners).toHaveLength(2);
  });
});

describe("downloadBase64File", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates and clicks a download link", () => {
    const mockClick = vi.fn();
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: mockClick,
    } as unknown as HTMLAnchorElement);

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });

    downloadBase64File(btoa("test-data"), "report.csv", "text/csv");

    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
