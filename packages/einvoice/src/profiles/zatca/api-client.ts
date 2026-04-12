// ---------------------------------------------------------------------------
// ZATCA Fatoora Portal API Client
// ---------------------------------------------------------------------------
// Communicates with ZATCA's e-invoicing API for clearance (B2B) and
// reporting (B2C) submission. Extends GovApiClient for retry with
// exponential backoff, timeout handling, and audit logging.
//
// Per T-48-09: Never log Authorization header. Strip auth from error
// responses before storing.
// ---------------------------------------------------------------------------

import type {
  GovApiAuditEntry,
  GovApiAuditLogger,
  GovApiConfig,
  GovApiEnvironment,
} from '@contractor-ops/gov-api';
import { GovApiClient } from '@contractor-ops/gov-api';

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/** ZATCA Developer Portal (sandbox) base URL */
export const ZATCA_SANDBOX_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';

/** ZATCA Production base URL */
export const ZATCA_PRODUCTION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZatcaApiClientConfig {
  /** Base URL for ZATCA API */
  baseUrl: string;
  /** Base64-encoded X.509 certificate (Binary Security Token) */
  binarySecurityToken: string;
  /** API secret from ZATCA CSID exchange */
  secret: string;
  /** Optional GovApiConfig override for retry, timeout, audit */
  govConfig?: GovApiConfig;
  /** Optional GovApiEnvironment override */
  govEnvironment?: GovApiEnvironment;
  /** Optional audit logger for compliance trail */
  auditLogger?: GovApiAuditLogger;
}

export interface ZatcaSubmissionPayload {
  /** SHA-256 hash of the signed invoice XML (hex) */
  invoiceHash: string;
  /** UUID v4 for this invoice */
  uuid: string;
  /** Base64-encoded signed invoice XML */
  invoice: string;
}

export interface ZatcaValidationResult {
  status: string;
  warningMessages: ZatcaValidationMessage[];
  errorMessages: ZatcaValidationMessage[];
  infoMessages?: ZatcaValidationMessage[];
}

export interface ZatcaValidationMessage {
  type?: string;
  code?: string;
  category?: string;
  message?: string;
  status?: string;
}

export interface ZatcaClearanceResponse {
  clearanceStatus: string;
  clearedInvoice?: string;
  validationResults: ZatcaValidationResult;
}

export interface ZatcaReportingResponse {
  reportingStatus: string;
  validationResults: ZatcaValidationResult;
}

export interface ZatcaCsidResponse {
  /** Base64-encoded X.509 certificate */
  binarySecurityToken: string;
  /** API secret */
  secret: string;
  /** Request ID for production CSID exchange */
  requestID: string;
}

export interface ZatcaComplianceResponse {
  clearanceStatus?: string;
  reportingStatus?: string;
  validationResults: ZatcaValidationResult;
}

/** Error classification for retry logic */
export type ZatcaErrorType = 'retryable' | 'non-retryable' | 'auth';

// ---------------------------------------------------------------------------
// Default GovApiConfig for ZATCA
// ---------------------------------------------------------------------------

const DEFAULT_ZATCA_CONFIG: GovApiConfig = {
  baseUrls: {
    sandbox: ZATCA_SANDBOX_URL,
    production: ZATCA_PRODUCTION_URL,
  },
  retry: {
    maxRetries: 3,
    retryableStatuses: [429, 500, 502, 503],
  },
  timeoutMs: 30000,
};

// ---------------------------------------------------------------------------
// ZatcaApiClient
// ---------------------------------------------------------------------------

export class ZatcaApiClient extends GovApiClient {
  private readonly authHeader: string;
  private readonly auditLogger: GovApiAuditLogger | null;

  constructor(config: ZatcaApiClientConfig) {
    const govConfig = config.govConfig ?? DEFAULT_ZATCA_CONFIG;
    const env: GovApiEnvironment =
      config.govEnvironment ?? (config.baseUrl === ZATCA_SANDBOX_URL ? 'sandbox' : 'production');
    super(govConfig, env);

    // Per ZATCA spec: Basic auth with Base64({binarySecurityToken}:{secret})
    this.authHeader = `Basic ${Buffer.from(
      `${config.binarySecurityToken}:${config.secret}`,
    ).toString('base64')}`;
    this.auditLogger = config.auditLogger ?? null;
  }

  // -------------------------------------------------------------------------
  // GovApiClient abstract implementation
  // -------------------------------------------------------------------------

  getApiName(): string {
    return 'zatca';
  }

