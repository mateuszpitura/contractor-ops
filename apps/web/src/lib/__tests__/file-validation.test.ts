import { describe, expect, it } from "vitest";
import { validateBankStatementFile } from "../file-validation";

function createMockFile(name: string, size: number): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name);
}

describe("validateBankStatementFile", () => {
  it("accepts .mt940 files", () => {
    const file = createMockFile("statement.mt940", 1024);
    expect(validateBankStatementFile(file)).toEqual({ valid: true });
  });

  it("accepts .csv files", () => {
    const file = createMockFile("export.csv", 2048);
    expect(validateBankStatementFile(file)).toEqual({ valid: true });
  });

  it("accepts .CSV files (case insensitive)", () => {
    const file = createMockFile("EXPORT.CSV", 2048);
    expect(validateBankStatementFile(file)).toEqual({ valid: true });
  });

  it("rejects invalid extensions", () => {
    const file = createMockFile("document.pdf", 1024);
    const result = validateBankStatementFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("INVALID_FORMAT");
  });

  it("rejects .xlsx files", () => {
    const file = createMockFile("data.xlsx", 1024);
    expect(validateBankStatementFile(file).valid).toBe(false);
  });

  it("rejects files without extension", () => {
    const file = createMockFile("noextension", 1024);
    expect(validateBankStatementFile(file).valid).toBe(false);
  });

  it("rejects files larger than 10MB", () => {
    const file = createMockFile("big.csv", 10 * 1024 * 1024 + 1);
    const result = validateBankStatementFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("FILE_TOO_LARGE");
  });

  it("accepts files exactly 10MB", () => {
    const file = createMockFile("exact.csv", 10 * 1024 * 1024);
    expect(validateBankStatementFile(file)).toEqual({ valid: true });
  });

  it("checks extension before size", () => {
    const file = createMockFile("big.pdf", 20 * 1024 * 1024);
    const result = validateBankStatementFile(file);
    expect(result.error).toBe("INVALID_FORMAT");
  });
});
