import type { CredentialBlob } from './credentials.js';
import type { ProviderHealthStatus } from './health.js';
import type { WebhookVerificationResult } from './webhook.js';

/**
 * OAuth configuration for providers that support OAuth 2.0 authorization.
 */
export interface OAuthConfig {
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** e.g., "/api/oauth/slack/callback" */
  redirectPath: string;
  /** Extra query parameters appended to the authorization URL (e.g., access_type, prompt). */
  extraAuthParams?: Record<string, string>;
}

/**
 * Core adapter interface that every integration provider must implement.
 * Optional methods are only required for providers that support the
 * corresponding capability (OAuth, webhooks, health checks).
 */
export interface IntegrationProviderAdapter {
  readonly slug: string;
  readonly displayName: string;
  readonly supportsOAuth: boolean;
  readonly supportsWebhooks: boolean;

  /** Returns OAuth configuration for providers that support OAuth. */
  getOAuthConfig?(): OAuthConfig;

  /** Exchanges an authorization code for access/refresh tokens. */
  exchangeCodeForTokens?(code: string, redirectUri: string): Promise<CredentialBlob>;

  /** Refreshes an expired access token using the refresh token. */
  refreshToken?(credentials: CredentialBlob): Promise<CredentialBlob>;

  /** Verifies the cryptographic signature of an incoming webhook. */
  verifyWebhookSignature?(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult;

  /** Processes a verified webhook payload. Returns provider-specific result or void. */
  handleWebhook?(payload: unknown, organizationId: string, connectionId: string): Promise<unknown>;

  /** Returns health status for a connection (recent syncs, errors, etc.). */
  getHealthStatus?(connectionId: string): Promise<ProviderHealthStatus>;
}
