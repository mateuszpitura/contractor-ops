import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted to avoid TDZ issues with vi.mock hoisting
// ---------------------------------------------------------------------------

const {
  mockFindFirst,
  mockCreate,
  mockPrefCreate,
  mockPrefFindFirst,
  mockUserFindUnique,
  mockConnectionFindMany,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockPrefCreate: vi.fn(),
  mockPrefFindFirst: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockConnectionFindMany: vi.fn(),
}));

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    notification: {
      findFirst: mockFindFirst,
      create: mockCreate,
    },
    userNotificationPreference: {
      findFirst: mockPrefFindFirst,
      create: mockPrefCreate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    integrationConnection: {
      findMany: mockConnectionFindMany,
    },
  },
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "email_1" }) },
  })),
}));

vi.mock("../email-templates.js", () => ({
  renderNotificationEmail: vi.fn().mockReturnValue({
    subject: "Test Subject",
    react: "<div>test</div>",
  }),
}));

// messaging/index.js uses prisma.integrationConnection.findMany (mocked above)
// slack-client.js is imported by SlackMessagingProvider
vi.mock("../slack-client.js", () => ({
  getSlackClient: vi.fn().mockResolvedValue(null),
  getSlackUserIdForUser: vi.fn().mockResolvedValue(null),
  sendApprovalCard: vi.fn().mockResolvedValue(undefined),
  sendReminderDM: vi.fn().mockResolvedValue(undefined),
}));

import {
  dispatch,
  getOrCreatePreferences,
  type NotificationEvent,
} from "../notification-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<NotificationEvent> = {},
): NotificationEvent {
  return {
    organizationId: "org_1",
    type: "INVOICE_APPROVED",
    recipientUserIds: ["user_1"],
    title: "Invoice Approved",
    body: "Invoice #123 has been approved",
    entityType: "INVOICE",
    entityId: "inv_1",
    ...overrides,
  } as NotificationEvent;
}

const defaultPrefs = {
  id: "pref_1",
  channelEmail: true,
  channelSlack: true,
  channelTeams: false,
  channelInApp: true,
  digestMode: false,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrefFindFirst.mockResolvedValue(null);
  mockPrefCreate.mockResolvedValue(defaultPrefs);
  mockFindFirst.mockResolvedValue(null); // no duplicate
  mockCreate.mockResolvedValue({ id: "notif_1" });
  mockUserFindUnique.mockResolvedValue({ email: "user@example.com" });
  mockConnectionFindMany.mockResolvedValue([]); // no messaging providers by default
});

// ---------------------------------------------------------------------------
// getOrCreatePreferences
// ---------------------------------------------------------------------------

describe("getOrCreatePreferences", () => {
  it("returns existing preference when found", async () => {
    const existing = { ...defaultPrefs, channelEmail: false };
    mockPrefFindFirst.mockResolvedValueOnce(existing);

    const result = await getOrCreatePreferences(
      "user_1",
      "org_1",
      "INVOICE_APPROVED",
    );

    expect(result).toBe(existing);
    expect(mockPrefCreate).not.toHaveBeenCalled();
  });

  it("creates default preferences when none exist", async () => {
    mockPrefFindFirst.mockResolvedValueOnce(null);

    await getOrCreatePreferences("user_1", "org_1", "INVOICE_APPROVED");

    expect(mockPrefCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        organizationId: "org_1",
        notificationType: "INVOICE_APPROVED",
        channelEmail: true,
        channelSlack: true,
        channelTeams: false,
        channelInApp: true,
        digestMode: false,
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

describe("dispatch", () => {
  it("creates an IN_APP notification for each recipient", async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);

    await dispatch(makeEvent({ recipientUserIds: ["user_1", "user_2"] }));

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_1",
        userId: "user_1",
        channel: "IN_APP",
        type: "INVOICE_APPROVED",
        title: "Invoice Approved",
        body: "Invoice #123 has been approved",
        entityType: "INVOICE",
        entityId: "inv_1",
        status: "SENT",
      }),
    });
  });

  it("includes entityType and entityId on notification records", async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);

    await dispatch(
      makeEvent({
        entityType: "CONTRACT",
        entityId: "contract_42",
      }),
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "CONTRACT",
        entityId: "contract_42",
      }),
    });
  });

  it("handles empty recipientUserIds gracefully (no-op)", async () => {
    await dispatch(makeEvent({ recipientUserIds: [] }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPrefFindFirst).not.toHaveBeenCalled();
  });

  it("deduplicates: skips notification if recent duplicate exists", async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    mockFindFirst.mockResolvedValueOnce({ id: "existing_notif" });

    await dispatch(makeEvent());

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("does not throw when email sending fails (fire-and-forget)", async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    mockUserFindUnique.mockRejectedValueOnce(new Error("DB error"));

    await expect(dispatch(makeEvent())).resolves.toBeUndefined();
    // IN_APP notification should still have been created
    expect(mockCreate).toHaveBeenCalled();
  });

  it("skips IN_APP creation when channelInApp is false", async () => {
    mockPrefFindFirst.mockResolvedValue({
      ...defaultPrefs,
      channelInApp: false,
      channelEmail: false,
      channelSlack: false,
    });

    await dispatch(makeEvent());

    expect(mockCreate).not.toHaveBeenCalled();
  });
});
