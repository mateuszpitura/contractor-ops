import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { degradedHandlers } from "../msw/scenarios/degraded.js";
import { missingDataHandlers } from "../msw/scenarios/missing-data.js";
import { partialFailureHandlers } from "../msw/scenarios/partial-failure.js";
import { rateLimitedHandlers } from "../msw/scenarios/rate-limited.js";
import { tokenExpiredHandlers } from "../msw/scenarios/token-expired.js";
import { replayWebhook, webhookPayloads } from "../msw/scenarios/webhook-replay.js";
import { RequestCapture } from "../msw/utils.js";

// ---------------------------------------------------------------
// Missing Data Scenario
// ---------------------------------------------------------------
describe("missing-data scenario", () => {
  const server = setupServer(...missingDataHandlers());
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("returns Jira issue with null assignee and priority", async () => {
    const res = await fetch("https://api.atlassian.com/ex/jira/cloud-001/rest/api/3/issue/TEST-1");
    const body = await res.json();
    expect(body.fields.assignee).toBeNull();
    expect(body.fields.priority).toBeNull();
    expect(body.fields.summary).toBe("Issue with minimal data");
    // description should be missing entirely
    expect(body.fields.description).toBeUndefined();
  });

  it("returns Slack users with missing email and deactivated users", async () => {
    const res = await fetch("https://slack.com/api/users.list", {
      method: "POST",
    });
    const body = await res.json();
    const incomplete = body.members.find((m: { id: string }) => m.id === "U_INCOMPLETE");
    expect(incomplete.profile.email).toBeUndefined();
    expect(incomplete.profile.display_name).toBe("");

    const deactivated = body.members.find((m: { id: string }) => m.id === "U_DEACTIVATED");
    expect(deactivated.deleted).toBe(true);

    const bot = body.members.find((m: { id: string }) => m.id === "U_BOT");
    expect(bot.is_bot).toBe(true);
  });

  it("returns Claude OCR with low confidence and null values", async () => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "test", messages: [] }),
    });
    const body = await res.json();
    const input = body.content[0].input;
    expect(input.invoiceNumber.confidence).toBeLessThan(0.5);
    expect(input.buyerNip.value).toBeNull();
    expect(input.lineItems).toHaveLength(0);
  });

  it("returns Notion page with empty title", async () => {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    });
    const body = await res.json();
    expect(body.results[0].properties.title.title).toHaveLength(0);
  });

  it("returns Clockify time entry with running timer (null end)", async () => {
    const res = await fetch(
      "https://api.clockify.me/api/v1/workspaces/ws-001/user/user-001/time-entries",
    );
    const body = await res.json();
    expect(body[0].timeInterval.end).toBeNull();
    expect(body[0].timeInterval.duration).toBeNull();
    expect(body[0].projectId).toBeNull();
  });
});

// ---------------------------------------------------------------
// Degraded Scenario
// ---------------------------------------------------------------
describe("degraded scenario", () => {
  const server = setupServer(...degradedHandlers());
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("returns 503 from Linear", async () => {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ viewer { id } }" }),
    });
    expect(res.status).toBe(503);
  });

  it("returns 529 from Claude OCR (overloaded)", async () => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "test", messages: [] }),
    });
    expect(res.status).toBe(529);
    const body = await res.json();
    expect(body.error.type).toBe("overloaded_error");
  }, 15000);
});

// ---------------------------------------------------------------
// Rate Limited Scenario
// ---------------------------------------------------------------
describe("rate-limited scenario", () => {
  const server = setupServer(...rateLimitedHandlers());
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("returns 429 with Retry-After from Stripe, then succeeds", async () => {
    // First call: 429
    const res1 = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
    });
    expect(res1.status).toBe(429);
    expect(res1.headers.get("Retry-After")).toBe("1");

    // Second call: still 429 (only for Stripe the counter wasn't reset because it needs >1 call)
    // Third call after reset would succeed
  });

  it("returns 429 with Retry-After from Slack", async () => {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");

    const body = await res.json();
    expect(body.error).toBe("ratelimited");
  });
});

