import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import {
  ConfluenceBrandIcon,
  GoogleCalendarBrandIcon,
  JiraBrandIcon,
  LinearBrandIcon,
  NotionBrandIcon,
  OutlookCalendarBrandIcon,
  SlackBrandIcon,
} from "../brand-icons";

describe("BrandIcons", () => {
  it("renders SlackBrandIcon with aria-hidden", () => {
    const { container } = render(<SlackBrandIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders JiraBrandIcon with aria-hidden", () => {
    const { container } = render(<JiraBrandIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders LinearBrandIcon with aria-hidden", () => {
    const { container } = render(<LinearBrandIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders GoogleCalendarBrandIcon with aria-hidden", () => {
    const { container } = render(<GoogleCalendarBrandIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders NotionBrandIcon with aria-hidden", () => {
    const { container } = render(<NotionBrandIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders ConfluenceBrandIcon with aria-hidden", () => {
    const { container } = render(<ConfluenceBrandIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders OutlookCalendarBrandIcon with aria-hidden", () => {
    const { container } = render(<OutlookCalendarBrandIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom className to SlackBrandIcon", () => {
    const { container } = render(<SlackBrandIcon className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("custom-class")).toBe(true);
  });

  it("applies custom className to JiraBrandIcon", () => {
    const { container } = render(<JiraBrandIcon className="size-8" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("size-8")).toBe(true);
  });
});
