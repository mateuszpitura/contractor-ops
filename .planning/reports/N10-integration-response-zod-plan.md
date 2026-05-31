# Finding #10 — Integration-response Zod validation: remaining work

**Status:** shared helper `packages/integrations/src/services/parse-json-response.ts` shipped; **jira** + **slack** OAuth paths applied + verified (integrations typecheck green). This doc captures the exact per-adapter plan so the rest is mechanical.

## Pattern (per adapter)

1. `import { z } from 'zod';` + `import { parseJsonResponse } from '../services/parse-json-response.js';`
2. Add the token-response Zod schema at module scope.
3. Replace `(await response.json()) as {...}` with `await parseJsonResponse(response, <schema>, '<adapter>:<method>')` at each CRITICAL (credential-persist) site. Medium data-fetch sites may use `safeParseJsonResponse` (degrade locally) — lower priority.

## packages/integrations/src/adapters/linear-adapter.ts  (4 critical, 1 medium)

### CRITICAL packages/integrations/src/adapters/linear-adapter.ts:1-9 (import block — add zod import + token-response schema)  persistsCredential=True

- fields: N/A — this site adds the zod import and the shared schema used by the two CRITICAL token paths below (access_token, refresh_token, expires_in, token_type, scope).

Schema:
```ts
const linearTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().finite(),
  token_type: z.string().min(1).optional(),
  scope: z.union([z.array(z.string()), z.string()]).optional(),
});
```

Anchor:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
```

Replace with:
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
```

### CRITICAL packages/integrations/src/adapters/linear-adapter.ts (after the LINEAR_OAUTH_CONFIG const, before `export class LinearAdapter` at line 51) — place the shared token-response schema once at module scope so both exchangeCodeForTokens and refreshToken reuse it  persistsCredential=True

- fields: access_token (→ CredentialBlob.accessToken, persisted), refresh_token (→ refreshToken, persisted), expires_in (→ expiresAt ISO, persisted), token_type (→ tokenType, persisted), scope (→ scope, persisted)

Schema:
```ts
const LINEAR_TOKEN_RESPONSE_SCHEMA = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().finite(),
  token_type: z.string().min(1).optional(),
  scope: z.union([z.array(z.string()), z.string()]).optional(),
});
```

Anchor:
```ts
// ---------------------------------------------------------------------------
// Linear Adapter
// ---------------------------------------------------------------------------
```

Replace with:
```ts
/**
 * Shape of Linear's OAuth token endpoint response (authorization-code exchange
 * and refresh). Validated with `.parse()` at the credential-persistence
 * boundary: a malformed or changed payload throws here rather than coercing
 * `undefined` into a stored access token or `NaN` into the expiry timestamp.
 * `scope` and `token_type` are optional because Linear's refresh response may
 * omit them.
 */
const LINEAR_TOKEN_RESPONSE_SCHEMA = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().finite(),
  token_type: z.string().min(1).optional(),
  scope: z.union([z.array(z.string()), z.string()]).optional(),
});

// ---------------------------------------------------------------------------
// Linear Adapter
// ---------------------------------------------------------------------------
```

### CRITICAL packages/integrations/src/adapters/linear-adapter.ts:105-122 (exchangeCodeForTokens — CRITICAL: builds persisted CredentialBlob)  persistsCredential=True

- fields: access_token, refresh_token, expires_in, token_type, scope — all mapped into the returned CredentialBlob which is persisted to the encrypted credential store.

Schema:
```ts
(reuses module-level LINEAR_TOKEN_RESPONSE_SCHEMA from the site above)
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string[] | string;
    };

    // Linear returns scope as an array of strings — join with comma for storage
    const scope = Array.isArray(data.scope) ? data.scope.join(',') : data.scope;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

Replace with:
```ts
// Fail closed: a malformed token payload throws here rather than
    // persisting a corrupt credential.
    const data = LINEAR_TOKEN_RESPONSE_SCHEMA.parse(await response.json());

    // Linear returns scope as an array of strings — join with comma for storage
    const scope = Array.isArray(data.scope) ? data.scope.join(',') : data.scope;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

