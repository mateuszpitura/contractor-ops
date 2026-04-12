import { describe, expect, it } from "vitest";
import { formatAmount, formatMinorUnits } from "../format-currency";

describe("formatMinorUnits", () => {
  it("formats minor units to display with 2 decimal places", () => {
    expect(formatMinorUnits(10050)).toBe("100,50");
  });

  it("formats zero", () => {
    expect(formatMinorUnits(0)).toBe("0,00");
  });

  it("formats single minor unit", () => {
    expect(formatMinorUnits(1)).toBe("0,01");
  });

  it("formats negative amounts", () => {
    expect(formatMinorUnits(-5000)).toBe("-50,00");
  });

  it("formats large amounts with thousands separator", () => {
    // pl-PL uses non-breaking space as thousands separator
    const result = formatMinorUnits(1234567);
    expect(result).toMatch(/12[\s\u00a0]345,67/);
  });

  it("appends currency when provided", () => {
    expect(formatMinorUnits(10050, "PLN")).toBe("100,50 PLN");
  });

  it("appends EUR currency", () => {
    expect(formatMinorUnits(5000, "EUR")).toBe("50,00 EUR");
  });

  it("does not append currency when null", () => {
    expect(formatMinorUnits(10050, null)).toBe("100,50");
  });

  it("does not append currency when undefined", () => {
    expect(formatMinorUnits(10050, undefined)).toBe("100,50");
  });
});

describe("formatAmount", () => {
  it("formats minor units with required currency", () => {
    expect(formatAmount(10050, "PLN")).toBe("100,50 PLN");
  });

  it("formats zero with currency", () => {
    expect(formatAmount(0, "EUR")).toBe("0,00 EUR");
  });

  it("formats negative amounts with currency", () => {
    expect(formatAmount(-5000, "USD")).toBe("-50,00 USD");
  });

  it("formats large amounts with currency", () => {
    const result = formatAmount(1234567, "PLN");
    expect(result).toMatch(/12[\s\u00a0]345,67 PLN/);
  });
});
