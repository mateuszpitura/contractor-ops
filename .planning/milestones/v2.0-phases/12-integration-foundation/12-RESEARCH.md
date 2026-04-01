# Phase 12: Integration Foundation - Research

**Researched:** 2026-03-23
**Domain:** OAuth credential storage, webhook ingestion, integration health monitoring, adapter pattern
**Confidence:** HIGH

## Summary

Phase 12 builds the shared integration infrastructure that all subsequent provider phases (13-20) will use. The codebase already has a working Slack integration with AES-256-GCM encryption, OAuth flow, webhook signature verification, and a connection card UI -- but everything is Slack-specific. This phase extracts that into a generic framework with a `packages/integrations` monorepo package, migrates Slack and Resend to it, and adds token expiry tracking with proactive refresh.

The database schema already has the four integration tables (IntegrationConnection, ExternalLink, IntegrationSyncLog, WebhookDelivery) with correct indexes. The critical gap is that IntegrationConnection lacks token expiry fields -- `credentialsRef` stores a single encrypted string with no structured metadata about refresh tokens or expiry times. A schema migration is needed to support the encrypted JSON blob approach (D-02) with expiry tracking.

QStash (already in the Upstash ecosystem) provides HTTP-based queue processing ideal for serverless/Vercel deployment. Webhook payloads arrive, get HMAC-verified and stored in WebhookDelivery, then are published to QStash for async processing with automatic retries.

**Primary recommendation:** Extract the existing Slack encryption/OAuth/webhook patterns into `packages/integrations` with a TypeScript adapter interface, add QStash for async webhook processing and cron-based token refresh, and migrate Slack + Resend as validation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Per-provider encryption keys -- each provider gets its own env var (e.g., JIRA_ENCRYPTION_KEY, DOCUSIGN_ENCRYPTION_KEY). More isolation between providers, independent key rotation.
- **D-02:** Encrypted JSON blob in credentialsRef field -- store all tokens (access, refresh, scopes, expiry) as one encrypted JSON object. Flexible for providers with different token shapes. Existing Slack pattern stores similarly.
- **D-03:** Proactive cron refresh + lazy fallback -- background job checks token expiry periodically and refreshes before expiry. Lazy refresh on API call as safety net if cron misses. Most robust approach.
- **D-04:** Migrate existing Slack credentials to the new generic store -- proves the abstraction works with a real provider. One credential management pattern going forward.
- **D-05:** Queue-based async processing via Upstash QStash -- webhook arrives, HMAC verified, stored in WebhookDelivery, pushed to queue for async processing. Handles retries, backpressure, timeouts. Upstash already in stack for Redis cache.
- **D-06:** Single endpoint + provider routing -- one `/api/webhooks/[provider]` route that dispatches to registered handlers by provider slug. Central signature verification, clean URL structure.
- **D-07:** Migrate both Slack interactivity and Resend inbound webhooks to the unified system -- proves the abstraction with two real providers. Single webhook pattern going forward.
- **D-08:** Provider cards grid layout -- card per provider showing status badge (connected/error/disconnected), last sync time, error count. Click to expand. Matches card-based patterns used in dashboard KPIs.
- **D-09:** Connection details + recent sync log on click -- expandable card or slide-over showing connection metadata, token expiry countdown, last 10 sync entries, last 10 webhook deliveries. Re-authorize and disconnect buttons.
- **D-10:** Polling every 30s via TanStack Query auto-refetch -- simple, works with existing patterns, no WebSocket infrastructure needed.
- **D-11:** TypeScript interface + adapter pattern -- define IntegrationProvider interface with methods like getOAuthConfig(), handleWebhook(), refreshToken(), getHealthStatus(). Each provider implements it. Typed, testable, enforces consistency.
- **D-12:** New `packages/integrations` package in monorepo -- dedicated package for the framework: interfaces, base adapter, credential service, webhook dispatcher. Providers register adapters here. Clean separation from API layer.
- **D-13:** Use Slack migration as the real framework validation -- migrating Slack to the new framework IS the end-to-end test. Real OAuth flow, real webhooks, real credential refresh. No mock/stub provider needed.

