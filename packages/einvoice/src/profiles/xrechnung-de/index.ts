// XRechnungDEProfile class + registry hook.
//
// The profile is a stateless adapter between the shared `EInvoiceProfile`
// contract and the XRechnung-specific generator / parser / validator modules.
// It is registered at module import time via `registerXRechnungDEProfile()`
// invoked from `packages/einvoice/src/index.ts` (mirrors the KSeF / ZATCA /
// Peppol-AE convenience-registration pattern), so anyone who `import`s
// `@contractor-ops/einvoice` gets `getProfile('xrechnung-de')` wired up.

import type { ComplianceStatus } from '../../types/compliance.js';
import { complianceState } from '../../types/compliance.js';
import type { EInvoice } from '../../types/invoice.js';
import type { EInvoiceProfile } from '../../types/profile.js';
import type { ValidationError, ValidationResult } from '../../types/validation.js';
import { KOSIT_RULE_SET_VERSION, XRECHNUNG_DE_PROFILE_ID } from './constants.js';
import type { SkontoTermInput } from './generator.js';
import { generateXRechnungCii } from './generator.js';
import { parseXRechnungCii } from './parser.js';
import type { ValidationIssue, XRechnungValidationReport } from './validator.js';
import { validateXRechnungCii } from './validator.js';

/**
 * Re-exported from `./generator.js` so api-side callers can construct the
 * `skontoTerm` opt without reaching into the internal generator module.
 * Keeps the api → einvoice dependency direction clean.
 */
export type { SkontoTermInput };

/** Optional extras accepted by `generate()` — Leitweg-ID + Skonto term. */
export interface XRechnungGenerateOptions {
  /** BT-10 BuyerReference. Resolved by Plan 04's leitweg-id-resolver. */
  leitwegId?: string | null;
  /**
   * Optional Skonto (early payment discount) term. When provided, the
   * generator emits a BG-20 `<ram:SpecifiedTradePaymentTerms>` block
   * containing the locked German phrase plus the structured
   * `#SKONTO#TAGE=…#PROZENT=…#BASISBETRAG=…#` extension per XRechnung
   * 3.0.2 Anhang E.
   *
   * Accepts the same type the CII-level helper (`generateXRechnungCii`)
   * already takes, keeping the einvoice package self-contained.
   *
   * Resolution policy (invoice-level term → billing-profile default →
   * null) lives at the caller (`einvoice-finalize.ts`,
   * `einvoice.ts:generateZugferdPdf`) via
   * `services/skonto.ts:resolveSkontoTerm` — NOT inside this profile.
   */
  skontoTerm?: SkontoTermInput | null;
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
    // Forward the resolved Skonto term to the CII helper. Default to null
    // when omitted so the no-Skonto branch in buildPaymentTerms keeps
    // emitting the standard <ram:DueDateDateTime>-only payment terms block.
    return generateXRechnungCii(invoice, opts?.leitwegId ?? null, opts?.skontoTerm ?? null);
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
   * For the FULL per-layer report (used by the finalize router and the
   * EInvoice tab UI), call `validateRich` instead.
   */
  async validate(xml: string): Promise<ValidationResult> {
    const report = await validateXRechnungCii(xml);
    return projectReport(report, this.profileId);
  }

  /**
   * Generate XRechnung CII XML, then validate it in one round-trip. Used by
   * the `finalizeEInvoice` mutation to atomically build + KoSIT-check an
   * invoice before persisting to `EInvoiceLifecycle`.
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
   * issues) without lossy projection. Used by the finalize router and UI.
   */
  async validateRich(xml: string): Promise<XRechnungValidationReport> {
    return validateXRechnungCii(xml);
  }

  /**
   * Minimal compliance snapshot — active, full generate capability, no
   * signing or QR requirement. Enrich with org-scoped lifecycle counts
   * (validated / transmitted / delivered) to derive a real `healthScore`.
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
        canParse: true,
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
