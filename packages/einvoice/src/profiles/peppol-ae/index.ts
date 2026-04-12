// ---------------------------------------------------------------------------
// Peppol PINT-AE Country Profile (UAE)
// ---------------------------------------------------------------------------

import type { ComplianceStatus } from "../../types/compliance.js";
import type { EInvoice } from "../../types/invoice.js";
import type { EInvoiceProfile } from "../../types/profile.js";
import type { ValidationResult } from "../../types/validation.js";
import { generatePintAeXml } from "./generator.js";
import { parsePintAeXml } from "./parser.js";
import { PeppolAEQRCode } from "./qr-code.js";
import { validatePintAeXml } from "./validator.js";

/**
 * Connection data for computing Peppol compliance status.
 */
export interface PeppolConnectionData {
  status: string;
  lastSyncAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
  sentCount?: number;
  receivedCount?: number;
  failedCount?: number;
}

/**
 * Compute compliance status from Peppol connection data.
 */
export function computePeppolComplianceStatus(data: PeppolConnectionData | null): ComplianceStatus {
  if (!data) {
    return {
      profileId: "peppol-ae",
      state: "not_connected",
      country: "AE",
      displayName: "Peppol PINT-AE (UAE)",
      healthScore: 0,
      capabilities: {
        canGenerate: true,
        canParse: true,
        canSign: false,
        canQRCode: true,
      },
    };
  }

  const stateMap: Record<string, ComplianceStatus["state"]> = {
    PENDING: "onboarding",
    REGISTERED: "onboarding",
    ACTIVE: "active",
    SUSPENDED: "suspended",
    DEREGISTERED: "not_connected",
  };

  const state = stateMap[data.status] ?? "error";

  // Health score: 100 if active with no recent errors, degrade based on failures
  let healthScore = 0;
  if (state === "active") {
    const total = (data.sentCount ?? 0) + (data.receivedCount ?? 0);
    const failed = data.failedCount ?? 0;
    healthScore = total > 0 ? Math.round(((total - failed) / total) * 100) : 100;
  }

  return {
    profileId: "peppol-ae",
    state,
    country: "AE",
    displayName: "Peppol PINT-AE (UAE)",
    lastSyncAt: data.lastSyncAt,
    lastErrorAt: data.lastErrorAt,
    lastErrorMessage: data.lastErrorMessage,
    healthScore,
    capabilities: {
      canGenerate: true,
      canParse: true,
      canSign: false,
      canQRCode: true,
    },
  };
}

/**
 * Peppol PINT-AE (UAE) country profile for the e-invoicing engine.
 *
 * Implements EInvoiceProfile to plug into the engine.
 * UAE Peppol does not require client-side signing (ASP handles AS4 transport).
 * UAE FTA requires QR codes on invoices.
 */
export class PeppolAEProfile implements EInvoiceProfile {
  readonly profileId = "peppol-ae" as const;
  readonly country = "AE" as const;
  readonly displayName = "Peppol PINT-AE (UAE)";

  /** UAE Peppol does not require client-side signing */
  readonly sign = undefined;
  /** UAE FTA requires QR codes per PEPPOL-04 */
  readonly qrCode = new PeppolAEQRCode();

  private complianceFetcher?:
    | ((organizationId: string) => Promise<PeppolConnectionData | null>)
    | undefined;

  constructor(options?: {
    complianceFetcher?: (organizationId: string) => Promise<PeppolConnectionData | null>;
  }) {
    this.complianceFetcher = options?.complianceFetcher;
  }

  async generate(invoice: EInvoice): Promise<string> {
    return generatePintAeXml(invoice);
  }

  async parse(xml: string, metadata?: Record<string, unknown>): Promise<EInvoice> {
    return parsePintAeXml(xml, metadata);
  }

  async validate(xml: string): Promise<ValidationResult> {
    return validatePintAeXml(xml);
  }

  async getComplianceStatus(organizationId: string): Promise<ComplianceStatus> {
    if (!this.complianceFetcher) {
      return computePeppolComplianceStatus(null);
    }
    const data = await this.complianceFetcher(organizationId);
    return computePeppolComplianceStatus(data);
  }
}
