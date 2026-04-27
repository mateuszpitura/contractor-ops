import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@contractor-ops/db';
import { createIntegrationLogger } from '@contractor-ops/logger';
import { decryptCredentials } from '../services/credential-service.js';
import { handleSigningWebhook } from '../services/esign-webhook-handler.js';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import type { CredentialBlob } from '../types/credentials.js';
import type {
  EmbeddedSigningUrlResult,
  ESignAdapter,
  NormalizedSigningEvent,
  SignedDocumentResult,
  SigningEnvelopeRequest,
  SigningEnvelopeResult,
} from '../types/esign.js';
import type { OAuthConfig } from '../types/provider.js';
import type { WebhookVerificationResult } from '../types/webhook.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// DocuSign SDK types (untyped JS SDK — declare minimal shapes we use)
// ---------------------------------------------------------------------------

interface DocuSignApiClient {
  setBasePath(basePath: string): void;
  addDefaultHeader(name: string, value: string): void;
}

interface DocuSignEnvelopeSummary {
  envelopeId: string;
  status: string;
}

interface DocuSignRecipientView {
  url: string;
}

interface DocuSignEnvelope {
  envelopeId: string;
  status: string;
}

interface DocuSignSigner {
  recipientId: string;
  email: string;
  status: string;
  /** Display name from the original envelope; preserved across resend operations. */
  name?: string;
}

interface DocuSignRecipients {
  signers?: DocuSignSigner[];
}

/** Constructable model from docusign-esign SDK */
interface Constructable<T> {
  constructFromObject(data: Record<string, unknown>): T;
}

/** Envelopes API from docusign-esign SDK */
interface DocuSignEnvelopesApi {
  createEnvelope(
    accountId: string,
    opts: { envelopeDefinition: unknown },
  ): Promise<DocuSignEnvelopeSummary>;
  createRecipientView(
    accountId: string,
    envelopeId: string,
    opts: { recipientViewRequest: unknown },
  ): Promise<DocuSignRecipientView>;
  getDocument(accountId: string, envelopeId: string, documentId: string): Promise<Buffer>;
  getEnvelope(accountId: string, envelopeId: string): Promise<DocuSignEnvelope>;
  listRecipients(accountId: string, envelopeId: string): Promise<DocuSignRecipients>;
  update(accountId: string, envelopeId: string, opts: { envelope: unknown }): Promise<void>;
  updateRecipients(
    accountId: string,
    envelopeId: string,
    opts: { recipients: unknown; resendEnvelope?: string },
  ): Promise<void>;
}

/** Shape of the dynamically imported docusign-esign module */
interface DocuSignSdk {
  ApiClient: new () => DocuSignApiClient;
  EnvelopesApi: new (client: DocuSignApiClient) => DocuSignEnvelopesApi;
  Document: Constructable<unknown>;
  Signer: Constructable<unknown>;
  Recipients: Constructable<unknown>;
  EnvelopeDefinition: Constructable<unknown>;
  Envelope: Constructable<unknown>;
  RecipientViewRequest: Constructable<unknown>;
  Notification: Constructable<unknown>;
  Expirations: Constructable<unknown>;
  Reminders: Constructable<unknown>;
}

// ---------------------------------------------------------------------------
// Module-scoped state
// ---------------------------------------------------------------------------

const log = createIntegrationLogger('docusign');

/**
 * Cache the dynamically-imported docusign-esign SDK at module level so
 * subsequent operations don't re-resolve `import('docusign-esign')` and
 * re-cast the namespace on every API call.
 */
let sdkPromise: Promise<DocuSignSdk> | null = null;

/**
 * Returns the OAuth host (account-d.docusign.com for demo, account.docusign.com
 * for production). Driven by the `DOCUSIGN_OAUTH_HOST` env var with a safe
 * dev-only default to avoid silently signing production envelopes against
 * the demo account when configuration drifts.
 */
function getDocuSignOAuthHost(): string {
  const host = process.env.DOCUSIGN_OAUTH_HOST;
  if (host) return host;
  // In production NODE_ENV the missing env var must fail closed.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DOCUSIGN_OAUTH_HOST environment variable is required in production. ' +
        'Set it to "account.docusign.com" (production) or "account-d.docusign.com" (demo).',
    );
  }
  return 'account-d.docusign.com';
}

