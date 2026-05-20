import {
  consumeOAuthChallenge,
  OAUTH_STATE_COOKIE_NAME,
} from '@contractor-ops/api/services/oauth-challenge';
import { syncJiraProjectsToOrgDefinitions } from '@contractor-ops/api/services/org-definition-sync';
import type { Prisma } from '@contractor-ops/db';
import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import {
  encryptCredentials,
  getAdapter,
  registerAllAdapters,
  verifyOAuthState,
} from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withNoStore } from '@/lib/cache-control';

const log = createLogger({ service: 'oauth-callback' });

// Cache-Control: `no-store, private` — single-use IdP redirect target;
// every response is user/state-scoped and must never be cached.
export const dynamic = 'force-dynamic';

// Ensure all OAuth adapters are registered before any callback is processed
registerAllAdapters();

// ---------------------------------------------------------------------------
// GET /api/oauth/[provider]/callback
// Generic OAuth callback — replaces provider-specific routes.
// Exchanges authorization code for tokens via the adapter, encrypts, and
// stores credentials in IntegrationConnection.
//
// F-SEC-05 + F-SEC-21: in addition to the legacy HMAC-signed `state` check,
// we now require the browser-bound `__Host-oauth_state` cookie to match the
// IdP-echoed `state` AND the corresponding `OAuthChallenge` row to still be
// unconsumed and unexpired. The atomic `updateMany` claim guarantees
// single-use semantics, closing both the cross-account credential capture
// (F-SEC-05) and the in-window replay (F-SEC-21) gaps.
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const settingsUrl = (status: string) =>
    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/settings?tab=integrations&${provider}=${status}`;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');

    if (!(code && stateParam)) {
      return withNoStore(NextResponse.redirect(settingsUrl('error')));
    }

    // Look up the adapter for this provider
    const adapter = getAdapter(provider);
    if (!(adapter?.supportsOAuth && adapter.exchangeCodeForTokens && adapter.getOAuthConfig)) {
      log.error({ provider }, 'no oauth adapter registered');
      return withNoStore(NextResponse.redirect(settingsUrl('error')));
    }

    // Use the adapter's configured client secret env var for state signing
    const oauthConfig = adapter.getOAuthConfig();
    const signingSecret = process.env[oauthConfig.clientSecretEnvVar];
    if (!signingSecret) {
      log.error({ provider, envVar: oauthConfig.clientSecretEnvVar }, 'missing env var');
      return withNoStore(NextResponse.redirect(settingsUrl('error')));
    }

    // Step 1 — verify HMAC-signed state (cross-provider CSRF, freshness).
    const state = verifyOAuthState(stateParam, provider, signingSecret);
    if (!state) {
      log.error({ provider }, 'invalid or expired state parameter');
      return withNoStore(NextResponse.redirect(settingsUrl('error')));
    }

    // Step 2 — F-SEC-05 + F-SEC-21: enforce browser binding + single use.
    // The cookie was set on `/api/oauth/[provider]/start`; if it is missing
    // or does not match the IdP-echoed state, the callback request did not
    // originate in the browser that initiated the flow.
    const cookieState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value ?? null;
    const challenge = await consumeOAuthChallenge({
      db: prisma,
      callbackState: stateParam,
      cookieState,
      expectedProvider: provider,
    });

    if (!challenge) {
      log.warn(
        { provider, hasCookie: !!cookieState, orgId: state.orgId, userId: state.userId },
        'oauth callback rejected: challenge consume failed',
      );
      const response = NextResponse.redirect(settingsUrl('error'));
      // Clear the cookie defensively so a second click doesn't try the same
      // path with stale state.
      response.cookies.delete({ name: OAUTH_STATE_COOKIE_NAME, path: '/api/oauth' });
      return withNoStore(response);
    }

    // Defence-in-depth: HMAC-encoded user/org should match the row. If they
    // don't, treat the request as forged even though the row was unconsumed
    // (this would mean an attacker's HMAC pre-image somehow hashed to a real
    // row — not currently feasible, but cheap to assert).
    if (
      challenge.userId !== state.userId ||
      (challenge.organizationId && challenge.organizationId !== state.orgId)
    ) {
      log.error({ provider }, 'oauth callback rejected: state/challenge identity mismatch');
      const response = NextResponse.redirect(settingsUrl('error'));
      response.cookies.delete({ name: OAUTH_STATE_COOKIE_NAME, path: '/api/oauth' });
      return withNoStore(response);
    }

    // Exchange authorization code for tokens via adapter. Use the
    // server-stored redirectUri (matches what we sent to the IdP at start)
    // so we don't drift if someone tweaks NEXT_PUBLIC_APP_URL between start
    // and callback.
    const credentials = await adapter.exchangeCodeForTokens(code, challenge.redirectUri);

    // Encrypt credentials with per-provider key (D-01)
    const encrypted = encryptCredentials(credentials, provider);

    // Upsert IntegrationConnection — scoped by the SERVER-stored
    // organizationId from the challenge row, never the client-supplied state.
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

    // First-time Jira connect → seed Organization > Projects. Linear does the
    // same after the team-mapping step (see linear router) because it starts
    // in PENDING_MAPPING here. Errors never block the OAuth completion.
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
          log.error({ err, provider, organizationId: targetOrgId }, 'jira on-connect sync failed');
          Sentry.captureException(err, {
            tags: { 'sync.kind': 'org-definition-sync.on-connect', provider: 'jira' },
            extra: { organizationId: targetOrgId, connectionId: upsertedConnectionId },
          });
        }
      })();
    }

    // Clear the binding cookie now that we've successfully consumed the challenge.
    const response = NextResponse.redirect(settingsUrl('connected'));
    response.cookies.delete({ name: OAUTH_STATE_COOKIE_NAME, path: '/api/oauth' });
    return withNoStore(response);
  } catch (error) {
    log.error({ err: error, provider }, 'unexpected error');
    return withNoStore(NextResponse.redirect(settingsUrl('error')));
  }
}
