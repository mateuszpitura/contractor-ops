/**
 * OAuth start + callback handlers.
 *
 * Browser-bound, single-use OAuth state.
 *
 *   /api/oauth/:provider/start  (GET)
 *     1. Better Auth session must resolve; user must have an active org.
 *     2. Resolve adapter + its OAuth config; load client id/secret from env.
 *     3. Mint HMAC-signed `state` + persist `OAuthChallenge` row keyed on
 *        sha256(state).
 *     4. Set `__Host-oauth_state` cookie holding the same state value
 *        (httpOnly, secure, sameSite=lax, path=/api/oauth, 10 min).
 *     5. 302-redirect to the IdP authorize URL with `state` in query.
 *
 *   /api/oauth/:provider/callback  (GET)
 *     1. Pull `code` + `state` from query.
 *     2. Resolve adapter + signing secret from env.
 *     3. Verify HMAC-signed state (cross-provider CSRF, freshness).
 *     4. Atomically consume the challenge — requires the cookie value to
 *        match the IdP-echoed state, the row to still be unconsumed and
 *        unexpired. The atomic `updateMany` claim is single-use.
 *     5. Sanity-check `state` payload vs the persisted challenge row.
 *     6. Exchange code for tokens via the adapter, encrypt credentials,
 *        upsert `IntegrationConnection`. Linear lands in PENDING_MAPPING.
 *     7. First-time Jira connect kicks off the project sync best-effort.
 *     8. Clear the binding cookie + 302 → settings page.
 *
 * The same `__Host-` constraints apply: cookie path scoped to
 * `/api/oauth`. The Fastify host serves these at the same path so the
 * cookie shape carries over unchanged.
 *
 * GET routes are exempt from the CSRF origin guard by default, so no
 * special exempt prefix is needed.
 */

import { writeAuditLog } from '@contractor-ops/api/services/audit-writer';
import {
  consumeOAuthChallenge,
  createOAuthChallenge,
  OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  OAUTH_STATE_COOKIE_NAME,
} from '@contractor-ops/api/services/oauth-challenge';
import { syncJiraProjectsToOrgDefinitions } from '@contractor-ops/api/services/org-definition-sync';
import { auth } from '@contractor-ops/auth';
import type { CapabilityEnum, DataRegion, Prisma, ScopeCapabilities } from '@contractor-ops/db';
import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import type {
  CredentialBlob,
  IntegrationProviderAdapter,
  OAuthConfig,
} from '@contractor-ops/integrations';
import {
  encryptCredentials,
  GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES,
  GOOGLE_WORKSPACE_DEPROVISION_SCOPES,
  generateOAuthState,
  getAdapter,
  registerAllAdapters,
  verifyOAuthState,
} from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv, getServerEnvRecord } from '@contractor-ops/validators';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { loadEnv } from '../env.js';
import { Sentry } from '../lib/sentry.js';

const startLog = createLogger({ service: 'oauth-start' });
const callbackLog = createLogger({ service: 'oauth-callback' });

// Adapter registry is process-singleton.
registerAllAdapters();

function noStore(reply: FastifyReply): FastifyReply {
  return reply.header('cache-control', 'no-store, private');
}

/**
 * Derive the Google Workspace scopeCapabilities JSONB from the space-separated
 * scope string Google returns on token exchange. Read capabilities are the
 * baseline; write capabilities (user.deprovision + directory.write) are appended
 * only when the additive admin.directory.user (non-readonly) scope was granted.
 * Existing read-only directory-import is preserved either way.
 */
export function buildGoogleWorkspaceScopeCapabilities(
  scope: string | undefined,
): ScopeCapabilities {
  const grantedScopes = scope?.split(/\s+/).filter(Boolean) ?? [];
  const hasWriteScope = GOOGLE_WORKSPACE_DEPROVISION_SCOPES.every(s => grantedScopes.includes(s));
  const capabilities: CapabilityEnum[] = ['directory.read', 'group.read'];
  if (hasWriteScope) {
    for (const cap of GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES) {
      if (!capabilities.includes(cap)) capabilities.push(cap);
    }
  }
  return {
    provider: 'google',
    scopes: grantedScopes,
    capabilities,
    grantedAt: new Date().toISOString(),
  };
}

function buildHeaders(headers: Record<string, string | string[] | undefined>): Headers {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') out.set(key, value);
    else if (Array.isArray(value)) out.set(key, value.join(','));
  }
  return out;
}

