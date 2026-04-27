import { getOcrAdapterBySlug } from '../registry.js';
import type { OcrAdapter, OcrExtractionRequest, OcrExtractionResult } from '../types/ocr.js';

// ---------------------------------------------------------------------------
// Provider-Agnostic OCR Orchestration Service
// ---------------------------------------------------------------------------

type OcrProvider = 'CLAUDE' | 'GOOGLE_DOCUMENT_AI' | 'AZURE_FORM_RECOGNIZER';

/**
 * Required method surface every OCR adapter must implement.
 * Used as a runtime guard in `getOcrAdapter()` so partially-implemented
 * adapters fail at registration time rather than at first call.
 */
const OCR_ADAPTER_METHODS = ['extractInvoice'] as const satisfies ReadonlyArray<keyof OcrAdapter>;
const OCR_ADAPTER_PROPS = [
  'providerName',
  'slug',
  'supportedDocumentTypes',
] as const satisfies ReadonlyArray<keyof OcrAdapter>;

function isOcrAdapter(value: unknown): value is OcrAdapter {
  if (!(value && typeof value === 'object')) return false;
  const candidate = value as Record<string, unknown>;
  for (const method of OCR_ADAPTER_METHODS) {
    if (typeof candidate[method] !== 'function') return false;
  }
  for (const prop of OCR_ADAPTER_PROPS) {
    if (candidate[prop] === undefined) return false;
  }
  return true;
}

/**
 * Resolves the OcrAdapter for a given provider from the OCR adapter registry.
 *
 * @param provider - The OCR provider to look up
 * @returns The resolved OcrAdapter
 * @throws Error if the adapter is not found or does not implement OcrAdapter
 */
export function getOcrAdapter(provider: OcrProvider): OcrAdapter {
  const slug = provider.toLowerCase();
  const adapter = getOcrAdapterBySlug(slug);

  if (!adapter) {
    throw new Error(
      `No adapter registered for OCR provider: ${provider}. ` +
        `Ensure registerAllAdapters() has been called.`,
    );
  }

  if (!isOcrAdapter(adapter)) {
    throw new Error(`Adapter for ${provider} does not implement the OcrAdapter interface.`);
  }

  return adapter;
}

/**
 * Extracts invoice data from a PDF using the specified OCR provider.
 *
 * @param params - Provider, PDF base64, file name, and optional locale
 * @returns Extraction result with fields, line items, and confidence scores
 */
export async function extractInvoice(params: {
  provider: OcrProvider;
  pdfBase64: string;
  fileName: string;
  locale?: string;
}): Promise<OcrExtractionResult> {
  const adapter = getOcrAdapter(params.provider);

  const request: OcrExtractionRequest = {
    pdfBase64: params.pdfBase64,
    fileName: params.fileName,
    locale: params.locale ?? 'pl',
  };

  return adapter.extractInvoice(request);
}

// Re-export OCR types for consumer convenience
export type {
  OcrAdapter,
  OcrExtractionField,
  OcrExtractionRequest,
  OcrExtractionResult,
  OcrLineItem,
} from '../types/ocr.js';