### CRITICAL packages/integrations/src/adapters/linear-adapter.ts:167-183 (refreshToken — CRITICAL: builds persisted CredentialBlob)  persistsCredential=True

- fields: access_token, refresh_token (falls back to existing credentials.refreshToken when absent), expires_in, token_type, scope — all mapped into the returned CredentialBlob which is persisted.

Schema:
```ts
(reuses module-level LINEAR_TOKEN_RESPONSE_SCHEMA)
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string[] | string;
    };

    const scope = Array.isArray(data.scope) ? data.scope.join(',') : data.scope;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

Replace with:
```ts
// Fail closed: a malformed refresh payload throws here rather than
    // overwriting a working credential with junk.
    const data = LINEAR_TOKEN_RESPONSE_SCHEMA.parse(await response.json());

    const scope = Array.isArray(data.scope) ? data.scope.join(',') : data.scope;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

_Medium (data-fetch) — lower priority: packages/integrations/src/adapters/linear-adapter.ts:364-406 (discoverWorkspace — MEDIUM: transient GraphQL data used to populate connection config, not a persisted credential)_

## notion-adapter  (2 critical, 2 medium)

### CRITICAL packages/integrations/src/adapters/notion-adapter.ts:112 (exchangeCodeForTokens)  persistsCredential=True

- fields: data.access_token -> CredentialBlob.accessToken (persisted); data.token_type -> tokenType (persisted); data.bot_id -> extra.botId; data.workspace_id -> extra.workspaceId; data.workspace_name -> extra.workspaceName. workspace_icon, duplicated_template_id, owner are cast but never read.

Schema:
```ts
NotionTokenExchangeResponseSchema (defined in the import-block edit above)
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      token_type: string;
      bot_id: string;
      workspace_id: string;
      workspace_name: string;
      workspace_icon: string | null;
      duplicated_template_id: string | null;
      owner: unknown;
    };
```

Replace with:
```ts
// Fail closed: a malformed token-exchange payload throws here rather than
    // persisting a corrupt credential to the encrypted store.
    const data = NotionTokenExchangeResponseSchema.parse(await response.json());
```

### CRITICAL packages/integrations/src/adapters/notion-adapter.ts:178 (refreshToken)  persistsCredential=True

- fields: data.access_token -> CredentialBlob.accessToken (persisted); data.token_type -> tokenType (persisted). refreshToken is carried over from existing credentials, not from this payload.

Schema:
```ts
NotionTokenRefreshResponseSchema (defined in the import-block edit above)
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      token_type: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: credentials.refreshToken,
      tokenType: data.token_type,
    };
```

Replace with:
```ts
// Fail closed on token refresh — never overwrite a stored credential with
    // an unvalidated payload.
    const data = NotionTokenRefreshResponseSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: credentials.refreshToken,
      tokenType: data.token_type,
    };
```

_Medium (data-fetch) — lower priority: packages/integrations/src/adapters/notion-adapter.ts:1 (add import after existing imports, before the timeout-budgets comment block), packages/integrations/src/adapters/notion-adapter.ts:244 (searchPages)_

## jira — DONE (applied + verified)

## packages/integrations/src/adapters/confluence-adapter.ts  (2 critical, 3 medium)

### CRITICAL packages/integrations/src/adapters/confluence-adapter.ts:110-116 (exchangeCodeForTokens)  persistsCredential=True

- fields: data.access_token → CredentialBlob.accessToken; data.refresh_token → refreshToken; data.token_type → tokenType; data.scope → scope; data.expires_in → expiresAt = new Date(Date.now() + expires_in*1000).toISOString(). ALL persisted into the encrypted credential store.

Schema:
```ts
confluenceTokenResponseSchema (defined in the import-block edit above)
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

Replace with:
```ts
// Fail closed: a malformed token response must throw BEFORE we persist a
    // corrupt credential. .parse() (not safeParse) is intentional here.
    const data = confluenceTokenResponseSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