function buildIdpAuthorizeUrl(
  oauthConfig: OAuthConfig,
  args: { clientId: string; redirectUri: string; state: string },
): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    response_type: 'code',
    scope: oauthConfig.scopes.join(' '),
    redirect_uri: args.redirectUri,
    state: args.state,
  });
  if (oauthConfig.extraAuthParams) {
    for (const [key, value] of Object.entries(oauthConfig.extraAuthParams)) {
      params.set(key, value);
    }
  }
  return `${oauthConfig.authorizationUrl}?${params.toString()}`;
}

type OAuthState = NonNullable<ReturnType<typeof verifyOAuthState>>;
type OAuthChallenge = NonNullable<Awaited<ReturnType<typeof consumeOAuthChallenge>>>;
type OAuthAdapter = IntegrationProviderAdapter & {
  exchangeCodeForTokens: NonNullable<IntegrationProviderAdapter['exchangeCodeForTokens']>;
};

type OAuthCallbackValidation =
  | { ok: false; clearCookie: boolean }
  | { ok: true; adapter: OAuthAdapter; state: OAuthState; challenge: OAuthChallenge; code: string };

/**
 * Sequential OAuth callback validation: presence of code/state → adapter +
 * signing secret resolution → HMAC state verification → single-use challenge
 * consume → state/challenge identity match. On any failure logs the specific
 * reason and signals whether the binding cookie must be cleared; on success
 * returns the narrowed adapter plus the verified state and consumed challenge.
 */
async function validateOAuthCallback(args: {
  provider: string;
  code: string | undefined;
  stateParam: string | undefined;
  cookieState: string | null;
}): Promise<OAuthCallbackValidation> {
  const { provider, code, stateParam, cookieState } = args;

  if (!(code && stateParam)) {
    return { ok: false, clearCookie: false };
  }

  const adapter = getAdapter(provider);
  if (!(adapter?.supportsOAuth && adapter.exchangeCodeForTokens && adapter.getOAuthConfig)) {
    callbackLog.error({ provider }, 'no oauth adapter registered');
    return { ok: false, clearCookie: false };
  }

  const oauthConfig = adapter.getOAuthConfig();
  const signingSecret = process.env[oauthConfig.clientSecretEnvVar];
  if (!signingSecret) {
    callbackLog.error({ provider, envVar: oauthConfig.clientSecretEnvVar }, 'missing env var');
    return { ok: false, clearCookie: false };
  }

  const state = verifyOAuthState(stateParam, provider, signingSecret);
  if (!state) {
    callbackLog.error({ provider }, 'invalid or expired state parameter');
    return { ok: false, clearCookie: false };
  }

  const challenge = await consumeOAuthChallenge({
    db: prisma,
    callbackState: stateParam,
    cookieState,
    expectedProvider: provider,
  });

  if (!challenge) {
    callbackLog.warn(
      { provider, hasCookie: !!cookieState, orgId: state.orgId, userId: state.userId },
      'oauth callback rejected: challenge consume failed',
    );
    return { ok: false, clearCookie: true };
  }

  if (
    challenge.userId !== state.userId ||
    (challenge.organizationId && challenge.organizationId !== state.orgId)
  ) {
    callbackLog.error({ provider }, 'oauth callback rejected: state/challenge identity mismatch');
    return { ok: false, clearCookie: true };
  }

  return { ok: true, adapter: adapter as OAuthAdapter, state, challenge, code };
}

/**
 * Build the connection patch and create-or-update the IntegrationConnection
 * row. For Google Workspace the scopeCapabilities JSONB is derived from the
 * granted OAuth scopes — write capabilities (user.deprovision + directory.write)
 * are appended only when the additive admin.directory.user scope was granted, so
 * an existing read-only connection that re-OAuths gains write access additively.
 */
async function upsertIntegrationConnection(args: {
  provider: string;
  adapterSlug: string;
  organizationId: string;
  existingConnectionId: string | null;
  actorUserId: string;
  displayName: string;
  encrypted: ReturnType<typeof encryptCredentials>;
  credentials: CredentialBlob;
}): Promise<{ upsertedConnectionId: string; wasFirstConnect: boolean }> {
  const { provider, credentials } = args;
  const gwsScopeCapabilities =
    provider === 'google_workspace'
      ? buildGoogleWorkspaceScopeCapabilities(credentials.scope)
      : undefined;

  const connectionData = {
    status: (provider === 'linear' ? 'PENDING_MAPPING' : 'CONNECTED') as never,
    displayName: args.displayName,
    credentialsRef: args.encrypted,
    connectedByUserId: args.actorUserId,
    connectedAt: new Date(),
    configJson: (credentials.extra ?? {}) as Prisma.InputJsonValue,
    tokenExpiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
    lastErrorAt: null,
    lastErrorMessage: null,
    ...(gwsScopeCapabilities
      ? { scopeCapabilities: gwsScopeCapabilities as unknown as Prisma.InputJsonValue }
      : {}),
  };

  if (args.existingConnectionId) {
    await prisma.integrationConnection.update({
      where: { id: args.existingConnectionId },
      data: connectionData,
    });
    return { upsertedConnectionId: args.existingConnectionId, wasFirstConnect: false };
  }

  const created = await prisma.integrationConnection.create({
    data: {
      organizationId: args.organizationId,
      provider: args.adapterSlug.toUpperCase() as never,
      ...connectionData,
    },
  });
  return { upsertedConnectionId: created.id, wasFirstConnect: true };
}

