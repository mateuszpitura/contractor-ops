/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockProcess } = vi.hoisted(() => ({
  mockProcess: vi.fn(),
}));

vi.mock("botbuilder", () => ({
  CloudAdapter: class {
    process = mockProcess;
  },
  ConfigurationBotFrameworkAuthentication: class {
    MicrosoftAppId = "";
    MicrosoftAppPassword = "";
    MicrosoftAppType = "MultiTenant";
  },
}));

vi.mock("@contractor-ops/api/services/teams/teams-bot-handler", () => ({
  TeamsBotHandler: class {
    run = vi.fn().mockResolvedValue(undefined);
  },
}));

describe("POST /api/teams/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AZURE_BOT_APP_ID = "app-id";
    process.env.AZURE_BOT_APP_SECRET = "secret";
    mockProcess.mockImplementation(
      async (_req: unknown, _res: unknown, logic: (ctx: unknown) => Promise<void>) => {
        await logic({});
      },
    );
  });

  it("returns 200 when CloudAdapter.process completes", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/teams/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "message", text: "hi" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockProcess).toHaveBeenCalled();
  });

  it("returns 500 when CloudAdapter.process throws", async () => {
    mockProcess.mockRejectedValueOnce(new Error("adapter failed"));
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/teams/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });

  it("returns 500 when request body is not valid JSON", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/teams/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
