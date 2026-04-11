import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { NipValidationBadge, validateNip } from "../nip-validation-badge";

describe("validateNip", () => {
  it("returns true for a valid NIP", () => {
    // 1234563218 is a known valid NIP (checksum passes)
    expect(validateNip("1234563218")).toBe(true);
  });

  it("returns false for an invalid NIP checksum", () => {
    expect(validateNip("1234567890")).toBe(false);
  });

  it("returns false for non-10-digit input", () => {
    expect(validateNip("12345")).toBe(false);
    expect(validateNip("12345678901")).toBe(false);
    expect(validateNip("abcdefghij")).toBe(false);
  });

  it("strips spaces and dashes before validating", () => {
    expect(validateNip("123-456-32-18")).toBe(true);
    expect(validateNip("123 456 32 18")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(validateNip("")).toBe(false);
  });
});

describe("NipValidationBadge", () => {
  it("returns null for null nip", () => {
    const { container } = render(<NipValidationBadge nip={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null for empty string nip", () => {
    const { container } = render(<NipValidationBadge nip="" />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null for whitespace-only nip", () => {
    const { container } = render(<NipValidationBadge nip="   " />);
    expect(container.firstChild).toBeNull();
  });

  it("renders valid badge for valid NIP", () => {
    render(<NipValidationBadge nip="1234563218" />);
    expect(screen.getByText("Valid NIP format")).toBeInTheDocument();
  });

  it("renders invalid badge for invalid NIP", () => {
    render(<NipValidationBadge nip="1234567890" />);
    expect(screen.getByText("Invalid NIP format")).toBeInTheDocument();
  });
});