/**
 * Best-effort audit of the credential upsert. The connection is already
 * persisted, so a failed audit write must not fail the user's connect flow —
 * log + Sentry-capture rather than rolling back.
 */
async function auditConnectionUpsert(args: {
  provider: string;
  adapterSlug: string;
  organizationId: string;
  actorUserId: string;
  connectionId: string;
  displayName: string;
  wasFirstConnect: boolean;
}): Promise<void> {
  try {
    await writeAuditLog({
      organizationId: args.organizationId,
      actorType: 'USER',
      actorId: args.actorUserId,
      action: args.wasFirstConnect
        ? 'integration.connection.connected'
        : 'integration.connection.updated',
      resourceType: 'ORGANIZATION',
      resourceId: args.organizationId,
      resourceName: args.displayName,
      metadata: {
        provider: args.adapterSlug,
        connectionId: args.connectionId,
        firstConnect: args.wasFirstConnect,
      },
    });
  } catch (auditErr) {
    callbackLog.error(
      { err: auditErr, provider: args.provider, organizationId: args.organizationId },
      'oauth callback: audit-log write failed (connection already persisted)',
    );
    Sentry.captureException(auditErr, {
      tags: { 'audit.kind': 'integration.connection.upsert', provider: args.provider },
      extra: { organizationId: args.organizationId, connectionId: args.connectionId },
    });
  }
}

/**
 * Fire-and-forget first-time Jira connect sync. Errors never block OAuth
 * completion — log + Sentry-capture only.
 */
async function syncJiraOnConnect(args: {
  organizationId: string;
  actorUserId: string;
  connectionId: string;
  credentialsRef: string;
  configExtra: Record<string, unknown> | undefined;
}): Promise<void> {
  try {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: args.organizationId },
      select: { dataRegion: true },
    });
    const region: DataRegion = org.dataRegion ?? 'EU';
    const tenantDb = createTenantClientFrom(getRegionalClient(region));
    await tenantStore.run({ organizationId: args.organizationId, region }, () =>
      syncJiraProjectsToOrgDefinitions(
        { db: tenantDb, actorUserId: args.actorUserId },
        {
          id: args.connectionId,
          organizationId: args.organizationId,
          provider: 'JIRA',
          credentialsRef: args.credentialsRef,
          configJson: (args.configExtra ?? {}) as { cloudId?: string },
        },
      ),
    );
  } catch (err) {
    callbackLog.error(
      { err, provider: 'jira', organizationId: args.organizationId },
      'jira on-connect sync failed',
    );
    Sentry.captureException(err, {
      tags: { 'sync.kind': 'org-definition-sync.on-connect', provider: 'jira' },
      extra: { organizationId: args.organizationId, connectionId: args.connectionId },
    });
  }
}

