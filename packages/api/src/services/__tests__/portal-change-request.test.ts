import { describe, it } from "vitest";

describe("portal-change-request", () => {
  describe("createChangeRequest", () => {
    it.todo("creates a PENDING change request with requestedChanges and previousValues JSON");
    it.todo("throws CONFLICT when a PENDING request already exists for the same contractor+org (PORT-06d)");
    it.todo("allows new request after previous one is APPROVED");
    it.todo("allows new request after previous one is REJECTED");
  });

  describe("approveChangeRequest", () => {
    it.todo("applies requestedChanges to default billing profile in a transaction (PORT-06c)");
    it.todo("sets status to APPROVED with reviewerId and reviewedAt");
    it.todo("stores optional reviewer comment");
    it.todo("throws NOT_FOUND for non-existent or already-reviewed request");
    it.todo("throws NOT_FOUND when billing profile does not exist");
  });

  describe("rejectChangeRequest", () => {
    it.todo("sets status to REJECTED with reviewerId and reviewedAt");
    it.todo("stores optional rejection comment");
    it.todo("throws NOT_FOUND for non-existent or already-reviewed request");
  });
});
