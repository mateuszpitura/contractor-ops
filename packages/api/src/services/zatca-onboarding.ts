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
// All certificates/keys stored in Infisical, never in DB.
// Private key never returned to client.
// All mutations require authenticated org admin.
// Compliance credentials only in Infisical, never in configJson.
// ---------------------------------------------------------------------------

import nodeCrypto from 'node:crypto';
import type { Prisma } from '@contractor-ops/db';
import type {
  ZatcaConnectionConfig,
  ZatcaOnboardingState,
  ZatcaTaxDetails,
} from '@contractor-ops/einvoice';
import {
  buildComplianceTestInvoices,
  generateZatcaCsr,
  generateZatcaXml,
  ZATCA_PRODUCTION_URL,
  ZATCA_SANDBOX_URL,
  ZatcaApiClient,
  zatcaTaxDetailsSchema,
} from '@contractor-ops/einvoice';
import { computeZatcaInvoiceHash } from '@contractor-ops/einvoice/zatca/hash';
import { createZatcaSecretStore, ZATCA_SECRET_NAMES } from '@contractor-ops/integrations';
import { TRPCError } from '@trpc/server';
import {
  ZATCA_COMPLIANCE_CHECKS_MUST_PASS,
  ZATCA_COMPLIANCE_CSID_REQUIRED,
  ZATCA_CSR_REQUIRED,
  ZATCA_TAX_DETAILS_REQUIRED,
  ZATCA_TAX_DETAILS_REQUIRED_FOR_COMPLIANCE,
} from '../errors';
import { writeAuditLog } from './audit-writer';
import type { DbClient } from './types';

