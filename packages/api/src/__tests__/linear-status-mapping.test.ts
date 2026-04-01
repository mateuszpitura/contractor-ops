import { describe, it, expect } from "vitest";

describe("LinearStatusMappingService", () => {
  describe("getStatusMapping", () => {
    it.todo("returns empty array when no mapping exists for team");
    it.todo("returns stored mappings for a team");
  });

  describe("saveStatusMapping", () => {
    it.todo("persists mappings to connection configJson under teamId key");
    it.todo("updates stateCache alongside mappings");
    it.todo("preserves mappings for other teams when saving");
    it.todo("transitions connection from PENDING_MAPPING to CONNECTED on first save per D-03");
    it.todo("does not change status if already CONNECTED");
  });

  describe("resolveLinearStateId", () => {
    it.todo("returns stateId for mapped workflow status");
    it.todo("returns null for unmapped workflow status");
  });

  describe("resolveInternalStatus", () => {
    it.todo("returns workflow status for mapped Linear stateId");
    it.todo("returns null for unmapped stateId and logs as unmapped per D-04");
  });
});
