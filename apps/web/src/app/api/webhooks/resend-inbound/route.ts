/**
 * @deprecated Phase 12: Use /api/webhooks/resend instead.
 * This route remains for backward compatibility during Resend webhook URL migration.
 * Remove after Resend webhook URL is updated to /api/webhooks/resend.
 */

import {
  checkResendEmailIntakeRateLimit,
  processResendEmailReceivedAttachments,
  RESEND_EMAIL_RATE_MAX_PER_HOUR,
} from '@contractor-ops/api/services/resend-email-intake';
import { prisma } from '@contractor-ops/db';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { WebhookEventPayload } from 'resend';
import { Resend } from 'resend';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_DOMAIN_SUFFIX = '.contractorhub.io';

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
  const email = bracketMatch ? (bracketMatch[1] ?? toAddress.trim()) : toAddress.trim();

  const atIndex = email.indexOf('@');
  if (atIndex === -1) return null;

  const domain = email.substring(atIndex + 1).toLowerCase();

  if (!domain.endsWith(EMAIL_DOMAIN_SUFFIX)) return null;

  const slug = domain.slice(0, -EMAIL_DOMAIN_SUFFIX.length);
  if (!slug || slug.includes('.')) return null;

  return slug;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;

  if (!webhookSecret) {
    console.error('[resend-inbound] RESEND_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  if (!apiKey) {
    console.error('[resend-inbound] RESEND_API_KEY is not set');
    return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  const rawBody = await request.text();
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!(svixId && svixTimestamp && svixSignature)) {
    return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 401 });
  }

  let event: WebhookEventPayload;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    });
  } catch (error) {
    console.warn('[resend-inbound] Invalid webhook signature:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (event.type !== 'email.received') {
    return NextResponse.json({ received: true });
  }

  const emailData = event.data;

  const toAddresses = emailData.to ?? [];
  let orgSlug: string | null = null;

  for (const addr of toAddresses) {
    orgSlug = parseOrgSlugFromEmail(addr);
    if (orgSlug) break;
  }

  if (!orgSlug) {
    console.warn(
      '[resend-inbound] Could not parse org slug from recipients: %s',
      toAddresses.join(', '),
    );
    return NextResponse.json({ received: true });
  }

  const organization = await prisma.organization.findFirst({
    where: { slug: orgSlug },
  });

  if (!organization) {
    console.warn('[resend-inbound] No organization found for slug: %s', orgSlug);
    return NextResponse.json({ received: true });
  }

  const { allowed: emailAllowed } = checkResendEmailIntakeRateLimit(organization.id);
  if (!emailAllowed) {
    console.warn(
      '[resend-inbound] Rate limit exceeded for org %s (%s): %d emails/hour max',
      organization.id,
      orgSlug,
      RESEND_EMAIL_RATE_MAX_PER_HOUR,
    );
    return NextResponse.json({ error: 'Email intake rate limit exceeded' }, { status: 429 });
  }

  const { processedCount } = await processResendEmailReceivedAttachments(
    prisma,
    organization.id,
    emailData,
  );

  return NextResponse.json({
    processed: true,
    count: processedCount,
  });
}