### CRITICAL packages/integrations/src/adapters/confluence-adapter.ts:167-182 (refreshToken)  persistsCredential=True

- fields: data.access_token → accessToken; data.refresh_token ?? credentials.refreshToken → refreshToken; data.token_type → tokenType; data.scope → scope; data.expires_in → expiresAt. ALL persisted (refresh path rewrites the stored credential). Note: keeps the falling-back-to-existing refreshToken behavior, but only because the schema makes refresh_token optional rather than coercing undefined silently from a wrong-shaped body.

Schema:
```ts
confluenceTokenResponseSchema (shared — defined in the import-block edit above)
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

Replace with:
```ts
// Fail closed: a malformed refresh response must throw before overwriting
    // the stored credential with junk (a bad parse here corrupts the live
    // connection's accessToken/expiresAt).
    const data = confluenceTokenResponseSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

_Medium (data-fetch) — lower priority: packages/integrations/src/adapters/confluence-adapter.ts:1 (new import — add after existing imports block), packages/integrations/src/adapters/confluence-adapter.ts:222-227 (discoverCloudId), packages/integrations/src/adapters/confluence-adapter.ts:292-305 (searchPages)_

## google-workspace  (2 critical, 3 medium)

### CRITICAL packages/integrations/src/adapters/google-workspace-adapter.ts:142-148 (exchangeCodeForTokens)  persistsCredential=True

- fields: access_token (→ accessToken, persisted), refresh_token (→ refreshToken, persisted, optional), token_type (→ tokenType, persisted), scope (→ scope, persisted), expires_in (arithmetic: new Date(Date.now() + expires_in*1000) → expiresAt persisted). A non-numeric/absent expires_in yields NaN → 'Invalid Date'; a missing access_token persists an empty credential. All five fields feed the returned CredentialBlob that is encrypted and written to the credential store.

Schema:
```ts
googleTokenExchangeSchema (defined in the top-of-file import block above): z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional(), expires_in: z.number().int().positive(), token_type: z.string().min(1), scope: z.string() }) — used via .parse() to fail closed.
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };
```

Replace with:
```ts
const data = googleTokenExchangeSchema.parse(await response.json());
```

### CRITICAL packages/integrations/src/adapters/google-workspace-adapter.ts:199-204 (refreshToken)  persistsCredential=True

- fields: access_token (→ accessToken, persisted), token_type (→ tokenType, persisted), scope (→ scope, persisted), expires_in (arithmetic → expiresAt persisted). refresh_token is intentionally NOT read here (Google does not rotate; the existing credentials.refreshToken is reused), so it is excluded from the schema. The returned CredentialBlob is encrypted and written to the credential store by token-refresh.ts:153 / google-workspace-sync-orchestrator.ts:81 / routers/integrations/google-workspace.ts:69.

Schema:
```ts
googleTokenRefreshSchema (defined in the top-of-file import block above): z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive(), token_type: z.string().min(1), scope: z.string() }) — used via .parse() to fail closed.
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };
```

Replace with:
```ts
const data = googleTokenRefreshSchema.parse(await response.json());
```

_Medium (data-fetch) — lower priority: packages/integrations/src/adapters/google-workspace-adapter.ts:1 (add import at top of file), packages/integrations/src/adapters/google-workspace-adapter.ts:257-260 (listAllDirectoryUsers), packages/integrations/src/adapters/google-workspace-adapter.ts:314-317 (listUserGroups)_

## outlook-calendar-adapter  (2 critical, 3 medium)

### CRITICAL packages/integrations/src/adapters/outlook-calendar-adapter.ts:163  persistsCredential=True

- fields: access_token -> CredentialBlob.accessToken (persisted); refresh_token -> CredentialBlob.refreshToken (persisted, optional); token_type -> CredentialBlob.tokenType; scope -> CredentialBlob.scope; expires_in -> expiresAt = new Date(Date.now() + expires_in*1000).toISOString() (persisted)

