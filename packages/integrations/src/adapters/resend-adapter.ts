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
 * Supports:
 * - Webhook signature verification via Svix headers
 * - Webhook processing for inbound email events
 *
 * Does NOT support OAuth (Resend is API-key / webhook-only).
 *
 * Env vars required:
 * - RESEND_WEBHOOK_SECRET — for Svix signature verification
 * - RESEND_API_KEY — for Resend SDK initialization
 */
export class ResendAdapter extends BaseAdapter {
  readonly slug = 'resend';
  readonly displayName = 'Resend';
  readonly supportsOAuth = false;
  readonly supportsWebhooks = true;

  // -------------------------------------------------------------------------
  // Webhook Verification
  // -------------------------------------------------------------------------

  /**
   * Verifies Resend webhook signature using Svix headers.
   * Mirrors the exact logic from apps/web/src/app/api/webhooks/resend-inbound/route.ts.
   *
   * Required headers: svix-id, svix-timestamp, svix-signature
   * Required env: RESEND_WEBHOOK_SECRET, RESEND_API_KEY
   */
  verifyWebhookSignature(
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

      // Extract event type
      const eventType = (event as { type?: string }).type ?? 'unknown';

      // Attempt to resolve organizationId from recipient email domain
      let organizationId: string | undefined;
      try {
        const data = (event as { data?: { to?: string[] } }).data;
        const toAddresses = data?.to ?? [];
        for (const addr of toAddresses) {
          const slug = parseOrgSlugFromEmail(addr);
          if (slug) {
            // Note: actual org lookup (prisma.organization.findFirst) happens
            // in the webhook route layer. Here we pass the slug as a hint.
            organizationId = slug;
            break;
          }
        }
      } catch {
        // If parsing fails, organizationId stays undefined
      }

      return {
        valid: true,
        eventType,
        organizationId,
      };
    } catch {
      return { valid: false };
    }
  }

  // -------------------------------------------------------------------------
  // Webhook Processing
  // -------------------------------------------------------------------------

  /**
   * Processes a verified Resend webhook payload.
   * Stub for Plan 02 — the actual email processing logic remains in the
   * resend-inbound route until full migration in Plan 03.
   */
  async handleWebhook(
    payload: unknown,
    _organizationId: string,
    _connectionId: string,
  ): Promise<void> {
    const _typedPayload = payload as { type?: string };
    // Plan 03 will wire the full email processing logic here
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the org slug from a recipient email address.
 * Handles both "invoices@slug.contractorhub.io" and
 * "Display Name <invoices@slug.contractorhub.io>" formats.
 */
function parseOrgSlugFromEmail(toAddress: string): string | null {
  const bracketMatch = toAddress.match(/<([^>]+)>/);
  const email = bracketMatch ? bracketMatch[1]! : toAddress.trim();

  const atIndex = email.indexOf('@');
  if (atIndex === -1) return null;

  const domain = email.substring(atIndex + 1).toLowerCase();

  if (!domain.endsWith(EMAIL_DOMAIN_SUFFIX)) return null;

  const slug = domain.slice(0, -EMAIL_DOMAIN_SUFFIX.length);
  if (!slug || slug.includes('.')) return null;

  return slug;
}
