import { createLogger } from '@contractor-ops/logger';
import { validateMimeType } from './mime-validator';
import { getR2BucketName } from './r2';
import { isClamAvailable, scanBuffer } from './virus-scanner';

const log = createLogger({ service: 'document-virus-scan' });

/** Prisma-like client for document virus-scan status updates. */
export type DocumentScanDb = {
  document: {
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

/**
 * Async fire-and-forget: validates MIME type and scans for viruses.
 * Updates document virusScanStatus accordingly. Never throws.
 */
export async function scanDocumentAndUpdateStatus(
  db: DocumentScanDb,
  documentId: string,
  storageKey: string,
): Promise<void> {
  try {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { createR2Client } = await import('./r2');
    const client = createR2Client();

    // 4 KB head only — this slice feeds the magic-byte MIME sniff below, NOT
    // the virus scan (see the full-object read further down).
    const headResponse = await client.send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: storageKey,
        Range: 'bytes=0-4099',
      }),
    );
    const headBytes = await headResponse.Body?.transformToByteArray();

    if (!headBytes) {
      log.error({ storageKey }, 'could not read object body');
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      });
      return;
    }

    const headBuffer = Buffer.from(headBytes);

    const mimeResult = await validateMimeType(headBuffer);
    if (!mimeResult.valid) {
      log.warn(
        { documentId, detectedMime: mimeResult.detectedMime ?? 'unknown' },
        'invalid mime type',
      );
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      });
      return;
    }

    const clamReady = await isClamAvailable();
    if (!clamReady) {
      log.error({}, 'clamav not available — marking failed');
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      });
      return;
    }

    // ClamAV must see the WHOLE object. The 4 KB head read above is only the
    // MIME sniff; scanning that slice would let malware placed past the first
    // 4 KB pass undetected, so fetch the full object (no Range) for the scan.
    const fullResponse = await client.send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: storageKey,
      }),
    );
    const fullBytes = await fullResponse.Body?.transformToByteArray();
    if (!fullBytes) {
      log.error({ storageKey }, 'could not read full object body for scan');
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      });
      return;
    }

    const scanResult = await scanBuffer(Buffer.from(fullBytes));
    if (scanResult.isClean) {
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'CLEAN' },
      });
    } else {
      log.warn({ documentId, virusName: scanResult.virusName ?? 'unknown' }, 'virus detected');
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'INFECTED' },
      });
    }
  } catch (error) {
    log.error({ err: error, documentId }, 'scan pipeline failed');
    await db.document
      .update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      })
      .catch(e => log.error({ err: e }, 'failed to update status'));
  }
}

/** Schedule a virus scan without blocking the caller. */
export function scheduleDocumentVirusScan(
  db: DocumentScanDb,
  documentId: string,
  storageKey: string,
): void {
  void scanDocumentAndUpdateStatus(db, documentId, storageKey);
}
