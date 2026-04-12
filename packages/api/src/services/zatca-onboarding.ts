// ---------------------------------------------------------------------------
// ZATCA Device Onboarding Orchestrator Service
// ---------------------------------------------------------------------------
// Implements the 5-step ZATCA onboarding flow:
// 1. saveTaxDetails — validate and persist tax details
// 2. generateAndStoreCsr — generate ECDSA CSR, store private key in Infisical
// 3. requestComplianceCsid — submit CSR to ZATCA, store compliance credentials
// 4. runComplianceChecks — submit 6 test invoices against compliance endpoint
// 5. exchangeProductionCertificate — swap compliance for production credentials
//
// Per D-02: All certificates/keys stored in Infisical, never in DB.
// Per T-48-15: Private key never returned to client.
// Per T-48-16: All mutations require authenticated org admin.
// Per T-48-18: Compliance credentials only in Infisical, never in configJson.
// ---------------------------------------------------------------------------

import nodeCrypto from "node:crypto";
import type { Prisma } from "@contractor-ops/db";
import { prisma as defaultPrisma } from "@contractor-ops/db";
import type { PrismaClient } from "@contractor-ops/db";
import type {
  ZatcaConnectionConfig,
  ZatcaOnboardingState,
  ZatcaTaxDetails,
} from "@contractor-ops/einvoice";
import {
  buildComplianceTestInvoices,
  generateZatcaCsr,
  generateZatcaXml,
  zatcaTaxDetailsSchema,
} from "@contractor-ops/einvoice";
import { createZatcaSecretStore, ZATCA_SECRET_NAMES } from "@contractor-ops/integrations";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result from a single compliance check invoice submission */
export interface ComplianceCheckResult {
  type: string;
  invoiceTypeCode: string;
  subtype: string;
  status: "CLEARED" | "REPORTED" | "REJECTED" | "ERROR";
  message?: string;
}

/** Minimal shape of the ZatcaApiClient we expect from Plan 04 */
interface ZatcaApiClientLike {
  requestComplianceCsid(csrBase64: string): Promise<{
    binarySecurityToken: string;
    secret: string;
    requestID: string;
  }>;
  requestProductionCsid(requestId: string): Promise<{
    binarySecurityToken: string;
    secret: string;
  }>;
  submitComplianceInvoice(
    hash: string,
    uuid: string,
    xml: string,
  ): Promise<{
    validationResults?: {
      status?: string;
      warningMessages?: Array<{ message?: string }>;
    };
  }>;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Dynamically load the ZatcaApiClient from the einvoice package.
 * Uses dynamic import because the api-client module is created by Plan 04
 * (running in parallel). At merge time, this resolves correctly.
 */
async function loadZatcaApiClient(options: Record<string, unknown>): Promise<ZatcaApiClientLike> {
  try {
    // The api-client.ts is created by Plan 04 and exports ZatcaApiClient
    const mod = await import("@contractor-ops/einvoice");
    const ClientClass = (mod as Record<string, unknown>).ZatcaApiClient as
      | (new (
          opts: Record<string, unknown>,
        ) => ZatcaApiClientLike)
      | undefined;

    if (!ClientClass) {
      throw new Error("ZatcaApiClient not found in einvoice exports");
    }

    return new ClientClass(options);
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "errors.zatca.apiClientUnavailable",
    });
  }
}

/**
 * Load or create ZATCA IntegrationConnection for an organization.
 * Returns the connection record with parsed config.
 */
