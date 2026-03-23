/**
 * Result of verifying a webhook signature from a provider.
 */
export interface WebhookVerificationResult {
  valid: boolean;
  organizationId?: string;
  eventType?: string;
  connectionId?: string;
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
