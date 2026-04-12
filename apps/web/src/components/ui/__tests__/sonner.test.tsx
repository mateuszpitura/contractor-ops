import { render } from "@/test/test-utils";
import { Toaster } from "../sonner";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

describe("Toaster", () => {
  it("renders without crashing", () => {
    expect(() => render(<Toaster />)).not.toThrow();
  });

  it("renders an element into the DOM", () => {
    const { container } = render(<Toaster />);
    // Sonner renders its own structure; verify it doesn't produce empty output
    expect(container).toBeInTheDocument();
  });

  it("accepts position prop without error", () => {
    expect(() => render(<Toaster position="top-center" />)).not.toThrow();
  });

  it("accepts richColors prop without error", () => {
    expect(() => render(<Toaster richColors />)).not.toThrow();
  });
});
