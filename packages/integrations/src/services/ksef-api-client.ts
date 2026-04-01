import {
  createPublicKey,
  publicEncrypt,
  constants,
  createDecipheriv,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KsefSession {
  jwt: string;
  referenceNumber: string;
  encryptionKey: Buffer;
}

export interface KsefInvoiceMetadata {
  ksefReferenceNumber: string;
  invoiceNumber: string;
  subjectNip: string;
  invoiceDate: string;
}

export interface KsefQueryResult {
  invoiceMetadataList: KsefInvoiceMetadata[];
  hasMore: boolean;
  pageToken?: string;
}

// ---------------------------------------------------------------------------
// KSeF API Client
// ---------------------------------------------------------------------------

/**
 * Client for KSeF (Krajowy System e-Faktur) REST API v2.
 *
 * Supports:
 * - Token-based authentication via RSA-OAEP challenge-response
 * - Async invoice querying by NIP and date range
 * - Individual invoice XML download (with AES-256 decryption if needed)
 * - Session lifecycle management
 *
 * @see https://ksef.mf.gov.pl/api/v2
 */
export class KsefApiClient {
  private readonly baseUrl: string;
  private session: KsefSession | null = null;

  constructor(environment: "test" | "prod" = "prod") {
    this.baseUrl =
      environment === "test"
        ? "https://ksef-test.mf.gov.pl/api/v2"
        : "https://ksef.mf.gov.pl/api/v2";
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  /**
   * Authenticates with KSeF using token-based RSA-OAEP challenge-response.
   *
   * Flow:
   * 1. Fetch public key from KSeF auth endpoint
   * 2. Request challenge for given NIP
   * 3. Encrypt token + timestamp using RSA-OAEP with SHA-256
   * 4. Redeem encrypted token to receive JWT session
   * 5. Poll session status until ready
   */
  async authenticate(token: string, nip: string): Promise<KsefSession> {
    // Step 1: Get public key
    const publicKeyResponse = await this.fetchWithRetry(
      `${this.baseUrl}/auth/public-key`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
    );
    const publicKeyData = (await publicKeyResponse.json()) as {
      publicKey: string;
    };

    // Step 2: Request challenge
    const challengeResponse = await this.fetchWithRetry(
      `${this.baseUrl}/auth/challenge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextIdentifier: { type: "nip", value: nip },
        }),
      },
    );
    const challengeData = (await challengeResponse.json()) as {
      challenge: string;
      timestampMs: number;
    };

    // Step 3: RSA-OAEP encrypt token + timestamp
    const rsaKey = createPublicKey(publicKeyData.publicKey);
    const plaintext = Buffer.from(`${token}|${challengeData.timestampMs}`);
    const encrypted = publicEncrypt(
      {
        key: rsaKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      plaintext,
    );

    // Step 4: Redeem encrypted token
    const redeemResponse = await this.fetchWithRetry(
      `${this.baseUrl}/auth/token/redeem`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge: challengeData.challenge,
          encryptedToken: encrypted.toString("base64"),
        }),
      },
    );
    const redeemData = (await redeemResponse.json()) as {
      jwt: string;
      referenceNumber: string;
      encryptionKey?: string;
    };

    // Step 5: Poll for session readiness
    let ready = false;
    for (let i = 0; i < 30; i++) {
      const statusResponse = await this.fetchWithRetry(
        `${this.baseUrl}/auth/${redeemData.referenceNumber}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${redeemData.jwt}`,
          },
        },
      );
      const statusData = (await statusResponse.json()) as {
        status?: string;
        processingCode?: number;
      };

      if (
        statusData.status === "READY" ||
        statusData.processingCode === 200
      ) {
        ready = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!ready) {
      throw new Error(
        `KSeF session did not become ready within 30 seconds (ref: ${redeemData.referenceNumber})`,
      );
    }

    const encryptionKey = redeemData.encryptionKey
      ? Buffer.from(redeemData.encryptionKey, "base64")
      : Buffer.alloc(32);

    this.session = {
      jwt: redeemData.jwt,
      referenceNumber: redeemData.referenceNumber,
      encryptionKey,
    };

    return this.session;
  }

  /**
   * Authenticates with KSeF using a qualified electronic certificate (XAdES).
   *
   * Not implemented — token auth is the primary and supported path.
   * Certificate auth requires XAdES XML signing with a .p12 private key,
   * which is deferred to a future milestone if needed.
   */
  async authenticateWithCertificate(
    _certificateBase64: string,
    _password: string | undefined,
    _nip: string,
  ): Promise<KsefSession> {
    throw new Error(
      "Certificate-based KSeF authentication is not supported. Use token-based auth.",
    );
  }

  // -------------------------------------------------------------------------
  // Invoice Operations
  // -------------------------------------------------------------------------

  /**
   * Queries KSeF for invoices matching the given NIP and date range.
   *
   * Starts an async query, polls for completion, and returns metadata list.
   * The query uses "subject2" subjectType (buyer perspective).
   */
  async queryInvoices(
    nip: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<KsefQueryResult> {
    this.requireSession();

    // Start query
    const queryStartResponse = await this.fetchWithRetry(
      `${this.baseUrl}/invoices/query/metadata`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.session!.jwt}`,
        },
        body: JSON.stringify({
          queryCriteria: {
            subjectNip: nip,
            invoicingDateFrom: dateFrom,
            invoicingDateTo: dateTo,
            subjectType: "subject2",
          },
        }),
      },
    );
    const queryStartData = (await queryStartResponse.json()) as {
      queryId: string;
    };

    // Poll for query completion
    let queryResult: KsefQueryResult | null = null;
    for (let i = 0; i < 60; i++) {
      const statusResponse = await this.fetchWithRetry(
        `${this.baseUrl}/invoices/query/${queryStartData.queryId}/status`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.session!.jwt}`,
          },
        },
      );
      const statusData = (await statusResponse.json()) as {
        status?: string;
        processingCode?: number;
        invoiceMetadataList?: KsefInvoiceMetadata[];
        hasMore?: boolean;
        pageToken?: string;
      };

      if (
        statusData.status === "COMPLETED" ||
        statusData.processingCode === 200
      ) {
        queryResult = {
          invoiceMetadataList: statusData.invoiceMetadataList ?? [],
          hasMore: statusData.hasMore ?? false,
          pageToken: statusData.pageToken,
        };
        break;
      }

      if (statusData.status === "FAILED") {
        throw new Error(
          `KSeF query failed (queryId: ${queryStartData.queryId})`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (!queryResult) {
      throw new Error(
        `KSeF query did not complete within 120 seconds (queryId: ${queryStartData.queryId})`,
      );
    }

    return queryResult;
  }

  /**
   * Downloads a single invoice XML from KSeF by its reference number.
   *
   * If the response is AES-256 encrypted (indicated by content-type),
   * it will be decrypted using the session encryption key.
   */
  async downloadInvoiceXml(ksefReferenceNumber: string): Promise<string> {
    this.requireSession();

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/invoices/ksef/${ksefReferenceNumber}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.session!.jwt}`,
        },
      },
    );

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/octet-stream")) {
      // AES-256 encrypted response — decrypt
      const encryptedBuffer = Buffer.from(await response.arrayBuffer());

      // First 12 bytes = IV, next = ciphertext, last 16 = auth tag
      const iv = encryptedBuffer.subarray(0, 12);
      const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
      const ciphertext = encryptedBuffer.subarray(
        12,
        encryptedBuffer.length - 16,
      );

      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.session!.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString("utf-8");
    }

    return await response.text();
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /**
   * Verifies KSeF credentials by attempting authentication.
   * Returns true if credentials are valid, false otherwise.
   * Used for D-04 credential verification in connection setup.
   */
  async verifyCredentials(token: string, nip: string): Promise<boolean> {
    try {
      await this.authenticate(token, nip);
      await this.terminateSession();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Terminates the active KSeF session.
   * Safe to call even if no session exists.
   */
  async terminateSession(): Promise<void> {
    if (!this.session) return;

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/auth/session/terminate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.session.jwt}`,
          },
        },
      );
    } finally {
      this.session = null;
    }
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private requireSession(): void {
    if (!this.session) {
      throw new Error(
        "KSeF session not established. Call authenticate() first.",
      );
    }
  }

  /**
   * Fetch wrapper with retry logic for transient errors.
   * - Retries on HTTP 429 (rate limit) with Retry-After backoff
   * - Retries on HTTP 5xx with exponential backoff
   * - Throws on 4xx (except 429)
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 2,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.ok) {
          return response;
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.min(1000 * 2 ** attempt, 10000);

          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
        }

        if (response.status >= 500 && attempt < retries) {
          const waitMs = Math.min(1000 * 2 ** attempt, 10000);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        // Non-retryable error
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `KSeF API error ${response.status}: ${errorBody || response.statusText}`,
        );
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("KSeF API error")) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          const waitMs = Math.min(1000 * 2 ** attempt, 10000);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }

    throw lastError ?? new Error("KSeF API request failed after retries");
  }
}
