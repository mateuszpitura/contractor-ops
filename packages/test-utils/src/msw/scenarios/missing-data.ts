import { HttpResponse, http } from "msw";
import { mockId } from "../utils.js";

/**
 * Handlers that return incomplete/missing data from external APIs.
 * Tests that our system handles nullable fields, missing optional data,
 * and partially populated responses without crashing.
 */
export function missingDataHandlers() {
  return [
    // --- Jira issue with many null/missing fields ---
    http.get(
      "https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey",
      ({ params }) => {
        return HttpResponse.json({
          id: mockId(),
          key: params.issueKey,
          fields: {
            summary: "Issue with minimal data",
            // description: missing entirely
            status: { id: "1", name: "To Do", statusCategory: { key: "new" } },
            assignee: null, // unassigned
            priority: null, // no priority
            issuetype: { id: "10001", name: "Task" },
            project: { id: "10000", key: "TEST", name: "Test Project" },
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            worklog: { total: 0, worklogs: [] },
            // labels: missing
            // components: missing
            // fixVersions: missing
            // customfield_*: all missing
          },
        });
      },
    ),

    // --- Linear issue with nulls everywhere ---
    http.post("https://api.linear.app/graphql", async ({ request }) => {
      const body = (await request.json()) as { query: string };
      if (body.query.includes("issue(") || body.query.includes("issue (")) {
        return HttpResponse.json({
          data: {
            issue: {
              id: mockId(),
              identifier: "ENG-999",
              title: "Issue with nulls",
              description: null,
              state: { id: "state-todo", name: "Todo", type: "unstarted" },
              assignee: null, // no assignee
              team: { id: "team-001", name: "Engineering", key: "ENG" },
              labels: { nodes: [] },
              project: null, // no project
              cycle: null, // no cycle
              dueDate: null,
              estimate: null,
              priority: 0, // no priority
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (body.query.includes("issueCreate")) {
        return HttpResponse.json({
          data: {
            issueCreate: {
              success: true,
              issue: {
                id: mockId(),
                identifier: "ENG-1000",
                title: "Created issue",
                url: "https://linear.app/test-org/issue/ENG-1000",
                state: null, // sometimes Linear returns null state briefly
              },
            },
          },
        });
      }

      return HttpResponse.json({ data: {} });
    }),

    // --- Slack users.list with missing profile fields ---
    http.post("https://slack.com/api/users.list", () => {
      return HttpResponse.json({
        ok: true,
        members: [
          {
            id: "U_INCOMPLETE",
            name: "incomplete_user",
            deleted: false,
            is_bot: false,
            profile: {
              // email: missing — some Slack users don't have email visible
              real_name: "Incomplete User",
              display_name: "", // empty display name
              // image_48: missing
            },
          },
          {
            id: "U_DEACTIVATED",
            name: "old_user",
            deleted: true, // deactivated user
            is_bot: false,
            profile: {
              email: "old@example.com",
              real_name: "Old User",
            },
          },
          {
            id: "U_BOT",
            name: "bot",
            deleted: false,
            is_bot: true, // bot account
            profile: {
              real_name: "Bot Account",
            },
          },
        ],
        response_metadata: { next_cursor: "" },
      });
    }),

    // --- DocuSign envelope with incomplete recipient data ---
    http.get(
      "https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes/:envelopeId/recipients",
      () => {
        return HttpResponse.json({
          signers: [
            {
              recipientId: "1",
              email: "contractor@example.com",
              name: "Test Contractor",
              status: "sent", // not yet signed
              signedDateTime: null, // hasn't signed
              clientUserId: null, // not embedded signer
              deliveredDateTime: null,
              // tabs: missing
            },
          ],
          // carbonCopies: missing
          // certifiedDeliveries: missing
        });
      },
    ),

    // --- Clockify time entries with null fields ---
    http.get(
      "https://api.clockify.me/api/v1/workspaces/:workspaceId/user/:userId/time-entries",
      () => {
        return HttpResponse.json([
          {
            id: mockId(),
            description: "", // empty description
            timeInterval: {
              start: new Date().toISOString(),
              end: null, // running timer — no end
              duration: null,
            },
            projectId: null, // no project assigned
            taskId: null,
            billable: false,
            userId: "user-001",
            workspaceId: "ws-001",
            tags: [], // no tags — empty array instead of missing
          },
        ]);
      },
    ),

    // --- Claude OCR with low confidence / missing fields ---
    http.post("https://api.anthropic.com/v1/messages", () => {
      return HttpResponse.json({
        id: `msg_${mockId()}`,
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-5-20250514",
        content: [
          {
            type: "tool_use",
            id: `toolu_${mockId().slice(0, 12)}`,
            name: "extract_invoice_data",
            input: {
              invoiceNumber: { value: "FV/2026/???", confidence: 0.3 },
              issueDate: { value: "2026-03-15", confidence: 0.85 },
              dueDate: { value: null, confidence: 0.1 }, // couldn't read
              sellerNip: { value: "1234567890", confidence: 0.7 },
              buyerNip: { value: null, confidence: 0.05 }, // unreadable
              sellerName: { value: "Partially Reada...", confidence: 0.4 },
              buyerName: { value: null, confidence: 0.1 },
              currency: { value: "PLN", confidence: 0.9 },
              totalNet: { value: 10000.0, confidence: 0.6 },
              totalTax: { value: null, confidence: 0.2 },
              totalGross: { value: 12300.0, confidence: 0.55 },
              bankAccount: { value: null, confidence: 0.05 },
              lineItems: [], // couldn't parse any line items
            },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 1500, output_tokens: 200 },
      });
    }),

    // --- Notion search returning pages without title ---
    http.post("https://api.notion.com/v1/search", () => {
      return HttpResponse.json({
        object: "list",
        results: [
          {
            id: mockId(),
            object: "page",
            created_time: new Date().toISOString(),
            last_edited_time: new Date().toISOString(),
            icon: null, // no icon
            parent: { type: "workspace", workspace: true },
            url: "https://www.notion.so/Untitled-abc123",
            properties: {
              title: {
                id: "title",
                type: "title",
                title: [], // empty title array — untitled page
              },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      });
    }),

    // --- Google Calendar event create returning minimal response ---
    http.post("https://www.googleapis.com/calendar/v3/calendars/:calendarId/events", () => {
      return HttpResponse.json({
        id: mockId().replace(/-/g, ""),
        // htmlLink: missing sometimes for certain calendar types
        // etag: missing
        status: "confirmed",
      });
    }),

    // --- Autenti process with minimal participant data ---
    http.get("https://api.autenti.com/api/v2/document-processes/:processId", ({ params }) => {
      return HttpResponse.json({
        id: params.processId,
        title: "Contract",
        status: "IN_PROGRESS",
        createdAt: new Date().toISOString(),
        completedAt: null,
        participants: [
          {
            id: mockId(),
            role: "signer",
            party: {
              firstName: "Jan",
              lastName: null, // missing last name
              email: null, // missing email — invited via link
            },
            status: "PENDING",
          },
        ],
      });
    }),
  ];
}
