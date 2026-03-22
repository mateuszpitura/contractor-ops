import { describe, it } from "vitest";

describe("payment router", () => {
  describe("readyForPayment", () => {
    it.todo("returns invoices with paymentStatus READY");
    it.todo("filters by currency when provided");
    it.todo("filters by contractor when provided");
  });

  describe("create", () => {
    it.todo("creates a DRAFT run with sequential number PR-{year}-{seq}");
    it.todo("sets invoice paymentStatus to IN_RUN");
    it.todo("rejects invoices not in READY status");
    it.todo("groups by currency when groupByCurrency is true");
  });

  describe("listByContractor", () => {
    it.todo("returns payment items filtered by contractorId");
  });

  describe("removeFromRun", () => {
    it.todo("removes invoice from DRAFT run and resets paymentStatus to READY");
    it.todo("rejects removal from non-DRAFT runs");
    it.todo("recalculates totalGrosze and invoiceCount after removal");
  });

  describe("lockAndExport", () => {
    it.todo("transitions DRAFT to EXPORTED and returns file base64");
    it.todo("rejects transition from invalid status");
  });

  describe("updateItemStatus", () => {
    it.todo("marks item as PAID and updates invoice paymentStatus");
    it.todo("marks item as FAILED and releases invoice to READY");
    it.todo("requires failureReason when status is FAILED");
  });

  describe("markAllPaid", () => {
    it.todo("marks all PENDING items as PAID atomically");
    it.todo("sets run status to COMPLETED");
  });

  describe("cancel", () => {
    it.todo("cancels DRAFT run and releases invoices to READY");
    it.todo("requires admin role to cancel EXPORTED run");
    it.todo("rejects cancellation of COMPLETED run");
  });

  describe("importStatement", () => {
    it.todo("parses MT940 file and returns match results");
    it.todo("parses CSV file and returns match results");
  });

  describe("confirmStatementMatches", () => {
    it.todo("marks matched items as PAID");
    it.todo("auto-completes run when all items are terminal");
  });
});
