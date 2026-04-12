import { describe, expect, it, vi } from "vitest";
import { withRlsSession } from "../rls.js";

describe("withRlsSession", () => {
  it("sets app.org_id and app.user_id via set_config", async () => {
    const executeCalls: unknown[] = [];
    const tx = {
      $executeRaw: vi.fn(async (q: unknown) => {
        executeCalls.push(q);
      }),
    };

    await withRlsSession(tx as never, {
      organizationId: "org-42",
      userId: "user-99",
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const sql0 = executeCalls[0] as { strings?: string[] };
    const s0 = sql0?.strings?.join("?");
    expect(s0).toContain("set_config");
    expect(s0).toContain("app.org_id");
    expect(s0).toContain("app.user_id");
  });
});
