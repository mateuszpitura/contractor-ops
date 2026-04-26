import { Resend } from 'resend';
import type { WebhookVerificationResult } from '../types/webhook.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_DOMAIN_SUFFIX = '.contractorhub.io';

// ---------------------------------------------------------------------------
// Resend Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Resend (email webhook provider).
 *
 * Signature verification matches `apps/web/.../webhooks/resend-inbound/route.ts`
 * (legacy URL) and unified `/api/webhooks/resend`.
 *
 * Inbound processing runs in `apps/web/.../webhooks/_process` via
 * `@contractor-ops/api/services/resend-email-intake` (not in this package, to
 * avoid pulling Prisma/R2 into integrations).
 */
export class ResendAdapter extends BaseAdapter {
  readonly slug = 'resend';
  readonly displayName = 'Resend';
  readonly supportsOAuth = false;
  readonly supportsWebhooks = true;

  override verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const apiKey = process.env.RESEND_API_KEY;

    if (!(webhookSecret && apiKey)) {
      return { valid: false };
    }

    const svixId = headers['svix-id'];
    const svixTimestamp = headers['svix-timestamp'];
    const svixSignature = headers['svix-signature'];

    if (!(svixId && svixTimestamp && svixSignature)) {
      return { valid: false };
    }

    try {
      const resend = new Resend(apiKey);
      const event = resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        webhookSecret,
      });

      const eventType = (event as { type?: string }).type ?? 'unknown';

      let organizationSlug: string | undefined;
      try {
        const data = (event as { data?: { to?: string[] } }).data;
        const toAddresses = data?.to ?? [];
        for (const addr of toAddresses) {
          const slug = parseOrgSlugFromEmail(addr);
          if (slug) {
            organizationSlug = slug;
            break;
          }
        }
      } catch {
        // organizationSlug stays undefined
      }

      return {
        valid: true,
        eventType,
        organizationSlug,
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * No-op: real work runs in `_process` via `processResendWebhookDelivery`.
   */
  override async handleWebhook(): Promise<void> {
    return;
  }
}

function parseOrgSlugFromEmail(toAddress: string): string | null {
  const bracketMatch = toAddress.match(/<([^>]+)>/);
  const email = bracketMatch ? (bracketMatch[1] ?? toAddress.trim()) : toAddress.trim();

  const atIndex = email.indexOf('@');
  if (atIndex === -1) return null;

  const domain = email.substring(atIndex + 1).toLowerCase();

  if (!domain.endsWith(EMAIL_DOMAIN_SUFFIX)) return null;

  const slug = domain.slice(0, -EMAIL_DOMAIN_SUFFIX.length);
  if (!slug || slug.includes('.')) return null;

  return slug;
}
