import { createHash } from 'node:crypto';
import {
  storecoveLegalEntitySchema,
  storecoveReceivedDocumentSchema,
  storecoveSubmissionResponseSchema,
} from './schemas.js';
import type {
  StorecoveConfig,
  StorecoveDocumentSubmission,
  StorecoveLegalEntity,
  StorecoveReceivedDocument,
} from './types.js';

// ---------------------------------------------------------------------------
// Idempotency-key derivation (DRIFT-01)
// ---------------------------------------------------------------------------
//
// `@contractor-ops/integrations/services/idempotency` is the canonical
// `deriveIdempotencyKey` implementation. We can't import it here because
// `@contractor-ops/integrations` already depends on `@contractor-ops/einvoice`
// (a reverse import would close the cycle). Instead we mirror the exact
// `sha256(`${orgId}:${operation}:${businessKey}`)` composition; the
// integrations-package unit test pins the wire format so any future change
// will fail loudly there before drift can re-emerge.
const STORECOVE_OPERATION = 'storecove.peppol.send' as const;

function localDeriveIdempotencyKey(orgId: string, businessKey: string): string {
  return createHash('sha256')
    .update(`${orgId}:${STORECOVE_OPERATION}:${businessKey}`)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Storecove REST Client
// ---------------------------------------------------------------------------

/**
 * Typed HTTP client for the Storecove REST API v2.
 *
 * All methods validate responses with Zod schemas and throw
 * typed errors on non-2xx responses.
 */
export class StorecoveClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: StorecoveConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Submit a UBL document for transmission via the Peppol network.
   *
   * F-INT-04 / DRIFT-01: passes an `Idempotency-Key` header derived from
   * the canonical `(orgId, operation, businessKey)` composition shared
   * across every external-provider integration in this monorepo. Storecove
   * dedupes against the header on `/document_submissions` for at least 24h.
   * Critical for Peppol compliance — a duplicate transmission means the
   * receiver gets two copies and our local lifecycle row diverges from the
   * receiver's e-archive.
   *
   * Callers SHOULD pass `organizationId`. If absent we substitute a global
   * sentinel that still partitions away from any future tenant-scoped key.
   * The `businessKey` defaults to a canonical hash of (sender, receiver,
   * UBL body) so two distinct invoices on the same connection don't
   * collapse together. Callers holding a stronger natural key (invoice id
   * + revision) can pass `idempotencyKey` to override.
   */
  async submitDocument(params: {
    xml: string;
    senderLegalEntityId: number;
    receiverIdentifier: string;
    receiverScheme: string;
    documentType: string;
    /** Tenant scope; falls back to the global sentinel when omitted. */
    organizationId?: string;
    /** Override; precomputed by the caller (e.g. invoice id + revision). */
    idempotencyKey?: string;
  }): Promise<StorecoveDocumentSubmission> {
    const businessKey = createHash('sha256')
      .update(
        `${params.senderLegalEntityId}|${params.receiverScheme}:${params.receiverIdentifier}|${params.xml}`,
      )
      .digest('hex');
    const idempotencyKey =
      params.idempotencyKey ??
      localDeriveIdempotencyKey(params.organizationId ?? '_global', businessKey);

    const response = await fetch(`${this.baseUrl}/document_submissions`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        legal_entity_id: params.senderLegalEntityId,
        document: {
          document_type: params.documentType,
          raw_document: params.xml,
          parse: false,
        },
        routing: {
          eIdentifiers: [
            {
              identifier: params.receiverIdentifier,
              scheme: params.receiverScheme,
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const json = await this.parseResponse(response);
    return storecoveSubmissionResponseSchema.parse(json);
  }

  /**
   * Get status of a previously submitted document.
   */
  async getSubmission(guid: string): Promise<StorecoveDocumentSubmission> {
    const response = await fetch(`${this.baseUrl}/document_submissions/${guid}`, {
      method: 'GET',
      headers: this.headers,
      signal: AbortSignal.timeout(30_000),
    });

    const json = await this.parseResponse(response);
    return storecoveSubmissionResponseSchema.parse(json);
  }

  /**
   * Create a legal entity (Peppol participant registration).
   */
  async createLegalEntity(params: {
    partyName: string;
    identifier: string;
    scheme: string;
  }): Promise<StorecoveLegalEntity> {
    const response = await fetch(`${this.baseUrl}/legal_entities`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        party_name: params.partyName,
        peppol_identifiers: [
          {
            identifier: params.identifier,
            scheme: params.scheme,
            superscheme: 'iso6523-actorid-upis',
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const json = await this.parseResponse(response);
    return storecoveLegalEntitySchema.parse(json);
  }

  /**
   * Get a legal entity by ID.
   */
  async getLegalEntity(id: number): Promise<StorecoveLegalEntity> {
    const response = await fetch(`${this.baseUrl}/legal_entities/${id}`, {
      method: 'GET',
      headers: this.headers,
      signal: AbortSignal.timeout(30_000),
    });

    const json = await this.parseResponse(response);
    return storecoveLegalEntitySchema.parse(json);
  }

  /**
   * Phase 61 Plan 05 (D-11) — probe a Peppol participant's SMP capabilities.
   *
   * Returns the raw JSON body (unparsed) so the adapter layer can own the
   * Zod normalisation step — keeps the discovery-shape uncertainty (per
   * 61-RESEARCH.md §Open Questions #5) out of the HTTP client.
   *
   * Throws `StorecoveApiError` on non-2xx; adapter-level caller handles 404
   * (participant not registered → empty capabilities).
   *
   * SSRF-safety: path + query values are appended to the pinned `baseUrl`
   * via `URLSearchParams`. Scheme / identifier values are URL-encoded so an
   * upstream accidentally forwarding user input cannot break out of the
   * path segment.
   */
  async getDiscoveryReceives(params: { schemeId: string; identifier: string }): Promise<unknown> {
    const query = new URLSearchParams({
      scheme_id: params.schemeId,
      identifier: params.identifier,
    });
    const response = await fetch(`${this.baseUrl}/discovery/receives?${query.toString()}`, {
      method: 'GET',
      headers: this.headers,
      signal: AbortSignal.timeout(30_000),
    });
    return this.parseResponse(response);
  }

  /**
   * Get received documents (inbound invoices) since a given date.
   */
  async getReceivedDocuments(since: Date): Promise<StorecoveReceivedDocument[]> {
    const response = await fetch(
      `${this.baseUrl}/received_documents?since=${since.toISOString()}`,
      {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(30_000),
      },
    );

    const json = await this.parseResponse(response);
    const items = Array.isArray(json) ? json : [];
    return items.map((item: unknown) => storecoveReceivedDocumentSchema.parse(item));
  }

  /**
   * Parse a response, throwing on non-2xx status codes.
   */
  private async parseResponse(response: Response): Promise<unknown> {
    const body = await response.text();

    if (!response.ok) {
      throw new StorecoveApiError(
        `Storecove API error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    try {
      return JSON.parse(body);
    } catch {
      throw new StorecoveApiError('Storecove API returned invalid JSON', response.status, body);
    }
  }
}

/**
 * Typed error for Storecove API failures.
 */
export class StorecoveApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'StorecoveApiError';
  }
}
