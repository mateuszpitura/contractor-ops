import { describe, expect, it } from "vitest";
import { fadeUp, springs, stagger } from "../motion";

describe("motion presets", () => {
  it("defines spring presets with type spring and positive stiffness", () => {
    for (const key of Object.keys(springs) as Array<keyof typeof springs>) {
      const s = springs[key];
      expect(s.type).toBe("spring");
      expect(s.stiffness).toBeGreaterThan(0);
      expect(s.damping).toBeGreaterThan(0);
    }
  });

  it("defines stagger delays in ascending rough order of speed", () => {
    expect(stagger.fast.staggerChildren).toBeLessThan(stagger.default.staggerChildren);
    expect(stagger.default.staggerChildren).toBeLessThan(stagger.slow.staggerChildren);
  });

  it("fadeUp toggles opacity, y, and blur between hidden and visible", () => {
    expect(fadeUp.hidden).toMatchObject({
      opacity: 0,
      y: 12,
    });
    expect(fadeUp.visible).toMatchObject({
      opacity: 1,
      y: 0,
    });
    expect((fadeUp.hidden as { filter?: string }).filter).toContain("blur");
  });
});
