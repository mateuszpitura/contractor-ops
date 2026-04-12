import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { allHandlers, selectHandlers } from "../msw/handlers/index.js";

// ----------------------------------------------------------------
// Integration tests: verify each handler set produces valid MSW
// handlers and that the mock server intercepts real fetch() calls.
// ----------------------------------------------------------------

const server = setupServer(...allHandlers());

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Helper
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------
describe("Stripe handlers", () => {
  it("creates a customer", async () => {
    const { status, body } = await fetchJson("https://api.stripe.com/v1/customers", {
      method: "POST",
    });
    expect(status).toBe(200);
    expect(body.id).toMatch(/^cus_/);
    expect(body.object).toBe("customer");
  });

  it("creates a subscription", async () => {
    const { body } = await fetchJson("https://api.stripe.com/v1/subscriptions", { method: "POST" });
    expect(body.id).toMatch(/^sub_/);
    expect(body.status).toBe("active");
  });

  it("creates checkout session", async () => {
    const { body } = await fetchJson("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
    });
    expect(body.url).toContain("checkout.stripe.com");
  });
});

// ---------------------------------------------------------------
// Jira
// ---------------------------------------------------------------
describe("Jira handlers", () => {
  it("exchanges OAuth token", async () => {
    const { body } = await fetchJson("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code" }),
    });
    expect(body.access_token).toBeDefined();
    expect(body.token_type).toBe("Bearer");
  });

  it("gets accessible resources", async () => {
    const { body } = await fetchJson("https://api.atlassian.com/oauth/token/accessible-resources");
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe("cloud-id-mock-001");
  });

  it("gets an issue", async () => {
    const { body } = await fetchJson(
      "https://api.atlassian.com/ex/jira/cloud-001/rest/api/3/issue/TEST-123",
    );
    expect(body.key).toBe("TEST-123");
    expect(body.fields.summary).toBe("Mock Jira Issue");
    expect(body.fields.assignee).toBeDefined();
  });

  it("creates an issue", async () => {
    const { body } = await fetchJson(
      "https://api.atlassian.com/ex/jira/cloud-001/rest/api/3/issue",
      { method: "POST" },
    );
    expect(body.key).toMatch(/^TEST-/);
  });

  it("searches issues via JQL (GET)", async () => {
    const { body } = await fetchJson(
      "https://api.atlassian.com/ex/jira/cloud-001/rest/api/3/search?jql=project%3DTEST",
    );
    expect(body.issues).toBeDefined();
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.issues[0].key).toBe("TEST-1");
  });
});

// ---------------------------------------------------------------
// Linear
// ---------------------------------------------------------------
describe("Linear handlers", () => {
  it("exchanges OAuth token", async () => {
    const { body } = await fetchJson("https://api.linear.app/oauth/token", {
      method: "POST",
      body: new URLSearchParams({ grant_type: "authorization_code" }),
    });
    expect(body.access_token).toMatch(/^lin_mock_/);
  });

  it("queries teams via GraphQL", async () => {
    const { body } = await fetchJson("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "{ teams { nodes { id name } } organization { id name } }",
      }),
    });
    expect(body.data.teams.nodes[0].name).toBe("Engineering");
    expect(body.data.organization.name).toBe("Test Org");
  });

  it("creates an issue via GraphQL", async () => {
    const { body } = await fetchJson("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "mutation { issueCreate(input: $input) { issue { id } } }",
        variables: { input: { title: "New Issue", teamId: "team-001" } },
      }),
    });
    expect(body.data.issueCreate.success).toBe(true);
    expect(body.data.issueCreate.issue.id).toBeDefined();
  });
});

// ---------------------------------------------------------------
// Slack
// ---------------------------------------------------------------
describe("Slack handlers", () => {
  it("posts a message", async () => {
    const { body } = await fetchJson("https://slack.com/api/chat.postMessage", { method: "POST" });
    expect(body.ok).toBe(true);
    expect(body.ts).toBeDefined();
  });

  it("lists users", async () => {
    const { body } = await fetchJson("https://slack.com/api/users.list", {
      method: "POST",
    });
    expect(body.ok).toBe(true);
    expect(body.members.length).toBeGreaterThan(0);
    expect(body.members[0].profile.email).toBeDefined();
  });
});

// ---------------------------------------------------------------
// DocuSign
// ---------------------------------------------------------------
describe("DocuSign handlers", () => {
  it("creates an envelope", async () => {
    const { body } = await fetchJson(
      "https://demo.docusign.net/restapi/v2.1/accounts/acct-001/envelopes",
      { method: "POST" },
    );
    expect(body.envelopeId).toBeDefined();
    expect(body.status).toBe("sent");
  });

  it("gets signing URL", async () => {
    const { body } = await fetchJson(
      "https://demo.docusign.net/restapi/v2.1/accounts/acct-001/envelopes/env-001/views/recipient",
      { method: "POST" },
    );
    expect(body.url).toContain("docusign.net");
  });
});

