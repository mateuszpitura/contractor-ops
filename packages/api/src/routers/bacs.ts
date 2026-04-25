// packages/api/src/routers/bacs.ts
//
// Phase 63 · Plan 04 · D-27 — BACS Standard 18 Direct Credit tRPC router.
// Provides: previewExport, generateExport, validateSortCode, saveSubmitterConfig.
//
// All procedures are tenant-scoped. Preview + generate are gated by the
// `payments.bacs-enabled` feature flag (D-07). saveSubmitterConfig requires
// `settings:update` permission (admin-only per D-02).
//
// Threat model (per 63-04 plan):
//   - Non-admin access to submitter config -> requirePermission gate.
//   - Encrypted bank fields exposed in API response -> router NEVER returns
//     `*Encrypted` columns; only `*Masked` is sent to the client.
//   - Stale/tampered preview used as the downloaded file -> generateExport
//     creates a fresh file (does not cache previews) and writes a Document
//     row with a content-addressed R2 key + SHA-256 checksum.
//   - Guessable download URLs -> R2 signed URL, TTL 300s, content-addressed key.

import { createHash } from 'node:crypto';
import { createLogger } from '@contractor-ops/logger';
import {
  accountNumberSchema,
  bacsSubmitterNameSchema,
  modulusCheck,
  serviceUserNumberSchema,
  sortCodeSchema,
  VOCALINK_MODULUS_TABLE_V840,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { plain } from '../lib/plain.js';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../middleware/feature-flag.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { writeAuditLog } from '../services/audit-writer.js';
import { decryptBankAccount, encryptBankAccount } from '../services/bank-account-crypto.js';
import type { BacsExportItem, BacsOrgBankInfo } from '../services/payment-export.js';
import { generateBacsStandard18 } from '../services/payment-export.js';
import { putObjectAndSignDownload } from '../services/r2.js';

const log = createLogger({ service: 'bacs-router' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode the masked SUN preview from a 6-digit value: e.g. `XXXX{last2}`. */
function maskSun(plain: string): string {
  return `XXXX${plain.slice(-2)}`;
}

/** Format a 6-digit sort code mask: e.g. `XX-XX-{last2}`. */
function maskSortCode(plain: string): string {
  return `XX-XX-${plain.slice(-2)}`;
}

/** Format an 8-digit account number mask: e.g. `XXXX{last4}`. */
function maskAccountNumber(plain: string): string {
  return `XXXX${plain.slice(-4)}`;
}

/** Build a filesystem-safe ISO date stamp (YYYY-MM-DD) for filenames. */
function isoDateStamp(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Sanitize an arbitrary string into a safe segment for filenames / R2 keys.
 * Replaces every non `[A-Za-z0-9._-]` character with `-` and collapses runs.
 */
function sanitizeSegment(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Resolves the org's BACS submitter config from the Organization row.
 * Returns the decrypted plain values, or `null` when not yet configured.
 *
 * Used by previewExport + generateExport. Decryption is performed server-side
 * only — the plaintext NEVER leaves this function.
 */
async function loadDecryptedSubmitterConfig(
  db: unknown,
  organizationId: string,
): Promise<BacsOrgBankInfo | null> {
  // biome-ignore lint/suspicious/noExplicitAny: tenant client typing varies
  const dbAny = db as any;
  const org = await dbAny.organization.findUnique({
    where: { id: organizationId },
    select: {
      bacsServiceUserNumberEncrypted: true,
      bacsSubmitterSortCodeEncrypted: true,
      bacsSubmitterAccountNumberEncrypted: true,
      bacsSubmitterName: true,
      name: true,
    },
  });

  if (
    !(
      org &&
      org.bacsServiceUserNumberEncrypted &&
      org.bacsSubmitterSortCodeEncrypted &&
      org.bacsSubmitterAccountNumberEncrypted &&
      org.bacsSubmitterName
    )
  ) {
    return null;
  }

  return {
    serviceUserNumber: decryptBankAccount(org.bacsServiceUserNumberEncrypted),
    submitterSortCode: decryptBankAccount(org.bacsSubmitterSortCodeEncrypted),
    submitterAccountNumber: decryptBankAccount(org.bacsSubmitterAccountNumberEncrypted),
    submitterName: org.bacsSubmitterName,
  };
}

/**
 * Loads a payment run with all data needed to generate a BACS Std 18 file:
 * items + their invoice + contractor + billing-profile UK bank details.
 *
 * Throws NOT_FOUND when the run does not exist or belongs to another tenant.
 * Throws FAILED_PRECONDITION when an item is missing UK bank details.
 */
async function loadRunWithBacsItems(
  db: unknown,
  organizationId: string,
  paymentRunId: string,
): Promise<{
  runNumber: string;
  bacsItems: BacsExportItem[];
}> {
  // biome-ignore lint/suspicious/noExplicitAny: tenant client typing varies
  const dbAny = db as any;
  const run = await dbAny.paymentRun.findFirst({
    where: { id: paymentRunId, organizationId },
    include: {
      items: {
        where: { status: { not: 'SKIPPED' } },
        include: {
          invoice: {
            select: { invoiceNumber: true },
          },
          contractor: {
            select: { legalName: true },
          },
          billingProfile: {
            select: {
              ukSortCodeEncrypted: true,
              ukAccountNumberEncrypted: true,
            },
          },
        },
      },
    },
  });

  if (!run) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Payment run not found',
    });
  }

  const items = run.items as Array<{
    amountMinor: number;
    paymentReference: string | null;
    invoice: { invoiceNumber: string | null };
    contractor: { legalName: string };
    billingProfile: {
      ukSortCodeEncrypted: string | null;
      ukAccountNumberEncrypted: string | null;
    } | null;
  }>;

  const runRef = (run.runNumber as string | null) ?? run.id;

  const bacsItems: BacsExportItem[] = items.map(item => {
    if (
      !(
        item.billingProfile &&
        item.billingProfile.ukSortCodeEncrypted &&
        item.billingProfile.ukAccountNumberEncrypted
      )
    ) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `BACS export requires UK bank details for ${item.contractor.legalName}`,
      });
    }
    const reference = item.paymentReference ?? `${runRef}/${item.invoice.invoiceNumber ?? ''}`;
    return {
      contractorName: item.contractor.legalName,
      sortCode: decryptBankAccount(item.billingProfile.ukSortCodeEncrypted),
      accountNumber: decryptBankAccount(item.billingProfile.ukAccountNumberEncrypted),
      amountMinor: item.amountMinor,
      paymentReference: reference,
    };
  });

  return { runNumber: runRef, bacsItems };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const bacsRouter = router({
  /**
   * Returns the org's BACS submitter MASKED previews for the settings UI.
   * Never decrypts; safe to call without admin permission since the response
   * contains only non-reversible masks (last 2 / last 4 digits).
   *
   * Used by `<BacsSubmitterForm>` to render `Currently saved: XXXX34` rows
   * above each input when an encrypted secret already exists.
   */
  getSubmitterMasks: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const masks = await getBacsSubmitterMasks(ctx.db, ctx.organizationId);
      return plain(masks);
    }),

  /**
   * Preview a BACS Std 18 file for a payment run.
   *
   * Returns the rendered fixed-width text (ASCII), aggregated transliteration
   * warnings, and modulus-check warnings. The UI must:
   *  - block download when ANY transliteration `?` replacements exist;
   *  - surface modulus-check warnings (non-blocking per D-01).
   *
   * Throws FAILED_PRECONDITION when the org has not configured BACS submitter
   * details yet (D-02). The frontend deep-links the user to /settings/payments.
   */
  previewExport: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.bacs-enabled'))
    .use(requirePermission({ payment: ['export'] }))
    .input(z.object({ paymentRunId: z.string() }))
    .query(async ({ ctx, input }) => {
      const submitter = await loadDecryptedSubmitterConfig(ctx.db, ctx.organizationId);
      if (!submitter) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'BACS submitter not configured',
        });
      }

      const { runNumber, bacsItems } = await loadRunWithBacsItems(
        ctx.db,
        ctx.organizationId,
        input.paymentRunId,
      );

      const result = generateBacsStandard18(bacsItems, submitter, runNumber, new Date());

      return plain({
        fileText: result.fileBuffer.toString('ascii'),
        transliterationWarnings: result.transliterationWarnings,
        modulusWarnings: result.modulusWarnings,
      });
    }),

  /**
   * Generate the BACS file, persist it to R2 (content-addressed), record a
   * Document + PaymentExport row, and return a short-TTL signed download URL.
   *
   * The downloaded file is a freshly-rendered render — it is NOT a cached
   * preview byte-replay (mitigates "stale preview download" threat).
   */
  generateExport: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.bacs-enabled'))
    .use(requirePermission({ payment: ['export'] }))
    .input(z.object({ paymentRunId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const submitter = await loadDecryptedSubmitterConfig(ctx.db, ctx.organizationId);
      if (!submitter) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'BACS submitter not configured',
        });
      }

      const { runNumber, bacsItems } = await loadRunWithBacsItems(
        ctx.db,
        ctx.organizationId,
        input.paymentRunId,
      );

      const generatedAt = new Date();
      const result = generateBacsStandard18(bacsItems, submitter, runNumber, generatedAt);

      // Refuse to upload a file that contains unmappable `?` placeholders
      // (BACS would reject it; defensive guard duplicating the UI gate).
      const hasUnmappable = result.transliterationWarnings.some(w => w.replaced.includes('?'));
      if (hasUnmappable) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'BACS file contains unmappable characters; resolve transliteration warnings before downloading.',
        });
      }

      const sha256Hex = createHash('sha256').update(result.fileBuffer).digest('hex');
      const sha256Prefix = sha256Hex.slice(0, 16);

      // Content-addressed key keeps regenerated files deduplicated and prevents
      // guessable URLs (any change in input bytes changes the key).
      const r2Key = `payment-exports/${ctx.organizationId}/${input.paymentRunId}/BACS-${sanitizeSegment(runNumber)}-${sha256Prefix}.txt`;

      // biome-ignore lint/suspicious/noExplicitAny: tenant client typing varies
      const dbAny = ctx.db as any;
      const org = await dbAny.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });
      const orgNameSegment = sanitizeSegment(org?.name ?? 'org');
      const filename = `${orgNameSegment}-BACS-${sanitizeSegment(runNumber)}-${isoDateStamp(generatedAt)}.txt`;

      const { signedUrl } = await putObjectAndSignDownload({
        key: r2Key,
        body: result.fileBuffer,
        contentType: 'text/plain; charset=us-ascii',
        downloadFilename: filename,
        ttlSeconds: 300,
      });

      // Record Document + PaymentExport in a transaction so the audit trail is
      // consistent even if the export row write fails.
      await ctx.db.$transaction(async (tx: unknown) => {
        // biome-ignore lint/suspicious/noExplicitAny: tx typing varies
        const txAny = tx as any;
        const document = await txAny.document.create({
          data: {
            organizationId: ctx.organizationId,
            storageKey: r2Key,
            originalFileName: filename,
            mimeType: 'text/plain; charset=us-ascii',
            fileSizeBytes: BigInt(result.fileBuffer.length),
            checksumSha256: sha256Hex,
            documentType: 'PAYMENT_EXPORT',
            source: 'GENERATED',
            uploadedByUserId: ctx.user?.id ?? null,
            virusScanStatus: 'CLEAN',
          },
          select: { id: true },
        });

        await txAny.paymentExport.create({
          data: {
            organizationId: ctx.organizationId,
            paymentRunId: input.paymentRunId,
            documentId: document.id,
            format: 'BACS_STD18',
            status: 'GENERATED',
            generatedByUserId: ctx.user?.id ?? '',
          },
        });
      });

      log.info(
        {
          organizationId: ctx.organizationId,
          paymentRunId: input.paymentRunId,
          itemCount: bacsItems.length,
          sha256Prefix,
        },
        'bacs.generateExport: file generated',
      );

      return plain({
        downloadUrl: signedUrl,
        filename,
        sha256: sha256Hex,
      });
    }),

  /**
   * Validate a UK sort code + account number combination against the VocaLink
   * modulus-check table v8.40 (D-01). Advisory only — exception ranges produce
   * a `WARN` status, not a hard block. Format-level failures (regex) are
   * already filtered by the Zod schemas before this handler runs.
   */
  validateSortCode: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(
      z.object({
        sortCode: sortCodeSchema,
        accountNumber: accountNumberSchema,
      }),
    )
    .query(async ({ input }) => {
      const result = modulusCheck(input.sortCode, input.accountNumber, VOCALINK_MODULUS_TABLE_V840);

      // Determine the user-facing status. INVALID is reserved for regex-level
      // failures, which Zod has already rejected — so the only outcomes here
      // are VALID (passed) or WARN (failed / known-exception sort codes).
      let status: 'VALID' | 'WARN' | 'INVALID';
      if (result.valid && result.warnings.length === 0) {
        status = 'VALID';
      } else {
        status = 'WARN';
      }

      return plain({ status, warnings: result.warnings });
    }),

  /**
   * Save the org's BACS submitter configuration (admin-only per D-02).
   *
   * Encrypts each sensitive field via `encryptBankAccount` (AES-256-GCM) and
   * stores a non-reversible mask alongside for safe display in the settings
   * UI (`XXXX34` / `XX-XX-34` / `XXXX5678`). The plaintext submitter name is
   * already short and BACS-safe; it is stored as-is for use in the file's
   * originator-name field.
   *
   * Audit log records WHICH fields were updated, never the values.
   */
  saveSubmitterConfig: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(
      z.object({
        serviceUserNumber: serviceUserNumberSchema,
        submitterSortCode: sortCodeSchema,
        submitterAccountNumber: accountNumberSchema,
        submitterName: bacsSubmitterNameSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sunMasked = maskSun(input.serviceUserNumber);
      const sortCodeMasked = maskSortCode(input.submitterSortCode);
      const accountMasked = maskAccountNumber(input.submitterAccountNumber);

      // biome-ignore lint/suspicious/noExplicitAny: tenant client typing varies
      const dbAny = ctx.db as any;
      await dbAny.organization.update({
        where: { id: ctx.organizationId },
        data: {
          bacsServiceUserNumberEncrypted: encryptBankAccount(input.serviceUserNumber),
          bacsServiceUserNumberMasked: sunMasked,
          bacsSubmitterSortCodeEncrypted: encryptBankAccount(input.submitterSortCode),
          bacsSubmitterSortCodeMasked: sortCodeMasked,
          bacsSubmitterAccountNumberEncrypted: encryptBankAccount(input.submitterAccountNumber),
          bacsSubmitterAccountNumberMasked: accountMasked,
          bacsSubmitterName: input.submitterName,
        },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'BACS_SUBMITTER_CONFIG_UPDATED',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        // Field NAMES only — never the values (encrypted bank fields).
        metadata: {
          fieldsUpdated: [
            'bacsServiceUserNumber',
            'bacsSubmitterSortCode',
            'bacsSubmitterAccountNumber',
            'bacsSubmitterName',
          ],
        },
      });

      log.info(
        { organizationId: ctx.organizationId, userId: ctx.user?.id },
        'bacs.saveSubmitterConfig: submitter config updated',
      );

      return plain({
        saved: true as const,
        masks: {
          sun: sunMasked,
          sortCode: sortCodeMasked,
          accountNumber: accountMasked,
        },
      });
    }),
});

