// Phase 61 · Plan 61-02 Task 2 — XRechnungDEProfile class + registry hook.
//
// The profile is a stateless adapter between the shared `EInvoiceProfile`
// contract and the XRechnung-specific generator / parser / validator modules.
// It is registered at module import time via `registerXRechnungDEProfile()`
// invoked from `packages/einvoice/src/index.ts` (mirrors the KSeF / ZATCA /
// Peppol-AE convenience-registration pattern), so anyone who `import`s
// `@contractor-ops/einvoice` gets `getProfile('xrechnung-de')` wired up.
//
// `validate()` returns a minimal always-valid result in Plan 61-02; Plan 61-03
// replaces it with the three-layer KoSIT pipeline (XSD → EN 16931 Schematron →
// XRechnung CIUS Schematron). `getComplianceStatus()` returns an active-state
// snapshot with XRechnung capabilities; Plan 61-04 / 61-06 enrich this with
// org-scoped lifecycle counts from `EInvoiceLifecycle`.

import type { ComplianceStatus } from '../../types/compliance.js';
import { complianceState } from '../../types/compliance.js';
import type { EInvoice } from '../../types/invoice.js';
import type { EInvoiceProfile } from '../../types/profile.js';
import type { ValidationError, ValidationResult } from '../../types/validation.js';
import { KOSIT_RULE_SET_VERSION, XRECHNUNG_DE_PROFILE_ID } from './constants.js';
import { generateXRechnungCii } from './generator.js';
import { parseXRechnungCii } from './parser.js';
import type { ValidationIssue, XRechnungValidationReport } from './validator.js';
import { validateXRechnungCii } from './validator.js';

/** Optional extras accepted by `generate()` — Leitweg-ID is the only one today. */
export interface XRechnungGenerateOptions {
  /** BT-10 BuyerReference. Resolved by Plan 04's leitweg-id-resolver. */
  leitwegId?: string | null;
}

/**
 * XRechnung 3.0.2 country profile (CII syntax, German B2G CIUS on EN 16931).
 *
 * Registered in the einvoice registry via `registerXRechnungDEProfile` from
 * the package root (see `packages/einvoice/src/index.ts`).
 */
export class XRechnungDEProfile implements EInvoiceProfile {
  readonly profileId = XRECHNUNG_DE_PROFILE_ID;
  readonly country = 'DE' as const;
  readonly displayName = 'XRechnung 3.0.2 (Germany, CII)';

  /** XRechnung does not require client-side signing — KoSIT artifacts cover integrity. */
  readonly sign = undefined;
  /** XRechnung does not require invoice QR codes (unlike ZATCA). */
  readonly qrCode = undefined;

  async generate(invoice: EInvoice, opts?: XRechnungGenerateOptions): Promise<string> {
    return generateXRechnungCii(invoice, opts?.leitwegId ?? null);
  }

  async parse(xml: string, _metadata?: Record<string, unknown>): Promise<EInvoice> {
    return parseXRechnungCii(xml);
  }

  /**
   * Validate an XRechnung CII XML against the bundled KoSIT three-layer
   * pipeline (libxmljs2 XSD + saxon-js EN 16931 Schematron + saxon-js
   * XRechnung CIUS Schematron) and project the typed report onto the engine's
   * generic `ValidationResult` shape.
   *
   * For the FULL per-layer report (used by Plan 61-06's finalize router and
   * the EInvoice tab UI), call `validateRich` instead.
   */
  async validate(xml: string): Promise<ValidationResult> {
    const report = await validateXRechnungCii(xml);
    return projectReport(report, this.profileId);
  }

  /**
   * Generate XRechnung CII XML, then validate it in one round-trip. Used by
   * Plan 61-06's `finalizeEInvoice` mutation to atomically build + KoSIT-check
   * an invoice before persisting to `EInvoiceLifecycle`.
   */
  async generateAndValidate(
    invoice: EInvoice,
    opts?: XRechnungGenerateOptions,
  ): Promise<{ xml: string; report: XRechnungValidationReport }> {
    const xml = await this.generate(invoice, opts);
    const report = await validateXRechnungCii(xml);
    return { xml, report };
  }

  /**
   * Returns the full typed three-layer report (per-layer status + bucketed
   * issues) without lossy projection. Plan 61-06 / Plan 61-08 consume this.
   */
  async validateRich(xml: string): Promise<XRechnungValidationReport> {
    return validateXRechnungCii(xml);
  }

  /**
   * Minimal compliance snapshot — active, full generate capability, no
   * signing or QR requirement. Plan 61-06 enriches this with org-scoped
   * lifecycle counts (validated / transmitted / delivered) to derive a real
   * `healthScore`.
   */
  async getComplianceStatus(_organizationId: string): Promise<ComplianceStatus> {
    return {
      profileId: this.profileId,
      state: complianceState.active,
      country: this.country,
      displayName: `${this.displayName} · ${KOSIT_RULE_SET_VERSION}`,
      healthScore: 100,
      capabilities: {
        canGenerate: true,
        canParse: true, // inbound parsing wired in Phase 62 Plan 02 Task 4
        canSign: false,
        canQRCode: false,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Project the typed `XRechnungValidationReport` onto the engine's generic
 * `ValidationResult` shape. Lossy: `fatal` collapses into the engine's
 * `error` severity, and `info` is dropped (callers that need full fidelity
 * call `validateRich` instead).
 */
function projectReport(report: XRechnungValidationReport, profileId: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const layer of report.layers) {
    for (const issue of layer.errors) errors.push(toEngineIssue(issue, layer.layer));
    for (const issue of layer.warnings) warnings.push(toEngineIssue(issue, layer.layer));
  }

  return {
    valid: report.status === 'VALID' || report.status === 'WARNINGS',
    errors,
    warnings,
    profileId,
  };
}

function toEngineIssue(
  issue: ValidationIssue,
  layer: XRechnungValidationReport['layers'][number]['layer'],
): ValidationError {
  const severity: ValidationError['severity'] =
    issue.severity === 'warning' || issue.severity === 'info' ? 'warning' : 'error';
  return {
    code: `${layer}:${issue.ruleId}`,
    message: issue.message,
    path: issue.xpath || undefined,
    severity,
  };
}
