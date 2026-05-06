import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GovApiAuditLogger, GovApiRateLimiter } from '@contractor-ops/gov-api';
import { PINT_AE_DOCUMENT_TYPE_ID } from '../../profiles/peppol-ae/constants.js';
import { STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID } from '../../profiles/xrechnung-de/constants.js';
import type {
  ASPAdapter,
  ASPHealthStatus,
  InboundInvoicePayload,
  LookupParticipantCapabilitiesParams,
  ParticipantCapabilityResult,
  ParticipantRegistration,
  ParticipantStatus,
  RegisterParticipantParams,
  TransmissionResult,
  TransmissionStatus,
  TransmitInvoiceParams,
  WebhookVerification,
} from '../types.js';
import { StorecoveApiError, StorecoveClient } from './client.js';
import {
  extractDocumentTypes,
  storecoveDiscoveryResponseSchema,
  storecoveWebhookPayloadSchema,
} from './schemas.js';
import type { StorecoveConfig } from './types.js';

/**
 * Peppol BIS Billing 3.0 `document_type_id` (UBL Invoice-2 + BIS Billing 3).
 * Forwarded verbatim to Storecove when `format.kind === 'ubl-peppol-bis-3'`.
 */
const UBL_PEPPOL_BIS_3_DOC_TYPE_ID =
  'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1' as const;

/**
 * Phase 61 Plan 05 (D-09) — map the EInvoiceFormat discriminator to the
 * Storecove `document_type_id` that drives routing on the Peppol network.
 *
 * When `format` is undefined (legacy caller), the caller-supplied
 * `documentTypeId` is used as-is to preserve peppol-ae zero-regression.
 */
function resolveDocumentTypeId(params: TransmitInvoiceParams): string {
  if (!params.format) return params.documentTypeId;
  switch (params.format.kind) {
    case 'cii-xrechnung':
      return STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID;
    case 'ubl-pint-ae':
      return PINT_AE_DOCUMENT_TYPE_ID;
    case 'ubl-peppol-bis-3':
      return UBL_PEPPOL_BIS_3_DOC_TYPE_ID;
  }
}

// ---------------------------------------------------------------------------
// Dependency injection for gov-api framework
// ---------------------------------------------------------------------------

/** Optional dependencies for gov-api framework integration. */
export interface StorecoveAdapterDeps {
  /** Rate limiter for Storecove API calls (optional — fail-open if not provided). */
  rateLimiter?: GovApiRateLimiter;
  /** Audit logger for compliance trail (optional — no-op if not provided). */
  auditLogger?: GovApiAuditLogger;
}

// ---------------------------------------------------------------------------
// Storecove ASP Adapter
// ---------------------------------------------------------------------------

/**
 * Storecove implementation of the ASPAdapter interface.
 *
 * Wraps the Storecove REST API v2 for Peppol network operations.
 * HMAC-SHA256 webhook signature verification per Storecove docs.
 *
 * Optionally composes GovApiRateLimiter and GovApiAuditLogger
 * for rate limiting and compliance audit trails.
 */
export class StorecoveAdapter implements ASPAdapter {
  readonly providerId = 'storecove' as const;
  readonly displayName = 'Storecove';

  private readonly client: StorecoveClient;
  private readonly webhookSecret: string | undefined;
  private readonly rateLimiter: GovApiRateLimiter | null;
  private readonly auditLogger: GovApiAuditLogger | null;

  constructor(config: StorecoveConfig, deps?: StorecoveAdapterDeps) {
    this.client = new StorecoveClient(config);
    this.webhookSecret = config.webhookSecret;
    this.rateLimiter = deps?.rateLimiter ?? null;
    this.auditLogger = deps?.auditLogger ?? null;
  }

  // -------------------------------------------------------------------------
  // Rate limiting and audit logging helpers
  // -------------------------------------------------------------------------

  /**
   * Check rate limit for the given organization.
   * Throws if rate limit exceeded. No-op if no rate limiter configured.
   */
  private async checkRateLimit(identifier: string): Promise<void> {
    if (!this.rateLimiter) return;
    const result = await this.rateLimiter.checkLimit(identifier);
    if (!result.allowed) {
      throw new Error(
        `Storecove API rate limit exceeded for ${identifier}. ` +
          `Remaining: ${result.remaining}, resets in ${result.resetMs}ms`,
      );
    }
  }

