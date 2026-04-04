import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlackMessagingProvider } from "../slack-messaging-provider.js";
import type { MessagingProvider } from "../types.js";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    integrationConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    externalLink: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../slack-client.js", () => ({
  getSlackClient: vi.fn().mockResolvedValue(null),
  getSlackUserIdForUser: vi.fn().mockResolvedValue("U_SLACK_123"),
  sendApprovalCard: vi.fn().mockResolvedValue(undefined),
  sendReminderDM: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// SlackMessagingProvider
// ---------------------------------------------------------------------------

describe("SlackMessagingProvider", () => {
  let provider: SlackMessagingProvider;

  beforeEach(() => {
    provider = new SlackMessagingProvider();
    vi.clearAllMocks();
  });

  it("implements MessagingProvider interface with platform = 'slack'", () => {
    const mp: MessagingProvider = provider;
    expect(mp.platform).toBe("slack");
    expect(typeof mp.sendApprovalCard).toBe("function");
    expect(typeof mp.sendReminderDM).toBe("function");
    expect(typeof mp.sendChannelAlert).toBe("function");
    expect(typeof mp.getUserId).toBe("function");
  });

  it("getUserId delegates to getSlackUserIdForUser", async () => {
    const { getSlackUserIdForUser } = await import("../../slack-client.js");
    const result = await provider.getUserId("org-1", "user-1");
    expect(getSlackUserIdForUser).toHaveBeenCalledWith("org-1", "user-1");
    expect(result).toBe("U_SLACK_123");
  });

  it("sendApprovalCard delegates to slack-client sendApprovalCard", async () => {
    const { sendApprovalCard } = await import("../../slack-client.js");
    await provider.sendApprovalCard({
      organizationId: "org-1",
      recipientId: "U_SLACK_123",
      invoiceNumber: "INV-001",
      contractorName: "John Doe",
      amount: "5000",
      currency: "PLN",
      dueDate: "2026-04-15",
      invoiceId: "inv-1",
      flowId: "flow-1",
    });
    expect(sendApprovalCard).toHaveBeenCalledWith({
      organizationId: "org-1",
      slackUserId: "U_SLACK_123",
      invoiceNumber: "INV-001",
      contractorName: "John Doe",
      amount: "5000",
      currency: "PLN",
      slaDeadline: "2026-04-15",
      invoiceId: "inv-1",
      flowId: "flow-1",
    });
  });

  it("sendReminderDM delegates to slack-client sendReminderDM", async () => {
    const { sendReminderDM } = await import("../../slack-client.js");
    await provider.sendReminderDM({
      organizationId: "org-1",
      recipientId: "U_SLACK_123",
      text: "Reminder text",
    });
    expect(sendReminderDM).toHaveBeenCalledWith({
      organizationId: "org-1",
      slackUserId: "U_SLACK_123",
      text: "Reminder text",
    });
  });
});

// ---------------------------------------------------------------------------
// getConnectedMessagingProviders
// ---------------------------------------------------------------------------

describe("getConnectedMessagingProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no connections exist", async () => {
    const { prisma } = await import("@contractor-ops/db");
    vi.mocked(prisma.integrationConnection.findMany).mockResolvedValue([]);

    const { getConnectedMessagingProviders } = await import("../index.js");
    const providers = await getConnectedMessagingProviders("org-1");
    expect(providers).toEqual([]);
  });

  it("returns SlackMessagingProvider when SLACK connection exists", async () => {
    const { prisma } = await import("@contractor-ops/db");
    vi.mocked(prisma.integrationConnection.findMany).mockResolvedValue([
      { provider: "SLACK" } as never,
    ]);

    const { getConnectedMessagingProviders } = await import("../index.js");
    const providers = await getConnectedMessagingProviders("org-1");
    expect(providers).toHaveLength(1);
    expect(providers[0]!.platform).toBe("slack");
    expect(providers[0]).toBeInstanceOf(SlackMessagingProvider);
  });

  it("skips MICROSOFT_TEAMS until TeamsMessagingProvider is implemented", async () => {
    const { prisma } = await import("@contractor-ops/db");
    vi.mocked(prisma.integrationConnection.findMany).mockResolvedValue([
      { provider: "MICROSOFT_TEAMS" } as never,
    ]);

    const { getConnectedMessagingProviders } = await import("../index.js");
    const providers = await getConnectedMessagingProviders("org-1");
    expect(providers).toEqual([]);
  });
});
