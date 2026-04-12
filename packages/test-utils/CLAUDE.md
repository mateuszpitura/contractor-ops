# @contractor-ops/test-utils

MSW-based mock server for all external service integrations. Intercepts HTTP requests at the network level — no production code changes needed.

## Quick Start

```typescript
import { createMockServer } from "@contractor-ops/test-utils/msw/server";

const { server, capture } = createMockServer();

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => { server.resetHandlers(); capture.clear(); });
afterAll(() => server.close());
```

Or with the convenience wrapper (auto-registers vitest lifecycle hooks):

```typescript
import { useMockServer } from "@contractor-ops/test-utils/msw/server";

const { server, capture } = useMockServer();
```

## Architecture

```
packages/test-utils/src/msw/
├── server.ts          # createMockServer(), useMockServer()
├── types.ts           # NetworkCondition, HandlerOptions, CapturedRequest
├── utils.ts           # applyNetworkConditions(), RequestCapture, mockId()
├── handlers/          # One file per provider — happy-path defaults
│   ├── index.ts       # allHandlers(), selectHandlers(), handlersByProvider
│   ├── stripe.ts      # Customers, subscriptions (POST for update), invoices, checkout, billing portal, meter events, subscription items
│   ├── jira.ts        # OAuth, issues CRUD, worklogs (read+write), JQL search (GET), transitions, statuses, projects, webhook management
│   ├── linear.ts      # OAuth, GraphQL (teams, issues CRUD, user lookup, workflowState, webhook create/delete)
│   ├── slack.ts       # OAuth, chat.postMessage, chat.update, users.list
│   ├── docusign.ts    # OAuth, envelopes, signing URLs, documents, recipients, void
│   ├── autenti.ts     # OAuth, document processes, files, participants, actions
│   ├── google-calendar.ts  # OAuth, events CRUD
│   ├── outlook-calendar.ts # OAuth (Microsoft), Graph API events CRUD
│   ├── confluence.ts  # Atlassian OAuth, cloud ID discovery, search, pages
│   ├── notion.ts      # OAuth, search
│   ├── clockify.ts    # All 5 regional endpoints — user, time entries, projects
│   ├── ksef.ts        # Public key, auth challenge, token redeem, session poll, invoice query+poll, XML download, session terminate (both test+prod env)
│   ├── resend.ts      # Send email, batch, get email
│   ├── claude-ocr.ts  # Anthropic Messages API with tool_use (extract_invoice_data)
│   ├── qstash.ts      # Publish, enqueue, batch
│   ├── upstash-redis.ts # GET, SET, DEL, SCAN — in-memory key-value store (clearRedisStore() to reset)
│   ├── r2.ts          # S3-compatible PUT, GET, HEAD, DELETE — in-memory object store
│   └── google-workspace.ts # OAuth, Directory API users list, groups list
├── scenarios/         # Override handlers for specific test conditions
│   ├── missing-data.ts     # Null fields, empty arrays, missing optional data
│   ├── degraded.ts         # Slow responses (2-10s), 502/503/529 errors
│   ├── rate-limited.ts     # HTTP 429 + Retry-After headers, recovers after N calls
│   ├── token-expired.ts    # 401 on first call, token refresh works, retry succeeds
│   ├── partial-failure.ts  # Some providers up, others down
│   └── webhook-replay.ts   # Webhook payload factories + replayWebhook() helper
└── fixtures/          # Reusable data factories
    ├── stripe.ts      # customer(), subscription(), invoice()
    ├── jira.ts        # issue(), issueMinimal(), worklog()
    ├── linear.ts      # issue(), issueMinimal(), team()
    └── ocr.ts         # highConfidence(), lowConfidence(), multiLineItems()
```

## Selecting Specific Providers

Don't load all 15 providers if you only need 2:

```typescript
import { selectHandlers } from "@contractor-ops/test-utils/msw/handlers";

const server = setupServer(...selectHandlers(["stripe", "jira"]));
```

Available provider names: `stripe`, `jira`, `linear`, `slack`, `docusign`, `autenti`, `googleCalendar`, `outlookCalendar`, `confluence`, `notion`, `clockify`, `ksef`, `resend`, `claudeOcr`, `qstash`, `upstashRedis`, `r2`, `googleWorkspace`.

## Network Conditions (Delays, Error Injection)

Apply to all handlers globally:

```typescript
const { server } = createMockServer({
  handlerOptions: {
    network: {
      delayMs: 200,           // Fixed delay per request
      delayRange: [100, 500], // Random delay (alternative to delayMs)
      errorRate: 0.1,         // 10% chance of returning an error
      errorStatus: 503,       // HTTP status on error (default: 500)
      errorBody: { message: "Simulated failure" },
    },
  },
});
```