/**
 * Helper exposed for downstream consumers (e.g. `/settings/payments` page) to
 * quickly check whether the BACS section should display the "configure
 * submitter" empty state. Reads only masked fields — never decrypts.
 */
export async function getBacsSubmitterMasks(
  db: unknown,
  organizationId: string,
): Promise<{
  configured: boolean;
  sun: string | null;
  sortCode: string | null;
  accountNumber: string | null;
  submitterName: string | null;
}> {
  // biome-ignore lint/suspicious/noExplicitAny: tenant client typing varies
  const dbAny = db as any;
  const org = await dbAny.organization.findUnique({
    where: { id: organizationId },
    select: {
      bacsServiceUserNumberMasked: true,
      bacsSubmitterSortCodeMasked: true,
      bacsSubmitterAccountNumberMasked: true,
      bacsSubmitterName: true,
    },
  });

  if (!org) {
    return {
      configured: false,
      sun: null,
      sortCode: null,
      accountNumber: null,
      submitterName: null,
    };
  }

  const configured = Boolean(
    org.bacsServiceUserNumberMasked &&
      org.bacsSubmitterSortCodeMasked &&
      org.bacsSubmitterAccountNumberMasked &&
      org.bacsSubmitterName,
  );

  return {
    configured,
    sun: org.bacsServiceUserNumberMasked ?? null,
    sortCode: org.bacsSubmitterSortCodeMasked ?? null,
    accountNumber: org.bacsSubmitterAccountNumberMasked ?? null,
    submitterName: org.bacsSubmitterName ?? null,
  };
}
