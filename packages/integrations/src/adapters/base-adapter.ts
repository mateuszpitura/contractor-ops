import type { CredentialBlob } from '../types/credentials.js';
import type { ProviderHealthStatus } from '../types/health.js';
import type { IntegrationProviderAdapter, OAuthConfig } from '../types/provider.js';
import type { WebhookVerificationResult } from '../types/webhook.js';

// ---------------------------------------------------------------------------
// Base Adapter
// ---------------------------------------------------------------------------

/**
 * Abstract base class providing default no-op implementations
 * for optional IntegrationProviderAdapter methods.
 *
 * Concrete adapters extend this and override only the methods
 * relevant to their capabilities.
 */
export abstract class BaseAdapter implements IntegrationProviderAdapter {
  abstract readonly slug: string;
  abstract readonly displayName: string;
  abstract readonly supportsOAuth: boolean;
  abstract readonly supportsWebhooks: boolean;

  getOAuthConfig?(): OAuthConfig;

  exchangeCodeForTokens?(_code: string, _redirectUri: string): Promise<CredentialBlob>;

  refreshToken?(_credentials: CredentialBlob): Promise<CredentialBlob>;

  verifyWebhookSignature?(
    _rawBody: string,
    _headers: Record<string, string>,
  ): WebhookVerificationResult;

  handleWebhook?(
    _payload: unknown,
    _organizationId: string,
    _connectionId: string,
  ): Promise<unknown>;

  getHealthStatus?(_connectionId: string): Promise<ProviderHealthStatus>;
}