### Claude's Discretion
- Exact cron interval for proactive token refresh (suggested: every 15 min)
- QStash retry strategy and backoff configuration
- Encryption algorithm details (AES-256-GCM already proven)
- Exact card component design and spacing
- Sync log pagination and filtering UX
- Internal package structure within packages/integrations

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTG-01 | Admin can connect third-party services via OAuth 2.0 with encrypted token storage | Existing Slack OAuth flow generalized via IntegrationProvider adapter interface (D-11). Per-provider encryption keys (D-01) with encrypted JSON blob (D-02). Schema migration adds token expiry fields. |
| INTG-02 | System receives and routes webhooks from external services | Single `/api/webhooks/[provider]` route (D-06) with HMAC verification, WebhookDelivery logging, QStash async processing (D-05). Slack interactivity + Resend migrated as validation (D-07). |
| INTG-03 | Admin can view integration connection health and sync status per provider | Provider cards grid (D-08) with expandable details (D-09), 30s polling (D-10). tRPC procedures for health data from IntegrationConnection + IntegrationSyncLog + WebhookDelivery tables. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @upstash/qstash | 2.10.1 | Webhook queue + cron scheduling | Already in Upstash ecosystem (Redis cache), HTTP-push model fits Vercel serverless, automatic retries + DLQ |
| node:crypto | built-in | AES-256-GCM encryption | Already proven in Slack integration, zero dependencies, FIPS-compliant |
| zod | ^3.23.0 | Credential schema + webhook payload validation | Already used project-wide for all schema validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @upstash/redis | existing | Rate limiting webhook endpoints | Already installed, use for per-provider rate limiting |
| date-fns | ^4.1.0 | Token expiry calculations | Already installed, use for countdown display + cron interval math |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| QStash | Vercel Cron + inngest | QStash is simpler, already in Upstash ecosystem, no new vendor |
| Per-provider env vars | Single master key | Less isolation, single compromise exposes all providers |
| Encrypted JSON blob | Separate columns per token type | Less flexible for providers with different token shapes |

**Installation:**
```bash
pnpm add @upstash/qstash@^2.10.1 --filter @contractor-ops/integrations
```

**Version verification:** `@upstash/qstash` confirmed at 2.10.1 via `npm view` on 2026-03-23.

## Architecture Patterns

### Recommended Project Structure
```
packages/integrations/
  src/
    types/                  # IntegrationProvider interface, credential types, webhook types
      provider.ts           # Core IntegrationProvider interface
      credentials.ts        # CredentialBlob, EncryptedCredentials types
      webhook.ts            # WebhookPayload, WebhookVerificationResult types
    services/
      credential-service.ts # encrypt/decrypt/store/retrieve credentials (generic)
      webhook-dispatcher.ts # Receive, verify, log, queue webhook events
      token-refresh.ts      # Proactive cron + lazy refresh logic
      health-service.ts     # Aggregate health status from connection + sync logs
    adapters/
      base-adapter.ts       # Abstract base class with shared logic
      slack-adapter.ts      # Slack-specific: OAuth config, webhook handler, refresh
      resend-adapter.ts     # Resend-specific: webhook handler (no OAuth)
    registry.ts             # Provider registry -- register/lookup adapters by provider slug
    index.ts                # Public API exports
  package.json
  tsconfig.json

apps/web/src/app/api/
  webhooks/
    [provider]/
      route.ts              # Single dynamic route -- verify + log + queue
  cron/
    token-refresh/
      route.ts              # Proactive token refresh cron (QStash-triggered or Vercel Cron)
```

