/**
 * Typed errors for the outbound-webhook surface. A `reason` discriminant lets
 * the subscription DTO map a rejection to a stable client message and the
 * deliver drain skip a bad target without leaking an internal stack.
 */

export type WebhookUrlErrorReason =
  | 'invalid-url'
  | 'https-required'
  | 'blocked-range'
  | 'resolves-private'
  | 'unresolvable';

export class WebhookUrlError extends Error {
  readonly reason: WebhookUrlErrorReason;

  constructor(reason: WebhookUrlErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'WebhookUrlError';
    this.reason = reason;
  }
}
