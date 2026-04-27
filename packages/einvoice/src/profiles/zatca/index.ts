// ---------------------------------------------------------------------------
// ZATCA (Saudi Arabia) Country Profile
// ---------------------------------------------------------------------------

import type { ComplianceStatus } from '../../types/compliance.js';
import type { EInvoice } from '../../types/invoice.js';
import type { EInvoiceProfile } from '../../types/profile.js';
import type { ValidationResult } from '../../types/validation.js';
import type { ZatcaConnectionData } from './compliance.js';
import { computeZatcaComplianceStatus } from './compliance.js';
import { generateZatcaXml } from './generator.js';
import { parseZatcaXml } from './parser.js';
import { ZatcaTLVQRCode } from './qr-code.js';
import { ZatcaXAdESSigner } from './signer.js';

// ---------------------------------------------------------------------------
// ZatcaProfile
// ---------------------------------------------------------------------------

/**
 * ZATCA (Saudi Arabia) country profile for the e-invoicing engine.
 *
 * Implements EInvoiceProfile to plug into the engine.
 * ZATCA requires both signing (XAdES) and QR codes (TLV).
 * Plan 02 wires the ZatcaXAdESSigner (Signable).
 * Plan 03 wires the ZatcaTLVQRCode (QRCodeable).
 */
export class ZatcaProfile implements EInvoiceProfile {
  readonly profileId = 'zatca' as const;
  readonly country = 'SA' as const;
  readonly displayName = 'ZATCA (Saudi Arabia)';

  /** XAdES-BES enveloped digital signature (Plan 02) */
  readonly sign = new ZatcaXAdESSigner();
  /** TLV-encoded QR code generator (Plan 03) */
  readonly qrCode = new ZatcaTLVQRCode();

  private complianceFetcher?:
    | ((organizationId: string) => Promise<ZatcaConnectionData | null>)
    | undefined;

  constructor(options?: {
    complianceFetcher?: (organizationId: string) => Promise<ZatcaConnectionData | null>;
  }) {
    this.complianceFetcher = options?.complianceFetcher;
  }

  async generate(invoice: EInvoice): Promise<string> {
    return generateZatcaXml(invoice);
  }

  async parse(xml: string, metadata?: Record<string, unknown>): Promise<EInvoice> {
    return parseZatcaXml(xml, metadata);
  }

  async validate(xml: string): Promise<ValidationResult> {
    try {
      parseZatcaXml(xml);
      return {
        valid: true,
        errors: [],
        warnings: [],
        profileId: this.profileId,
      };
    } catch (error) {
      // `error instanceof Error` is now reliable across all parser-thrown
      // values after bug-hunt 2026-04-27 fixed the plain-object throw sites.
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : String(error);
      return {
        valid: false,
        errors: [{ code: 'PARSE_ERROR', message, severity: 'error' }],
        warnings: [],
        profileId: this.profileId,
      };
    }
  }

  async getComplianceStatus(organizationId: string): Promise<ComplianceStatus> {
    if (!this.complianceFetcher) {
      return computeZatcaComplianceStatus(null);
    }
    const data = await this.complianceFetcher(organizationId);
    return computeZatcaComplianceStatus(data);
  }
}
