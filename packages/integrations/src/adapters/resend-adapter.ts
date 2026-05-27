import { createIntegrationLogger } from '@contractor-ops/logger';
import { Resend } from 'resend';
import type { WebhookVerificationResult } from '../types/webhook.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_DOMAIN_SUFFIX = '.contractorhub.io';

const log = createIntegrationLogger('resend');

/**
 * Resend client singleton (and the API key it was constructed with).
 *
 * The `verify` call does not make a network request, but constructing a
 * fresh `Resend` instance per webhook still pays the cost of pulling the
 * dependency tree on hot paths. We rebuild the client only when the API
 * key changes — typically never within a single process lifetime.
 */
let resendInstance: Resend | null = null;
let resendInstanceKey: string | null = null;

function getResendClient(apiKey: string): Resend {
  if (resendInstance && resendInstanceKey === apiKey) return resendInstance;
  resendInstance = new Resend(apiKey);
  resendInstanceKey = apiKey;
  return resendInstance;
}

// ---------------------------------------------------------------------------
// Resend Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Resend (email webhook provider).
 *
 * Signature verification runs in the `/webhooks/resend` Fastify ingress
 * (multi-provider dispatcher); the body then goes to QStash and inbound
 * processing happens in `/webhooks/_process` via
 * `@contractor-ops/api/services/resend-email-intake` (not in this package,
 * to avoid pulling Prisma/R2 into integrations).
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
      // Configuration error, not an attacker — log so operators can debug.
      log.warn(
        {
          hasSecret: Boolean(webhookSecret),
          hasApiKey: Boolean(apiKey),
        },
        'Resend webhook verification skipped: missing RESEND_WEBHOOK_SECRET or RESEND_API_KEY',
      );
      return { valid: false, reason: 'config' };
    }

    const svixId = headers['svix-id'];
    const svixTimestamp = headers['svix-timestamp'];
    const svixSignature = headers['svix-signature'];

    if (!(svixId && svixTimestamp && svixSignature)) {
      return { valid: false, reason: 'headers' };
    }

    let event: unknown;
    try {
      const resend = getResendClient(apiKey);
      event = resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        webhookSecret,
      });
    } catch (err) {
      // Never log the secret or full headers — only the error class.
      log.warn(
        {
          error: err instanceof Error ? err.message : String(err),
          errorName: err instanceof Error ? err.name : undefined,
        },
        'Resend webhook signature verification failed',
      );
      return { valid: false, reason: 'signature' };
    }

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
      // organizationSlug stays undefined — not a security-critical path
    }

    return {
      valid: true,
      eventType,
      organizationSlug,
    };
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
