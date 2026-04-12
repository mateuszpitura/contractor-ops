/** @vitest-environment node */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSubscriptionFindMany = vi.fn();

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    subscription: {
      findMany: (...args: unknown[]) => mockSubscriptionFindMany(...args),
    },
  },
}));

vi.mock("@contractor-ops/api/services/notification-service", () => ({
  dispatch: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn().mockResolvedValue({ id: "email-1" }) };
  },
}));

vi.mock("@sentry/nextjs", () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  captureException: vi.fn(),
}));

vi.mock("@contractor-ops/api/services/cron-monitor", () => ({
  withCronMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
}));

vi.mock("@contractor-ops/logger", () => ({
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@contractor-ops/logger/metrics", () => ({
  metrics: { gauge: vi.fn() },
}));

import { GET } from "../route";

describe("GET /api/cron/trial-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthorized", async () => {
    process.env.CRON_SECRET = "s";
    const req = new NextRequest("http://localhost/api/cron/trial-notifications", {
      headers: { authorization: "Bearer x" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with counts when authorized and no trialing subs", async () => {
    process.env.CRON_SECRET = "good";
    const req = new NextRequest("http://localhost/api/cron/trial-notifications", {
      headers: { authorization: "Bearer good" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      processed: number;
      notificationsSent: number;
    };
    expect(json).toEqual({ processed: 0, notificationsSent: 0 });
    expect(mockSubscriptionFindMany).toHaveBeenCalled();
  });
});
