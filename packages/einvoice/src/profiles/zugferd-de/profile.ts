// Phase 62 · Plan 62-02 Task 5 — ZUGFeRD-DE profile class + registry entry.
//
// Conforms to the shared `EInvoiceProfile` contract. The `parse()` method
// accepts a base64-encoded PDF string (`EInvoiceProfile.parse` signature is
// `(xml: string, metadata)` — ZUGFeRD inputs are binary so the caller is
// expected to base64-encode before passing; the router + intake service both
// do). The returned envelope loses the profile-level + warnings information
// that the richer `parseZugferdPdf` returns — callers that need it should
// call `parseZugferdPdf` directly instead of going through the profile
// interface.
//
// `generate()` delegates to the PDF/A-3 pipeline shipped by Plan 62-03.

import type { ComplianceStatus } from '../../types/compliance.js';
import { complianceState } from '../../types/compliance.js';
import type { EInvoice } from '../../types/invoice.js';
import type { EInvoiceProfile } from '../../types/profile.js';
import type { ValidationResult } from '../../types/validation.js';
import { ZUGFERD_DE_PROFILE_ID } from './constants.js';
import { generateZugferdPdf } from './generator.js';
import { parseZugferdPdf } from './parser.js';
import { validateZugferdEmbeddedXml } from './validator.js';

/**
 * ZUGFeRD / Factur-X German country profile.
 *
 * Inbound: PDF/A-3 + embedded factur-x.xml extracted and parsed.
 * Outbound: not yet wired — Plan 62-03 adds the PDF/A-3 wrapping pipeline.
 */
export class ZugferdDEProfile implements EInvoiceProfile {
  readonly profileId = ZUGFERD_DE_PROFILE_ID;
  readonly country = 'DE' as const;
  readonly displayName = 'ZUGFeRD 2.2 / Factur-X 1.0 (Germany, hybrid PDF/A-3 + CII)';

  /** ZUGFeRD does not require client-side XML signing (PDF signature is separate). */
  readonly sign = undefined;
  /** ZUGFeRD does not require invoice QR codes. */
  readonly qrCode = undefined;

  /**
   * Generate a ZUGFeRD hybrid PDF/A-3 B document from the canonical
   * `EInvoice` envelope. Returns a base64-encoded PDF string to satisfy
   * the `EInvoiceProfile.generate(): Promise<string>` contract — callers
   * that need the raw bytes should call `generateZugferdPdf` directly.
   */
  async generate(invoice: EInvoice): Promise<string> {
    const bytes = await generateZugferdPdf({ invoice });
    return Buffer.from(bytes).toString('base64');
  }

  /**
   * Parse a base64-encoded ZUGFeRD PDF and return the canonical EInvoice
   * envelope. Profile-level + warnings are discarded at this boundary —
   * callers needing that fidelity should call `parseZugferdPdf` directly.
   */
  async parse(base64Pdf: string, _metadata?: Record<string, unknown>): Promise<EInvoice> {
    const bytes = Uint8Array.from(Buffer.from(base64Pdf, 'base64'));
    const parsed = await parseZugferdPdf(bytes);
    return parsed.invoice;
  }

  /**
   * Validate extracted CII XML against the Phase-61 KoSIT three-layer
   * pipeline. Input is the XML string (already extracted from the PDF by
   * the intake service) — use `parseZugferdPdf` upstream to obtain it.
   */
  async validate(xml: string): Promise<ValidationResult> {
    const report = await validateZugferdEmbeddedXml(xml);
    const errors = report.layers.flatMap(layer =>
      layer.errors.map(issue => ({
        code: `${layer.layer}:${issue.ruleId}`,
        message: issue.message,
        path: issue.xpath || undefined,
        severity: 'error' as const,
      })),
    );
    const warnings = report.layers.flatMap(layer =>
      layer.warnings.map(issue => ({
        code: `${layer.layer}:${issue.ruleId}`,
        message: issue.message,
        path: issue.xpath || undefined,
        severity: 'warning' as const,
      })),
    );
    return {
      valid: report.status === 'VALID' || report.status === 'WARNINGS',
      errors,
      warnings,
      profileId: this.profileId,
    };
  }

  async getComplianceStatus(_organizationId: string): Promise<ComplianceStatus> {
    return {
      profileId: this.profileId,
      state: complianceState.active,
      country: this.country,
      displayName: this.displayName,
      healthScore: 100,
      capabilities: {
        canGenerate: true, // Plan 62-03 wired the PDF/A-3 pipeline
        canParse: true,
        canSign: false,
        canQRCode: false,
      },
    };
  }
}
