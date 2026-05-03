import {
  createOAuthChallenge,
  OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  OAUTH_STATE_COOKIE_NAME,
} from '@contractor-ops/api/services/oauth-challenge';
import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import { generateOAuthState, getAdapter, registerAllAdapters } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv, getServerEnvRecord } from '@contractor-ops/validators';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createLogger({ service: 'oauth-start' });

// Ensure all OAuth adapters are registered before any start request is processed
registerAllAdapters();

// ---------------------------------------------------------------------------
// GET /api/oauth/[provider]/start
//
// F-SEC-05 + F-SEC-21: browser-bound, single-use OAuth start.
//
// 1. Authenticates the session (Better Auth) — rejects unauthenticated callers.
// 2. Resolves the provider adapter and verifies its OAuth config + env vars.
// 3. Generates the HMAC-signed state, persists an `OAuthChallenge` row keyed
//    on `sha256(state)`, and sets the `__Host-oauth_state` cookie holding the
//    same `state` value (httpOnly, secure, sameSite=lax, Path=/api/oauth,
//    Max-Age=10m).
// 4. 302-redirects to the IdP authorization URL with `state` in the query.
//
// On callback, the cookie value MUST match the IdP-echoed `state` AND the
// challenge row must still be unconsumed and unexpired — see
// `apps/web/src/app/api/oauth/[provider]/callback/route.ts`.
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const settingsErrorUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/settings?tab=integrations&${provider}=error`;

  // 1. Authenticate. Anyone hitting /start must own a logged-in session — the
  //    cookie binding is meaningless if we don't first know which user the
  //    flow belongs to.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    log.warn({ provider }, 'oauth start blocked: no session');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login`);
  }

  const userId = session.user.id;
  const organizationId = session.session.activeOrganizationId ?? null;
  if (!organizationId) {
    log.warn({ provider, userId }, 'oauth start blocked: no active organization');
    return NextResponse.redirect(settingsErrorUrl);
  }

  // 2. Resolve the adapter + its OAuth config.
  const adapter = getAdapter(provider);
  if (!(adapter?.supportsOAuth && adapter.getOAuthConfig)) {
    log.error({ provider }, 'oauth start blocked: no oauth adapter');
    return NextResponse.redirect(settingsErrorUrl);
  }

  const oauthConfig = adapter.getOAuthConfig();
  const env = getServerEnvRecord();
  const clientId = env[oauthConfig.clientIdEnvVar];
  const clientSecret = env[oauthConfig.clientSecretEnvVar];
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

  if (!(clientId && clientSecret && appUrl)) {
    log.error({ provider }, 'oauth start blocked: missing client credentials');
    return NextResponse.redirect(settingsErrorUrl);
  }

  // 3. Generate state + persist challenge + set cookie.
  const redirectUri = `${appUrl}${oauthConfig.redirectPath}`;
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
    log.error({ err, provider, userId }, 'oauth start failed: challenge persist');
    return NextResponse.redirect(settingsErrorUrl);
  }

  // 4. Build the IdP URL.
  const params2 = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: oauthConfig.scopes.join(' '),
    redirect_uri: redirectUri,
    state,
  });
  if (oauthConfig.extraAuthParams) {
    for (const [key, value] of Object.entries(oauthConfig.extraAuthParams)) {
      params2.set(key, value);
    }
  }
  const idpUrl = `${oauthConfig.authorizationUrl}?${params2.toString()}`;

  // 5. Redirect with the cookie attached. The `__Host-` prefix mandates
  //    Secure + Path=/ + no Domain — except Path=/api/oauth narrows scope
  //    further (the cookie is irrelevant outside the OAuth callback path).
  const response = NextResponse.redirect(idpUrl);
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/oauth',
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  });

  log.info({ provider, organizationId, userId }, 'oauth start: challenge minted');
  return response;
}
