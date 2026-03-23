import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@contractor-ops/db";
import type { OAuthConfig } from "../types/provider.js";
import type { CredentialBlob } from "../types/credentials.js";
import type { WebhookVerificationResult } from "../types/webhook.js";
import type {
  ESignAdapter,
  SigningEnvelopeRequest,
  SigningEnvelopeResult,
  EmbeddedSigningUrlResult,
  SignedDocumentResult,
  NormalizedSigningEvent,
} from "../types/esign.js";
import { BaseAdapter } from "./base-adapter.js";
import { decryptCredentials } from "../services/credential-service.js";
import { handleSigningWebhook } from "../services/esign-webhook-handler.js";

// ---------------------------------------------------------------------------
// Autenti API Base URL
// ---------------------------------------------------------------------------

const AUTENTI_API_BASE = "https://api.autenti.com/api/v2";

// ---------------------------------------------------------------------------
// Autenti Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Autenti e-signature (Polish provider).
 *
 * Supports:
 * - OAuth 2.0 Authorization Code Grant
 * - Webhook signature verification (HMAC-SHA256)
 * - Full document process lifecycle (create, withdraw, remind, download)
 *
 * Does NOT support embedded signing (Autenti uses redirect-based signing flow).
 *
 * Env vars required:
 * - AUTENTI_CLIENT_ID, AUTENTI_CLIENT_SECRET — for OAuth
 * - AUTENTI_WEBHOOK_SECRET — for webhook signature verification
 * - AUTENTI_ENCRYPTION_KEY — for credential encryption
 */
export class AutentiAdapter extends BaseAdapter implements ESignAdapter {
  readonly slug = "autenti";
  readonly displayName = "Autenti";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;
  readonly supportsEmbeddedSigning = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  getOAuthConfig(): OAuthConfig {
    return {
      clientIdEnvVar: "AUTENTI_CLIENT_ID",
      clientSecretEnvVar: "AUTENTI_CLIENT_SECRET",
      authorizationUrl: "https://app.autenti.com/oauth/authorize",
      tokenUrl: "https://app.autenti.com/oauth/token",
      scopes: ["document-process:write", "document-process:read"],
      redirectPath: "/api/oauth/autenti/callback",
    };
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<CredentialBlob> {
    const clientId = process.env.AUTENTI_CLIENT_ID;
    const clientSecret = process.env.AUTENTI_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "AUTENTI_CLIENT_ID and AUTENTI_CLIENT_SECRET environment variables are required",
      );
    }

