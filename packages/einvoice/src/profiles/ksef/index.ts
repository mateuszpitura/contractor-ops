import type { ComplianceStatus } from '../../types/compliance.js';
import type { EInvoice } from '../../types/invoice.js';
import type { EInvoiceProfile } from '../../types/profile.js';
import type { ValidationResult } from '../../types/validation.js';
import type { KsefConnectionData } from './compliance.js';
import { computeKsefComplianceStatus } from './compliance.js';
import { generateFa3Xml } from './generator.js';
import { ksefToEInvoice } from './mapper.js';
import { parseFa3Xml } from './parser.js';

// ---------------------------------------------------------------------------
// KSeF Country Profile
// ---------------------------------------------------------------------------

/**
 * KSeF (Krajowy System e-Faktur) country profile for Poland.
 *
 * Implements EInvoiceProfile to plug into the e-invoicing engine.
 * KSeF handles signing server-side and does not require client-side QR codes,
 * so both capabilities are undefined.
 */
export class KsefProfile implements EInvoiceProfile {
  readonly profileId = 'ksef' as const;
  readonly country = 'PL' as const;
  readonly displayName = 'KSeF (Poland)';

  /** KSeF does not require client-side signing (server-side) */
  readonly sign = undefined;
  /** KSeF does not require client-side QR code generation */
  readonly qrCode = undefined;

  private complianceFetcher?:
    | ((organizationId: string) => Promise<KsefConnectionData | null>)
    | undefined;

  constructor(options?: {
    complianceFetcher?: (organizationId: string) => Promise<KsefConnectionData | null>;
  }) {
    this.complianceFetcher = options?.complianceFetcher;
  }

  async generate(invoice: EInvoice): Promise<string> {
    return generateFa3Xml(invoice);
  }

  async parse(xml: string, metadata?: Record<string, unknown>): Promise<EInvoice> {
    const ksefRef = (metadata?.ksefReferenceNumber as string) ?? '';
    const upoNumber = metadata?.upoNumber as string | undefined;
    const parsed = parseFa3Xml(xml, ksefRef, upoNumber);
    return ksefToEInvoice(parsed);
  }

  async validate(xml: string): Promise<ValidationResult> {
    try {
      parseFa3Xml(xml, 'validation-check');
      return {
        valid: true,
        errors: [],
        warnings: [],
        profileId: this.profileId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
      return computeKsefComplianceStatus(null);
    }
    const data = await this.complianceFetcher(organizationId);
    return computeKsefComplianceStatus(data);
  }
}
