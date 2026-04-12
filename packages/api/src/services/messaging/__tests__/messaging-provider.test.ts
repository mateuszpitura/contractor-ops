import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlackMessagingProvider } from "../slack-messaging-provider.js";
import { TeamsMessagingProvider } from "../teams-messaging-provider.js";
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

const mockContinueConversationAsync = vi.fn(
  async (_appId: string, _ref: unknown, callback: (ctx: unknown) => Promise<void>) => {
    await callback({ sendActivity: vi.fn() });
  },
);

vi.mock("botbuilder", () => ({
  CloudAdapter: vi.fn(),
  ConfigurationBotFrameworkAuthentication: vi.fn(),
  CardFactory: { adaptiveCard: vi.fn((card: unknown) => card) },
}));

// Override the module-level adapter singleton
vi.mock("../teams-messaging-provider.js", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
  };
});

vi.mock("../../teams/cards/activity-alert-card.js", () => ({
  buildActivityAlertCard: vi.fn(() => ({
    type: "AdaptiveCard",
    body: [{ type: "TextBlock", text: "Alert" }],
  })),
}));

vi.mock("../../teams/teams-bot-handler.js", () => ({
  getConversationReference: vi.fn(),
}));

vi.mock("../../teams/cards/approval-card.js", () => ({
  buildApprovalCard: vi.fn(),
}));

vi.mock("../../teams/cards/approval-reminder-card.js", () => ({
  buildApprovalReminderCard: vi.fn(),
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

  it("sendChannelAlert throws when no Slack integration exists", async () => {
    await expect(
      provider.sendChannelAlert({
        organizationId: "org-1",
        channelId: "C_CHANNEL_1",
        title: "New Invoice",
        body: "Invoice INV-001 submitted",
        entityType: "INVOICE",
        entityId: "inv-1",
        details: [{ label: "Amount", value: "5000 PLN" }],
        viewUrl: "https://app.example.com/invoices/inv-1",
      }),
    ).rejects.toThrow("No Slack integration for organization org-1");
  });

  it("sendChannelAlert posts to channel when Slack client is available", async () => {
    const { getSlackClient } = await import("../../slack-client.js");
    const mockPostMessage = vi.fn().mockResolvedValue({ ok: true });
    vi.mocked(getSlackClient).mockResolvedValueOnce({
      chat: { postMessage: mockPostMessage },
    } as never);

    await provider.sendChannelAlert({
      organizationId: "org-1",
      channelId: "C_CHANNEL_1",
      title: "New Invoice",
      body: "Invoice INV-001 submitted",
      entityType: "INVOICE",
      entityId: "inv-1",
      details: [
        { label: "Amount", value: "5000 PLN" },
        { label: "Contractor", value: "Alpha Corp" },
      ],
      viewUrl: "https://app.example.com/invoices/inv-1",
    });

    expect(mockPostMessage).toHaveBeenCalledWith({
      channel: "C_CHANNEL_1",
      text: expect.stringContaining("*New Invoice*"),
      mrkdwn: true,
    });
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("*Amount:* 5000 PLN"),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// TeamsMessagingProvider.sendChannelAlert (Phase 41 — TEAM-03)
// ---------------------------------------------------------------------------

describe("TeamsMessagingProvider.sendChannelAlert", () => {
  let teamsProvider: InstanceType<typeof TeamsMessagingProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    teamsProvider = new TeamsMessagingProvider();
  });

  it("resolves channel ref by params.channelId matching conversation.id key", async () => {
    const { prisma } = await import("@contractor-ops/db");
    const channelThreadId = "19:abc123@thread.tacv2";
    const storedRef = {
      conversation: {
        id: channelThreadId,
        conversationType: "channel",
      },
      serviceUrl: "https://smba.trafficmanager.net/emea/",
    };

    vi.mocked(prisma.integrationConnection.findFirst).mockResolvedValue({
      configJson: {
        teamConversationReferences: {
          [channelThreadId]: storedRef,
        },
      },
    } as never);

    // The method will try to use CloudAdapter.continueConversationAsync
    // which we can't fully mock at module level, so we verify the DB lookup
    // by checking it doesn't warn about missing ref
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await teamsProvider.sendChannelAlert({
        organizationId: "org-1",
        channelId: channelThreadId,
        title: "New Invoice",
        body: "Invoice INV-001 submitted",
        entityType: "INVOICE",
        entityId: "inv-1",
        details: [{ label: "Amount", value: "5000 PLN" }],
        viewUrl: "https://app.example.com/invoices/inv-1",
      });
    } catch {
      // CloudAdapter may throw since it's mocked — that's OK,
      // we're testing the ref lookup path, not the adapter call
    }

    // Key assertion: the "No ConversationReference" warning should NOT fire
    // because channelRef was found via teamRefs[params.channelId]
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("No ConversationReference"));

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("warns when no channel ref found for given channelId", async () => {
    const { prisma } = await import("@contractor-ops/db");

    vi.mocked(prisma.integrationConnection.findFirst).mockResolvedValue({
      configJson: {
        teamConversationReferences: {
          "19:other-channel@thread.tacv2": { conversation: { id: "other" } },
        },
      },
    } as never);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await teamsProvider.sendChannelAlert({
      organizationId: "org-1",
      channelId: "19:missing-channel@thread.tacv2",
      title: "Alert",
      body: "Test",
      entityType: "INVOICE",
      entityId: "inv-1",
      details: [],
      viewUrl: "https://example.com",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "No ConversationReference for channel 19:missing-channel@thread.tacv2",
      ),
    );

    warnSpy.mockRestore();
  });

  it("returns early when no MICROSOFT_TEAMS connection exists", async () => {
    const { prisma } = await import("@contractor-ops/db");
    vi.mocked(prisma.integrationConnection.findFirst).mockResolvedValue(null);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await teamsProvider.sendChannelAlert({
      organizationId: "org-1",
      channelId: "19:any@thread.tacv2",
      title: "Alert",
      body: "Test",
      entityType: "INVOICE",
      entityId: "inv-1",
      details: [],
      viewUrl: "https://example.com",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("No MICROSOFT_TEAMS connection for org org-1"),
    );

    warnSpy.mockRestore();
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

  it("returns TeamsMessagingProvider when MICROSOFT_TEAMS connection exists", async () => {
    const { prisma } = await import("@contractor-ops/db");
    vi.mocked(prisma.integrationConnection.findMany).mockResolvedValue([
      { provider: "MICROSOFT_TEAMS" } as never,
    ]);

    const { getConnectedMessagingProviders } = await import("../index.js");
    const providers = await getConnectedMessagingProviders("org-1");
    expect(providers).toHaveLength(1);
    expect(providers[0]!.platform).toBe("teams");
    expect(providers[0]).toBeInstanceOf(TeamsMessagingProvider);
  });
});