export interface ZatcaOnboardingAuditContext {
  db: DbClient;
  actorId: string;
  actorName?: string | null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result from a single compliance check invoice submission */
export interface ComplianceCheckResult {
  type: string;
  invoiceTypeCode: string;
  subtype: string;
  status: 'CLEARED' | 'REPORTED' | 'REJECTED' | 'ERROR';
  message?: string;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function resolveZatcaBaseUrl(environment: string): string {
  return environment === 'production' ? ZATCA_PRODUCTION_URL : ZATCA_SANDBOX_URL;
}

function createZatcaApiClient(args: {
  environment: string;
  certificate?: string;
  secret?: string;
}): ZatcaApiClient {
  return new ZatcaApiClient({
    baseUrl: resolveZatcaBaseUrl(args.environment),
    binarySecurityToken: args.certificate ?? '',
    secret: args.secret ?? '',
  });
}

function resolveDb(db: DbClient): DbClient {
  return db;
}

/**
 * Load or create ZATCA IntegrationConnection for an organization.
 * Returns the connection record with parsed config.
 */
async function getOrCreateConnection(organizationId: string, db: DbClient, userId?: string) {
  const client = resolveDb(db);
  let connection = await client.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'ZATCA',
    },
  });

  if (!connection) {
    const defaultConfig: ZatcaConnectionConfig = {
      environment: 'sandbox',
      currentStep: 'tax_details',
      certificateStatus: 'none',
    };

    connection = await client.integrationConnection.create({
      data: {
        organizationId,
        provider: 'ZATCA',
        status: 'DISCONNECTED',
        credentialsRef: `infisical:zatca/${organizationId}`,
        connectedByUserId: userId ?? 'system',
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
  db: DbClient,
  statusOverride?: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'REAUTH_REQUIRED' | 'PENDING_MAPPING',
) {
  const client = resolveDb(db);
  const connection = await client.integrationConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const currentConfig = (connection.configJson as Record<string, unknown>) ?? {};
  const newConfig = { ...currentConfig, ...update };

  await client.integrationConnection.update({
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
 */
export async function saveTaxDetails(
  organizationId: string,
  taxDetails: ZatcaTaxDetails,
  userId: string | undefined,
  db: DbClient,
): Promise<void> {
  const validated = zatcaTaxDetailsSchema.parse(taxDetails);
  const connection = await getOrCreateConnection(organizationId, db, userId);

  await updateConnectionConfig(
    connection.id,
    {
      taxDetails: validated,
      currentStep: 'csr_generation',
    },
    db,
  );
}

// ---------------------------------------------------------------------------
// Step 2: Generate and Store CSR
// ---------------------------------------------------------------------------

/**
 * Generate ECDSA P-256 CSR with ZATCA-required attributes.
 * Stores the private key in Infisical immediately after generation.
 */
export async function generateAndStoreCsr(
  organizationId: string,
  db: DbClient,
): Promise<{ csrPem: string }> {
  const connection = await getOrCreateConnection(organizationId, db);
  const config = connection.configJson as Record<string, unknown> | null;
  const taxDetails = config?.taxDetails as ZatcaTaxDetails | undefined;

  if (!taxDetails) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: ZATCA_TAX_DETAILS_REQUIRED,
    });
  }

  const invoiceTypes = taxDetails.invoiceTypes ?? [];
  let title: '0100' | '1000' | '1100' = '1100';
  if (invoiceTypes.includes('standard') && !invoiceTypes.includes('simplified')) {
    title = '0100';
  } else if (!invoiceTypes.includes('standard') && invoiceTypes.includes('simplified')) {
    title = '1000';
  }

  const csrAttributes = {
    commonName: 'contractor-ops',
    orgName: taxDetails.orgNameArabic,
    vatNumber: taxDetails.vatNumber,
    country: 'SA' as const,
    serialNumber: `1-contractor-ops|2-ContractorOps|3-${nodeCrypto.randomUUID()}`,
    title,
    registeredAddress: `${taxDetails.street}, ${taxDetails.district}, ${taxDetails.city} ${taxDetails.postalCode}`,
    businessCategory: 'Technology',
  };

  const { csr, privateKey } = generateZatcaCsr(csrAttributes);

  const secretStore = createZatcaSecretStore(organizationId);
  await secretStore.set(ZATCA_SECRET_NAMES.PRIVATE_KEY, privateKey);

  await updateConnectionConfig(
    connection.id,
    {
      currentStep: 'compliance_csid',
      csrPem: csr,
    },
    db,
  );

  return { csrPem: csr };
}

// ---------------------------------------------------------------------------
// Step 3: Request Compliance CSID
// ---------------------------------------------------------------------------

/**
 * Submit CSR to ZATCA for a compliance certificate.
 * Stores the compliance certificate and API secret in Infisical.
 */
export async function requestComplianceCsid(
  organizationId: string,
  otp: string,
  audit: ZatcaOnboardingAuditContext,
): Promise<{ requestId: string }> {
  const db = audit.db;
  const connection = await getOrCreateConnection(organizationId, db);
  const config = connection.configJson as Record<string, unknown> | null;
  const csrPem = config?.csrPem as string | undefined;

  if (!csrPem) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: ZATCA_CSR_REQUIRED,
    });
  }

  const csrBase64 = Buffer.from(csrPem).toString('base64');
  const environment = (config?.environment as string) ?? 'sandbox';
  const apiClient = createZatcaApiClient({ environment });

  const response = await apiClient.requestComplianceCsid(csrBase64, otp);

  const secretStore = createZatcaSecretStore(organizationId);
  await secretStore.set(ZATCA_SECRET_NAMES.X509_CERTIFICATE, response.binarySecurityToken);
  await secretStore.set(ZATCA_SECRET_NAMES.API_SECRET, response.secret);
  await secretStore.set(ZATCA_SECRET_NAMES.COMPLIANCE_REQUEST_ID, response.requestID);

  const configUpdate = {
    currentStep: 'compliance_checks',
    certificateStatus: 'compliance',
  };

  await audit.db.$transaction(async tx => {
    const row = await tx.integrationConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });
    const currentConfig = (row.configJson as Record<string, unknown>) ?? {};
    await tx.integrationConnection.update({
      where: { id: connection.id },
      data: {
        configJson: { ...currentConfig, ...configUpdate } as unknown as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog({
      tx,
      organizationId,
      actorType: 'USER',
      actorId: audit.actorId,
      actorName: audit.actorName,
      action: 'zatca.compliance_csid_requested',
      resourceType: 'ORGANIZATION',
      resourceId: organizationId,
      metadata: { requestId: response.requestID, connectionId: connection.id },
    });
  });

  return { requestId: response.requestID };
}

// ---------------------------------------------------------------------------
// Step 4: Run Compliance Checks
// ---------------------------------------------------------------------------

/**
 * Submit 6 test invoices to ZATCA compliance endpoint.
 * All must pass (CLEARED for standard, REPORTED for simplified) to proceed.
 */
export async function runComplianceChecks(
  organizationId: string,
  db: DbClient,
): Promise<ComplianceCheckResult[]> {
  const connection = await getOrCreateConnection(organizationId, db);
  const config = connection.configJson as Record<string, unknown> | null;
  const taxDetails = config?.taxDetails as ZatcaTaxDetails | undefined;

  if (!taxDetails) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: ZATCA_TAX_DETAILS_REQUIRED_FOR_COMPLIANCE,
    });
  }

  const secretStore = createZatcaSecretStore(organizationId);
  const [certificate, apiSecret] = await Promise.all([
    secretStore.get(ZATCA_SECRET_NAMES.X509_CERTIFICATE),
    secretStore.get(ZATCA_SECRET_NAMES.API_SECRET),
  ]);

  if (!(certificate && apiSecret)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: ZATCA_COMPLIANCE_CSID_REQUIRED,
    });
  }

  const environment = (config?.environment as string) ?? 'sandbox';
  const apiClient = createZatcaApiClient({ environment, certificate, secret: apiSecret });

  const testInvoices = buildComplianceTestInvoices(taxDetails);
  const results: ComplianceCheckResult[] = [];

  for (const invoice of testInvoices) {
    const ext = invoice.extensions as Record<string, unknown>;
    const invoiceType = ext.invoiceType as string;
    const invoiceSubtype = ext.invoiceSubtype as string;

    try {
      const xml = await generateZatcaXml(invoice);
      const { base64: invoiceHash } = computeZatcaInvoiceHash(xml);
      const uuid = ext.uuid as string;

      const response = await apiClient.submitComplianceInvoice({
        invoiceHash,
        uuid,
        invoice: Buffer.from(xml, 'utf8').toString('base64'),
      });

      const status =
        response.clearanceStatus ?? response.reportingStatus ?? response.validationResults?.status;

      results.push({
        type: `${invoiceType} ${invoice.invoiceTypeCode}`,
        invoiceTypeCode: invoice.invoiceTypeCode,
        subtype: invoiceSubtype,
        status: (status as ComplianceCheckResult['status']) ?? 'ERROR',
        message: response.validationResults?.warningMessages?.[0]?.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        type: `${invoiceType} ${invoice.invoiceTypeCode}`,
        invoiceTypeCode: invoice.invoiceTypeCode,
        subtype: invoiceSubtype,
        status: 'ERROR',
        message,
      });
    }
  }

  const allPassed = results.every(r => r.status === 'CLEARED' || r.status === 'REPORTED');

  if (allPassed) {
    await updateConnectionConfig(
      connection.id,
      {
        currentStep: 'production_certificate',
      },
      db,
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// Step 5: Exchange Production Certificate
// ---------------------------------------------------------------------------

/**
 * Exchange compliance CSID for production certificate.
 * Overwrites compliance credentials with production ones in Infisical.
 */
export async function exchangeProductionCertificate(
  organizationId: string,
  audit: ZatcaOnboardingAuditContext,
): Promise<void> {
  const db = audit.db;
  const connection = await getOrCreateConnection(organizationId, db);
  const config = connection.configJson as Record<string, unknown> | null;

  const secretStore = createZatcaSecretStore(organizationId);
  const [requestId, certificate, apiSecret] = await Promise.all([
    secretStore.get(ZATCA_SECRET_NAMES.COMPLIANCE_REQUEST_ID),
    secretStore.get(ZATCA_SECRET_NAMES.X509_CERTIFICATE),
    secretStore.get(ZATCA_SECRET_NAMES.API_SECRET),
  ]);

  if (!(requestId && certificate && apiSecret)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: ZATCA_COMPLIANCE_CHECKS_MUST_PASS,
    });
  }

  const environment = (config?.environment as string) ?? 'sandbox';
  const apiClient = createZatcaApiClient({ environment, certificate, secret: apiSecret });

  const response = await apiClient.requestProductionCsid(requestId);

  await Promise.all([
    secretStore.set(ZATCA_SECRET_NAMES.X509_CERTIFICATE, response.binarySecurityToken),
    secretStore.set(ZATCA_SECRET_NAMES.API_SECRET, response.secret),
  ]);

  await secretStore.delete(ZATCA_SECRET_NAMES.COMPLIANCE_REQUEST_ID);

  const productionConfig = {
    ...(config ?? {}),
    currentStep: 'production_certificate',
    certificateStatus: 'production',
    environment: 'production',
  };

  await audit.db.$transaction(async tx => {
    await tx.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: 'CONNECTED',
        connectedAt: new Date(),
        configJson: productionConfig as unknown as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog({
      tx,
      organizationId,
      actorType: 'USER',
      actorId: audit.actorId,
      actorName: audit.actorName,
      action: 'zatca.production_certificate_exchanged',
      resourceType: 'ORGANIZATION',
      resourceId: organizationId,
      metadata: { connectionId: connection.id, environment: 'production' },
    });
  });
}

// ---------------------------------------------------------------------------
// State Query
// ---------------------------------------------------------------------------

/**
 * Get the current onboarding state for an organization's ZATCA connection.
 */
export async function getOnboardingState(
  organizationId: string,
  db: DbClient,
): Promise<ZatcaOnboardingState> {
  const connection = await db.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'ZATCA',
    },
  });

  if (!connection) {
    return {
      currentStep: 'tax_details',
      taxDetails: false,
      csrGenerated: false,
      complianceCsidReceived: false,
      complianceChecksPassed: false,
      productionCertActive: false,
    };
  }

  const config = (connection.configJson as Record<string, unknown>) ?? {};
  const currentStep = (config.currentStep as string) ?? 'tax_details';
  const certStatus = (config.certificateStatus as string) ?? 'none';

  return {
    currentStep: currentStep as ZatcaOnboardingState['currentStep'],
    taxDetails: !!config.taxDetails,
    csrGenerated: !!config.csrPem,
    complianceCsidReceived: certStatus === 'compliance' || certStatus === 'production',
    complianceChecksPassed: currentStep === 'production_certificate' || certStatus === 'production',
    productionCertActive: certStatus === 'production',
  };
}
