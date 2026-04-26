import type { Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import {
  encryptCredentials,
  getAdapter,
  registerAllAdapters,
  verifyOAuthState,
} from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createLogger({ service: 'oauth-callback' });

// Ensure all OAuth adapters are registered before any callback is processed
registerAllAdapters();

// ---------------------------------------------------------------------------
// GET /api/oauth/[provider]/callback
// Generic OAuth callback — replaces provider-specific routes.
// Exchanges authorization code for tokens via the adapter, encrypts, and
// stores credentials in IntegrationConnection.
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
      return NextResponse.redirect(settingsUrl('error'));
    }

    // Look up the adapter for this provider
    const adapter = getAdapter(provider);
    if (!(adapter?.supportsOAuth && adapter.exchangeCodeForTokens && adapter.getOAuthConfig)) {
      log.error({ provider }, 'no oauth adapter registered');
      return NextResponse.redirect(settingsUrl('error'));
    }

    // Use the adapter's configured client secret env var for state signing
    const oauthConfig = adapter.getOAuthConfig();
    const signingSecret = process.env[oauthConfig.clientSecretEnvVar];
    if (!signingSecret) {
      log.error({ provider, envVar: oauthConfig.clientSecretEnvVar }, 'missing env var');
      return NextResponse.redirect(settingsUrl('error'));
    }

    // Verify HMAC-signed state with provider in payload (cross-provider CSRF)
    const state = verifyOAuthState(stateParam, provider, signingSecret);
    if (!state) {
      log.error({ provider }, 'invalid or expired state parameter');
      return NextResponse.redirect(settingsUrl('error'));
    }

    // Exchange authorization code for tokens via adapter
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/${provider}/callback`;
    const credentials = await adapter.exchangeCodeForTokens(code, redirectUri);

    // Encrypt credentials with per-provider key (D-01)
    const encrypted = encryptCredentials(credentials, provider);

    // Upsert IntegrationConnection
    const existingConnection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId: state.orgId,
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
      connectedByUserId: state.userId,
      connectedAt: new Date(),
      configJson: (credentials.extra ?? {}) as Prisma.InputJsonValue,
      tokenExpiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
      lastErrorAt: null,
      lastErrorMessage: null,
    };

    if (existingConnection) {
      await prisma.integrationConnection.update({
        where: { id: existingConnection.id },
        data: connectionData,
      });
    } else {
      await prisma.integrationConnection.create({
        data: {
          organizationId: state.orgId,
          provider: adapter.slug.toUpperCase() as never,
          ...connectionData,
        },
      });
    }

    return NextResponse.redirect(settingsUrl('connected'));
  } catch (error) {
    log.error({ err: error, provider }, 'unexpected error');
    return NextResponse.redirect(settingsUrl('error'));
  }
}
