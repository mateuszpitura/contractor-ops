/**
 * Profile-only orchestration facades — no DB, R2, or @contractor-ops/api imports.
 * Api-layer persistence (finalize, Peppol poll, KSeF sync) stays in packages/api.
 */
import type { EInvoice } from '../types/invoice.js';
import { generateXRechnungCii } from '../profiles/xrechnung-de/generator.js';
import type { XRechnungGenerateOptions } from '../profiles/xrechnung-de/index.js';
import { parseXrechnungCii } from '../profiles/xrechnung-de/parser.js';
import type { XRechnungValidationReport } from '../profiles/xrechnung-de/validator.js';
import { validateXRechnungCii } from '../profiles/xrechnung-de/validator.js';
import type { GenerateZugferdInput } from '../profiles/zugferd-de/generator.js';
import { generateZugferdPdf } from '../profiles/zugferd-de/generator.js';
import type { ParsedZugferd } from '../profiles/zugferd-de/parser.js';
import { parseZugferdPdf } from '../profiles/zugferd-de/parser.js';
import { validateZugferdEmbeddedXml } from '../profiles/zugferd-de/validator.js';

export async function parseInboundPdf(bytes: Uint8Array): Promise<ParsedZugferd> {
  return parseZugferdPdf(bytes);
}

export function parseInboundXml(xml: string) {
  return parseXrechnungCii(xml);
}

export async function validateInboundEmbeddedXml(xml: string): Promise<XRechnungValidationReport> {
  return validateZugferdEmbeddedXml(xml);
}

export async function validateInboundXRechnungCii(xml: string): Promise<XRechnungValidationReport> {
  return validateXRechnungCii(xml);
}

export async function generateOutboundZugferdPdf(input: GenerateZugferdInput) {
  return generateZugferdPdf(input);
}

export function generateOutboundXRechnungCii(
  invoice: EInvoice,
  options?: XRechnungGenerateOptions,
): string {
  return generateXRechnungCii(
    invoice,
    options?.leitwegId ?? null,
    options?.skontoTerm ?? null,
  );
}
