// ---------------------------------------------------------------------------
// Infisical Secret Store — Per-Organization Certificate Management
// ---------------------------------------------------------------------------
// Implements SecretStore interface from @contractor-ops/secrets for storing
// ZATCA certificates and private keys in Infisical.
// Per D-02: Certificates stored in external SaaS secret manager (Infisical).
// Per T-48-14: Never log secret values. Path /zatca/{orgId} isolates orgs.
// ---------------------------------------------------------------------------

import type { SecretStore } from "@contractor-ops/secrets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InfisicalConfig {
  /** Infisical instance URL. Defaults to https://app.infisical.com */
  siteUrl?: string;
  /** Machine identity client ID */
  clientId: string;
  /** Machine identity client secret */
  clientSecret: string;
  /** Infisical project ID */
  projectId: string;
  /** Environment slug (e.g., "production", "staging") */
  environment: string;
}

/** Well-known ZATCA secret names stored per organization */
export const ZATCA_SECRET_NAMES = {
  X509_CERTIFICATE: "X509_CERTIFICATE",
  PRIVATE_KEY: "PRIVATE_KEY",
  API_SECRET: "API_SECRET",
  COMPLIANCE_REQUEST_ID: "COMPLIANCE_REQUEST_ID",
} as const;

export type ZatcaSecretName = (typeof ZATCA_SECRET_NAMES)[keyof typeof ZATCA_SECRET_NAMES];

// ---------------------------------------------------------------------------
// SecretStoreError
// ---------------------------------------------------------------------------

export class SecretStoreError extends Error {
  readonly operation: string;
  readonly path?: string;

  constructor(message: string, operation: string, path?: string, cause?: unknown) {
    super(message);
    this.name = "SecretStoreError";
    this.operation = operation;
    this.path = path;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// InfisicalSecretStore
// ---------------------------------------------------------------------------

/**
 * SecretStore implementation backed by Infisical.
 *
 * Uses lazy initialization — the SDK is only created and authenticated
 * on the first operation. All errors are caught, logged (path only, never
 * values), and rethrown as SecretStoreError.
 */
export class InfisicalSecretStore implements SecretStore {
  private readonly config: Required<InfisicalConfig>;
  private sdk: import("@infisical/sdk").InfisicalSDK | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: InfisicalConfig) {
    this.config = {
      siteUrl: config.siteUrl ?? "https://app.infisical.com",
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      projectId: config.projectId,
      environment: config.environment,
    };
  }

  async get(path: string): Promise<string | null> {
    await this.ensureInitialized();
    const { secretName, folderPath } = this.parsePath(path);

    try {
      const secret = await this.sdk!.secrets().getSecret({
        environment: this.config.environment,
        projectId: this.config.projectId,
        secretName,
        secretPath: folderPath,
      });
      return secret?.secretValue ?? null;
    } catch (error) {
      // Infisical throws on not-found — treat as null
      if (this.isNotFoundError(error)) {
        return null;
      }
      console.error(`[infisical] Failed to get secret at path: ${path}`);
      throw new SecretStoreError(`Failed to retrieve secret`, "get", path, error);
    }
  }

  async set(path: string, value: string): Promise<void> {
    await this.ensureInitialized();
    const { secretName, folderPath } = this.parsePath(path);

    try {
      // Try update first, fall back to create
      try {
        await this.sdk!.secrets().updateSecret(secretName, {
          environment: this.config.environment,
          projectId: this.config.projectId,
          secretPath: folderPath,
          secretValue: value,
        });
      } catch (updateError) {
        if (this.isNotFoundError(updateError)) {
          await this.sdk!.secrets().createSecret(secretName, {
            environment: this.config.environment,
            projectId: this.config.projectId,
            secretPath: folderPath,
            secretValue: value,
          });
        } else {
          throw updateError;
        }
      }
    } catch (error) {
      if (error instanceof SecretStoreError) throw error;
      console.error(`[infisical] Failed to set secret at path: ${path}`);
      throw new SecretStoreError(`Failed to store secret`, "set", path, error);
    }
  }

  async delete(path: string): Promise<void> {
    await this.ensureInitialized();
    const { secretName, folderPath } = this.parsePath(path);

    try {
      await this.sdk!.secrets().deleteSecret(secretName, {
        environment: this.config.environment,
        projectId: this.config.projectId,
        secretPath: folderPath,
      });
    } catch (error) {
      // Deleting non-existent secret is a no-op
      if (this.isNotFoundError(error)) return;
      console.error(`[infisical] Failed to delete secret at path: ${path}`);
      throw new SecretStoreError(`Failed to delete secret`, "delete", path, error);
    }
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  /**
   * Parse a path like "zatca/org_123/X509_CERTIFICATE" into
   * { folderPath: "/zatca/org_123", secretName: "X509_CERTIFICATE" }
   */
  private parsePath(path: string): { secretName: string; folderPath: string } {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash <= 0) {
      return { secretName: normalized.slice(1), folderPath: "/" };
    }
    return {
      folderPath: normalized.slice(0, lastSlash),
      secretName: normalized.slice(lastSlash + 1),
    };
  }

  /**
   * Lazy-initialize the Infisical SDK on first use.
   * Uses a shared promise to prevent multiple concurrent initializations.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.sdk) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      const { InfisicalSDK } = await import("@infisical/sdk");
      this.sdk = new InfisicalSDK({
        siteUrl: this.config.siteUrl,
      });
      await this.sdk.auth().universalAuth.login({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      });
    } catch (error) {
      this.initPromise = null; // Allow retry
      console.error("[infisical] Failed to initialize SDK");
      throw new SecretStoreError("Failed to initialize Infisical SDK", "init", undefined, error);
    }
  }

  private isNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return msg.includes("not found") || msg.includes("404") || msg.includes("doesn't exist");
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// ZATCA Secret Store Factory
// ---------------------------------------------------------------------------

/**
 * Creates a SecretStore scoped to a specific organization's ZATCA secrets.
 *
 * All paths are automatically prefixed with `/zatca/{organizationId}/`.
 * This ensures per-org isolation (T-48-14).
 *
 * @example
 * ```typescript
 * const store = createZatcaSecretStore("org_abc123");
 * await store.set("X509_CERTIFICATE", certPem);
 * const cert = await store.get("X509_CERTIFICATE");
 * ```
 */
export function createZatcaSecretStore(organizationId: string): SecretStore {
  const config: InfisicalConfig = {
    siteUrl: process.env.INFISICAL_SITE_URL ?? "https://app.infisical.com",
    clientId: process.env.INFISICAL_CLIENT_ID ?? "",
    clientSecret: process.env.INFISICAL_CLIENT_SECRET ?? "",
    projectId: process.env.INFISICAL_PROJECT_ID ?? "",
    environment: process.env.INFISICAL_ENVIRONMENT ?? "production",
  };

  const backing = new InfisicalSecretStore(config);
  const prefix = `zatca/${organizationId}`;

  return {
    get: (path: string) => backing.get(`${prefix}/${path}`),
    set: (path: string, value: string) => backing.set(`${prefix}/${path}`, value),
    delete: (path: string) => backing.delete(`${prefix}/${path}`),
  };
}