### Pattern 1: IntegrationProvider Adapter Interface
**What:** TypeScript interface that every provider must implement
**When to use:** Every new integration (Jira, DocuSign, KSeF, etc.) implements this
**Example:**
```typescript
// packages/integrations/src/types/provider.ts
export interface IntegrationProviderAdapter {
  /** Provider slug matching IntegrationProvider enum */
  readonly slug: string;
  /** Human-readable display name */
  readonly displayName: string;
  /** Whether this provider supports OAuth */
  readonly supportsOAuth: boolean;
  /** Whether this provider receives webhooks */
  readonly supportsWebhooks: boolean;

  /** OAuth configuration (client ID env var, scopes, URLs) */
  getOAuthConfig?(): OAuthConfig;

  /** Exchange OAuth code for tokens, return credential blob */
  exchangeCodeForTokens?(code: string, redirectUri: string): Promise<CredentialBlob>;

  /** Refresh an expired token, return updated credential blob */
  refreshToken?(credentials: CredentialBlob): Promise<CredentialBlob>;

  /** Verify webhook signature, return verification result */
  verifyWebhookSignature?(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult;

  /** Process a verified webhook payload */
  handleWebhook?(
    payload: unknown,
    organizationId: string,
    connectionId: string,
  ): Promise<void>;

  /** Return current health status for a connection */
  getHealthStatus?(connectionId: string): Promise<ProviderHealthStatus>;
}
```

### Pattern 2: Encrypted Credential Blob
**What:** All tokens stored as one encrypted JSON object in `credentialsRef`
**When to use:** Every credential store/retrieve operation
**Example:**
```typescript
// packages/integrations/src/types/credentials.ts
export interface CredentialBlob {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: string; // ISO 8601
  /** Provider-specific extra fields */
  extra?: Record<string, unknown>;
}

// packages/integrations/src/services/credential-service.ts
export function encryptCredentials(
  blob: CredentialBlob,
  providerSlug: string,
): string {
  const key = getProviderEncryptionKey(providerSlug);
  const json = JSON.stringify(blob);
  return encrypt(json, key); // AES-256-GCM, iv:authTag:ciphertext format
}

export function decryptCredentials(
  encrypted: string,
  providerSlug: string,
): CredentialBlob {
  const key = getProviderEncryptionKey(providerSlug);
  const json = decrypt(encrypted, key);
  return JSON.parse(json) as CredentialBlob;
}

function getProviderEncryptionKey(slug: string): Buffer {
  // Per D-01: per-provider env vars
  const envKey = `${slug.toUpperCase()}_ENCRYPTION_KEY`;
  const key = process.env[envKey];
  if (!key) {
    throw new Error(`Missing encryption key: ${envKey}`);
  }
  return Buffer.from(key, "hex");
}
```

