import { getServerEnv } from '@contractor-ops/validators';
import { Resend } from 'resend';

let resendClient: Resend | null = null;

/**
 * Returns a lazily-initialized Resend client.
 * Shared across billing-webhook, notification-service, and portal-magic-link.
 */
export function getResend(): Resend {
  resendClient ??= new Resend(getServerEnv().RESEND_API_KEY);
  return resendClient;
}
