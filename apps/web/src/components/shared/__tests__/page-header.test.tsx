import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { PageHeader } from "../page-header";

describe("PageHeader", () => {
  it("renders title and optional description", () => {
    render(<PageHeader title="Settings" description="Manage your organization" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings");
    expect(screen.getByText("Manage your organization")).toBeInTheDocument();
  });

  it("omits description when not provided", () => {
    const { container } = render(<PageHeader title="Invoices" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Invoices");
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders the actions slot", () => {
    render(<PageHeader title="Reports" actions={<button type="button">Export</button>} />);
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});
