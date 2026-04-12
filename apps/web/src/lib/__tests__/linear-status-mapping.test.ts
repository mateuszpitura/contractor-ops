import { describe, expect, it } from "vitest";
import { computeSmartDefaultMappings } from "../linear-status-mapping";

describe("computeSmartDefaultMappings", () => {
  it("maps states by name keywords (pass 1)", () => {
    const states = [
      { name: "In Progress", type: "started" },
      { name: "Done", type: "completed" },
      { name: "Blocked", type: "started" },
      { name: "Cancelled", type: "cancelled" },
    ];
    const result = computeSmartDefaultMappings(states);
    expect(result.IN_PROGRESS).toBe("In Progress");
    expect(result.DONE).toBe("Done");
    expect(result.BLOCKED).toBe("Blocked");
    expect(result.CANCELLED).toBe("Cancelled");
  });

  it("falls back to type mapping for unmapped statuses (pass 2)", () => {
    const states = [
      { name: "Backlog", type: "backlog" },
      { name: "Active", type: "started" },
      { name: "Finished", type: "completed" },
    ];
    const result = computeSmartDefaultMappings(states);
    expect(result.TODO).toBe("Backlog");
    expect(result.IN_PROGRESS).toBe("Active");
    expect(result.DONE).toBe("Finished");
  });

  it("does not override pass 1 matches with pass 2", () => {
    const states = [
      { name: "In Review", type: "started" },
      { name: "Active", type: "started" },
    ];
    const result = computeSmartDefaultMappings(states);
    // "In Review" matches "review" keyword -> IN_PROGRESS
    expect(result.IN_PROGRESS).toBe("In Review");
  });

  it("handles empty states array", () => {
    expect(computeSmartDefaultMappings([])).toEqual({});
  });

  it("uses first match for each workflow status", () => {
    const states = [
      { name: "Done - Verified", type: "completed" },
      { name: "Done - Shipped", type: "completed" },
    ];
    const result = computeSmartDefaultMappings(states);
    expect(result.DONE).toBe("Done - Verified");
  });

  it("maps triage type to TODO", () => {
    const states = [{ name: "Triage Queue", type: "triage" }];
    const result = computeSmartDefaultMappings(states);
    expect(result.TODO).toBe("Triage Queue");
  });

  it("maps unstarted type to TODO", () => {
    const states = [{ name: "Not Started", type: "unstarted" }];
    const result = computeSmartDefaultMappings(states);
    expect(result.TODO).toBe("Not Started");
  });

  it("name keyword 'complete' matches DONE", () => {
    const states = [{ name: "Complete", type: "completed" }];
    const result = computeSmartDefaultMappings(states);
    expect(result.DONE).toBe("Complete");
  });

  it("name keyword 'progress' matches IN_PROGRESS", () => {
    const states = [{ name: "Work In Progress", type: "started" }];
    const result = computeSmartDefaultMappings(states);
    expect(result.IN_PROGRESS).toBe("Work In Progress");
  });
});