### Pattern 3: Webhook Receive-Verify-Log-Queue Pipeline
**What:** Single dynamic route receives all webhooks, dispatches to adapter for verification, logs to WebhookDelivery, queues via QStash
**When to use:** Every inbound webhook from any provider
**Example:**
```typescript
// apps/web/src/app/api/webhooks/[provider]/route.ts
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { Client } from "@upstash/qstash";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const adapter = registry.getAdapter(provider);
  if (!adapter) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  // Step 1: Verify signature via adapter
  const verification = adapter.verifyWebhookSignature?.(rawBody, headers);
  if (!verification?.valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Step 2: Log to WebhookDelivery
  const delivery = await prisma.webhookDelivery.create({
    data: {
      organizationId: verification.organizationId ?? "PENDING",
      provider: adapter.slug.toUpperCase(),
      eventType: verification.eventType ?? "UNKNOWN",
      signatureValid: true,
      payloadJson: JSON.parse(rawBody),
      deliveryStatus: "RECEIVED",
    },
  });

  // Step 3: Queue for async processing via QStash
  const qstash = new Client({ token: process.env.QSTASH_TOKEN! });
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/_process`,
    body: { deliveryId: delivery.id, provider },
  });

  return NextResponse.json({ received: true });
}
```

### Pattern 4: Proactive Token Refresh Cron
**What:** Background job checks token expiry and refreshes before expiry
**When to use:** Runs every 15 minutes via Vercel Cron or QStash schedule
**Example:**
```typescript
// apps/web/src/app/api/cron/token-refresh/route.ts
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find connections expiring within 30 minutes
  const connections = await prisma.integrationConnection.findMany({
    where: {
      status: "CONNECTED",
      tokenExpiresAt: { lte: new Date(Date.now() + 30 * 60 * 1000) },
    },
  });

  let refreshed = 0;
  for (const conn of connections) {
    const adapter = registry.getAdapter(conn.provider.toLowerCase());
    if (!adapter?.refreshToken) continue;

    try {
      const credentials = decryptCredentials(conn.credentialsRef, conn.provider.toLowerCase());
      const newCredentials = await adapter.refreshToken(credentials);
      const encrypted = encryptCredentials(newCredentials, conn.provider.toLowerCase());

      await prisma.integrationConnection.update({
        where: { id: conn.id },
        data: {
          credentialsRef: encrypted,
          tokenExpiresAt: newCredentials.expiresAt ? new Date(newCredentials.expiresAt) : null,
          lastSyncAt: new Date(),
        },
      });
      refreshed++;
    } catch (error) {
      await prisma.integrationConnection.update({
        where: { id: conn.id },
        data: {
          status: "REAUTH_REQUIRED",
          lastErrorAt: new Date(),
          lastErrorMessage: error instanceof Error ? error.message : "Token refresh failed",
        },
      });
    }
  }

  return NextResponse.json({ refreshed, total: connections.length });
}
```

### Anti-Patterns to Avoid
- **Storing raw tokens in database:** Never store unencrypted OAuth tokens. Always encrypt via credential service.
- **Synchronous webhook processing:** Never process webhook payloads inline in the POST handler. Return 200 immediately, process via queue.
- **Hardcoding provider logic in routes:** All provider-specific behavior lives in adapters, not in API routes.
- **Single encryption key for all providers:** Violates D-01 -- use per-provider keys for isolation.
- **Polling external APIs for status:** Use webhooks for real-time updates, cron only for token refresh and health checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message queue for webhooks | Custom Redis queue with retry logic | QStash | Automatic retries, DLQ, signature verification, HTTP-push fits serverless |
| OAuth state CSRF protection | Custom token generation | Existing HMAC-signed state pattern | Already proven in Slack OAuth, timing-safe comparison |
| Encryption | Custom encryption wrapper | Node.js built-in crypto (AES-256-GCM) | Already proven, FIPS-compliant, zero deps |
| Webhook signature verification | Custom per-provider verification from scratch | Provider SDK verification methods | Slack has `@slack/web-api`, Resend has `resend.webhooks.verify` -- use them |
| Cron scheduling | Custom setTimeout/setInterval | Vercel Cron (vercel.json) + QStash fallback | Vercel Cron is free, reliable, built-in |

**Key insight:** The existing Slack integration already solves most of these problems for one provider. The work is generalization, not invention.

## Common Pitfalls

### Pitfall 1: OAuth State Parameter Mismatch After Generalization
**What goes wrong:** The existing Slack OAuth encodes state as base64url JSON with HMAC. When generalizing, the state format must include the provider slug so the callback knows which adapter to use.
**Why it happens:** The current state only has `orgId:userId:timestamp:sig`. A generic callback needs to know the provider.
**How to avoid:** Add `provider` field to the OAuth state payload. The generic callback route `/api/oauth/[provider]/callback` reads the provider from the URL, but the state must also include it for verification (prevent cross-provider CSRF).
**Warning signs:** OAuth callback redirects to wrong provider handler.

### Pitfall 2: Slack Migration Breaks Existing Functionality
**What goes wrong:** Migrating Slack to the new framework while the old code is still in use causes double-processing or missed webhooks during transition.
**Why it happens:** Both old and new webhook endpoints are live simultaneously.
**How to avoid:** Implement behind feature flags. New routes coexist with old routes. Migration happens atomically: update Slack app webhook URL + OAuth redirect URL together. Old routes remain as fallback briefly, then are removed.
**Warning signs:** Duplicate webhook deliveries, OAuth redirects to wrong URL.

### Pitfall 3: Token Refresh Race Condition
**What goes wrong:** Cron job and lazy refresh both attempt to refresh the same token simultaneously, one gets an "invalid refresh token" error because the other already consumed it.
**Why it happens:** OAuth refresh tokens are typically single-use. Two concurrent refreshes mean the second one fails.
**How to avoid:** Use Upstash Redis distributed lock with short TTL (30s) keyed by connection ID before refreshing. First acquirer wins, second skips.
**Warning signs:** Intermittent REAUTH_REQUIRED status on connections that should be healthy.

### Pitfall 4: WebhookDelivery Organization Resolution
**What goes wrong:** Webhooks arrive without organization context (e.g., Slack sends to a single URL). The system cannot create a WebhookDelivery record without `organizationId`.
**Why it happens:** Not all providers include org-identifying information in webhook headers.
**How to avoid:** Two strategies: (1) Include org ID in the webhook URL path `/api/webhooks/slack/[orgSlug]`, or (2) look up the organization from the payload (Slack team_id -> connection lookup). Current Slack interactivity handler resolves user -> org from ExternalLink. Keep this pattern.
**Warning signs:** WebhookDelivery records with null/empty organizationId.

### Pitfall 5: Encrypted Credential Migration Data Loss
**What goes wrong:** Migrating existing Slack credentials from the old format (single encrypted token string) to the new format (encrypted JSON blob) fails, leaving connections in broken state.
**Why it happens:** Old format: `iv:authTag:ciphertext` of just the access token. New format: `iv:authTag:ciphertext` of full JSON blob. Different content, same encryption.
**How to avoid:** Write a one-time migration script that: (1) decrypts with old key (SLACK_TOKEN_ENCRYPTION_KEY), (2) wraps in CredentialBlob JSON, (3) re-encrypts with new key (SLACK_ENCRYPTION_KEY). Run as a Prisma migration or seed script. Keep old decryption function available during migration.
**Warning signs:** "Invalid encrypted token format" errors after deployment.

### Pitfall 6: QStash Webhook Processing Endpoint Must Be Public
**What goes wrong:** The `/api/webhooks/_process` endpoint that QStash calls is not accessible because it's behind auth middleware.
**Why it happens:** QStash delivers via HTTP POST to your API. It's not an authenticated user request.
**How to avoid:** Use `verifySignatureAppRouter` from `@upstash/qstash/nextjs` to verify QStash signatures instead of user auth. Set `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` env vars.
**Warning signs:** QStash retries accumulate, messages end up in DLQ.

### Pitfall 7: IntegrationProvider Enum Must Be Extended
**What goes wrong:** The Prisma IntegrationProvider enum currently has providers (SLACK, JIRA, ESIGN, KSEF, etc.) but may need additions like RESEND, DOCUSIGN, AUTENTI.
**Why it happens:** The enum was designed for v1 with a broad set. Resend is not in the enum -- it processes webhooks but is not an "integration connection" in the traditional sense.
**How to avoid:** Evaluate whether Resend needs to be in the IntegrationProvider enum. Resend receives webhooks but doesn't have an IntegrationConnection (no OAuth, no credentials). Consider a separate webhook-only provider concept or just add RESEND to the enum with no connection required.
**Warning signs:** Type errors when trying to create WebhookDelivery with provider "RESEND".

## Code Examples

### Database Schema Migration (Required)
```prisma
// Add to IntegrationConnection model in integration.prisma
model IntegrationConnection {
  // ... existing fields ...
  tokenExpiresAt    DateTime?         // NEW: when access token expires
  refreshLockedAt   DateTime?         // NEW: distributed lock for refresh race condition prevention

  // credentialsRef format changes from single encrypted token to encrypted JSON blob
  // Migration handles conversion -- see Pitfall 5
}

