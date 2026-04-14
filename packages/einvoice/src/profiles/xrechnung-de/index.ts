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
import type { ValidationResult } from '../../types/validation.js';
import {
  KOSIT_RULE_SET_VERSION,
  XRECHNUNG_DE_PROFILE_ID,
} from './constants.js';
import { generateXRechnungCii } from './generator.js';
import { parseXRechnungCii } from './parser.js';

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
   * Validation stub — Plan 61-03 implements the full three-layer KoSIT
   * pipeline (libxmljs2 XSD + saxon-js EN16931 Schematron + XRechnung CIUS
   * Schematron). Returning `valid: true` here is a DELIBERATE Plan-02 stub:
   * callers in Plans 04/06 invoke the profile's `validate` only AFTER Plan 03
   * lands. Callers before then must route through the generator directly.
   */
  async validate(_xml: string): Promise<ValidationResult> {
    return {
      valid: true,
      errors: [],
      warnings: [],
      profileId: this.profileId,
    };
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
        canParse: false, // inbound parsing is Phase 62
        canSign: false,
        canQRCode: false,
      },
    };
  }
}