## Scenarios

Override default handlers for specific test conditions:

```typescript
import { missingDataHandlers } from "@contractor-ops/test-utils/msw/scenarios";

it("handles missing assignee from Jira", async () => {
  server.use(...missingDataHandlers());
  // Now Jira returns issues with null assignee, priority, missing description
  // Slack returns users without email, deactivated users, bots
  // Claude OCR returns low confidence with null values
  // etc.
});
```

### Available Scenarios

| Scenario | What it simulates | Key providers affected |
|----------|-------------------|----------------------|
| `missingDataHandlers()` | Null fields, empty arrays, incomplete responses | Jira, Linear, Slack, DocuSign, Clockify, Claude OCR, Notion, Google Calendar, Autenti |
| `degradedHandlers()` | 2-10s delays, 502/503/529 errors | Jira (5s), Linear (503), Slack (timeout), Stripe (3s), DocuSign (502), Google (500), Resend (4s), Claude (529), QStash (503) |
| `rateLimitedHandlers()` | HTTP 429 with Retry-After, recovers after N calls | Stripe, Jira, Linear, Slack, Google Calendar, Resend |
| `tokenExpiredHandlers()` | 401 on first API call, refresh works, retry succeeds | Jira, Linear, Google Calendar, Outlook Calendar, DocuSign |
| `partialFailureHandlers()` | Some services working, others down | UP: Stripe, Resend, QStash. DOWN: Jira (503), Linear (500), Slack (channel_not_found), Google (503), DocuSign (404) |

### Pagination Edge Cases

```typescript
import { jiraPaginatedWithTokenExpiry, clockifyPaginated } from "@contractor-ops/test-utils/msw/scenarios";

server.use(...jiraPaginatedWithTokenExpiry());
// Jira returns 3 pages, page 2 returns 401 first (token expired), then succeeds on retry
```

| Scenario | What it tests |
|----------|---------------|
| `jiraPaginatedWithTokenExpiry()` | 401 mid-pagination, token refresh, retry continues |
| `jiraEmptyPagesWithNonZeroTotal()` | API reports total=5 but returns empty issues array |
| `clockifyPaginated()` | 2 pages of 50 entries, empty page 3 = stop signal |
| `googleWorkspacePaginated()` | Multi-page directory listing with nextPageToken |
| `googleWorkspaceGroupsNotFound()` | 404 when user has no groups (should return []) |

### Webhook Edge Cases

```typescript
import { invalidSignaturePayloads, linearLoopPreventionPayloads } from "@contractor-ops/test-utils/msw/scenarios";

// Test that tampered webhooks are rejected
const { payload, headers } = invalidSignaturePayloads.stripe;

// Test Linear loop prevention timing
const loop = linearLoopPreventionPayloads();
// loop.webhookAt5s  — should be SUPPRESSED (within 30s window)
// loop.webhookAt31s — should be PROCESSED (outside window)
```

| Scenario | What it tests |
|----------|---------------|
| `linearWebhookDuplicateDelivery()` | N identical webhooks in <5s dedup window |
| `invalidSignaturePayloads` | Tampered payloads for all providers (Stripe, Jira, Linear, Slack, DocuSign, Autenti, Resend) |
| `linearLoopPreventionPayloads()` | Webhook at 5s/29s (suppressed) vs 31s (processed) after outbound sync |

### Infrastructure Failures

```typescript
import { redisDownHandlers, r2ForbiddenHandlers, ocrCorruptPdfHandlers } from "@contractor-ops/test-utils/msw/scenarios";

server.use(...redisDownHandlers());
// Cache falls through to database — system should still work
```

| Scenario | What it tests |
|----------|---------------|
| **Redis**: `redisTimeoutHandlers()` | 30s timeout on cache ops |
| **Redis**: `redisCorruptResponseHandlers()` | Malformed non-JSON response |
| **Redis**: `redisDownHandlers()` | 503 on all operations |
| **R2**: `r2ForbiddenHandlers()` | 403 Access Denied |
| **R2**: `r2EmptyObjectHandlers()` | Object exists but is 0 bytes |
| **R2**: `r2NotFoundHandlers()` | 404 NoSuchKey |
| **Resend**: `resendInvalidEmailHandlers()` | 400 invalid email address |
| **Resend**: `resendUnauthorizedHandlers()` | 401 API key invalid |
| **Resend**: `resendBatchRateLimitHandlers()` | 429 after first email in batch |
| **OCR**: `ocrTimeoutHandlers()` | 2min timeout → 529 overloaded |
| **OCR**: `ocrCorruptPdfHandlers()` | 400 corrupted/unreadable PDF |
| **OCR**: `ocrBlankPageHandlers()` | All fields null, confidence 0.0 |
| **KSeF**: `ksefAuthFailureHandlers()` | 400 invalid NIP |
| **KSeF**: `ksefQueryTimeoutHandlers()` | Query stuck in PROCESSING forever |
| **KSeF**: `ksefQueryFailedHandlers()` | Query returns FAILED status |

