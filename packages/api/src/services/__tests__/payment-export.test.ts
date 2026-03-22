import { describe, it } from "vitest";

describe("payment-export", () => {
  describe("generateCsv", () => {
    it.todo("generates CSV buffer with correct columns per D-06");
    it.todo("includes UTF-8 BOM for Excel compatibility");
    it.todo("formats amounts as decimal strings");
  });

  describe("generateElixir", () => {
    it.todo("generates Elixir type 110 format with CRLF line endings");
    it.todo("strips Polish diacritics to ASCII");
    it.todo("formats multiline fields with pipe delimiters");
    it.todo("uses grosze integer for amount field");
  });

  describe("generateSepaXml", () => {
    it.todo("generates valid pain.001.001.03 XML");
    it.todo("escapes XML special characters");
    it.todo("formats amounts with 2 decimal places");
    it.todo("limits MsgId to 35 characters");
  });

  describe("resolveTransferTitle", () => {
    it.todo("replaces {invoice_number} placeholder");
    it.todo("replaces multiple placeholders");
    it.todo("trims whitespace from result");
  });
});

describe("bank-statement", () => {
  describe("parseMt940", () => {
    it.todo("parses MT940 transactions with amounts in grosze");
  });

  describe("parseCsvStatement", () => {
    it.todo("parses CSV with comma separator");
    it.todo("handles semicolon separator");
    it.todo("handles comma decimal separator in amounts");
  });

  describe("parseBankStatement", () => {
    it.todo("routes .mt940 files to parseMt940");
    it.todo("routes .csv files to parseCsvStatement");
    it.todo("throws for unrecognized file extensions");
  });

  describe("matchStatementToRun", () => {
    it.todo("returns exact match when IBAN and amount match");
    it.todo("returns partial match within 1 grosze tolerance");
    it.todo("returns unmatched when no match found");
    it.todo("does not double-match items");
  });
});
