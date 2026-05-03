/**
 * Email helpers for the async export framework (P2-F).
 *
 * This module is deliberately thin — it composes the existing
 * `sendAppEmail` infrastructure (Resend in prod, SMTP in dev) with the
 * new react-email templates. New transactional emails should land here
 * (or in a dedicated submodule under `services/email/`) rather than
 * polluting the export consumer route.
 */

import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import { sendAppEmail } from '../app-email.js';
import {
  ExportReadyEmail,
  type ExportReadyEmailProps,
} from './templates/export-ready.js';

const log = createLogger({ service: 'email' });

export interface SendExportReadyEmailParams {
  to: string;
  exportDisplayName: string;
  fileName: string;
  /** Path to the in-app download route, e.g. `/api/exports/abc/download`. */
  downloadPath: string;
  expiresAtIso: string;
  rowCount?: number | null;
}

/**
 * Send the "your export is ready" notification. Builds the absolute
 * download URL from `NEXT_PUBLIC_APP_URL` so the link works in the
 * recipient's browser regardless of which Render region produced it.
 *
 * Errors are caught + logged at warn level — failing to email a download
 * link is not fatal (the user can find the export in the dashboard's
 * "your exports" panel) but still warrants ops visibility.
 */
export async function sendExportReadyEmail(params: SendExportReadyEmailParams): Promise<void> {
  const env = getServerEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const downloadUrl = `${appUrl}${params.downloadPath}`;

  const props: ExportReadyEmailProps = {
    exportDisplayName: params.exportDisplayName,
    fileName: params.fileName,
    downloadUrl,
    expiresAtIso: params.expiresAtIso,
    rowCount: params.rowCount ?? null,
  };

  try {
    await sendAppEmail({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: `Your export is ready: ${params.exportDisplayName}`,
      react: ExportReadyEmail(props),
    });
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), to: params.to },
      'sendExportReadyEmail failed — export is still durable',
    );
  }
}
