import { createLogger } from '@contractor-ops/logger';
import { decryptCredentials } from '../../services/credential-service.js';
import type { TinMatchClient, TinMatchInput, TinMatchResult } from './tin-match-client.js';

// DARK live IRS e-Services TIN-Matching client.
//
// Built behind the TinMatchClient seam but NOT wired into the default path: the
// shipped default is MockTinMatchClient. This client is instantiated only once
// PAF (Payer Account File) enrollment + e-Services registration clears its flag
// gate — a separate operational prerequisite from the IRIS A2A TCC.
//
// SSRF-safety (mirrors peppol-adapter-factory): the base URL is one of two
// pinned literal strings, selected by the decrypted credential blob's
// `environment` field. No user input can influence the URL.
//
// PII boundary: a full TIN/SSN is NEVER logged. The structured logger only ever
// records the last-4 digits.

const log = createLogger({ service: 'eservices-tin-match-client' });

const ESERVICES_PRODUCTION_BASE_URL = 'https://la.www4.irs.gov/e-services/tin/tinmatch';
const ESERVICES_SANDBOX_BASE_URL = 'https://la.alt.www4.irs.gov/e-services/tin/tinmatch';

function last4(tin: string): string {
  return tin.replace(/[\s-]/g, '').slice(-4);
}

/**
 * Resolve the pinned literal base URL for the requested environment. Never
 * derived from user input — `environment` is the only switch and it selects
 * between two compile-time literals.
 */
function resolveBaseUrl(environment: unknown): string {
  return environment === 'production' ? ESERVICES_PRODUCTION_BASE_URL : ESERVICES_SANDBOX_BASE_URL;
}

export interface EServicesTinMatchClientConfig {
  /** The encrypted credential blob reference stored on the IntegrationConnection. */
  credentialsRef: string;
}

/**
 * Live e-Services TIN-Matching client. Dark — kept off the default path until
 * its flag/PAF gate clears (the service is wired to MockTinMatchClient by
 * default). Constructing it decrypts the e-Services credential and pins the
 * base URL by the credential's `environment`.
 */
export class EServicesTinMatchClient implements TinMatchClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: EServicesTinMatchClientConfig) {
    // Provider slug 'irs-tin-match' selects the dedicated e-Services encryption key.
    const blob = decryptCredentials(config.credentialsRef, 'irs-tin-match');
    const environment = (blob.extra as Record<string, unknown> | undefined)?.environment;
    this.baseUrl = resolveBaseUrl(environment);
    this.apiKey = blob.accessToken;
  }

  async match(input: TinMatchInput): Promise<TinMatchResult> {
    // Dark: the real interactive/bulk e-Services call is implemented when PAF
    // enrollment clears. Until then a constructed-but-ungated client refuses to
    // transmit rather than silently returning a fabricated indicator.
    log.warn(
      {
        baseUrl: this.baseUrl,
        hasApiKey: this.apiKey.length > 0,
        tinType: input.tinType,
        tinLast4: last4(input.tin),
      },
      'live e-Services TIN-Match client invoked while gate not cleared — refusing live call',
    );
    throw new Error(
      'EServicesTinMatchClient is dark: live IRS e-Services TIN-Matching requires PAF enrollment before use',
    );
  }
}