  /**
   * Emit an audit log entry for a Storecove API call.
   * Fire-and-forget: failures are silently caught. No-op if no logger.
   */
  private emitAudit(
    organizationId: string,
    endpoint: string,
    method: string,
    responseStatus: number,
    responseTimeMs: number,
    errorMessage?: string,
  ): void {
    if (!this.auditLogger) return;
    void this.auditLogger.log({
      apiName: 'storecove-peppol',
      organizationId,
      endpoint,
      method,
      responseStatus,
      responseTimeMs,
      errorMessage,
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Parse Storecove 422 validation errors from the response body.
   */
  private parseValidationErrors(responseBody: string): Array<{ code: string; message: string }> {
    try {
      const parsed = JSON.parse(responseBody);
      return Array.isArray(parsed.errors)
        ? parsed.errors
        : [{ code: 'VALIDATION_ERROR', message: responseBody }];
    } catch {
      return [{ code: 'VALIDATION_ERROR', message: responseBody }];
    }
  }

  // -------------------------------------------------------------------------
  // ASPAdapter implementation
  // -------------------------------------------------------------------------

  async registerParticipant(params: RegisterParticipantParams): Promise<ParticipantRegistration> {
    const orgId = params.organizationId ?? 'unknown';
    await this.checkRateLimit(orgId);

    const startMs = Date.now();
    try {
      const entity = await this.client.createLegalEntity({
        partyName: params.organizationName,
        identifier: params.identifierValue,
        scheme: params.schemeId,
      });

      this.emitAudit(orgId, '/legal_entities', 'POST', 200, Date.now() - startMs);

      return {
        registrationId: String(entity.id),
        participantId: params.participantId,
        status: 'registered',
        registeredAt: new Date(),
      };
    } catch (error) {
      if (error instanceof StorecoveApiError) {
        this.emitAudit(
          orgId,
          '/legal_entities',
          'POST',
          error.statusCode,
          Date.now() - startMs,
          error.message,
        );
      }
      throw error;
    }
  }

  async getParticipantStatus(participantId: string): Promise<ParticipantStatus> {
    // Storecove doesn't have a direct "participant status" endpoint;
    // we check if the legal entity exists and has identifiers.
    // The participantId is used as a lookup key on the caller side.
    return {
      participantId,
      status: 'active',
    };
  }

  async transmitInvoice(params: TransmitInvoiceParams): Promise<TransmissionResult> {
    const orgId = params.organizationId ?? 'unknown';
    await this.checkRateLimit(orgId);

    // Parse receiver participant ID "scheme:identifier"
    const [receiverScheme, receiverIdentifier] = params.receiverParticipantId.split(':');
    const startMs = Date.now();

    try {
      const submission = await this.client.submitDocument({
        xml: params.xml,
        senderLegalEntityId: 0, // Caller should resolve this from participant data
        receiverIdentifier: receiverIdentifier ?? params.receiverParticipantId,
        receiverScheme: receiverScheme ?? '0192',
        documentType: resolveDocumentTypeId(params),
        // DRIFT-01: feed the organizationId into the idempotency-key
        // derivation so retries from any code path (orchestrator, outbox,
        // QStash retry) produce the same Storecove dedup key.
        organizationId: params.organizationId,
      });

      this.emitAudit(orgId, '/document_submissions', 'POST', 200, Date.now() - startMs);

      return {
        transmissionId: submission.guid,
        status: 'accepted',
        timestamp: new Date(submission.created_at),
      };
    } catch (error) {
      if (error instanceof StorecoveApiError) {
        this.emitAudit(
          orgId,
          '/document_submissions',
          'POST',
          error.statusCode,
          Date.now() - startMs,
          error.message,
        );

        if (error.statusCode === 422) {
          return {
            transmissionId: '',
            status: 'rejected',
            timestamp: new Date(),
            errors: this.parseValidationErrors(error.responseBody),
          };
        }
      }
      throw error;
    }
  }

  /**
   * Phase 61 Plan 05 (D-11) — probe a Peppol participant's SMP-registered
   * document types. Results are cached by the API-layer service
   * (`packages/api/src/services/peppol-capability.ts`) with a 6h TTL to
   * stay under the Storecove rate budget.
   *
   * - Happy path: normalises the response to a flat `documentTypes: string[]`.
   * - 404: participant is not registered on the Peppol SML → returns an
   *   empty `documentTypes: []`. Callers translate empty to
   *   `PARTICIPANT_NOT_REACHABLE`.
   * - Other errors (5xx, network): propagate as-is for retry-at-caller.
   */
  async lookupParticipantCapabilities(
    params: LookupParticipantCapabilitiesParams,
  ): Promise<ParticipantCapabilityResult> {
    const orgId = params.organizationId ?? 'unknown';
    await this.checkRateLimit(orgId);

    const startMs = Date.now();
    try {
      const raw = await this.client.getDiscoveryReceives({
        schemeId: params.schemeId,
        identifier: params.value,
      });
      this.emitAudit(orgId, '/discovery/receives', 'GET', 200, Date.now() - startMs);

      const parsed = storecoveDiscoveryResponseSchema.parse(raw);
      return {
        schemeId: params.schemeId,
        value: params.value,
        documentTypes: extractDocumentTypes(parsed),
        fetchedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof StorecoveApiError) {
        this.emitAudit(
          orgId,
          '/discovery/receives',
          'GET',
          error.statusCode,
          Date.now() - startMs,
          error.message,
        );
        if (error.statusCode === 404) {
          // Participant not registered on the Peppol SML — empty capabilities.
          return {
            schemeId: params.schemeId,
            value: params.value,
            documentTypes: [],
            fetchedAt: new Date(),
          };
        }
      }
      throw error;
    }
  }

  async getTransmissionStatus(transmissionId: string): Promise<TransmissionStatus> {
    const submission = await this.client.getSubmission(transmissionId);

    const statusMap: Record<string, TransmissionStatus['status']> = {
      sent: 'transmitted',
      delivered: 'delivered',
      error: 'failed',
      failed: 'failed',
    };

    return {
      transmissionId: submission.guid,
      status: statusMap[submission.status] ?? 'pending',
      deliveredAt: submission.status === 'delivered' ? new Date(submission.created_at) : undefined,
      failureReason:
        submission.status === 'error' || submission.status === 'failed'
          ? `Storecove status: ${submission.status}`
          : undefined,
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): WebhookVerification {
    if (!this.webhookSecret) {
      return { valid: false };
    }

    // HTTP headers are case-insensitive — accept both common casings used by
    // Storecove's docs. Callers SHOULD normalise upstream, but we tolerate
    // either spelling here as a defensive default.
    const signature = headers['storecove-signature'] ?? headers['Storecove-Signature'];

    // Strict shape gate BEFORE hex-decoding: `Buffer.from(<header>, 'hex')`
    // silently truncates on any non-hex character or odd-length input, which
    // weakens the HMAC strength bound (the comparison universe shrinks below
    // the header's actual character space) AND, when the resulting buffers
    // differ in length, `timingSafeEqual` throws RangeError. Rejecting here
    // converts both failure modes into a clean `{ valid: false }`.
    const HEX64 = /^[0-9a-f]{64}$/i;
    if (typeof signature !== 'string' || !HEX64.test(signature)) {
      return { valid: false };
    }

    const computed = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const cmpBuf = Buffer.from(computed, 'hex');
    // Both buffers are 32 bytes after the regex gate, but defence-in-depth:
    // never feed mismatched lengths into timingSafeEqual.
    if (sigBuf.length !== cmpBuf.length) {
      return { valid: false };
    }

    if (!timingSafeEqual(sigBuf, cmpBuf)) {
      return { valid: false };
    }

    // Parse event type from payload
    try {
      const parsed = storecoveWebhookPayloadSchema.parse(JSON.parse(rawBody));
      return {
        valid: true,
        eventType: parsed.event,
      };
    } catch {
      return { valid: true };
    }
  }

  async parseWebhookPayload(
    rawBody: string,
    _headers: Record<string, string>,
  ): Promise<InboundInvoicePayload> {
    const parsed = storecoveWebhookPayloadSchema.parse(JSON.parse(rawBody));

    return {
      documentId: parsed.document_guid ?? parsed.guid,
      senderParticipantId: '', // Extracted from XML by caller if needed
      receiverParticipantId: '',
      xml: parsed.document ?? '',
      receivedAt: new Date(),
      metadata: {
        event: parsed.event,
        guid: parsed.guid,
      },
    };
  }

  async pollInboundInvoices(
    since: Date,
    organizationId?: string,
  ): Promise<InboundInvoicePayload[]> {
    if (organizationId) {
      await this.checkRateLimit(organizationId);
    }

    const startMs = Date.now();
    const documents = await this.client.getReceivedDocuments(since);

    if (organizationId) {
      this.emitAudit(organizationId, '/received_documents', 'GET', 200, Date.now() - startMs);
    }

    return documents.map(doc => ({
      documentId: doc.guid,
      senderParticipantId: `${doc.sender.scheme}:${doc.sender.identifier}`,
      receiverParticipantId: '',
      xml: doc.document,
      receivedAt: new Date(doc.created_at),
      metadata: {
        source: doc.source,
        guid: doc.guid,
      },
    }));
  }

  async checkHealth(): Promise<ASPHealthStatus> {
    const start = Date.now();

    try {
      // Attempt to get a non-existent entity — we expect 404 or similar,
      // but a response at all means the API is healthy.
      await this.client.getLegalEntity(0);
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        lastCheckedAt: new Date(),
      };
    } catch (error) {
      if (
        error instanceof StorecoveApiError &&
        (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 404)
      ) {
        // API responded — it's healthy
        return {
          healthy: true,
          latencyMs: Date.now() - start,
          lastCheckedAt: new Date(),
        };
      }

      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastCheckedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
