/**
 * Result of verifying a webhook signature from a provider.
 */
export interface WebhookVerificationResult {
  valid: boolean;
  /** Resolved organization primary key (cuid) when known at verification time */
  organizationId?: string;
  /**
   * Organization slug (e.g. from inbound email domain) — resolve to `organizationId`
   * in the HTTP route before persisting WebhookDelivery (FK).
   */
  organizationSlug?: string;
  eventType?: string;
  connectionId?: string;
  /**
   * Provider-supplied unique per-delivery event id, extracted from the VERIFIED
   * payload/headers (e.g. Resend/Svix `svix-id`). The ingress route persists it
   * on `WebhookDelivery.providerEventId`; combined with `provider` it gives
   * DB-enforced dedup (a re-delivery of the same upstream event collapses to
   * one row — the second insert hits P2002 and the route 200-OKs it). Leave
   * unset when the provider has no reliable per-event id (NULLs never collide,
   * so dedup is simply disabled for that provider — never fabricate a key that
   * is stable across distinct events, which would drop legitimate deliveries).
   */
  providerEventId?: string;
  /**
   * Reason a verification failed. Helps operators distinguish a configuration
   * problem (`config` — secret/API key missing or malformed) from genuine
   * signature mismatches (`signature` — likely an attacker probe or stale
   * webhook). Only set when `valid === false`.
   */
  reason?: 'config' | 'signature' | 'headers';
}

/**
 * Raw webhook delivery payload before processing.
 */
export interface WebhookPayload {
  deliveryId: string;
  provider: string;
  rawBody: string;
  headers: Record<string, string>;
}
