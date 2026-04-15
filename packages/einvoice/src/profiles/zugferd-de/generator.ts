// Phase 62 · Plan 62-03 Task 5 — ZUGFeRD generator orchestrator.
//
// End-to-end outbound pipeline:
//   1. Build the CII XML via Phase-61 `generateXRechnungCii` — no fork.
//      The CII syntax that XRechnung produces IS already EN-16931 compliant,
//      which is what ZUGFeRD COMFORT requires. One CII XML, two wrappers.
//   2. Render the visual invoice via @react-pdf/renderer.
//   3. Wrap the visual + CII into PDF/A-3 B (`wrapToPdfA3`).
//   4. Assert structural invariants (`assertZugferdStructure`) before
//      returning bytes — fail fast so callers never ship a broken PDF.
//
// Level gate (D-03): we only emit COMFORT outbound. MINIMUM / BASIC /
// BASIC-WL drop line-item or tax detail from the EN 16931 model, so
// emitting them would silently strip invoice fields. Anything other
// than 'COMFORT' throws `ZugferdLevelUnsupportedForOutput`. XRECHNUNG
// / EXTENDED are accepted at the type-level for future use but currently
// rejected as well (belt-and-braces).

import { logger } from '@contractor-ops/logger';

import { generateXRechnungCii } from '../xrechnung-de/generator.js';
import type { EInvoice } from '../../types/invoice.js';

import type { ZugferdConformanceLevel } from './constants.js';
import { renderInvoiceToPdfBuffer } from './invoice-template.js';
import { wrapToPdfA3 } from './pdf-wrapper.js';
import { assertZugferdStructure } from './zugferd-structural-check.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateZugferdInput {
  invoice: EInvoice;
  /** Defaults to 'COMFORT' — the only supported outbound level. */
  conformanceLevel?: ZugferdConformanceLevel;
  /**
   * Byte-stable timestamp stamped into XMP + /Info. Callers passing
   * fixtures / running deterministic tests should set this explicitly.
   * Defaults to `new Date()`.
   */
  producedAt?: Date;
  /**
   * Optional Leitweg-ID for XRechnung BT-10 BuyerReference embedding. Not
   * strictly required for ZUGFeRD COMFORT but preserved for parity with
   * the XRechnung generator. Defaults to `null` (no Leitweg-ID).
   */
  leitwegId?: string | null;
}

/**
 * Thrown when a caller requests an outbound conformance level we do not
 * generate. Stable `.code` lets upstream layers discriminate without a
 * `instanceof` check.
 */
export class ZugferdLevelUnsupportedForOutput extends Error {
  readonly code = 'ZUGFERD_LEVEL_UNSUPPORTED_FOR_OUTPUT' as const;
  constructor(public readonly level: string) {
    super(`Outbound ZUGFeRD only supports COMFORT; got ${level}`);
    this.name = 'ZugferdLevelUnsupportedForOutput';
  }
}

/**
 * Generate a ZUGFeRD (Factur-X) PDF/A-3 B hybrid invoice: visual PDF +
 * embedded CII XML. Returns the final byte stream ready to stream back
 * to the caller or upload to R2.
 */
export async function generateZugferdPdf(
  input: GenerateZugferdInput,
): Promise<Uint8Array> {
  const log = logger.child({
    module: 'zugferd-de/generator',
    invoiceId: input.invoice.id,
  });
  const level = input.conformanceLevel ?? 'COMFORT';
  if (level !== 'COMFORT') {
    throw new ZugferdLevelUnsupportedForOutput(level);
  }

  const producedAt = input.producedAt ?? new Date();
  const leitwegId = input.leitwegId ?? null;

  log.debug('building CII XML');
  const xml = generateXRechnungCii(input.invoice, leitwegId);

  log.debug('rendering visual PDF');
  const visualPdf = await renderInvoiceToPdfBuffer(input.invoice);

  log.debug('wrapping to PDF/A-3');
  const wrapped = await wrapToPdfA3(visualPdf, xml, {
    conformanceLevel: level,
    documentTitle: `Invoice ${input.invoice.id}`,
    creatorTool: '@contractor-ops/einvoice 5.0',
    producedAt,
  });

  log.debug('structural sanity check');
  await assertZugferdStructure(wrapped);

  log.info(
    { bytes: wrapped.length, invoiceId: input.invoice.id },
    'ZUGFeRD PDF/A-3 generated',
  );
  return wrapped;
}