    const response = await fetch("https://app.autenti.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Autenti OAuth exchange failed: ${text}`);
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
      scope: "document-process:write,document-process:read",
      expiresAt: new Date(
        Date.now() + data.expires_in * 1000,
      ).toISOString(),
    };
  }

  async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.AUTENTI_CLIENT_ID;
    const clientSecret = process.env.AUTENTI_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "AUTENTI_CLIENT_ID and AUTENTI_CLIENT_SECRET environment variables are required",
      );
    }

    if (!credentials.refreshToken) {
      throw new Error("No refresh token available for Autenti");
    }

    const response = await fetch("https://app.autenti.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credentials.refreshToken,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Autenti token refresh failed: ${text}`);
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
      expiresAt: new Date(
        Date.now() + data.expires_in * 1000,
      ).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // E-Sign Operations
  // -------------------------------------------------------------------------

  async createEnvelope(
    connectionId: string,
    request: SigningEnvelopeRequest,
  ): Promise<SigningEnvelopeResult> {
    // Step 1: Create document process
    const createResult = (await this.autentiFetch(
      connectionId,
      "/document-processes",
      {
        method: "POST",
        body: JSON.stringify({
          title: request.documentName,
          description: request.message ?? "",
          processLanguage: "pl",
        }),
      },
    )) as { id: string; status: string };

    const processId = createResult.id;

    // Step 2: Upload document file
    const fileBuffer = Buffer.from(request.documentBase64, "base64");
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBuffer], { type: "application/pdf" }),
      request.documentName.endsWith(".pdf")
        ? request.documentName
        : `${request.documentName}.pdf`,
    );

    await this.autentiFetch(
      connectionId,
      `/document-processes/${processId}/files`,
      {
        method: "POST",
        body: formData,
        skipContentType: true,
      },
    );

    // Step 3: Add participants (signers)
    const signerResults: {
      externalRecipientId: string;
      email: string;
      status: string;
    }[] = [];

    for (const signer of request.signers) {
      const participant = (await this.autentiFetch(
        connectionId,
        `/document-processes/${processId}/participants`,
        {
          method: "POST",
          body: JSON.stringify({
            party: {
              firstName: signer.name.split(" ")[0] ?? signer.name,
              lastName: signer.name.split(" ").slice(1).join(" ") || signer.name,
              email: signer.email,
            },
            role: "signer",
            constraints: [
              {
                constrainedActions: ["SIGN"],
                classifiers: ["SIGNATURE_BASIC_AUTENTI"],
              },
            ],
          }),
        },
      )) as { id: string };

      signerResults.push({
        externalRecipientId: participant.id,
        email: signer.email,
        status: "pending",
      });
    }

    // Step 4: Send the document process
    await this.autentiFetch(
      connectionId,
      `/document-processes/${processId}/actions`,
      {
        method: "POST",
        body: JSON.stringify({ event_type: "SEND" }),
      },
    );

    return {
      externalEnvelopeId: processId,
      status: "sent",
      signers: signerResults,
    };
  }

  async getEmbeddedSigningUrl(
    _connectionId: string,
    _envelopeId: string,
    _recipientEmail: string,
    _returnUrl: string,
  ): Promise<EmbeddedSigningUrlResult> {
    throw new Error(
      "Autenti does not support embedded signing. Use redirect flow.",
    );
  }

  async getSignedDocument(
    connectionId: string,
    envelopeId: string,
  ): Promise<SignedDocumentResult> {
    // Get list of files with SIGNED purpose
    const filesResponse = (await this.autentiFetch(
      connectionId,
      `/document-processes/${envelopeId}/files?filePurpose=SIGNED`,
    )) as Array<{ id: string; fileName: string }>;

    if (!filesResponse.length) {
      throw new Error(
        `No signed documents found for process ${envelopeId}`,
      );
    }

    const firstFile = filesResponse[0]!;

    // Download the signed file
    const fileData = (await this.autentiFetch(
      connectionId,
      `/document-processes/${envelopeId}/files/${firstFile.id}/content`,
      { rawResponse: true },
    )) as ArrayBuffer;

    return {
      documentBase64: Buffer.from(fileData).toString("base64"),
      mimeType: "application/pdf",
      fileName: firstFile.fileName ?? `signed-${envelopeId}.pdf`,
    };
  }

  async getEnvelopeStatus(
    connectionId: string,
    envelopeId: string,
  ): Promise<SigningEnvelopeResult> {
    const process = (await this.autentiFetch(
      connectionId,
      `/document-processes/${envelopeId}`,
    )) as AutentiDocumentProcess;

    return {
      externalEnvelopeId: process.id,
      status: this.mapAutentiStatusToInternal(process.status),
      signers: (process.participants ?? [])
        .filter((p) => p.role === "signer")
        .map((p) => ({
          externalRecipientId: p.id,
          email: p.party?.email ?? "",
          status: this.mapAutentiParticipantStatus(p.status ?? ""),
        })),
    };
  }

  async voidEnvelope(
    connectionId: string,
    envelopeId: string,
    _reason: string,
  ): Promise<void> {
    await this.autentiFetch(
      connectionId,
      `/document-processes/${envelopeId}/actions`,
      {
        method: "POST",
        body: JSON.stringify({ event_type: "WITHDRAW" }),
      },
    );
  }

  async resendToRecipient(
    connectionId: string,
    envelopeId: string,
    _recipientEmail: string,
  ): Promise<void> {
    try {
      await this.autentiFetch(
        connectionId,
        `/document-processes/${envelopeId}/actions`,
        {
          method: "POST",
          body: JSON.stringify({ event_type: "REMIND" }),
        },
      );
    } catch {
      // REMIND action may not be supported for all process states — log and no-op
      console.warn(
        `[autenti-adapter] REMIND action failed for process ${envelopeId}, continuing as no-op`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Webhook Handling
  // -------------------------------------------------------------------------

  normalizeWebhookEvent(payload: unknown): NormalizedSigningEvent {
    const data = payload as AutentiWebhookPayload;

    const processId = data.documentProcessId ?? data.id ?? "";
    const status = data.status ?? "";

    return {
      externalEnvelopeId: processId,
      eventType: this.mapAutentiWebhookEventType(status),
      envelopeStatus: this.mapAutentiStatusToEnvelopeStatus(status),
      description: `Autenti: document process ${status.toLowerCase()}`,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      providerEventId: data.eventId,
    };
  }

  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult {
    const secret = process.env.AUTENTI_WEBHOOK_SECRET;
    if (!secret) {
      return { valid: false };
    }

    const signature =
      headers["x-autenti-signature"] ??
      headers["x-webhook-signature"] ??
      "";
    if (!signature) {
      return { valid: false };
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return { valid: false };
    }

    if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return { valid: false };
    }

    return {
      valid: true,
      eventType: "document-change",
    };
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private async autentiFetch(
    connectionId: string,
    path: string,
    options?: {
      method?: string;
      body?: string | FormData;
      skipContentType?: boolean;
      rawResponse?: boolean;
    },
  ): Promise<unknown> {
    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error(`Integration connection not found: ${connectionId}`);
    }

    if (connection.status !== "CONNECTED") {
      throw new Error(
        `Integration connection ${connectionId} is not active (status: ${connection.status})`,
      );
    }

    const credentials = decryptCredentials(
      connection.credentialsRef,
      "autenti",
    );

    const fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${credentials.accessToken}`,
    };

    if (!options?.skipContentType && !(options?.body instanceof FormData)) {
      fetchHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(`${AUTENTI_API_BASE}${path}`, {
      method: options?.method ?? "GET",
      headers: fetchHeaders,
      body: options?.body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Autenti API error (${response.status}) for ${path}: ${text}`,
      );
    }

    if (options?.rawResponse) {
      return await response.arrayBuffer();
    }

    // Some endpoints return no content
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    return undefined;
  }

  private mapAutentiStatusToInternal(status: string): string {
    const mapping: Record<string, string> = {
      DRAFT: "created",
      IN_PROGRESS: "sent",
      SIGNED: "completed",
      REJECTED: "declined",
      EXPIRED: "expired",
      WITHDRAWN: "voided",
    };
    return mapping[status] ?? status.toLowerCase();
  }

  private mapAutentiParticipantStatus(status: string): string {
    const mapping: Record<string, string> = {
      WAITING: "pending",
      NOTIFIED: "sent",
      VIEWED: "delivered",
      SIGNED: "completed",
      REJECTED: "declined",
    };
    return mapping[status] ?? status.toLowerCase();
  }

  private mapAutentiWebhookEventType(
    status: string,
  ): NormalizedSigningEvent["eventType"] {
    const mapping: Record<string, NormalizedSigningEvent["eventType"]> = {
      IN_PROGRESS: "ENVELOPE_SENT",
      SIGNED: "ENVELOPE_COMPLETED",
      REJECTED: "RECIPIENT_DECLINED",
      EXPIRED: "ENVELOPE_EXPIRED",
      WITHDRAWN: "ENVELOPE_VOIDED",
    };
    return mapping[status] ?? "ENVELOPE_SENT";
  }

  private mapAutentiStatusToEnvelopeStatus(
    status: string,
  ): NormalizedSigningEvent["envelopeStatus"] {
    const mapping: Record<string, NormalizedSigningEvent["envelopeStatus"]> = {
      DRAFT: "CREATED",
      IN_PROGRESS: "SENT",
      SIGNED: "COMPLETED",
      REJECTED: "DECLINED",
      EXPIRED: "EXPIRED",
      WITHDRAWN: "VOIDED",
    };
    return mapping[status] ?? "SENT";
  }

  // -------------------------------------------------------------------------
  // Webhook processing
  // -------------------------------------------------------------------------

  /**
   * Process an Autenti webhook event.
   * Delegates to the shared esign-webhook-handler for status updates
   * and idempotency. Returns void per BaseAdapter interface — the
   * completion signal is handled at the _process route level.
   */
  async handleWebhook(
    payload: unknown,
    organizationId: string,
    connectionId: string,
  ): Promise<void> {
    const result = await handleSigningWebhook({
      provider: "AUTENTI",
      payload,
      organizationId,
      connectionId,
    });

    // Store completion result for the _process route to pick up
    this._lastWebhookResult = result;
  }

  /** @internal Last webhook processing result (used by _process route) */
  _lastWebhookResult: { envelopeId: string; completed: boolean } | null = null;
}

// ---------------------------------------------------------------------------
// Autenti API Response Types
// ---------------------------------------------------------------------------

interface AutentiDocumentProcess {
  id: string;
  status: string;
  participants?: Array<{
    id: string;
    role: string;
    status?: string;
    party?: {
      email?: string;
      firstName?: string;
      lastName?: string;
    };
  }>;
}

interface AutentiWebhookPayload {
  documentProcessId?: string;
  id?: string;
  status?: string;
  eventId?: string;
  occurredAt?: string;
}