// ---------------------------------------------------------------------------
// DocuSign Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for DocuSign e-signature.
 *
 * Supports:
 * - OAuth 2.0 Authorization Code Grant
 * - Webhook signature verification (HMAC-SHA256 via DocuSign Connect)
 * - Embedded signing via recipient view
 * - Full envelope lifecycle (create, void, resend, download)
 *
 * Env vars required:
 * - DOCUSIGN_CLIENT_ID, DOCUSIGN_CLIENT_SECRET — for OAuth
 * - DOCUSIGN_WEBHOOK_SECRET — for Connect webhook verification
 * - DOCUSIGN_ENCRYPTION_KEY — for credential encryption
 * - APP_URL — for embedded signing frame ancestors
 */
export class DocuSignAdapter extends BaseAdapter implements ESignAdapter {
  readonly slug = 'docusign';
  readonly displayName = 'DocuSign';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;
  readonly supportsEmbeddedSigning = true;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    const host = getDocuSignOAuthHost();
    return {
      clientIdEnvVar: 'DOCUSIGN_CLIENT_ID',
      clientSecretEnvVar: 'DOCUSIGN_CLIENT_SECRET',
      authorizationUrl: `https://${host}/oauth/auth`,
      tokenUrl: `https://${host}/oauth/token`,
      scopes: ['signature'],
      redirectPath: '/api/oauth/docusign/callback',
    };
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.DOCUSIGN_CLIENT_ID;
    const clientSecret = process.env.DOCUSIGN_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'DOCUSIGN_CLIENT_ID and DOCUSIGN_CLIENT_SECRET environment variables are required',
      );
    }

    const response = await fetchWithTimeout(
      `https://${getDocuSignOAuthHost()}/oauth/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      },
      // OAuth token redemption is non-idempotent — bound the wall-clock and
      // do not retry on 5xx (re-using an authorization_code can revoke it).
      { timeoutMs: 30_000, retries: 0 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DocuSign OAuth exchange failed: ${text}`);
    }

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
  }

  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.DOCUSIGN_CLIENT_ID;
    const clientSecret = process.env.DOCUSIGN_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'DOCUSIGN_CLIENT_ID and DOCUSIGN_CLIENT_SECRET environment variables are required',
      );
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for DocuSign');
    }

    const response = await fetchWithTimeout(
      `https://${getDocuSignOAuthHost()}/oauth/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken,
        }),
      },
      // Token refresh is non-idempotent (refresh tokens may be rotated by the
      // server) — bound wall-clock, no retries.
      { timeoutMs: 30_000, retries: 0 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DocuSign token refresh failed: ${text}`);
    }

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
  }

  // -------------------------------------------------------------------------
  // E-Sign Operations
  // -------------------------------------------------------------------------

  async createEnvelope(
    connectionId: string,
    request: SigningEnvelopeRequest,
  ): Promise<SigningEnvelopeResult> {
    const { apiClient, accountId } = await this.getApiClient(connectionId);
    const docusign = await this.loadDocuSignSdk();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // Build document
    const document = docusign.Document.constructFromObject({
      documentBase64: request.documentBase64,
      name: request.documentName,
      fileExtension: 'pdf',
      documentId: '1',
    });

    // Build signers with routing order and embedded signing support
    const signers = request.signers.map((signer, index) => {
      const signerObj: Record<string, unknown> = {
        email: signer.email,
        name: signer.name,
        recipientId: String(index + 1),
        routingOrder: String(signer.routingOrder),
      };

      // Set clientUserId for embedded signing
      if (signer.clientUserId ?? request.embeddedReturnUrl) {
        signerObj.clientUserId = signer.clientUserId ?? signer.email;
      }

      return docusign.Signer.constructFromObject(signerObj);
    });

    // Build envelope definition
    const envelopeDefinition: Record<string, unknown> = {
      emailSubject: request.message ?? `Please sign: ${request.documentName}`,
      documents: [document],
      recipients: docusign.Recipients.constructFromObject({ signers }),
      status: 'sent',
    };

    // Configure notifications if specified
    if (request.expiresInDays || request.reminderIntervalDays) {
      const notification: Record<string, unknown> = {};

      if (request.expiresInDays) {
        notification.expirations = docusign.Expirations.constructFromObject({
          expireEnabled: 'true',
          expireAfter: String(request.expiresInDays),
          expireWarn: String(Math.max(1, request.expiresInDays - 2)),
        });
      }

      if (request.reminderIntervalDays) {
        notification.reminders = docusign.Reminders.constructFromObject({
          reminderEnabled: 'true',
          reminderDelay: String(request.reminderIntervalDays),
          reminderFrequency: String(request.reminderIntervalDays),
        });
      }

      envelopeDefinition.notification = docusign.Notification.constructFromObject(notification);
    }

    const envelope = docusign.EnvelopeDefinition.constructFromObject(envelopeDefinition);

    const result: DocuSignEnvelopeSummary = await envelopesApi.createEnvelope(accountId, {
      envelopeDefinition: envelope,
    });

    return {
      externalEnvelopeId: result.envelopeId,
      status: result.status,
      signers: request.signers.map((signer, index) => ({
        externalRecipientId: String(index + 1),
        email: signer.email,
        status: 'sent',
      })),
    };
  }

  async getEmbeddedSigningUrl(
    connectionId: string,
    envelopeId: string,
    recipientEmail: string,
    returnUrl: string,
  ): Promise<EmbeddedSigningUrlResult> {
    const { apiClient, accountId } = await this.getApiClient(connectionId);
    const docusign = await this.loadDocuSignSdk();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const origin = new URL(appUrl).origin;

    const viewRequest = docusign.RecipientViewRequest.constructFromObject({
      returnUrl,
      authenticationMethod: 'none',
      email: recipientEmail,
      userName: recipientEmail,
      clientUserId: recipientEmail,
      frameAncestors: [origin, 'https://apps-d.docusign.com'],
      messageOrigins: [origin],
    });

    const result: DocuSignRecipientView = await envelopesApi.createRecipientView(
      accountId,
      envelopeId,
      {
        recipientViewRequest: viewRequest,
      },
    );

    // DocuSign does not return a TTL for recipient view URLs (the URL is
    // single-use and account policies can shorten/extend the validity
    // window). Returning a fabricated 5-minute expiry would mislead the UI
    // into trusting a stale URL — instead we omit `expiresAt` and let the
    // caller request a fresh URL on first use.
    return {
      url: result.url,
    };
  }

  async getSignedDocument(connectionId: string, envelopeId: string): Promise<SignedDocumentResult> {
    const { apiClient, accountId } = await this.getApiClient(connectionId);
    const docusign = await this.loadDocuSignSdk();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // "combined" returns all documents as a single PDF
    const documentBytes: Buffer = await envelopesApi.getDocument(accountId, envelopeId, 'combined');

    return {
      documentBase64: Buffer.from(documentBytes).toString('base64'),
      mimeType: 'application/pdf',
      fileName: `signed-${envelopeId}.pdf`,
    };
  }

  async getEnvelopeStatus(
    connectionId: string,
    envelopeId: string,
  ): Promise<SigningEnvelopeResult> {
    const { apiClient, accountId } = await this.getApiClient(connectionId);
    const docusign = await this.loadDocuSignSdk();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    const [envelope, recipients]: [DocuSignEnvelope, DocuSignRecipients] = await Promise.all([
      envelopesApi.getEnvelope(accountId, envelopeId),
      envelopesApi.listRecipients(accountId, envelopeId),
    ]);

    return {
      externalEnvelopeId: envelope.envelopeId,
      status: envelope.status,
      signers: (recipients.signers ?? []).map(signer => ({
        externalRecipientId: signer.recipientId,
        email: signer.email,
        status: signer.status,
      })),
    };
  }

  async voidEnvelope(connectionId: string, envelopeId: string, reason: string): Promise<void> {
    const { apiClient, accountId } = await this.getApiClient(connectionId);
    const docusign = await this.loadDocuSignSdk();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    const envelope = docusign.Envelope.constructFromObject({
      status: 'voided',
      voidedReason: reason,
    });

    await envelopesApi.update(accountId, envelopeId, { envelope });
  }

  async resendToRecipient(
    connectionId: string,
    envelopeId: string,
    recipientEmail: string,
  ): Promise<void> {
    const { apiClient, accountId } = await this.getApiClient(connectionId);
    const docusign = await this.loadDocuSignSdk();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // Retrieve current recipients to find the matching signer
    const currentRecipients: DocuSignRecipients = await envelopesApi.listRecipients(
      accountId,
      envelopeId,
    );

    const matchingSigner = currentRecipients.signers?.find(
      s => s.email.toLowerCase() === recipientEmail.toLowerCase(),
    );

    if (!matchingSigner) {
      throw new Error(`Recipient ${recipientEmail} not found in envelope ${envelopeId}`);
    }

    // Preserve the original signer name when re-sending. Falling back to the
    // email is correct only when the original envelope was created without
    // a display name (rare). DocuSign accounts in strict-name-match mode
    // can reject envelopes whose signer name no longer matches the original.
    const signerName = matchingSigner.name?.trim() ? matchingSigner.name : matchingSigner.email;

    const recipients = docusign.Recipients.constructFromObject({
      signers: [
        docusign.Signer.constructFromObject({
          email: matchingSigner.email,
          name: signerName,
          recipientId: matchingSigner.recipientId,
        }),
      ],
    });

    await envelopesApi.updateRecipients(accountId, envelopeId, {
      recipients,
      resendEnvelope: 'true',
    });
  }

  // -------------------------------------------------------------------------
  // Webhook Handling
  // -------------------------------------------------------------------------

  normalizeWebhookEvent(payload: unknown): NormalizedSigningEvent {
    const data = payload as DocuSignConnectPayload;

    const envelopeId = data.envelopeId ?? data.data?.envelopeId ?? '';
    const envelopeStatus = data.status ?? data.data?.envelopeSummary?.status ?? '';

    // Check for recipient-level events
    const recipientStatuses = data.data?.envelopeSummary?.recipients?.signers ?? [];
    const changedRecipient = recipientStatuses.find(
      (r: { status?: string }) =>
        r.status === 'completed' ||
        r.status === 'declined' ||
        r.status === 'delivered' ||
        r.status === 'sent',
    );

    const eventType = this.mapDocuSignEventType(envelopeStatus, changedRecipient?.status);

    return {
      externalEnvelopeId: envelopeId,
      eventType,
      recipientEmail: changedRecipient?.email,
      recipientStatus: changedRecipient
        ? this.mapRecipientStatus(changedRecipient.status ?? '')
        : undefined,
      envelopeStatus: this.mapEnvelopeStatus(envelopeStatus),
      actorName: changedRecipient?.name,
      actorEmail: changedRecipient?.email,
      description: `DocuSign: envelope ${envelopeStatus}${changedRecipient ? `, recipient ${changedRecipient.email} ${changedRecipient.status}` : ''}`,
      providerEventId: data.data?.envelopeId,
      occurredAt: new Date(),
    };
  }

  override verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult {
    const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    if (!secret) {
      return { valid: false };
    }

    const signature = headers['x-docusign-signature-1'] ?? '';
    if (!signature) {
      return { valid: false };
    }

    // Reject signatures that aren't well-formed base64 before reaching
    // timingSafeEqual. `Buffer.from(s, 'base64')` silently drops non-base64
    // characters and pads partial groups, so we cannot rely on it to fail
    // closed for malformed input — we must validate first.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
      return { valid: false };
    }

    let receivedBuffer: Buffer;
    try {
      receivedBuffer = Buffer.from(signature, 'base64');
    } catch {
      return { valid: false };
    }

    // `digest()` (no encoding) returns the raw HMAC bytes, so both buffers
    // are compared in their canonical decoded form — not as strings.
    const expectedBuffer = createHmac('sha256', secret).update(rawBody).digest();

    if (expectedBuffer.length !== receivedBuffer.length) {
      return { valid: false };
    }

    if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return { valid: false };
    }

    return {
      valid: true,
      eventType: 'docusign-connect',
    };
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private async getApiClient(
    connectionId: string,
  ): Promise<{ apiClient: DocuSignApiClient; accountId: string }> {
    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error(`Integration connection not found: ${connectionId}`);
    }

    if (connection.status !== 'CONNECTED') {
      throw new Error(
        `Integration connection ${connectionId} is not active (status: ${connection.status})`,
      );
    }

    const credentials = decryptCredentials(connection.credentialsRef, 'docusign');

    const configJson = (connection.configJson ?? {}) as {
      basePath?: string;
      accountId?: string;
    };

    if (!configJson.accountId) {
      throw new Error(`DocuSign accountId not found in connection config for ${connectionId}`);
    }

    const docusign = await this.loadDocuSignSdk();

    if (!configJson.basePath) {
      // Fail closed rather than defaulting to demo — silently signing
      // production envelopes against demo.docusign.net is a compliance risk.
      // Operators must explicitly configure the basePath returned by the
      // userInfo endpoint after OAuth (e.g., https://na3.docusign.net/restapi).
      log.error(
        { connectionId },
        'DocuSign basePath missing on connection — refusing to default to demo environment',
      );
      throw new Error(
        `DocuSign basePath missing in connection config for ${connectionId}. ` +
          'Refusing to default to demo environment.',
      );
    }

    const apiClient: DocuSignApiClient = new docusign.ApiClient();
    apiClient.setBasePath(configJson.basePath);
    apiClient.addDefaultHeader('Authorization', `Bearer ${credentials.accessToken}`);

    return { apiClient, accountId: configJson.accountId };
  }

  /**
   * Dynamically loads the docusign-esign SDK (pure JS, no types).
   *
   * The SDK module is resolved once and cached at module level so subsequent
   * operations don't pay the resolution cost. Note: this caches only the
   * module — credentials and the `ApiClient` instance are still per-call so
   * token refreshes are picked up on the next operation.
   */
  private async loadDocuSignSdk(): Promise<DocuSignSdk> {
    if (!sdkPromise) {
      sdkPromise = import('docusign-esign').then(mod => mod as unknown as DocuSignSdk);
    }
    return sdkPromise;
  }

  private mapDocuSignEventType(
    envelopeStatus: string,
    recipientStatus?: string,
  ): NormalizedSigningEvent['eventType'] {
    // Recipient-level events take priority
    if (recipientStatus) {
      switch (recipientStatus) {
        case 'completed':
          return 'RECIPIENT_SIGNED';
        case 'declined':
          return 'RECIPIENT_DECLINED';
        case 'delivered':
          return 'RECIPIENT_VIEWED';
        case 'sent':
          return 'ENVELOPE_SENT';
      }
    }

    // Envelope-level events
    switch (envelopeStatus) {
      case 'sent':
        return 'ENVELOPE_SENT';
      case 'delivered':
        return 'RECIPIENT_VIEWED';
      case 'completed':
        return 'ENVELOPE_COMPLETED';
      case 'declined':
        return 'RECIPIENT_DECLINED';
      case 'voided':
        return 'ENVELOPE_VOIDED';
      default:
        return 'ENVELOPE_SENT';
    }
  }

  private mapEnvelopeStatus(status: string): NormalizedSigningEvent['envelopeStatus'] {
    const mapping: Record<string, NormalizedSigningEvent['envelopeStatus']> = {
      created: 'CREATED',
      sent: 'SENT',
      delivered: 'DELIVERED',
      completed: 'COMPLETED',
      declined: 'DECLINED',
      voided: 'VOIDED',
    };
    return mapping[status] ?? 'SENT';
  }

  private mapRecipientStatus(status: string): NormalizedSigningEvent['recipientStatus'] {
    const mapping: Record<string, NormalizedSigningEvent['recipientStatus']> = {
      created: 'PENDING',
      sent: 'SENT',
      delivered: 'DELIVERED',
      completed: 'SIGNED',
      declined: 'DECLINED',
    };
    return mapping[status] ?? 'PENDING';
  }

  // -------------------------------------------------------------------------
  // Webhook processing
  // -------------------------------------------------------------------------

  /**
   * Process a DocuSign Connect webhook event.
   * Delegates to the shared esign-webhook-handler for status updates
   * and idempotency. Returns the completion signal directly.
   */
  override async handleWebhook(
    payload: unknown,
    organizationId: string,
    connectionId: string,
  ): Promise<{ envelopeId: string; completed: boolean }> {
    return handleSigningWebhook({
      provider: 'DOCUSIGN',
      payload,
      organizationId,
      connectionId,
    });
  }
}

// ---------------------------------------------------------------------------
// DocuSign Connect Webhook Payload Shape
// ---------------------------------------------------------------------------

interface DocuSignConnectPayload {
  envelopeId?: string;
  status?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      recipients?: {
        signers?: Array<{
          recipientId?: string;
          email?: string;
          name?: string;
          status?: string;
        }>;
      };
    };
  };
}
