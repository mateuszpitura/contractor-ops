import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// KSeF Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for KSeF (Krajowy System e-Faktur).
 *
 * KSeF uses token/certificate-based authentication (not OAuth) and
 * polling-based invoice sync (not webhooks). Health status uses the
 * shared {@link BaseAdapter.getHealthStatus} default — KSeF tokens do
 * carry an expiry, so the default `includeTokenExpiry: true` is correct.
 */
export class KsefAdapter extends BaseAdapter {
  readonly slug = 'ksef';
  readonly displayName = 'KSeF';
  readonly supportsOAuth = false;
  readonly supportsWebhooks = false;
}
