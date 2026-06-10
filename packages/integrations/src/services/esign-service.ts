import { getAdapter } from '../registry.js';
import type {
  EmbeddedSigningUrlResult,
  ESignAdapter,
  NormalizedSigningEvent,
  SignedDocumentResult,
  SigningEnvelopeRequest,
  SigningEnvelopeResult,
} from '../types/esign.js';

// ---------------------------------------------------------------------------
// Provider-Agnostic E-Sign Orchestration Service
// ---------------------------------------------------------------------------

type ESignProvider = 'DOCUSIGN' | 'AUTENTI';

/**
 * Required method surface every ESignAdapter must implement.
 * Used as a runtime guard so partial adapters fail at resolve-time
 * rather than at first call site.
 */
const ESIGN_ADAPTER_METHODS = [
  'createEnvelope',
  'getEmbeddedSigningUrl',
  'getSignedDocument',
  'getEnvelopeStatus',
  'voidEnvelope',
  'resendToRecipient',
  'normalizeWebhookEvent',
] as const satisfies ReadonlyArray<keyof ESignAdapter>;

function isESignAdapter(value: unknown): value is ESignAdapter {
  if (!(value && typeof value === 'object')) return false;
  const candidate = value as Record<string, unknown>;
  for (const method of ESIGN_ADAPTER_METHODS) {
    if (typeof candidate[method] !== 'function') return false;
  }
  if (typeof candidate.supportsEmbeddedSigning !== 'boolean') return false;
  return true;
}

/**
 * Resolves the ESignAdapter for a given provider from the adapter registry.
 *
 * @param provider - The e-sign provider to look up
 * @returns The resolved ESignAdapter
 * @throws Error if the adapter is not found or does not implement ESignAdapter
 */
export function getESignAdapter(provider: ESignProvider): ESignAdapter {
  const slug = provider.toLowerCase();
  const adapter = getAdapter(slug);

  if (!adapter) {
    throw new Error(
      `No adapter registered for provider: ${provider}. ` +
        `Ensure registerAllAdapters() has been called.`,
    );
  }

  if (!isESignAdapter(adapter)) {
    throw new Error(`Adapter for ${provider} does not implement the ESignAdapter interface.`);
  }

  return adapter;
}

/**
 * Creates a signing envelope using the specified provider.
 */
export async function createSigningEnvelope(params: {
  provider: ESignProvider;
  connectionId: string;
  request: SigningEnvelopeRequest;
}): Promise<SigningEnvelopeResult> {
  const adapter = getESignAdapter(params.provider);
  return adapter.createEnvelope(params.connectionId, params.request);
}

/**
 * Gets an embedded signing URL for the specified provider.
 * Returns null if the provider does not support embedded signing
 * (caller should fall back to redirect flow).
 */
export async function getEmbeddedSigningUrl(params: {
  provider: ESignProvider;
  connectionId: string;
  envelopeId: string;
  recipientEmail: string;
  returnUrl: string;
}): Promise<EmbeddedSigningUrlResult | null> {
  const adapter = getESignAdapter(params.provider);

  if (!adapter.supportsEmbeddedSigning) {
    return null;
  }

  return adapter.getEmbeddedSigningUrl(
    params.connectionId,
    params.envelopeId,
    params.recipientEmail,
    params.returnUrl,
  );
}

/**
 * Downloads the signed document from the provider.
 */
export async function downloadSignedDocument(params: {
  provider: ESignProvider;
  connectionId: string;
  envelopeId: string;
}): Promise<SignedDocumentResult> {
  const adapter = getESignAdapter(params.provider);
  return adapter.getSignedDocument(params.connectionId, params.envelopeId);
}

/**
 * Voids (cancels) a signing envelope.
 */
export async function voidSigningEnvelope(params: {
  provider: ESignProvider;
  connectionId: string;
  envelopeId: string;
  reason: string;
}): Promise<void> {
  const adapter = getESignAdapter(params.provider);
  return adapter.voidEnvelope(params.connectionId, params.envelopeId, params.reason);
}

/**
 * Resends a signing notification to a specific recipient.
 */
export async function resendSigningNotification(params: {
  provider: ESignProvider;
  connectionId: string;
  envelopeId: string;
  recipientEmail: string;
}): Promise<void> {
  const adapter = getESignAdapter(params.provider);
  return adapter.resendToRecipient(params.connectionId, params.envelopeId, params.recipientEmail);
}

/**
 * Normalizes a provider-specific webhook payload into a standard event.
 */
export function normalizeSigningEvent(
  provider: ESignProvider,
  payload: unknown,
): NormalizedSigningEvent {
  const adapter = getESignAdapter(provider);
  return adapter.normalizeWebhookEvent(payload);
}

// Re-export e-sign types for consumer convenience
export type {
  EmbeddedSigningUrlResult,
  ESignAdapter,
  NormalizedSigningEvent,
  SignedDocumentResult,
  SignerInfo,
  SigningEnvelopeRequest,
  SigningEnvelopeResult,
} from '../types/esign.js';
