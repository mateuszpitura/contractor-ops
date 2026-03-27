import { describe, it } from "vitest";

describe("checkCrossSourceDuplicate", () => {
  it.todo(
    "finds duplicate by invoiceNumber + sellerTaxId (case-insensitive)",
  );

  it.todo(
    "returns no duplicate when none exists",
  );

  it.todo(
    "excludes specified invoice ID from search",
  );

  it.todo(
    "returns existingSource from the matched invoice",
  );
});

describe("linkDuplicateInvoices", () => {
  it.todo(
    "flags both invoices with duplicate metadata in flagsJson",
  );

  it.todo(
    "preserves existing flagsJson when adding duplicate link",
  );

  it.todo(
    "sets KSeF invoice duplicateSource to MANUAL and manual invoice to KSEF",
  );
});