Schema:
```ts
Add once, module scope (shared by both OAuth sites), after OUTLOOK_OAUTH_CONFIG:

// Microsoft Identity Platform token endpoint success response. Validated at
// the credential-persist boundary so a malformed/changed payload throws
// instead of writing junk (undefined accessToken / NaN expiry) to the
// encrypted credential store. Fields beyond these are ignored.
const microsoftTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  token_type: z.string().min(1),
  scope: z.string(),
});
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

Replace with:
```ts
const data = microsoftTokenResponseSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

### CRITICAL packages/integrations/src/adapters/outlook-calendar-adapter.ts:222  persistsCredential=True

- fields: access_token -> CredentialBlob.accessToken (persisted); refresh_token -> CredentialBlob.refreshToken (persisted; falls back to old credentials.refreshToken when absent); token_type -> tokenType; scope -> scope; expires_in -> expiresAt (persisted)

Schema:
```ts
Reuse the same module-scope microsoftTokenResponseSchema defined for the exchange site (do NOT redeclare).
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

Replace with:
```ts
const data = microsoftTokenResponseSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

_Medium (data-fetch) — lower priority: packages/integrations/src/adapters/outlook-calendar-adapter.ts:333, packages/integrations/src/adapters/outlook-calendar-adapter.ts:416, packages/integrations/src/adapters/outlook-calendar-adapter.ts:497_

## docusign  (2 critical, 0 medium)

### CRITICAL packages/integrations/src/adapters/docusign-adapter.ts:218  persistsCredential=True

- fields: data.access_token -> CredentialBlob.accessToken; data.refresh_token -> CredentialBlob.refreshToken; data.token_type -> CredentialBlob.tokenType; data.expires_in -> expiresAt (Date.now() + expires_in*1000). All four are persisted as an encrypted credential by the OAuth callback caller.

Schema:
```ts
// Add once, module-scope (after the `const log = createIntegrationLogger('docusign');` block or near the OAuth section). authorization_code grant always returns a refresh_token + expires_in for DocuSign, so this grant's schema is strict on those.
const docuSignTokenExchangeSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().min(1),
});
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: 'signature',
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

Replace with:
```ts
// Fail closed: a malformed token-exchange payload must throw, never
    // persist a corrupt credential (undefined token / Invalid Date expiry).
    const data = docuSignTokenExchangeSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: 'signature',
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

### CRITICAL packages/integrations/src/adapters/docusign-adapter.ts:275  persistsCredential=True

- fields: data.access_token -> CredentialBlob.accessToken; data.refresh_token -> CredentialBlob.refreshToken; data.token_type -> CredentialBlob.tokenType; data.expires_in -> expiresAt. CredentialBlob.scope is carried over from incoming credentials.scope. All persisted as an encrypted credential after refresh.

Schema:
```ts
// Add once, module-scope. refresh_token is optional+nullable: DocuSign
// does not guarantee a rotated refresh_token on every refresh response,
// so we must tolerate its absence and reuse the existing one rather than
// overwriting the stored credential with undefined.
const docuSignTokenRefreshSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).nullish(),
  expires_in: z.number().int().positive(),
  token_type: z.string().min(1),
});
```

Anchor:
```ts
const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: credentials.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

Replace with:
```ts
// Fail closed on malformed refresh payloads. Preserve the existing
    // refresh token when DocuSign does not return a new one (no rotation),
    // so a refresh never silently drops the credential's refresh ability.
    const data = docuSignTokenRefreshSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      tokenType: data.token_type,
      scope: credentials.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
```

## packages/integrations/src/adapters/slack-adapter.ts — DONE (applied + verified)

## packages/api/src/routers/integrations/jira.ts (assigned router) — but every bare-`as`-on-external-HTTP-response cast for the Jira integration lives in packages/integrations/src/adapters/jira-adapter.ts; the router itself only has one MEDIUM cast (jiraApiGet&lt;T&gt; line 108). — DONE (applied + verified)
