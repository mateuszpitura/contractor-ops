/**
 * Shared Resend inbound email (email.received) processing.
 *
 * Used by:
 * - `apps/web/.../webhooks/resend-inbound/route.ts` (legacy URL)
 * - `apps/web/.../webhooks/_process/route.ts` (unified `/api/webhooks/resend` + QStash)
 */

import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { fetchWithTimeout } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import type { Resend } from 'resend';
import { createR2Client, getR2BucketName } from './r2';
import { getResend } from './resend-client';
import type { DbClient } from './types';

const log = createLogger({ service: 'resend-email-intake' });

/** Resend Receiving API — SDK types may not include `emails.receiving` yet. */
function resendReceivingAttachments(resend: Resend) {
  return (
    resend as unknown as {
      emails: {
        receiving: {
          attachments: {
            get: (args: { id: string; emailId: string }) => Promise<{
              data?: {
                download_url: string;
                filename?: string;
                content_type: string;
                size?: number;
              } | null;
            }>;
          };
        };
      };
    }
  ).emails.receiving.attachments;
}

// ---------------------------------------------------------------------------
// Rate limiting (per org, 100 emails/hour) — shared across all ingress paths
// ---------------------------------------------------------------------------

const EMAIL_RATE_WINDOW_MS = 60 * 60_000;

/** Max inbound emails per org per rolling hour (shared across ingress paths). */
export const RESEND_EMAIL_RATE_MAX_PER_HOUR = 100;

const emailIntakeMap = new Map<string, { timestamps: number[] }>();

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

export function checkResendEmailIntakeRateLimit(organizationId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = emailIntakeMap.get(organizationId) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(ts => now - ts < EMAIL_RATE_WINDOW_MS);

  if (entry.timestamps.length >= RESEND_EMAIL_RATE_MAX_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  emailIntakeMap.set(organizationId, entry);
  return {
    allowed: true,
    remaining: RESEND_EMAIL_RATE_MAX_PER_HOUR - entry.timestamps.length,
  };
}

// ---------------------------------------------------------------------------
// Payload shape (Resend webhook `data` for email.received)
// ---------------------------------------------------------------------------

export interface ResendInboundEmailData {
  from?: string;
  email_id?: string;
  to?: string[];
  attachments?: Array<{
    id: string;
    content_type?: string;
    filename?: string;
    size?: number;
  }>;
}

// ---------------------------------------------------------------------------
// Core: PDF + supporting attachments → R2 + Prisma graph
// ---------------------------------------------------------------------------

async function processNonPdfAttachmentsForInvoice(
  prisma: DbClient,
  params: {
    organizationId: string;
    invoiceId: string;
    emailId: string;
    nonPdfAttachmentIds: string[];
    attachmentsApi: ReturnType<typeof resendReceivingAttachments>;
    client: ReturnType<typeof createR2Client>;
    bucketName: string;
  },
): Promise<void> {
  const {
    organizationId,
    invoiceId,
    emailId,
    nonPdfAttachmentIds,
    attachmentsApi,
    client,
    bucketName,
  } = params;

  for (const nonPdfId of nonPdfAttachmentIds) {
    try {
      const nonPdfResponse = await attachmentsApi.get({
        id: nonPdfId,
        emailId,
      });

      if (!nonPdfResponse.data) continue;
      const nonPdfData = nonPdfResponse.data;

      const downloadResp = await fetchWithTimeout(nonPdfData.download_url, undefined, {
        timeoutMs: 60_000,
      });
      if (!downloadResp.ok) continue;

      const nonPdfBuffer = Buffer.from(await downloadResp.arrayBuffer());
      const nonPdfFileId = randomUUID();
      const ext = nonPdfData.filename?.split('.').pop()?.toLowerCase() ?? 'bin';
      const nonPdfKey = `orgs/${organizationId}/invoices/${nonPdfFileId}.${ext}`;

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
          organizationId,
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
          organizationId,
          invoiceId,
          documentId: supportingDoc.id,
          role: 'SUPPORTING_ATTACHMENT',
        },
      });

      await prisma.documentLink.create({
        data: {
          organizationId,
          documentId: supportingDoc.id,
          entityType: 'INVOICE',
          entityId: invoiceId,
          linkRole: 'SUPPORTING',
        },
      });
    } catch (nonPdfError) {
      log.error({ err: nonPdfError, nonPdfId }, 'failed to process non-PDF attachment');
    }
  }
}