// ---------------------------------------------------------------
// Autenti
// ---------------------------------------------------------------
describe("Autenti handlers", () => {
  it("creates a document process", async () => {
    const { body } = await fetchJson("https://api.autenti.com/api/v2/document-processes", {
      method: "POST",
    });
    expect(body.id).toBeDefined();
    expect(body.status).toBe("DRAFT");
  });

  it("gets process status", async () => {
    const { body } = await fetchJson("https://api.autenti.com/api/v2/document-processes/proc-001");
    expect(body.status).toBe("COMPLETED");
    expect(body.participants.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------
describe("Google Calendar handlers", () => {
  it("creates an event", async () => {
    const { body } = await fetchJson(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      { method: "POST" },
    );
    expect(body.id).toBeDefined();
    expect(body.status).toBe("confirmed");
  });

  it("deletes an event", async () => {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/evt-001",
      { method: "DELETE" },
    );
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------
// Outlook Calendar
// ---------------------------------------------------------------
describe("Outlook Calendar handlers", () => {
  it("creates an event", async () => {
    const { body } = await fetchJson("https://graph.microsoft.com/v1.0/me/calendar/events", {
      method: "POST",
    });
    expect(body.id).toBeDefined();
    expect(body.webLink).toContain("outlook.office365.com");
  });
});

// ---------------------------------------------------------------
// Confluence
// ---------------------------------------------------------------
describe("Confluence handlers", () => {
  it("searches pages", async () => {
    const { body } = await fetchJson(
      "https://api.atlassian.com/ex/confluence/cloud-001/wiki/rest/api/search?cql=test",
    );
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].content.title).toBe("Test Page");
  });
});

// ---------------------------------------------------------------
// Notion
// ---------------------------------------------------------------
describe("Notion handlers", () => {
  it("searches pages", async () => {
    const { body } = await fetchJson("https://api.notion.com/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    });
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].object).toBe("page");
  });
});

// ---------------------------------------------------------------
// Clockify
// ---------------------------------------------------------------
describe("Clockify handlers", () => {
  it("gets time entries", async () => {
    const { body } = await fetchJson(
      "https://api.clockify.me/api/v1/workspaces/ws-001/user/user-001/time-entries",
    );
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].billable).toBe(true);
  });
});

// ---------------------------------------------------------------
// KSeF
// ---------------------------------------------------------------
describe("KSeF handlers", () => {
  it("starts invoice query", async () => {
    const { body } = await fetchJson("https://ksef-test.mf.gov.pl/api/v2/invoices/query/metadata", {
      method: "POST",
    });
    expect(body.queryId).toBeDefined();
  });

  it("polls query status with results", async () => {
    const { body } = await fetchJson(
      "https://ksef-test.mf.gov.pl/api/v2/invoices/query/query-001/status",
    );
    expect(body.status).toBe("COMPLETED");
    expect(body.invoiceMetadataList.length).toBeGreaterThan(0);
    expect(body.invoiceMetadataList[0].invoiceNumber).toBe("FV/2026/001");
  });

  it("gets invoice XML", async () => {
    const res = await fetch("https://ksef-test.mf.gov.pl/api/v2/invoices/ksef/ref-001");
    const text = await res.text();
    expect(text).toContain("Faktura");
    expect(res.headers.get("Content-Type")).toBe("application/xml");
  });

  it("handles auth challenge", async () => {
    const { body } = await fetchJson("https://ksef-test.mf.gov.pl/api/v2/auth/challenge", {
      method: "POST",
    });
    expect(body.challenge).toBeDefined();
    expect(body.timestampMs).toBeDefined();
  });
});

// ---------------------------------------------------------------
// Resend
// ---------------------------------------------------------------
describe("Resend handlers", () => {
  it("sends an email", async () => {
    const { body } = await fetchJson("https://api.resend.com/emails", {
      method: "POST",
    });
    expect(body.id).toBeDefined();
    expect(body.from).toContain("contractorhub.io");
  });
});

// ---------------------------------------------------------------
// Claude OCR
// ---------------------------------------------------------------
describe("Claude OCR handlers", () => {
  it("extracts invoice data", async () => {
    const { body } = await fetchJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-5-20250514", messages: [] }),
    });
    expect(body.content[0].name).toBe("extract_invoice_data");
    expect(body.content[0].input.invoiceNumber.value).toBe("FV/2026/001");
    expect(body.content[0].input.totalGross.confidence).toBeGreaterThan(0.9);
  });
});

// ---------------------------------------------------------------
// QStash
// ---------------------------------------------------------------
describe("QStash handlers", () => {
  it("publishes a message", async () => {
    const { body } = await fetchJson(
      "https://qstash.upstash.io/v2/publish/https://example.com/webhook",
      { method: "POST" },
    );
    expect(body.messageId).toMatch(/^msg_/);
  });
});

// ---------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------
describe("selectHandlers", () => {
  it("returns only specified provider handlers", () => {
    const handlers = selectHandlers(["stripe", "jira"]);
    // Should be a subset of all handlers
    const all = allHandlers();
    expect(handlers.length).toBeLessThan(all.length);
    expect(handlers.length).toBeGreaterThan(0);
  });
});

describe("allHandlers with network conditions", () => {
  it("applies delay to all handlers", () => {
    const handlers = allHandlers({
      network: { delayMs: 100 },
    });
    expect(handlers.length).toBeGreaterThan(0);
  });
});