// Add RESEND to IntegrationProvider enum if needed for WebhookDelivery
enum IntegrationProvider {
  SLACK
  RESEND              // NEW: for webhook delivery tracking
  GOOGLE_WORKSPACE
  MICROSOFT_365
  JIRA
  DOCUSIGN            // NEW: renamed from generic ESIGN
  AUTENTI             // NEW: separate from DocuSign
  KSEF
  ACCOUNTING
  OPEN_BANKING
  GITHUB
  GITLAB
}
```

### QStash Client Singleton
```typescript
// packages/integrations/src/services/qstash-client.ts
import { Client } from "@upstash/qstash";

let client: Client | null = null;

export function getQStashClient(): Client {
  if (!client) {
    client = new Client({ token: process.env.QSTASH_TOKEN! });
  }
  return client;
}
```

### Provider Registry
```typescript
// packages/integrations/src/registry.ts
import type { IntegrationProviderAdapter } from "./types/provider.js";

const adapters = new Map<string, IntegrationProviderAdapter>();

export function registerAdapter(adapter: IntegrationProviderAdapter): void {
  adapters.set(adapter.slug.toLowerCase(), adapter);
}

export function getAdapter(slug: string): IntegrationProviderAdapter | undefined {
  return adapters.get(slug.toLowerCase());
}

