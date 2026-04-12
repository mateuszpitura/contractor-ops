import { describe, expect, it } from "vitest";
import { render } from "@/test/test-utils";
import {
  ConfluenceIcon,
  GoogleCalendarIcon,
  LinearIcon,
  NotionIcon,
  OutlookCalendarIcon,
} from "../provider-icons";

describe("ProviderIcons (re-exports from brand-icons)", () => {
  it("renders GoogleCalendarIcon", () => {
    const { container } = render(<GoogleCalendarIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders LinearIcon", () => {
    const { container } = render(<LinearIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders NotionIcon", () => {
    const { container } = render(<NotionIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders ConfluenceIcon", () => {
    const { container } = render(<ConfluenceIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders OutlookCalendarIcon", () => {
    const { container } = render(<OutlookCalendarIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies className to each icon", () => {
    const { container } = render(<NotionIcon className="test-cls" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("test-cls")).toBe(true);
  });
});
