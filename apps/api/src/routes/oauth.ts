/**
 * OAuth start + callback handlers.
 *
 * F-SEC-05 + F-SEC-21 — browser-bound, single-use OAuth state.
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
import type { CapabilityEnum, Prisma, ScopeCapabilities } from '@contractor-ops/db';
import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
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
 * Phase 76 SC#3 — derive the Google Workspace scopeCapabilities JSONB from the
 * space-separated scope string Google returns on token exchange. Read capabilities
 * are the baseline; write capabilities (user.deprovision + directory.write) are
 * appended only when the additive admin.directory.user (non-readonly) scope was
 * granted. Existing read-only directory-import is preserved either way.
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

export function registerOAuthRoutes(app: FastifyInstance): void {
  // -----------------------------------------------------------------------
  // GET /api/oauth/:provider/start
  // -----------------------------------------------------------------------
  app.get<{ Params: { provider: string } }>(
    '/api/oauth/:provider/start',
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: linear multi-step state-mint + cookie-set + IdP redirect; splitting fragments the security audit surface
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

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: oauthConfig.scopes.join(' '),
        redirect_uri: redirectUri,
        state,
      });
      if (oauthConfig.extraAuthParams) {
        for (const [key, value] of Object.entries(oauthConfig.extraAuthParams)) {
          params.set(key, value);
        }
      }
      const idpUrl = `${oauthConfig.authorizationUrl}?${params.toString()}`;

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
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: linear cookie-verify + state-consume + token-exchange + connection-upsert; splitting fragments the security audit surface
    async (request, reply) => {
      const { provider } = request.params;
      const appUrlEnv = loadEnv().PUBLIC_APP_URL ?? '';
      const settingsUrl = (status: string) =>
        `${appUrlEnv}/settings?tab=integrations&${provider}=${status}`;

      const clearCookie = () => {
        reply.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/api/oauth' });
      };

      try {
        const code = request.query.code;
        const stateParam = request.query.state;

        if (!(code && stateParam)) {
          return noStore(reply).redirect(settingsUrl('error'), 302);
        }

        const adapter = getAdapter(provider);
        if (!(adapter?.supportsOAuth && adapter.exchangeCodeForTokens && adapter.getOAuthConfig)) {
          callbackLog.error({ provider }, 'no oauth adapter registered');
          return noStore(reply).redirect(settingsUrl('error'), 302);
        }

        const oauthConfig = adapter.getOAuthConfig();
        const signingSecret = process.env[oauthConfig.clientSecretEnvVar];
        if (!signingSecret) {
          callbackLog.error(
            { provider, envVar: oauthConfig.clientSecretEnvVar },
            'missing env var',
          );
          return noStore(reply).redirect(settingsUrl('error'), 302);
        }

        const state = verifyOAuthState(stateParam, provider, signingSecret);
        if (!state) {
          callbackLog.error({ provider }, 'invalid or expired state parameter');
          return noStore(reply).redirect(settingsUrl('error'), 302);
        }

        const cookieState =
          (request.cookies as Record<string, string | undefined>)[OAUTH_STATE_COOKIE_NAME] ?? null;
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
          clearCookie();
          return noStore(reply).redirect(settingsUrl('error'), 302);
        }

        if (
          challenge.userId !== state.userId ||
          (challenge.organizationId && challenge.organizationId !== state.orgId)
        ) {
          callbackLog.error(
            { provider },
            'oauth callback rejected: state/challenge identity mismatch',
          );
          clearCookie();
          return noStore(reply).redirect(settingsUrl('error'), 302);
        }

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

        // Phase 76 SC#3 — for Google Workspace, derive the scopeCapabilities JSONB from
        // the granted OAuth scopes. The write capabilities (user.deprovision + directory.write)
        // are appended ONLY when the additive admin.directory.user scope was granted, so an
        // existing read-only v3.0 connection that re-OAuths gains write access additively.
        const gwsScopeCapabilities =
          provider === 'google_workspace'
            ? buildGoogleWorkspaceScopeCapabilities(credentials.scope)
            : undefined;

        const connectionData = {
          status: (provider === 'linear' ? 'PENDING_MAPPING' : 'CONNECTED') as never,
          displayName,
          credentialsRef: encrypted,
          connectedByUserId: challenge.userId,
          connectedAt: new Date(),
          configJson: (credentials.extra ?? {}) as Prisma.InputJsonValue,
          tokenExpiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
          lastErrorAt: null,
          lastErrorMessage: null,
          ...(gwsScopeCapabilities
            ? { scopeCapabilities: gwsScopeCapabilities as unknown as Prisma.InputJsonValue }
            : {}),
        };

        let upsertedConnectionId: string;
        const wasFirstConnect = !existingConnection;
        if (existingConnection) {
          await prisma.integrationConnection.update({
            where: { id: existingConnection.id },
            data: connectionData,
          });
          upsertedConnectionId = existingConnection.id;
        } else {
          const created = await prisma.integrationConnection.create({
            data: {
              organizationId: targetOrgId,
              provider: adapter.slug.toUpperCase() as never,
              ...connectionData,
            },
          });
          upsertedConnectionId = created.id;
        }

        // Audit the credential upsert. The connection is already persisted,
        // so a failed audit write must not fail the user's connect flow —
        // log + Sentry best-effort rather than rolling back.
        try {
          await writeAuditLog({
            organizationId: targetOrgId,
            actorType: 'USER',
            actorId: challenge.userId,
            action: wasFirstConnect
              ? 'integration.connection.connected'
              : 'integration.connection.updated',
            resourceType: 'ORGANIZATION',
            resourceId: targetOrgId,
            resourceName: displayName,
            metadata: {
              provider: adapter.slug,
              connectionId: upsertedConnectionId,
              firstConnect: wasFirstConnect,
            },
          });
        } catch (auditErr) {
          callbackLog.error(
            { err: auditErr, provider, organizationId: targetOrgId },
            'oauth callback: audit-log write failed (connection already persisted)',
          );
          Sentry.captureException(auditErr, {
            tags: { 'audit.kind': 'integration.connection.upsert', provider },
            extra: { organizationId: targetOrgId, connectionId: upsertedConnectionId },
          });
        }

        // First-time Jira connect → seed Organization > Projects. Errors
        // never block OAuth completion (fire-and-forget with Sentry).
        if (provider === 'jira' && wasFirstConnect) {
          void (async () => {
            try {
              const org = await prisma.organization.findUniqueOrThrow({
                where: { id: targetOrgId },
                select: { dataRegion: true },
              });
              const region = (org.dataRegion ?? 'EU') as 'EU' | 'ME';
              const tenantDb = createTenantClientFrom(getRegionalClient(region));
              await tenantStore.run({ organizationId: targetOrgId, region }, () =>
                syncJiraProjectsToOrgDefinitions(
                  { db: tenantDb, actorUserId: challenge.userId },
                  {
                    id: upsertedConnectionId,
                    organizationId: targetOrgId,
                    provider: 'JIRA',
                    credentialsRef: encrypted,
                    configJson: (credentials.extra ?? {}) as { cloudId?: string },
                  },
                ),
              );
            } catch (err) {
              callbackLog.error(
                { err, provider, organizationId: targetOrgId },
                'jira on-connect sync failed',
              );
              Sentry.captureException(err, {
                tags: { 'sync.kind': 'org-definition-sync.on-connect', provider: 'jira' },
                extra: { organizationId: targetOrgId, connectionId: upsertedConnectionId },
              });
            }
          })();
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