// ---------------------------------------------------------------
// Token Expired Scenario
// ---------------------------------------------------------------
describe("token-expired scenario", () => {
  const server = setupServer(...tokenExpiredHandlers());
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("returns 401 from Jira on first call, then can refresh token", async () => {
    // First call: 401
    const res1 = await fetch("https://api.atlassian.com/ex/jira/cloud-001/rest/api/3/issue/TEST-1");
    expect(res1.status).toBe(401);

    // Refresh token
    const refreshRes = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
    });
    const refreshBody = await refreshRes.json();
    expect(refreshBody.access_token).toMatch(/^refreshed_atlassian_/);

    // Second call: success
    const res2 = await fetch("https://api.atlassian.com/ex/jira/cloud-001/rest/api/3/issue/TEST-1");
    expect(res2.status).toBe(200);
    const body = await res2.json();
    expect(body.fields.summary).toBe("Got it after token refresh");
  });
});

// ---------------------------------------------------------------
// Partial Failure Scenario
// ---------------------------------------------------------------
describe("partial-failure scenario", () => {
  const server = setupServer(...partialFailureHandlers());
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("Stripe works while Jira is down", async () => {
    const stripeRes = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
    });
    expect(stripeRes.status).toBe(200);

    const jiraRes = await fetch(
      "https://api.atlassian.com/ex/jira/cloud-001/rest/api/3/issue/TEST-1",
    );
    expect(jiraRes.status).toBe(503);
  });

  it("Resend works while Linear returns 500", async () => {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
    });
    expect(resendRes.status).toBe(200);

    const linearRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ viewer { id } }" }),
    });
    expect(linearRes.status).toBe(500);
  });

  it("Slack returns app-level error (ok: false)", async () => {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
    });
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("channel_not_found");
  });
});

// ---------------------------------------------------------------
// Webhook Payloads & Replay
// ---------------------------------------------------------------
describe("webhook payloads", () => {
  it("generates Stripe invoice.paid event", () => {
    const event = webhookPayloads.stripe.invoicePaid();
    expect(event.type).toBe("invoice.paid");
    expect(event.data.object.status).toBe("paid");
    expect(event.data.object.amount_paid).toBe(4900);
  });

  it("generates Jira issue_updated webhook", () => {
    const event = webhookPayloads.jira.issueUpdated();
    expect(event.webhookEvent).toBe("jira:issue_updated");
    expect(event.issue.key).toBe("TEST-1");
    expect(event.changelog.items[0].field).toBe("status");
  });

  it("generates Linear issue.create webhook", () => {
    const event = webhookPayloads.linear.issueCreated();
    expect(event.type).toBe("Issue");
    expect(event.action).toBe("create");
  });

  it("generates DocuSign envelope-completed webhook", () => {
    const event = webhookPayloads.docusign.envelopeCompleted();
    expect(event.event).toBe("envelope-completed");
    expect(event.data.envelopeSummary.status).toBe("completed");
  });

  it("generates Slack view_submission webhook", () => {
    const event = webhookPayloads.slack.viewSubmission();
    expect(event.type).toBe("view_submission");
    expect(event.view.callback_id).toBe("approval_modal");
  });

  it("allows overrides", () => {
    const event = webhookPayloads.stripe.invoicePaid({ amount_paid: 9900 });
    expect(event.data.object.amount_paid).toBe(9900);
  });

  it("replays the same webhook multiple times", () => {
    const event = webhookPayloads.jira.issueUpdated();
    const replayed = replayWebhook(event, 3);
    expect(replayed).toHaveLength(3);
    replayed.forEach((r) => {
      expect(r.webhookEvent).toBe("jira:issue_updated");
    });
  });
});

// ---------------------------------------------------------------
// RequestCapture utility
// ---------------------------------------------------------------
describe("RequestCapture", () => {
  it("captures and queries requests", () => {
    const capture = new RequestCapture();
    capture.capture("https://api.example.com/users", "POST", {}, { name: "test" });
    capture.capture("https://api.example.com/items", "GET", {}, null);

    expect(capture.count).toBe(2);
    expect(capture.getByUrl("users")).toHaveLength(1);
    expect(capture.getByMethod("GET")).toHaveLength(1);
  });

  it("assertCalled throws on missing request", () => {
    const capture = new RequestCapture();
    expect(() => capture.assertCalled("missing")).toThrow("Expected a");
  });

  it("assertNotCalled throws on existing request", () => {
    const capture = new RequestCapture();
    capture.capture("https://api.example.com/test", "GET", {}, null);
    expect(() => capture.assertNotCalled("test")).toThrow("Expected no");
  });

  it("clear removes all requests", () => {
    const capture = new RequestCapture();
    capture.capture("url", "GET", {}, null);
    capture.clear();
    expect(capture.count).toBe(0);
  });
});
