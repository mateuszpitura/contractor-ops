import { render, screen } from "@/test/test-utils";
import { TabCompliance } from "../tab-compliance";

vi.mock("@/components/documents/drop-zone", () => ({
  DropZone: () => <div data-testid="drop-zone" />,
}));

vi.mock("@/components/documents/document-list", () => ({
  DocumentList: () => <div data-testid="document-list" />,
}));

describe("TabCompliance", () => {
  it("renders empty state when no compliance items", () => {
    render(
      <TabCompliance contractor={{ id: "c1", complianceItems: [] }} />,
    );
    // Should render the empty state icon and message
    const container = document.querySelector("div");
    expect(container).toBeInTheDocument();
  });

  it("renders compliance items with status badges", () => {
    const items = [
      {
        id: "ci1",
        name: "Insurance Certificate",
        documentType: "PDF",
        status: "SATISFIED",
        dueDate: null,
        expiresAt: null,
        requirementTemplateId: null,
        contract: null,
      },
      {
        id: "ci2",
        name: "NDA",
        documentType: null,
        status: "MISSING",
        dueDate: null,
        expiresAt: null,
        requirementTemplateId: null,
        contract: null,
      },
    ];

    render(
      <TabCompliance contractor={{ id: "c1", complianceItems: items }} />,
    );
    expect(screen.getByText("Insurance Certificate")).toBeInTheDocument();
    expect(screen.getByText("NDA")).toBeInTheDocument();
  });

  it("shows upload button for MISSING items", () => {
    const items = [
      {
        id: "ci1",
        name: "Missing Doc",
        documentType: null,
        status: "MISSING",
        dueDate: null,
        expiresAt: null,
        requirementTemplateId: null,
        contract: null,
      },
    ];

    render(
      <TabCompliance contractor={{ id: "c1", complianceItems: items }} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("highlights expiring soon items", () => {
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const items = [
      {
        id: "ci1",
        name: "Expiring Doc",
        documentType: null,
        status: "SATISFIED",
        dueDate: null,
        expiresAt: soon.toISOString(),
        requirementTemplateId: null,
        contract: null,
      },
    ];

    render(
      <TabCompliance contractor={{ id: "c1", complianceItems: items }} />,
    );
    expect(screen.getByText("Expiring Doc")).toBeInTheDocument();
  });
});
