import { render } from "@/test/test-utils";
import { EquipmentTypeIcon } from "../equipment-type-icon";

describe("EquipmentTypeIcon", () => {
  const KNOWN_TYPES = ["LAPTOP", "MONITOR", "PHONE", "HEADSET", "KEYBOARD", "MOUSE", "OTHER"];

  it.each(KNOWN_TYPES)("renders without crashing for type %s", (type) => {
    const { container } = render(<EquipmentTypeIcon type={type} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders fallback icon for unknown type", () => {
    const { container } = render(<EquipmentTypeIcon type="DOCKING_STATION" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies default classes", () => {
    const { container } = render(<EquipmentTypeIcon type="LAPTOP" />);
    const svg = container.querySelector("svg")!;
    expect(svg.className.baseVal || svg.getAttribute("class")).toContain("h-4");
  });

  it("merges custom className", () => {
    const { container } = render(<EquipmentTypeIcon type="LAPTOP" className="text-red-500" />);
    const svg = container.querySelector("svg")!;
    const cls = svg.className.baseVal || svg.getAttribute("class") || "";
    expect(cls).toContain("text-red-500");
  });
});
