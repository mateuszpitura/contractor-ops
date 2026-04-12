/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { extractSlackTeamId } from "../slack-webhook-context.js";

describe("extractSlackTeamId", () => {
  it("reads team.id from interactivity payload", () => {
    expect(
      extractSlackTeamId({
        type: "block_actions",
        team: { id: "T0ABC", domain: "x" },
      }),
    ).toBe("T0ABC");
  });

  it("reads top-level team_id", () => {
    expect(extractSlackTeamId({ team_id: "T1XYZ", type: "event_callback" })).toBe("T1XYZ");
  });

  it("reads event.team_id", () => {
    expect(
      extractSlackTeamId({
        type: "event_callback",
        event: { type: "message", team_id: "T2DEF" },
      }),
    ).toBe("T2DEF");
  });

  it("returns undefined when missing", () => {
    expect(extractSlackTeamId({})).toBeUndefined();
  });
});
