/**
 * Integration: real Slack WebClient + MSW HTTP mocks (no @slack/web-api mock).
 * Validates outbound URLs and JSON against handlers in @contractor-ops/test-utils.
 */

import { createMockServer, selectHandlers } from "@contractor-ops/test-utils";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ORG_ID = "org-msw-slack";
const CONN_ID = "conn-msw-slack";

const { mockPrisma, mockGetCredentials } = vi.hoisted(() => {
  const mockPrisma = {
    integrationConnection: {
      findFirst: vi.fn(),
    },
    externalLink: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      findFirst: vi.fn(),
    },
  };
  const mockGetCredentials = vi.fn();
  return { mockPrisma, mockGetCredentials };
});

vi.mock("@contractor-ops/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@contractor-ops/integrations/services/credential-service", () => ({
  getCredentials: (...args: unknown[]) => mockGetCredentials(...args),
}));

import { sendReminderDM, syncWorkspaceUsers } from "../slack-client.js";

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(["slack"]),
});

beforeAll(() =>
  server.listen({
    onUnhandledRequest: "warn",
  }),
);
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe("slack-client + MSW", () => {
  beforeEach(() => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: CONN_ID,
      credentialsRef: `${ORG_ID}/slack`,
      status: "CONNECTED",
    });
    mockGetCredentials.mockResolvedValue({ accessToken: "xoxb-msw-integration" });
  });

  it("sendReminderDM reaches mock Slack chat.postMessage", async () => {
    const out = await sendReminderDM({
      organizationId: ORG_ID,
      slackUserId: "U_TARGET",
      text: "Hello from MSW",
    });

    expect(out).not.toBeNull();
    expect(out?.ok).toBe(true);
    expect(mockGetCredentials).toHaveBeenCalledWith(`${ORG_ID}/slack`, "slack");
  });

  it("syncWorkspaceUsers uses mock users.list and creates links for matched emails", async () => {
    mockPrisma.user.findFirst.mockImplementation(async (args: { where?: { email?: string } }) => {
      const email = args.where?.email;
      if (email === "test@example.com") return { id: "user-a" };
      if (email === "contractor@example.com") return { id: "user-b" };
      return null;
    });
    mockPrisma.externalLink.findFirst.mockResolvedValue(null);

    const stats = await syncWorkspaceUsers(ORG_ID, CONN_ID);

    expect(stats).toEqual({ matched: 2, total: 2 });
    expect(mockPrisma.externalLink.create).toHaveBeenCalledTimes(2);
  });
});