export function registerOAuthRoutes(app: FastifyInstance): void {
  // -----------------------------------------------------------------------
  // GET /api/oauth/:provider/start
  // -----------------------------------------------------------------------
  app.get<{ Params: { provider: string } }>(
    '/api/oauth/:provider/start',
    async (request, reply) => {
      const { provider } = request.params;
      const appUrlEnv = loadEnv().PUBLIC_APP_URL ?? '';
      const settingsErrorUrl = `${appUrlEnv}/settings?tab=integrations&${provider}=error`;
      const loginUrl = `${appUrlEnv}/login`;

      const fwdHeaders = buildHeaders(request.headers);
      const session = await auth.api.getSession({ headers: fwdHeaders });
      if (!session) {
        startLog.warn({ provider }, 'oauth start blocked: no session');
        return noStore(reply).redirect(loginUrl, 302);
      }

      const userId = session.user.id;
      const organizationId = session.session.activeOrganizationId ?? null;
      if (!organizationId) {
        startLog.warn({ provider, userId }, 'oauth start blocked: no active organization');
        return noStore(reply).redirect(settingsErrorUrl, 302);
      }

      const adapter = getAdapter(provider);
      if (!(adapter?.supportsOAuth && adapter.getOAuthConfig)) {
        startLog.error({ provider }, 'oauth start blocked: no oauth adapter');
        return noStore(reply).redirect(settingsErrorUrl, 302);
      }

      const oauthConfig = adapter.getOAuthConfig();
      const env = getServerEnvRecord();
      const clientId = env[oauthConfig.clientIdEnvVar];
      const clientSecret = env[oauthConfig.clientSecretEnvVar];
      const appUrl = getServerEnv().PUBLIC_APP_URL;
      const apiUrl = loadEnv().API_URL;

      if (!(clientId && clientSecret && appUrl && apiUrl)) {
        startLog.error({ provider }, 'oauth start blocked: missing client credentials');
        return noStore(reply).redirect(settingsErrorUrl, 302);
      }

      // IdP callback lands on the API host (not the static SPA). Legacy Next
      // used APP_URL because the monolith served /api/* on the same origin.
      const redirectUri = `${apiUrl}${oauthConfig.redirectPath}`;
      const state = generateOAuthState(provider, organizationId, userId, clientSecret);

      try {
        await createOAuthChallenge({
          db: prisma,
          state,
          provider,
          organizationId,
          userId,
          redirectUri,
        });
      } catch (err) {
        startLog.error({ err, provider, userId }, 'oauth start failed: challenge persist');
        return noStore(reply).redirect(settingsErrorUrl, 302);
      }

      const idpUrl = buildIdpAuthorizeUrl(oauthConfig, { clientId, redirectUri, state });

      // `__Host-` prefix mandates Secure + no Domain; Path=/api/oauth
      // narrows the cookie to the OAuth start/callback pair so it never
      // ships with unrelated requests.
      reply.setCookie(OAUTH_STATE_COOKIE_NAME, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api/oauth',
        maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
      });

      startLog.info({ provider, organizationId, userId }, 'oauth start: challenge minted');
      return noStore(reply).redirect(idpUrl, 302);
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/oauth/:provider/callback
  // -----------------------------------------------------------------------
  app.get<{ Params: { provider: string }; Querystring: Record<string, string> }>(
    '/api/oauth/:provider/callback',
    async (request, reply) => {
      const { provider } = request.params;
      const appUrlEnv = loadEnv().PUBLIC_APP_URL ?? '';
      const settingsUrl = (status: string) =>
        `${appUrlEnv}/settings?tab=integrations&${provider}=${status}`;

      const clearCookie = () => {
        reply.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/api/oauth' });
      };

      try {
        const cookieState =
          (request.cookies as Record<string, string | undefined>)[OAUTH_STATE_COOKIE_NAME] ?? null;
        const validated = await validateOAuthCallback({
          provider,
          code: request.query.code,
          stateParam: request.query.state,
          cookieState,
        });

        if (!validated.ok) {
          if (validated.clearCookie) clearCookie();
          return noStore(reply).redirect(settingsUrl('error'), 302);
        }

        const { adapter, state, challenge, code } = validated;

        const credentials = await adapter.exchangeCodeForTokens(code, challenge.redirectUri);

        const encrypted = encryptCredentials(credentials, provider);

        const targetOrgId = challenge.organizationId ?? state.orgId;
        const existingConnection = await prisma.integrationConnection.findFirst({
          where: {
            organizationId: targetOrgId,
            provider: adapter.slug.toUpperCase() as never,
          },
        });

        const displayName =
          (credentials.extra?.teamName as string) ??
          (credentials.extra?.displayName as string) ??
          adapter.displayName;

        const { upsertedConnectionId, wasFirstConnect } = await upsertIntegrationConnection({
          provider,
          adapterSlug: adapter.slug,
          organizationId: targetOrgId,
          existingConnectionId: existingConnection?.id ?? null,
          actorUserId: challenge.userId,
          displayName,
          encrypted,
          credentials,
        });

        await auditConnectionUpsert({
          provider,
          adapterSlug: adapter.slug,
          organizationId: targetOrgId,
          actorUserId: challenge.userId,
          connectionId: upsertedConnectionId,
          displayName,
          wasFirstConnect,
        });

        // First-time Jira connect → seed Organization > Projects. Errors
        // never block OAuth completion (fire-and-forget with Sentry).
        if (provider === 'jira' && wasFirstConnect) {
          void syncJiraOnConnect({
            organizationId: targetOrgId,
            actorUserId: challenge.userId,
            connectionId: upsertedConnectionId,
            credentialsRef: encrypted,
            configExtra: credentials.extra,
          });
        }

        clearCookie();
        return noStore(reply).redirect(settingsUrl('connected'), 302);
      } catch (error) {
        callbackLog.error({ err: error, provider }, 'unexpected error');
        return noStore(reply).redirect(settingsUrl('error'), 302);
      }
    },
  );
}