export function getAllAdapters(): IntegrationProviderAdapter[] {
  return Array.from(adapters.values());
}
```

### Health Status Aggregation
```typescript
// packages/integrations/src/services/health-service.ts
export async function getProviderHealth(
  organizationId: string,
  provider: string,
): Promise<ProviderHealthStatus> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { organizationId, provider: provider.toUpperCase() },
  });

  if (!connection) {
    return { status: "DISCONNECTED", provider };
  }

  const [recentSyncs, recentWebhooks, errorCount] = await Promise.all([
    prisma.integrationSyncLog.findMany({
      where: { integrationConnectionId: connection.id },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.webhookDelivery.findMany({
      where: { organizationId, provider: provider.toUpperCase() },
      orderBy: { receivedAt: "desc" },
      take: 10,
    }),
    prisma.integrationSyncLog.count({
      where: {
        integrationConnectionId: connection.id,
        status: "FAILED",
        startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    status: connection.status,
    provider,
    displayName: connection.displayName,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
    lastSuccessAt: connection.lastSuccessAt,
    lastErrorAt: connection.lastErrorAt,
    lastErrorMessage: connection.lastErrorMessage,
    tokenExpiresAt: connection.tokenExpiresAt,
    recentSyncs,
    recentWebhooks,
    errorCountLast24h: errorCount,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single encrypted token string | Encrypted JSON credential blob | This phase | Supports refresh tokens, scopes, expiry in one field |
| Provider-specific webhook routes | Single dynamic route + adapter dispatch | This phase | Eliminates route duplication, central verification |
| Manual token management | Proactive cron + lazy refresh | This phase | Tokens never expire during active use |
| Slack-only integration router | Generic integration router + provider adapters | This phase | Every future provider follows same pattern |

**Deprecated/outdated:**
- `packages/api/src/services/slack-client.ts` `encryptToken`/`decryptToken`: Replaced by generic credential service. Keep temporarily for migration compatibility.
- `apps/web/src/app/api/slack/interactivity/route.ts`: Replaced by `/api/webhooks/slack` route.
- `apps/web/src/app/api/webhooks/resend-inbound/route.ts`: Replaced by `/api/webhooks/resend` route.

## Discretion Recommendations

### Cron Interval: Every 15 minutes
**Rationale:** Most OAuth tokens expire in 1 hour. Checking every 15 minutes with a 30-minute lookahead means tokens are refreshed 15-45 minutes before expiry -- plenty of buffer. Vercel Cron supports `*/15 * * * *`. QStash schedule as alternative.

### QStash Retry Strategy
**Rationale:** Use QStash defaults with minor adjustment:
- **Retries:** 3 (QStash default)
- **Backoff:** Exponential (QStash default -- 10s, 100s, 1000s)
- **DLQ:** Enable. Failed webhooks after 3 retries go to DLQ. Surface DLQ count in health dashboard.
- **Timeout:** 30 seconds per delivery attempt (Vercel function timeout).

### AES-256-GCM Configuration
**Rationale:** Keep the exact same algorithm and format as existing Slack encryption. Proven, zero risk of algorithm issues. Format: `iv:authTag:ciphertext` (all hex-encoded). 12-byte IV, 16-byte auth tag.

### Internal Package Structure
**Rationale:** Flat services + adapters structure as shown above. No need for deep nesting. The `types/` folder keeps interfaces separate from implementation. The `registry.ts` is the integration point.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | packages/api/vitest.config.ts (extend for packages/integrations) |
| Quick run command | `pnpm --filter @contractor-ops/integrations test` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-01 | Encrypt/decrypt credential blob round-trip | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/credential-service.test.ts -t "encrypt"` | Wave 0 |
| INTG-01 | Per-provider key isolation (wrong key fails) | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/credential-service.test.ts -t "isolation"` | Wave 0 |
| INTG-01 | OAuth state generation + verification | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/oauth-state.test.ts` | Wave 0 |
| INTG-02 | Webhook signature verification dispatches correctly | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/webhook-dispatcher.test.ts -t "verify"` | Wave 0 |
| INTG-02 | Unknown provider returns 404 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/webhook-dispatcher.test.ts -t "unknown"` | Wave 0 |
| INTG-02 | WebhookDelivery record created on receive | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/webhook-dispatcher.test.ts -t "log"` | Wave 0 |
| INTG-03 | Health status aggregation returns correct structure | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/health-service.test.ts` | Wave 0 |
| INTG-01 | Token refresh updates credentials + expiry | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/token-refresh.test.ts` | Wave 0 |
| INTG-01 | Lazy refresh triggers when cron missed | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/token-refresh.test.ts -t "lazy"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/integrations test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/integrations/vitest.config.ts` -- test configuration for new package
- [ ] `packages/integrations/src/__tests__/credential-service.test.ts` -- encryption round-trip + per-provider isolation
- [ ] `packages/integrations/src/__tests__/webhook-dispatcher.test.ts` -- signature verification + logging
- [ ] `packages/integrations/src/__tests__/health-service.test.ts` -- health aggregation
- [ ] `packages/integrations/src/__tests__/token-refresh.test.ts` -- proactive + lazy refresh
- [ ] `packages/integrations/src/__tests__/oauth-state.test.ts` -- state HMAC generation + verification
- [ ] Framework install: `pnpm add vitest@^4.1.0 --filter @contractor-ops/integrations -D`

## Open Questions

1. **Resend as IntegrationProvider enum member**
   - What we know: Resend receives webhooks via Svix signatures but has no OAuth connection or stored credentials. Current implementation uses a standalone route with no IntegrationConnection.
   - What's unclear: Should RESEND be added to the IntegrationProvider enum just for WebhookDelivery tracking? Or should webhook-only providers be handled differently?
   - Recommendation: Add RESEND to the enum. WebhookDelivery already requires it. The adapter can indicate `supportsOAuth: false` and `supportsWebhooks: true`. No IntegrationConnection record needed for webhook-only providers.

2. **Slack OAuth redirect URI change**
   - What we know: Current Slack OAuth callback is at `/api/slack/oauth`. New generic pattern would be `/api/oauth/slack/callback` or similar.
   - What's unclear: Changing the redirect URI requires updating the Slack app configuration. This is a deployment coordination step.
   - Recommendation: Support both old and new callback URLs temporarily. Remove old route after confirming Slack app is updated.

3. **ESIGN enum value split**
   - What we know: Current enum has `ESIGN` as a single value. Phase 15 needs both DocuSign and Autenti as separate providers.
   - What's unclear: Whether to split now or defer to Phase 15.
   - Recommendation: Split now (add DOCUSIGN, AUTENTI) since enum migrations are cheaper to do alongside other schema changes. Mark ESIGN as deprecated.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/api/src/services/slack-client.ts` -- proven AES-256-GCM encryption pattern
- Existing codebase: `packages/db/prisma/schema/integration.prisma` -- all four integration tables already defined
- Existing codebase: `apps/web/src/app/api/slack/interactivity/route.ts` -- proven webhook signature verification pattern
- Existing codebase: `apps/web/src/app/api/webhooks/resend-inbound/route.ts` -- proven Svix webhook verification
- Existing codebase: `apps/web/src/components/settings/slack-connection-card.tsx` -- proven card UI pattern
- [Upstash QStash Next.js quickstart](https://upstash.com/docs/qstash/quickstarts/vercel-nextjs) -- setup, client, verification
- [Upstash QStash background jobs](https://upstash.com/docs/qstash/features/background-jobs) -- async processing pattern

### Secondary (MEDIUM confidence)
- npm registry: `@upstash/qstash@2.10.1` verified current via `npm view`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- QStash is the only new dependency, well-documented, verified version. Everything else is already in the project.
- Architecture: HIGH -- Adapter pattern is straightforward. All integration models already exist in Prisma. Existing Slack code provides a working reference implementation.
- Pitfalls: HIGH -- Identified from direct analysis of existing code (migration format, race conditions, enum gaps). These are real issues visible in the codebase.

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain, no fast-moving APIs)
