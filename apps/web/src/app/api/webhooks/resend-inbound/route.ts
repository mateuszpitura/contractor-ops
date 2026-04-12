/**
 * @deprecated Phase 12: Use /api/webhooks/resend instead.
 * This route remains for backward compatibility during Resend webhook URL migration.
 * Remove after Resend webhook URL is updated to /api/webhooks/resend.
 */

import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
// Email intake rate limiting (per-org, 100 emails/hour)
// ---------------------------------------------------------------------------

const EMAIL_RATE_WINDOW_MS = 60 * 60_000; // 1 hour
const EMAIL_RATE_MAX = 100;

const emailIntakeMap = new Map<string, { timestamps: number[] }>();

// Periodic cleanup
if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of emailIntakeMap) {
      entry.timestamps = entry.timestamps.filter(ts => now - ts < EMAIL_RATE_WINDOW_MS);
      if (entry.timestamps.length === 0) emailIntakeMap.delete(key);
    }
  };
  setInterval(cleanup, 10 * 60_000).unref?.();
}

function checkEmailIntakeLimit(orgId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = emailIntakeMap.get(orgId) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(ts => now - ts < EMAIL_RATE_WINDOW_MS);

  if (entry.timestamps.length >= EMAIL_RATE_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  emailIntakeMap.set(orgId, entry);
  return {
    allowed: true,
    remaining: EMAIL_RATE_MAX - entry.timestamps.length,
  };
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
  // Handle "Display Name <email>" format
  const bracketMatch = toAddress.match(/<([^>]+)>/);
  const email = bracketMatch ? bracketMatch[1]! : toAddress.trim();

  const atIndex = email.indexOf('@');
  if (atIndex === -1) return null;

  const domain = email.substring(atIndex + 1).toLowerCase();

  if (!domain.endsWith(EMAIL_DOMAIN_SUFFIX)) return null;

  // Extract slug: everything before the suffix in the domain
  const slug = domain.slice(0, -EMAIL_DOMAIN_SUFFIX.length);
  if (!slug || slug.includes('.')) return null;

  return slug;
}

// ---------------------------------------------------------------------------
// R2 client (same pattern as packages/api/src/services/r2.ts)
// ---------------------------------------------------------------------------

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;

  // Fail loudly if webhook secret is not configured
  if (!webhookSecret) {
    console.error('[resend-inbound] RESEND_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  if (!apiKey) {
    console.error('[resend-inbound] RESEND_API_KEY is not set');
    return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  // ---------- Step 1: Verify webhook signature ----------

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

  // ---------- Step 2: Check event type ----------

  if (event.type !== 'email.received') {
    return NextResponse.json({ received: true });
  }

  const emailData = event.data;

  // ---------- Step 3: Parse org slug from recipient ----------

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

  // ---------- Step 3.5: Email intake rate limiting ----------

  const { allowed: emailAllowed } = checkEmailIntakeLimit(organization.id);
  if (!emailAllowed) {
    console.warn(
      '[resend-inbound] Rate limit exceeded for org %s (%s): %d emails/hour max',
      organization.id,
      orgSlug,
      EMAIL_RATE_MAX,
    );
    return NextResponse.json({ error: 'Email intake rate limit exceeded' }, { status: 429 });
  }

  // ---------- Step 4: Fetch attachments via Resend Receiving API ----------

  const webhookAttachments = emailData.attachments ?? [];

  // Separate PDF vs non-PDF based on webhook event data
  const pdfAttachmentIds = webhookAttachments
    .filter(att => att.content_type === 'application/pdf')
    .map(att => att.id);
  const nonPdfAttachmentIds = webhookAttachments
    .filter(att => att.content_type !== 'application/pdf')
    .map(att => att.id);

  if (pdfAttachmentIds.length === 0) {
    return NextResponse.json({ received: true });
  }

  // ---------- Step 5: Process each PDF attachment ----------

  const orgId = organization.id;
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;

  const results = await Promise.all(
    pdfAttachmentIds.map(async attachmentId => {
      try {
        // Fetch attachment details (includes download_url)
        const attResponse = await resend.emails.receiving.attachments.get({
          id: attachmentId,
          emailId: emailData.email_id,
        });

        if (!attResponse.data) {
          console.error('[resend-inbound] No data returned for attachment %s', attachmentId);
          return null;
        }

        const attData = attResponse.data;

        // Download PDF content from the signed URL
        const pdfResponse = await fetch(attData.download_url);
        if (!pdfResponse.ok) {
          console.error(
            '[resend-inbound] Failed to download attachment %s: %d',
            attachmentId,
            pdfResponse.status,
          );
          return null;
        }

        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

        // Generate R2 storage key
        const fileId = randomUUID();
        const storageKey = `orgs/${orgId}/invoices/${fileId}.pdf`;

        // Upload to R2
        await client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: storageKey,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
          }),
        );

        // Create Document record
        const document = await prisma.document.create({
          data: {
            organizationId: orgId,
            storageKey,
            originalFileName: attData.filename ?? `invoice-${fileId}.pdf`,
            mimeType: 'application/pdf',
            fileSizeBytes: attData.size ?? pdfBuffer.length,
            checksumSha256: '',
            documentType: 'INVOICE',
            status: 'ACTIVE',
            virusScanStatus: 'PENDING',
            source: 'EMAIL_INTAKE',
          },
        });

        // Create Invoice record
        const invoice = await prisma.invoice.create({
          data: {
            organizationId: orgId,
            invoiceNumber: '',
            source: 'EMAIL_INTAKE',
            status: 'RECEIVED',
            matchStatus: 'UNMATCHED',
            approvalStatus: 'NOT_STARTED',
            paymentStatus: 'NOT_READY',
            submittedByEmail: emailData.from,
            receivedAt: new Date(),
            // Required monetary fields default to 0 until OCR/manual entry
            issueDate: new Date(),
            dueDate: new Date(),
            currency: 'PLN',
            subtotalMinor: 0,
            totalMinor: 0,
            amountToPayMinor: 0,
          },
        });

        // Create InvoiceFile linking invoice to document
        await prisma.invoiceFile.create({
          data: {
            organizationId: orgId,
            invoiceId: invoice.id,
            documentId: document.id,
            role: 'SOURCE_ORIGINAL',
          },
        });

        // Create DocumentLink
        await prisma.documentLink.create({
          data: {
            organizationId: orgId,
            documentId: document.id,
            entityType: 'INVOICE',
            entityId: invoice.id,
            linkRole: 'PRIMARY',
          },
        });

        // Process non-PDF attachments as SUPPORTING_ATTACHMENT for this invoice
        for (const nonPdfId of nonPdfAttachmentIds) {
          try {
            const nonPdfResponse = await resend.emails.receiving.attachments.get({
              id: nonPdfId,
              emailId: emailData.email_id,
            });

            if (!nonPdfResponse.data) continue;
            const nonPdfData = nonPdfResponse.data;

            const downloadResp = await fetch(nonPdfData.download_url);
            if (!downloadResp.ok) continue;

            const nonPdfBuffer = Buffer.from(await downloadResp.arrayBuffer());
            const nonPdfFileId = randomUUID();
            const ext = nonPdfData.filename?.split('.').pop()?.toLowerCase() ?? 'bin';
            const nonPdfKey = `orgs/${orgId}/invoices/${nonPdfFileId}.${ext}`;

            await client.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: nonPdfKey,
                Body: nonPdfBuffer,
                ContentType: nonPdfData.content_type,
              }),
            );

            const supportingDoc = await prisma.document.create({
              data: {
                organizationId: orgId,
                storageKey: nonPdfKey,
                originalFileName: nonPdfData.filename ?? `attachment-${nonPdfFileId}.${ext}`,
                mimeType: nonPdfData.content_type,
                fileSizeBytes: nonPdfData.size ?? nonPdfBuffer.length,
                checksumSha256: '',
                documentType: 'OTHER',
                status: 'ACTIVE',
                virusScanStatus: 'PENDING',
                source: 'EMAIL_INTAKE',
              },
            });

            await prisma.invoiceFile.create({
              data: {
                organizationId: orgId,
                invoiceId: invoice.id,
                documentId: supportingDoc.id,
                role: 'SUPPORTING_ATTACHMENT',
              },
            });

            await prisma.documentLink.create({
              data: {
                organizationId: orgId,
                documentId: supportingDoc.id,
                entityType: 'INVOICE',
                entityId: invoice.id,
                linkRole: 'SUPPORTING',
              },
            });
          } catch (nonPdfError) {
            console.error(
              '[resend-inbound] Failed to process non-PDF attachment %s:',
              nonPdfId,
              nonPdfError,
            );
          }
        }

        return invoice.id;
      } catch (error) {
        console.error('[resend-inbound] Failed to process PDF attachment %s:', attachmentId, error);
        return null;
      }
    }),
  );

  const processed = results.filter(Boolean);

  return NextResponse.json({
    processed: true,
    count: processed.length,
  });
}