### Webhook Payloads

Generate realistic inbound webhook payloads for testing webhook handlers:

```typescript
import { webhookPayloads, replayWebhook } from "@contractor-ops/test-utils/msw/scenarios";

// Generate a Stripe invoice.paid webhook event
const event = webhookPayloads.stripe.invoicePaid();

// With overrides
const customEvent = webhookPayloads.jira.issueUpdated({
  summary: "Custom summary",
});

// Simulate webhook replay (same payload delivered multiple times)
const replayed = replayWebhook(event, 3); // array of 3 identical events
```

Available webhook payloads:
- `stripe`: `invoicePaid()`, `subscriptionUpdated()`, `subscriptionDeleted()`
- `jira`: `issueUpdated()` (production only subscribes to `jira:issue_updated`; worklogs use polling)
- `linear`: `issueCreated()`, `issueUpdated()`
- `docusign`: `envelopeCompleted()`, `envelopeVoided()`
- `autenti`: `documentCompleted()`
- `slack`: `viewSubmission()`, `interactiveMessage()`
- `resend`: `emailDelivered()`, `emailBounced()`

## Fixtures

Factory functions for creating test data:

```typescript
import { stripeFixtures, jiraFixtures, ocrFixtures } from "@contractor-ops/test-utils/msw/fixtures";

const customer = stripeFixtures.customer({ email: "custom@test.com" });
const issue = jiraFixtures.issueMinimal(); // all nullable fields are null
const ocrResult = ocrFixtures.lowConfidence(); // blurry scan with null/low-confidence fields
```

## Request Capture

Track outbound HTTP calls for assertions:

```typescript
import { RequestCapture } from "@contractor-ops/test-utils";

const capture = new RequestCapture();
capture.capture(url, method, headers, body); // call in custom handlers

capture.assertCalled("api.stripe.com", "POST");
capture.assertNotCalled("api.linear.app");
capture.getByUrl(/jira/);
capture.getByMethod("DELETE");
capture.count; // total captured
capture.clear();
```

## SDK Interception Notes

MSW v2 intercepts both `fetch()` and Node.js `http/https` module. This means:

- **Stripe** (`stripe` SDK) — intercepted. SDK uses standard HTTP methods (create=POST, retrieve=GET, update=POST, list=GET, cancel=DELETE).
- **DocuSign** (`docusign-esign` SDK) — intercepted. SDK uses axios internally, which MSW intercepts via Node.js http module.
- **Anthropic** (`@anthropic-ai/sdk`) — intercepted. SDK uses fetch internally.
- **Slack** (`@slack/web-api`) — intercepted. SDK uses HTTP POST for all API methods.
- **Resend** (`resend` SDK) — intercepted. SDK uses fetch internally.
- **QStash** (`@upstash/qstash`) — intercepted. SDK uses fetch internally.

## Stateful Handlers

Some handlers maintain in-memory state:

- **Upstash Redis** — call `clearRedisStore()` in `afterEach` to reset the in-memory key-value store.
- **R2** — in-memory object store, resets when server resets handlers.

```typescript
import { clearRedisStore } from "@contractor-ops/test-utils/msw/handlers";

afterEach(() => {
  server.resetHandlers();
  clearRedisStore();
});
```

## Not Covered by MSW (non-HTTP protocols)

These services use non-HTTP protocols and need SDK-level mocking:

- **ClamAV** — TCP connection to `clamd` daemon. Mock `NodeClam` library directly with `vi.mock()`.
- **Database** — Prisma client. Use `@prisma/client` mocking or test database.

These services are fire-and-forget and gracefully degrade, so typically don't need mocking:

- **Sentry** — error tracking, proprietary envelope protocol. SDK silently fails in test.
- **Axiom** — log streaming, optional. Silently fails without `AXIOM_TOKEN`.
- **Cronitor** — cron health pings, silently caught on failure.

## Adding a New Provider

1. Create `src/msw/handlers/{provider}.ts` exporting a `{provider}Handlers(options?: HandlerOptions)` function
2. Add it to `src/msw/handlers/index.ts` (import, add to `handlersByProvider`, re-export)
3. Add missing-data variant to `src/msw/scenarios/missing-data.ts` if the provider has nullable fields
4. Add webhook payloads to `src/msw/scenarios/webhook-replay.ts` if it sends webhooks
5. Run `pnpm test` in this package to validate
