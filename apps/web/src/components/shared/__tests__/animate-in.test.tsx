import { render, screen } from "@/test/test-utils";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/lib/motion", () => ({
  springs: { gentle: {} },
  fadeUp: {},
}));

import { AnimateIn } from "../animate-in";

describe("AnimateIn", () => {
  it("renders children", () => {
    render(<AnimateIn>Hello</AnimateIn>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("applies default className with min-w-0", () => {
    render(<AnimateIn>Content</AnimateIn>);
    const el = screen.getByText("Content").closest("div")!;
    expect(el.className).toContain("min-w-0");
  });

  it("merges custom className", () => {
    render(<AnimateIn className="extra-class">Content</AnimateIn>);
    const el = screen.getByText("Content").closest("div")!;
    expect(el.className).toContain("min-w-0");
    expect(el.className).toContain("extra-class");
  });

  it("renders complex children", () => {
    render(
      <AnimateIn>
        <span data-testid="child-a">A</span>
        <span data-testid="child-b">B</span>
      </AnimateIn>,
    );
    expect(screen.getByTestId("child-a")).toBeInTheDocument();
    expect(screen.getByTestId("child-b")).toBeInTheDocument();
  });
});