async function processOnePdfAttachment(
  prisma: DbClient,
  params: {
    organizationId: string;
    emailData: ResendInboundEmailData;
    attachmentId: string;
    emailId: string;
    nonPdfAttachmentIds: string[];
    attachmentsApi: ReturnType<typeof resendReceivingAttachments>;
    client: ReturnType<typeof createR2Client>;
    bucketName: string;
  },
): Promise<string | null> {
  const {
    organizationId,
    emailData,
    attachmentId,
    emailId,
    nonPdfAttachmentIds,
    attachmentsApi,
    client,
    bucketName,
  } = params;

  try {
    const attResponse = await attachmentsApi.get({
      id: attachmentId,
      emailId,
    });

    if (!attResponse.data) {
      log.error({ attachmentId }, 'no data returned for attachment');
      return null;
    }

    const attData = attResponse.data;

    const pdfResponse = await fetchWithTimeout(attData.download_url, undefined, {
      timeoutMs: 60_000,
    });
    if (!pdfResponse.ok) {
      log.error({ attachmentId, status: pdfResponse.status }, 'failed to download attachment');
      return null;
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    const fileId = randomUUID();
    const storageKey = `orgs/${organizationId}/invoices/${fileId}.pdf`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }),
    );

    const document = await prisma.document.create({
      data: {
        organizationId,
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

    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        invoiceNumber: '',
        source: 'EMAIL_INTAKE',
        status: 'RECEIVED',
        matchStatus: 'UNMATCHED',
        approvalStatus: 'NOT_STARTED',
        paymentStatus: 'NOT_READY',
        submittedByEmail: emailData.from,
        receivedAt: new Date(),
        issueDate: new Date(),
        dueDate: new Date(),
        currency: 'PLN',
        subtotalMinor: 0,
        totalMinor: 0,
        amountToPayMinor: 0,
      },
    });

    await prisma.invoiceFile.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        documentId: document.id,
        role: 'SOURCE_ORIGINAL',
      },
    });

    await prisma.documentLink.create({
      data: {
        organizationId,
        documentId: document.id,
        entityType: 'INVOICE',
        entityId: invoice.id,
        linkRole: 'PRIMARY',
      },
    });

    await processNonPdfAttachmentsForInvoice(prisma, {
      organizationId,
      invoiceId: invoice.id,
      emailId,
      nonPdfAttachmentIds,
      attachmentsApi,
      client,
      bucketName,
    });

    return invoice.id;
  } catch (error) {
    log.error({ err: error, attachmentId }, 'failed to process PDF attachment');
    return null;
  }
}

/**
 * Downloads PDFs from Resend Receiving API, uploads to R2, creates Invoice/Document graph.
 * No-ops with `{ processedCount: 0 }` when there are no PDF attachments.
 */
export async function processResendEmailReceivedAttachments(
  prisma: DbClient,
  organizationId: string,
  emailData: ResendInboundEmailData,
): Promise<{ processedCount: number }> {
  const webhookAttachments = emailData.attachments ?? [];

  const pdfAttachmentIds = webhookAttachments
    .filter(att => att.content_type === 'application/pdf')
    .map(att => att.id);
  const nonPdfAttachmentIds = webhookAttachments
    .filter(att => att.content_type !== 'application/pdf')
    .map(att => att.id);

  if (pdfAttachmentIds.length === 0) {
    return { processedCount: 0 };
  }

  const emailId = emailData.email_id;
  if (!emailId) {
    return { processedCount: 0 };
  }

  const resend = getResend();
  const attachmentsApi = resendReceivingAttachments(resend);
  const client = createR2Client();
  const bucketName = getR2BucketName();

  const results = await Promise.all(
    pdfAttachmentIds.map(attachmentId =>
      processOnePdfAttachment(prisma, {
        organizationId,
        emailData,
        attachmentId,
        emailId,
        nonPdfAttachmentIds,
        attachmentsApi,
        client,
        bucketName,
      }),
    ),
  );

  const processed = results.filter(Boolean);
  return { processedCount: processed.length };
}

/**
 * QStash / unified webhook path: run intake from stored `WebhookDelivery` payload.
 */
export async function processResendWebhookDelivery(
  prisma: DbClient,
  params: {
    organizationId: string;
    eventType: string;
    payloadJson: unknown;
  },
): Promise<{ processedCount: number }> {
  const { organizationId, eventType, payloadJson } = params;

  if (!organizationId) {
    throw new Error('Resend webhook processing requires organizationId on delivery');
  }

  const payload = payloadJson as { type?: string; data?: ResendInboundEmailData };
  const type = payload.type ?? eventType;
  if (type !== 'email.received') {
    return { processedCount: 0 };
  }

  const emailData = payload.data;
  if (!emailData) {
    return { processedCount: 0 };
  }

  const { allowed } = checkResendEmailIntakeRateLimit(organizationId);
  if (!allowed) {
    throw new Error('Email intake rate limit exceeded');
  }

  return processResendEmailReceivedAttachments(prisma, organizationId, emailData);
}