  /**
   * Override to delegate audit logging to GovApiAuditLogger.
   * Fire-and-forget: audit log failures must not break API operations.
   */
  protected emitAuditEntry(entry: GovApiAuditEntry): void {
    if (this.auditLogger) {
      void this.auditLogger.log(entry);
    }
  }

  // -------------------------------------------------------------------------
  // Invoice Submission
  // -------------------------------------------------------------------------

  /**
   * Submit a B2B (standard) invoice for clearance.
   * ZATCA validates and clears the invoice in real-time.
   */
  async submitForClearance(
    payload: ZatcaSubmissionPayload,
    organizationId?: string,
  ): Promise<ZatcaClearanceResponse> {
    return this.post<ZatcaClearanceResponse>('/invoices/clearance/single', payload, organizationId);
  }

  /**
   * Submit a B2C (simplified) invoice for reporting.
   * ZATCA acknowledges receipt within 24 hours.
   */
  async submitForReporting(
    payload: ZatcaSubmissionPayload,
    organizationId?: string,
  ): Promise<ZatcaReportingResponse> {
    return this.post<ZatcaReportingResponse>('/invoices/reporting/single', payload, organizationId);
  }

  // -------------------------------------------------------------------------
  // CSID (Certificate) Management
  // -------------------------------------------------------------------------

  /**
   * Request a compliance CSID using a CSR.
   * Step 2 of the ZATCA device onboarding flow.
   *
   * Uses separate fetch (no auth header) — compliance endpoints use OTP.
   */
  async requestComplianceCsid(csrBase64: string, otp: string): Promise<ZatcaCsidResponse> {
    const response = await this.fetch(
      '/compliance',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          OTP: otp,
          'Accept-Version': 'V2',
        },
        body: JSON.stringify({ csr: csrBase64 }),
      },
      { skipAudit: true },
    );

    if (!response.ok) {
      throw await this.createError(response, 'requestComplianceCsid');
    }
    return response.json() as Promise<ZatcaCsidResponse>;
  }

  /**
   * Exchange compliance CSID for production CSID.
   * Step 5 of the ZATCA device onboarding flow.
   */
  async requestProductionCsid(requestId: string): Promise<ZatcaCsidResponse> {
    return this.post<ZatcaCsidResponse>('/production/csids', { requestID: requestId });
  }

  /**
   * Submit a compliance check invoice during onboarding.
   * Uses compliance credentials (not production).
   */
  async submitComplianceInvoice(payload: ZatcaSubmissionPayload): Promise<ZatcaComplianceResponse> {
    return this.post<ZatcaComplianceResponse>('/compliance/invoices', payload);
  }

  // -------------------------------------------------------------------------
  // Error Classification
  // -------------------------------------------------------------------------

  /**
   * Classify an error for retry logic.
   * - 429, 5xx: retryable with backoff
   * - 401, 403: auth error (certificate issue)
   * - 4xx: non-retryable (fix invoice data)
   */
  static classifyError(statusCode: number): ZatcaErrorType {
    if (statusCode === 401 || statusCode === 403) return 'auth';
    if (statusCode === 429 || statusCode >= 500) return 'retryable';
    return 'non-retryable';
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * POST request using GovApiClient.fetch() for retry and timeout handling.
   * Sets ZATCA-specific Basic auth header (not GovApiClient's Bearer cert auth).
   */
  private async post<T>(
    path: string,
    body: Record<string, unknown> | ZatcaSubmissionPayload,
    organizationId?: string,
  ): Promise<T> {
    const response = await this.fetch(
      path,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: this.authHeader,
          'Accept-Language': 'en',
          'Accept-Version': 'V2',
        },
        body: JSON.stringify(body),
      },
      { organizationId, skipAudit: !organizationId },
    );

    if (!response.ok) {
      throw await this.createError(response, path);
    }

    return response.json() as Promise<T>;
  }

  private async createError(response: Response, operation: string): Promise<ZatcaApiError> {
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = '';
    }

    // T-48-09: Never include auth header in error details
    return new ZatcaApiError(
      `ZATCA API error: ${response.status} ${response.statusText} at ${operation}`,
      response.status,
      ZatcaApiClient.classifyError(response.status),
      body,
    );
  }
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class ZatcaApiError extends Error {
  readonly statusCode: number;
  readonly errorType: ZatcaErrorType;
  readonly responseBody: string;

  constructor(
    message: string,
    statusCode: number,
    errorType: ZatcaErrorType,
    responseBody: string,
  ) {
    super(message);
    this.name = 'ZatcaApiError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.responseBody = responseBody;
  }
}