async function getOrCreateConnection(organizationId: string, userId?: string) {
  let connection = await defaultPrisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: "ZATCA",
    },
  });

  if (!connection) {
    const defaultConfig: ZatcaConnectionConfig = {
      environment: "sandbox",
      currentStep: "tax_details",
      certificateStatus: "none",
    };

    connection = await defaultPrisma.integrationConnection.create({
      data: {
        organizationId,
        provider: "ZATCA",
        status: "DISCONNECTED",
        credentialsRef: `infisical:zatca/${organizationId}`,
        connectedByUserId: userId ?? "system",
        configJson: defaultConfig as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return connection;
}

/**
 * Update the ZATCA connection config.
 */
async function updateConnectionConfig(
  connectionId: string,
  update: Record<string, unknown>,
  statusOverride?: "CONNECTED" | "DISCONNECTED" | "ERROR" | "REAUTH_REQUIRED" | "PENDING_MAPPING",
) {
  const connection = await defaultPrisma.integrationConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const currentConfig = (connection.configJson as Record<string, unknown>) ?? {};
  const newConfig = { ...currentConfig, ...update };

  await defaultPrisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      configJson: newConfig as unknown as Prisma.InputJsonValue,
      ...(statusOverride ? { status: statusOverride } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Step 1: Save Tax Details
// ---------------------------------------------------------------------------

/**
 * Validate and save organization tax details for ZATCA onboarding.
 * Creates or updates the ZATCA IntegrationConnection.
 *
 * @param organizationId - Organization performing onboarding
 * @param taxDetails - Saudi tax details (VAT number, Arabic name, address)
 * @param userId - User performing the action (for audit trail)
 */
export async function saveTaxDetails(
  organizationId: string,
  taxDetails: ZatcaTaxDetails,
  userId?: string,
): Promise<void> {
  // Validate input (T-48-17: Zod schema enforces VAT format)
  const validated = zatcaTaxDetailsSchema.parse(taxDetails);

  const connection = await getOrCreateConnection(organizationId, userId);

  await updateConnectionConfig(connection.id, {
    taxDetails: validated,
    currentStep: "csr_generation",
  });
}

// ---------------------------------------------------------------------------
// Step 2: Generate and Store CSR
// ---------------------------------------------------------------------------

/**
 * Generate ECDSA P-256 CSR with ZATCA-required attributes.
 * Stores the private key in Infisical immediately after generation.
 * Returns the CSR PEM (public, safe for UI preview).
 *
 * SECURITY: Private key is stored in Infisical and never returned to the caller.
 *
 * @param organizationId - Organization performing onboarding
 * @returns CSR in PEM format for display/preview
 */
export async function generateAndStoreCsr(organizationId: string): Promise<{ csrPem: string }> {
  const connection = await getOrCreateConnection(organizationId);
  const config = connection.configJson as Record<string, unknown> | null;
  const taxDetails = config?.taxDetails as ZatcaTaxDetails | undefined;

  if (!taxDetails) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "errors.zatca.taxDetailsRequired",
    });
  }

  // Derive invoice types title code
  const invoiceTypes = taxDetails.invoiceTypes ?? [];
  let title: "0100" | "1000" | "1100" = "1100";
  if (invoiceTypes.includes("standard") && !invoiceTypes.includes("simplified")) {
    title = "0100";
  } else if (!invoiceTypes.includes("standard") && invoiceTypes.includes("simplified")) {
    title = "1000";
  }

  // Build CSR attributes from tax details
  const csrAttributes = {
    commonName: "contractor-ops",
    orgName: taxDetails.orgNameArabic,
    vatNumber: taxDetails.vatNumber,
    country: "SA" as const,
    serialNumber: `1-contractor-ops|2-ContractorOps|3-${nodeCrypto.randomUUID()}`,
    title,
    registeredAddress: `${taxDetails.street}, ${taxDetails.district}, ${taxDetails.city} ${taxDetails.postalCode}`,
    businessCategory: "Technology",
  };

  // Generate CSR and key pair
  const { csr, privateKey } = generateZatcaCsr(csrAttributes);

  // Store private key in Infisical immediately (T-48-15: never return to client)
  const secretStore = createZatcaSecretStore(organizationId);
  await secretStore.set(ZATCA_SECRET_NAMES.PRIVATE_KEY, privateKey);

  // Store CSR in configJson for the next step (CSR is public, safe to store)
  await updateConnectionConfig(connection.id, {
    currentStep: "compliance_csid",
    csrPem: csr,
  });

  return { csrPem: csr };
}

// ---------------------------------------------------------------------------
// Step 3: Request Compliance CSID
// ---------------------------------------------------------------------------

/**
 * Submit CSR to ZATCA for a compliance certificate.
 * Stores the compliance certificate and API secret in Infisical.
 *
 * @param organizationId - Organization performing onboarding
 * @returns The compliance request ID for later production certificate exchange
 */
export async function requestComplianceCsid(
  organizationId: string,
): Promise<{ requestId: string }> {
  const connection = await getOrCreateConnection(organizationId);
  const config = connection.configJson as Record<string, unknown> | null;
  const csrPem = config?.csrPem as string | undefined;

  if (!csrPem) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "errors.zatca.csrRequired",
    });
  }

  // Base64-encode the CSR PEM for ZATCA API
  const csrBase64 = Buffer.from(csrPem).toString("base64");

  // Create API client with sandbox configuration
  const environment = (config?.environment as string) ?? "sandbox";
  const apiClient = await loadZatcaApiClient({ environment });

  // Submit CSR to ZATCA
  const response = await apiClient.requestComplianceCsid(csrBase64);

  // Store compliance credentials in Infisical (T-48-18: never in DB)
  const secretStore = createZatcaSecretStore(organizationId);
  await secretStore.set(ZATCA_SECRET_NAMES.X509_CERTIFICATE, response.binarySecurityToken);
  await secretStore.set(ZATCA_SECRET_NAMES.API_SECRET, response.secret);
  await secretStore.set(ZATCA_SECRET_NAMES.COMPLIANCE_REQUEST_ID, response.requestID);

  // Update connection config (no secrets in configJson)
  await updateConnectionConfig(connection.id, {
    currentStep: "compliance_checks",
    certificateStatus: "compliance",
  });

  return { requestId: response.requestID };
}

// ---------------------------------------------------------------------------
// Step 4: Run Compliance Checks
// ---------------------------------------------------------------------------

/**
 * Submit 6 test invoices to ZATCA compliance endpoint.
 * All must pass (CLEARED for standard, REPORTED for simplified) to proceed.
 *
 * @param organizationId - Organization performing onboarding
 * @returns Array of results for each test invoice
 */
export async function runComplianceChecks(
  organizationId: string,
): Promise<ComplianceCheckResult[]> {
  const connection = await getOrCreateConnection(organizationId);
  const config = connection.configJson as Record<string, unknown> | null;
  const taxDetails = config?.taxDetails as ZatcaTaxDetails | undefined;

  if (!taxDetails) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "errors.zatca.taxDetailsRequiredForCompliance",
    });
  }

  // Load compliance credentials from Infisical
  const secretStore = createZatcaSecretStore(organizationId);
  const [certificate, apiSecret] = await Promise.all([
    secretStore.get(ZATCA_SECRET_NAMES.X509_CERTIFICATE),
    secretStore.get(ZATCA_SECRET_NAMES.API_SECRET),
  ]);

  if (!certificate || !apiSecret) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "errors.zatca.complianceCsidRequired",
    });
  }

  const environment = (config?.environment as string) ?? "sandbox";
  const apiClient = await loadZatcaApiClient({
    environment,
    certificate,
    secret: apiSecret,
  });

  // Build 6 compliance test invoices
  const testInvoices = buildComplianceTestInvoices(taxDetails);
  const results: ComplianceCheckResult[] = [];

  for (const invoice of testInvoices) {
    const ext = invoice.extensions as Record<string, unknown>;
    const invoiceType = ext.invoiceType as string;
    const invoiceSubtype = ext.invoiceSubtype as string;

    try {
      // Generate XML
      const xml = await generateZatcaXml(invoice);

      // Compute hash
      const hash = nodeCrypto.createHash("sha256").update(xml, "utf-8").digest("base64");

      const uuid = ext.uuid as string;

      // Submit to ZATCA compliance endpoint
      const response = await apiClient.submitComplianceInvoice(hash, uuid, xml);

      results.push({
        type: `${invoiceType} ${invoice.invoiceTypeCode}`,
        invoiceTypeCode: invoice.invoiceTypeCode,
        subtype: invoiceSubtype,
        status: (response.validationResults?.status as ComplianceCheckResult["status"]) ?? "ERROR",
        message: response.validationResults?.warningMessages?.[0]?.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({
        type: `${invoiceType} ${invoice.invoiceTypeCode}`,
        invoiceTypeCode: invoice.invoiceTypeCode,
        subtype: invoiceSubtype,
        status: "ERROR",
        message,
      });
    }
  }

  // Check if all passed
  const allPassed = results.every((r) => r.status === "CLEARED" || r.status === "REPORTED");

  if (allPassed) {
    await updateConnectionConfig(connection.id, {
      currentStep: "production_certificate",
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Step 5: Exchange Production Certificate
// ---------------------------------------------------------------------------

/**
 * Exchange compliance CSID for production certificate.
 * Overwrites compliance credentials with production ones in Infisical.
 *
 * @param organizationId - Organization performing onboarding
 */
export async function exchangeProductionCertificate(organizationId: string): Promise<void> {
  const connection = await getOrCreateConnection(organizationId);
  const config = connection.configJson as Record<string, unknown> | null;

  // Load compliance requestId from Infisical
  const secretStore = createZatcaSecretStore(organizationId);
  const [requestId, certificate, apiSecret] = await Promise.all([
    secretStore.get(ZATCA_SECRET_NAMES.COMPLIANCE_REQUEST_ID),
    secretStore.get(ZATCA_SECRET_NAMES.X509_CERTIFICATE),
    secretStore.get(ZATCA_SECRET_NAMES.API_SECRET),
  ]);

  if (!requestId || !certificate || !apiSecret) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "errors.zatca.complianceChecksMustPass",
    });
  }

  const environment = (config?.environment as string) ?? "sandbox";
  const apiClient = await loadZatcaApiClient({
    environment,
    certificate,
    secret: apiSecret,
  });

  // Exchange for production certificate
  const response = await apiClient.requestProductionCsid(requestId);

  // Overwrite compliance credentials with production ones in Infisical
  await Promise.all([
    secretStore.set(ZATCA_SECRET_NAMES.X509_CERTIFICATE, response.binarySecurityToken),
    secretStore.set(ZATCA_SECRET_NAMES.API_SECRET, response.secret),
  ]);

  // Clean up compliance request ID
  await secretStore.delete(ZATCA_SECRET_NAMES.COMPLIANCE_REQUEST_ID);

  // Update connection to CONNECTED + production
  const productionConfig = {
    ...(config ?? {}),
    currentStep: "production_certificate",
    certificateStatus: "production",
    environment: "production",
  };

  await defaultPrisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      status: "CONNECTED",
      connectedAt: new Date(),
      configJson: productionConfig as unknown as Prisma.InputJsonValue,
    },
  });
}

// ---------------------------------------------------------------------------
// State Query
// ---------------------------------------------------------------------------

/**
 * Get the current onboarding state for an organization's ZATCA connection.
 *
 * @param organizationId - Organization to query
 * @returns Current onboarding step and progress flags
 */
export async function getOnboardingState(organizationId: string): Promise<ZatcaOnboardingState> {
  const connection = await defaultPrisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: "ZATCA",
    },
  });

  if (!connection) {
    return {
      currentStep: "tax_details",
      taxDetails: false,
      csrGenerated: false,
      complianceCsidReceived: false,
      complianceChecksPassed: false,
      productionCertActive: false,
    };
  }

  const config = (connection.configJson as Record<string, unknown>) ?? {};
  const currentStep = (config.currentStep as string) ?? "tax_details";
  const certStatus = (config.certificateStatus as string) ?? "none";

  return {
    currentStep: currentStep as ZatcaOnboardingState["currentStep"],
    taxDetails: !!config.taxDetails,
    csrGenerated: !!config.csrPem,
    complianceCsidReceived: certStatus === "compliance" || certStatus === "production",
    complianceChecksPassed: currentStep === "production_certificate" || certStatus === "production",
    productionCertActive: certStatus === "production",
  };
}
