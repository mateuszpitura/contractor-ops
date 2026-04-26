import { createHash } from 'node:crypto';

import type { ComplianceStatus } from '@contractor-ops/einvoice';
import {
  computeKsefComplianceStatus,
  generateZugferdPdf,
  listProfiles,
  STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID,
  XRECHNUNG_CUSTOMIZATION_ID,
  XRECHNUNG_PROFILE_ID,
  XRechnungDEProfile,
  ZugferdLevelUnsupportedForOutput,
} from '@contractor-ops/einvoice';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import type { FinalizeResult, R2Service } from '../services/einvoice-finalize.js';
import {
  EInvoiceAlreadyFinalizedError,
  EInvoiceInvoiceNotFoundError,
  finalizeEInvoice,
  mapPrismaInvoiceToEInvoice,
} from '../services/einvoice-finalize.js';
import {
  IllegalFsmTransitionError,
  transitionTransmission,
} from '../services/einvoice-lifecycle-fsm.js';
import { buildStorecoveAdapterForOrg } from '../services/peppol-adapter-factory.js';
import {
  assertReceiverAcceptsXRechnung,
  assertSenderParticipantActive,
  PARTICIPANT_NOT_REACHABLE,
  PEPPOL_PARTICIPANT_NOT_ACTIVE,
} from '../services/peppol-capability.js';
import {
  getObjectAsString,
  putObjectAndSignDownload,
  putObjectString,
  signExistingDownload,
} from '../services/r2.js';

// ---------------------------------------------------------------------------
// Types for the Prisma `$transaction` callback — we project onto the
// minimal delegate surface this router touches so test doubles only need
// to implement the delegates / methods actually called (vs mirroring the
// entire Prisma extension overlay).
// ---------------------------------------------------------------------------

interface LifecycleTx {
  eInvoiceLifecycle: {
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  eInvoiceLifecycleEvent: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

type TxRunner = (fn: (tx: LifecycleTx) => Promise<unknown>) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Logger — lazy dynamic import so ESM-only package resolution survives
// test environments that mock `@contractor-ops/logger`.
// ---------------------------------------------------------------------------

interface RouterLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

const noopLogger: RouterLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

async function getLogger(): Promise<RouterLogger> {
  try {
    const mod = (await import('@contractor-ops/logger')) as {
      createLogger?: (opts: { service: string }) => RouterLogger;
    };
    return mod.createLogger?.({ service: 'api.einvoice-router' }) ?? noopLogger;
  } catch {
    return noopLogger;
  }
}

// ---------------------------------------------------------------------------
// R2Service adapter — wraps the existing module-level helpers into the
// dependency surface the finalize service expects. Keeps the service
// testable (unit tests supply their own R2Service stub).
// ---------------------------------------------------------------------------

const r2Service: R2Service = {
  async putObject(params) {
    const body =
      typeof params.body === 'string' ? params.body : Buffer.from(params.body).toString('utf-8');
    await putObjectString({ key: params.key, body, contentType: params.contentType });
  },
  async signDownloadUrl(key, ttlSeconds) {
    return signExistingDownload(key, ttlSeconds);
  },
};

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

const invoiceIdInput = z.object({ invoiceId: z.string().cuid() });
const lifecycleIdInput = z.object({ lifecycleId: z.string().cuid() });

const listStatuses = [
  'all',
  'notGenerated',
  'valid',
  'warnings',
  'invalid',
  'transmitted',
  'failed',
] as const;

const listByOrgInput = z.object({
  status: z.enum(listStatuses).optional(),
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const finalizeInput = invoiceIdInput.extend({ force: z.boolean().default(false) });

// ---------------------------------------------------------------------------
// Helper: load a lifecycle row scoped to the caller's org. Returns null
// (not throws) so callers can map to NOT_FOUND with a specific message.
// ---------------------------------------------------------------------------

async function loadLifecycleScoped(
  db: { eInvoiceLifecycle: { findFirst: (args: unknown) => Promise<unknown> } },
  organizationId: string,
  lifecycleId: string,
): Promise<Record<string, unknown> | null> {
  return (await (db.eInvoiceLifecycle.findFirst as (args: unknown) => Promise<unknown>)({
    where: { id: lifecycleId, organizationId },
  })) as Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// E-Invoicing Router
// ---------------------------------------------------------------------------

export const einvoiceRouter = router({
  /**
   * Get compliance statuses for all registered e-invoicing profiles.
   * Returns per-profile compliance state (active, degraded, error, etc.)
   * for the current organization.
   */
  complianceStatuses: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const profiles = listProfiles();
      const statuses: ComplianceStatus[] = [];

      for (const profile of profiles) {
        if (profile.profileId === 'ksef') {
          // Fetch KSeF connection data from DB
          const connection = await ctx.db.integrationConnection.findFirst({
            where: {
              organizationId: ctx.organizationId,
              provider: 'KSEF',
            },
            select: {
              status: true,
              configJson: true,
              lastSyncAt: true,
              lastSuccessAt: true,
              lastErrorAt: true,
              lastErrorMessage: true,
              connectedAt: true,
            },
          });

          let recentSyncStatuses: string[] = [];
          if (connection) {
            const recentSyncs = await ctx.db.integrationSyncLog.findMany({
              where: {
                organizationId: ctx.organizationId,
                integrationConnection: {
                  provider: 'KSEF',
                },
              },
              orderBy: { startedAt: 'desc' },
              take: 10,
              select: { status: true },
            });
            recentSyncStatuses = recentSyncs.map(s => s.status);
          }

          statuses.push(
            computeKsefComplianceStatus(
              connection
                ? {
                    ...connection,
                    configJson: (connection.configJson as Record<string, unknown>) ?? {},
                    recentSyncStatuses,
                  }
                : null,
            ),
          );
        } else {
          // Generic: delegate to profile
          statuses.push(await profile.getComplianceStatus(ctx.organizationId));
        }
      }

      return { statuses };
    }),

  // -------------------------------------------------------------------------
  // Phase 62 · Plan 62-05 Task 2 — outbound ZUGFeRD PDF/A-3 generation
  // -------------------------------------------------------------------------

  /**
   * Generate a ZUGFeRD (Factur-X) PDF/A-3 B hybrid invoice from an existing
   * Invoice row. The PDF embeds the same CII XML the XRechnung pipeline
   * produces (single source of truth — no fork).
   *
   * Idempotent: if an existing `EInvoiceLifecycle.zugferdPdfSha256` matches
   * the newly-computed SHA-256, we short-circuit and re-sign the existing
   * key without writing a second `ZUGFERD_GENERATED` event.
   *
   * Writes are transactional: lifecycle upsert + event insert happen inside
   * `db.$transaction` so a partial failure never leaves orphaned rows.
   */
  generateZugferdPdf: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(z.object({ invoiceId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const logger = await getLogger();

      // 1. Load invoice (org-scoped) + its existing lifecycle row.
      const invoice = (await (ctx.db.invoice.findFirst as (args: unknown) => Promise<unknown>)({
        where: {
          id: input.invoiceId,
          organizationId: ctx.organizationId,
        },
        include: {
          lines: { orderBy: { lineNumber: 'asc' } },
          contractor: true,
          contract: true,
          organization: true,
          eInvoiceLifecycle: true,
        },
      })) as
        | (Record<string, unknown> & {
            id: string;
            eInvoiceLifecycle: {
              id: string;
              zugferdPdfKey: string | null;
              zugferdPdfSha256: string | null;
              zugferdGeneratedAt: Date | null;
            } | null;
          })
        | null;

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'EINVOICE_INVOICE_NOT_FOUND',
        });
      }

      // 2. Build the canonical EInvoice envelope (same helper the XRechnung
      //    finalize path uses — single source of CII truth).
      const envelope = mapPrismaInvoiceToEInvoice(
        invoice as unknown as Parameters<typeof mapPrismaInvoiceToEInvoice>[0],
      );

      // 3. Generate the ZUGFeRD PDF bytes.
      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await generateZugferdPdf({ invoice: envelope });
      } catch (err) {
        if (err instanceof ZugferdLevelUnsupportedForOutput) {
          throw new TRPCError({
            code: 'UNPROCESSABLE_CONTENT',
            message: 'ZUGFERD_LEVEL_UNSUPPORTED_FOR_OUTPUT',
          });
        }
        logger.error(
          {
            invoiceId: input.invoiceId,
            organizationId: ctx.organizationId,
            err: err instanceof Error ? err.message : String(err),
          },
          'ZUGFeRD generation failed',
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ZUGFERD_WRAPPING_FAILED',
        });
      }

      // 4. Content-addressed idempotency — if the lifecycle already has a
      //    matching sha, re-sign the existing object and return. Append no
      //    second event.
      const sha = createHash('sha256').update(Buffer.from(pdfBytes)).digest('hex');
      const key = `einvoice-pdf/${ctx.organizationId}/${input.invoiceId}/${sha.slice(0, 16)}.pdf`;

      const existing = invoice.eInvoiceLifecycle;
      if (
        existing?.zugferdPdfSha256 === sha &&
        existing.zugferdPdfKey &&
        existing.zugferdGeneratedAt
      ) {
        const { signedUrl, expiresInSeconds } = await signExistingDownload(
          existing.zugferdPdfKey,
          300,
        );
        return {
          pdfKey: existing.zugferdPdfKey,
          signedUrl,
          expiresInSeconds,
          generatedAt: existing.zugferdGeneratedAt,
          reused: true,
        };
      }

      // 5. Upload to R2 and pre-sign a 300 s download URL.
      const { signedUrl, expiresInSeconds } = await putObjectAndSignDownload({
        key,
        body: Buffer.from(pdfBytes),
        contentType: 'application/pdf',
        ttlSeconds: 300,
      });

      // 6. Upsert lifecycle + append ZUGFERD_GENERATED event atomically.
      const now = new Date();
      await (ctx.db as never as { $transaction: TxRunner }).$transaction(async tx => {
        const txDb = tx as unknown as LifecycleTx & {
          eInvoiceLifecycle: {
            upsert: (args: {
              where: Record<string, unknown>;
              create: Record<string, unknown>;
              update: Record<string, unknown>;
            }) => Promise<{ id: string }>;
          };
        };
        const upserted = await txDb.eInvoiceLifecycle.upsert({
          where: {
            organizationId_invoiceId: {
              organizationId: ctx.organizationId,
              invoiceId: input.invoiceId,
            },
          },
          create: {
            organizationId: ctx.organizationId,
            invoiceId: input.invoiceId,
            profileId: 'zugferd-de',
            zugferdPdfKey: key,
            zugferdPdfSha256: sha,
            zugferdGeneratedAt: now,
          },
          update: {
            zugferdPdfKey: key,
            zugferdPdfSha256: sha,
            zugferdGeneratedAt: now,
          },
        });
        await txDb.eInvoiceLifecycleEvent.create({
          data: {
            organizationId: ctx.organizationId,
            lifecycleId: upserted.id,
            eventType: 'ZUGFERD_GENERATED',
            occurredAt: now,
            actorUserId: ctx.user?.id ?? null,
            detailsJson: { sha256: sha, pdfKey: key, byteLength: pdfBytes.length },
          },
        });
      });

      logger.info(
        {
          invoiceId: input.invoiceId,
          organizationId: ctx.organizationId,
          sha256: sha,
          byteLength: pdfBytes.length,
        },
        'ZUGFeRD PDF generated',
      );

      return {
        pdfKey: key,
        signedUrl,
        expiresInSeconds,
        generatedAt: now,
        reused: false,
      };
    }),

  // -------------------------------------------------------------------------
  // Phase 61 · Plan 61-06 — lifecycle + transmission procedures
  // -------------------------------------------------------------------------

  /**
   * Finalize an invoice: generate XRechnung CII, run KoSIT validation,
   * persist XML to R2, upsert `EInvoiceLifecycle`, and emit GENERATED +
   * VALIDATED events — all transactional.
   *
   * Returns `FinalizeResult` with a 300s signed download URL.
   */
  finalize: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(finalizeInput)
    .mutation(async ({ ctx, input }): Promise<FinalizeResult> => {
      const logger = await getLogger();
      try {
        return await finalizeEInvoice(
          {
            db: ctx.db as never,
            r2: r2Service,
            profile: new XRechnungDEProfile(),
            logger,
          },
          {
            organizationId: ctx.organizationId,
            invoiceId: input.invoiceId,
            actorUserId: ctx.user?.id ?? null,
            force: input.force,
          },
        );
      } catch (err) {
        if (err instanceof EInvoiceInvoiceNotFoundError) {
          throw new TRPCError({ code: 'NOT_FOUND', message: err.code });
        }
        if (err instanceof EInvoiceAlreadyFinalizedError) {
          throw new TRPCError({ code: 'CONFLICT', message: err.code });
        }
        throw err;
      }
    }),

  /**
   * Re-run KoSIT validation against the stored XML without regenerating
   * the CII. Surfaces a `driftDetected: true` flag when the recomputed
   * SHA-256 differs from the stored one (R2 object tampering or stale
   * lifecycle row). Writes a `RE_VALIDATED` event on every invocation.
   */
  revalidate: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(lifecycleIdInput)
    .mutation(async ({ ctx, input }) => {
      const lifecycle = (await loadLifecycleScoped(
        ctx.db as never,
        ctx.organizationId,
        input.lifecycleId,
      )) as {
        id: string;
        xmlKey: string | null;
        xmlSha256: string | null;
      } | null;
      if (!(lifecycle && lifecycle.xmlKey)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'EINVOICE_LIFECYCLE_NOT_FOUND',
        });
      }

      const xml = await getObjectAsString(lifecycle.xmlKey);

      const profile = new XRechnungDEProfile();
      const report = await profile.validateRich(xml);

      const { createHash } = await import('node:crypto');
      const currentHash = createHash('sha256').update(xml).digest('hex');
      const driftDetected = lifecycle.xmlSha256 !== currentHash;

      const now = new Date();
      const nextStatus =
        report.status === 'VALID' ? 'VALID' : report.status === 'WARNINGS' ? 'WARNINGS' : 'INVALID';

      await (ctx.db as never as { $transaction: TxRunner }).$transaction(async tx => {
        const txDb = tx;
        await txDb.eInvoiceLifecycle.update({
          where: { id: lifecycle.id },
          data: {
            validationStatus: nextStatus,
            validatedAt: now,
            validationReportSummary: {
              status: report.status,
              ruleSetVersion: report.ruleSetVersion,
              driftDetected,
              perLayer: report.layers.map(l => ({
                layer: l.layer,
                status: l.status,
                errorCount: l.errors.length,
                warningCount: l.warnings.length,
              })),
            },
          },
        });
        await txDb.eInvoiceLifecycleEvent.create({
          data: {
            organizationId: ctx.organizationId,
            lifecycleId: lifecycle.id,
            eventType: 'RE_VALIDATED',
            occurredAt: now,
            actorUserId: ctx.user?.id ?? null,
            detailsJson: {
              driftDetected,
              priorSha256: lifecycle.xmlSha256,
              currentSha256: currentHash,
              reportStatus: report.status,
            },
          },
        });
      });

      return {
        lifecycleId: lifecycle.id,
        validationStatus: nextStatus,
        report,
        driftDetected,
      };
    }),

  /**
   * Signed 300s R2 URL for the canonical XRechnung CII XML.
   */
  downloadXml: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(lifecycleIdInput)
    .query(async ({ ctx, input }) => {
      const lifecycle = (await loadLifecycleScoped(
        ctx.db as never,
        ctx.organizationId,
        input.lifecycleId,
      )) as { id: string; xmlKey: string | null } | null;
      if (!(lifecycle && lifecycle.xmlKey)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'EINVOICE_XML_NOT_FOUND',
        });
      }
      const { signedUrl, expiresInSeconds } = await signExistingDownload(lifecycle.xmlKey, 300);
      return { url: signedUrl, expiresInSeconds };
    }),

  /**
   * Signed 300s R2 URL for the full KoSIT HTML validation report (D-14).
   * NOT_FOUND when `validationReportFullKey` is null — Plan 07 UI surfaces
   * "Report not available. Finalize the invoice to generate one.".
   */
  downloadReport: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(lifecycleIdInput)
    .query(async ({ ctx, input }) => {
      const lifecycle = (await loadLifecycleScoped(
        ctx.db as never,
        ctx.organizationId,
        input.lifecycleId,
      )) as { id: string; validationReportFullKey: string | null } | null;
      if (!lifecycle?.validationReportFullKey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'EINVOICE_REPORT_NOT_FOUND',
        });
      }
      const { signedUrl, expiresInSeconds } = await signExistingDownload(
        lifecycle.validationReportFullKey,
        300,
      );
      return { url: signedUrl, expiresInSeconds };
    }),

  /**
   * Transmit a finalized invoice via Storecove Peppol. Pre-flight:
   *   1. lifecycle status must be VALID or WARNINGS.
   *   2. sender PeppolParticipant must be ACTIVE.
   *   3. contractor must have peppolSchemeId + peppolParticipantValue.
   *   4. receiver must advertise the XRechnung-CII doc type on the Peppol SML.
   *
   * Flow: FSM-transition lifecycle to QUEUED, fetch XML from R2, call
   * Storecove, FSM-transition to SENT (or FAILED), emit TRANSMITTED (or
   * DELIVERY_FAILED) event — all mutations inside Prisma $transaction.
   */
  send: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(invoiceIdInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Load lifecycle + contractor scoped by org.
      const invoice = (await (ctx.db.invoice.findFirst as (args: unknown) => Promise<unknown>)({
        where: { id: input.invoiceId, organizationId: ctx.organizationId },
        include: { eInvoiceLifecycle: true, contractor: true },
      })) as {
        id: string;
        contractor: {
          peppolSchemeId: string | null;
          peppolParticipantValue: string | null;
        } | null;
        eInvoiceLifecycle: {
          id: string;
          xmlKey: string | null;
          validationStatus: 'NOT_VALIDATED' | 'VALID' | 'WARNINGS' | 'INVALID';
          transmissionStatus: 'NOT_SENT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
        } | null;
      } | null;

      if (!(invoice && invoice.eInvoiceLifecycle && invoice.eInvoiceLifecycle.xmlKey)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'EINVOICE_LIFECYCLE_NOT_FOUND',
        });
      }
      const lifecycle = invoice.eInvoiceLifecycle;

      // 2. Only VALID / WARNINGS may be sent.
      if (lifecycle.validationStatus !== 'VALID' && lifecycle.validationStatus !== 'WARNINGS') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'KOSIT_VALIDATION_FAILED',
        });
      }

      // 3. Sender must be ACTIVE — throws PEPPOL_PARTICIPANT_NOT_ACTIVE
      //    (mapped to PRECONDITION_FAILED) BEFORE any HTTP call.
      try {
        await assertSenderParticipantActive(ctx.db as never, ctx.organizationId);
      } catch (err) {
        if (err instanceof Error && err.message === PEPPOL_PARTICIPANT_NOT_ACTIVE) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: PEPPOL_PARTICIPANT_NOT_ACTIVE,
          });
        }
        throw err;
      }

      // 4. Contractor must carry a Peppol identifier pair.
      const schemeId = invoice.contractor?.peppolSchemeId ?? null;
      const value = invoice.contractor?.peppolParticipantValue ?? null;
      if (!(schemeId && value)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: PARTICIPANT_NOT_REACHABLE,
        });
      }

      // 5. Adapter factory — tests mock this module.
      const adapter = await buildStorecoveAdapterForOrg(ctx.db as never, ctx.organizationId);
      if (!adapter) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'PEPPOL_NOT_CONNECTED',
        });
      }

      // 6. Receiver capability check — throws PARTICIPANT_NOT_REACHABLE on
      //    missing doc-type. Uses the 6h cache (Plan 05).
      try {
        await assertReceiverAcceptsXRechnung(
          ctx.db as never,
          adapter,
          ctx.organizationId,
          schemeId,
          value,
        );
      } catch (err) {
        if (err instanceof Error && err.message === PARTICIPANT_NOT_REACHABLE) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: PARTICIPANT_NOT_REACHABLE,
          });
        }
        throw err;
      }

      // 7. FSM gate — transition NOT_SENT → QUEUED (or FAILED → QUEUED).
      //    Throws IllegalFsmTransitionError if lifecycle is mid-send.
      let queuedStatus: 'QUEUED';
      try {
        queuedStatus = transitionTransmission(
          lifecycle.transmissionStatus,
          lifecycle.transmissionStatus === 'FAILED' ? 'retry' : 'queue',
        ) as 'QUEUED';
      } catch (err) {
        if (err instanceof IllegalFsmTransitionError) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'EINVOICE_TRANSMISSION_IN_PROGRESS',
          });
        }
        throw err;
      }

      await (ctx.db as never as { $transaction: TxRunner }).$transaction(async tx => {
        await tx.eInvoiceLifecycle.update({
          where: { id: lifecycle.id },
          data: { transmissionStatus: queuedStatus },
        });
      });

      // 8. Rehydrate XML + call Storecove. `xmlKey` was null-checked on the
      // NOT_FOUND branch above; assert non-null to satisfy the narrowing
      // that TS cannot carry across the transaction callback.
      const xml = await getObjectAsString(lifecycle.xmlKey as string);

      // Load the org's active participant for the sender identifier that
      // Storecove echoes back with the transmission.
      const senderParticipant = (await (
        ctx.db.peppolParticipant.findFirst as (args: unknown) => Promise<unknown>
      )({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
        select: { participantId: true },
      })) as { participantId: string } | null;

      let result: Awaited<ReturnType<typeof adapter.transmitInvoice>>;
      try {
        result = await adapter.transmitInvoice({
          xml,
          senderParticipantId: senderParticipant?.participantId ?? '',
          receiverParticipantId: `${schemeId}:${value}`,
          documentTypeId: STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID,
          format: {
            kind: 'cii-xrechnung',
            customizationId: XRECHNUNG_CUSTOMIZATION_ID,
            profileId: XRECHNUNG_PROFILE_ID,
          },
          organizationId: ctx.organizationId,
        });
      } catch (err) {
        await (ctx.db as never as { $transaction: TxRunner }).$transaction(async tx => {
          await tx.eInvoiceLifecycle.update({
            where: { id: lifecycle.id },
            data: {
              transmissionStatus: 'FAILED',
              lastErrorJson: {
                message: err instanceof Error ? err.message : String(err),
              },
            },
          });
          await tx.eInvoiceLifecycleEvent.create({
            data: {
              organizationId: ctx.organizationId,
              lifecycleId: lifecycle.id,
              eventType: 'DELIVERY_FAILED',
              actorUserId: ctx.user?.id ?? null,
              detailsJson: {
                stage: 'transmit',
                error: err instanceof Error ? err.message : String(err),
              },
            },
          });
        });
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: 'STORECOVE_TRANSMISSION_FAILED',
        });
      }

      if (result.status === 'rejected') {
        await (ctx.db as never as { $transaction: TxRunner }).$transaction(async tx => {
          await tx.eInvoiceLifecycle.update({
            where: { id: lifecycle.id },
            data: {
              transmissionStatus: 'FAILED',
              lastErrorJson: { errors: result.errors ?? [] },
            },
          });
          await tx.eInvoiceLifecycleEvent.create({
            data: {
              organizationId: ctx.organizationId,
              lifecycleId: lifecycle.id,
              eventType: 'DELIVERY_FAILED',
              actorUserId: ctx.user?.id ?? null,
              detailsJson: { stage: 'rejected', errors: result.errors ?? [] },
            },
          });
        });
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: 'STORECOVE_TRANSMISSION_FAILED',
        });
      }

      const now = new Date();
      const sentStatus = transitionTransmission(queuedStatus, 'transmit_success');
      await (ctx.db as never as { $transaction: TxRunner }).$transaction(async tx => {
        await tx.eInvoiceLifecycle.update({
          where: { id: lifecycle.id },
          data: {
            transmissionStatus: sentStatus,
            transmissionId: result.transmissionId,
            transmittedAt: now,
            lastErrorJson: null,
          },
        });
        await tx.eInvoiceLifecycleEvent.create({
          data: {
            organizationId: ctx.organizationId,
            lifecycleId: lifecycle.id,
            eventType: 'TRANSMITTED',
            occurredAt: now,
            actorUserId: ctx.user?.id ?? null,
            detailsJson: {
              transmissionId: result.transmissionId,
              timestamp: result.timestamp,
            },
          },
        });
      });

      return {
        lifecycleId: lifecycle.id,
        transmissionStatus: sentStatus,
        transmissionId: result.transmissionId,
      };
    }),

  /**
   * Filtered + cursor-paginated join of Invoice × EInvoiceLifecycle for
   * the compliance invoice list (UI-SPEC chips).
   */
  listByOrg: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(listByOrgInput)
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { organizationId: ctx.organizationId };

      switch (input.status) {
        case 'notGenerated':
          where.eInvoiceLifecycle = null;
          break;
        case 'valid':
          where.eInvoiceLifecycle = { is: { validationStatus: 'VALID' } };
          break;
        case 'warnings':
          where.eInvoiceLifecycle = { is: { validationStatus: 'WARNINGS' } };
          break;
        case 'invalid':
          where.eInvoiceLifecycle = { is: { validationStatus: 'INVALID' } };
          break;
        case 'transmitted':
          where.eInvoiceLifecycle = {
            is: { transmissionStatus: { in: ['SENT', 'DELIVERED'] } },
          };
          break;
        case 'failed':
          where.eInvoiceLifecycle = { is: { transmissionStatus: 'FAILED' } };
          break;
        case 'all':
        case undefined:
        default:
          // no filter
          break;
      }

      const rows = (await (ctx.db.invoice.findMany as (args: unknown) => Promise<unknown>)({
        where,
        include: { eInvoiceLifecycle: true },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      })) as Array<{ id: string }>;

      let nextCursor: string | undefined;
      if (rows.length > input.limit) {
        const next = rows.pop();
        nextCursor = next?.id;
      }

      return { rows, nextCursor };
    }),

  /**
   * Org-wide compliance counts for the summary tile at the top of the
   * invoices list (UI-SPEC tile).
   */
  summaryForOrg: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .query(async ({ ctx }) => {
      const total = await (ctx.db.invoice.count as (args: unknown) => Promise<number>)({
        where: { organizationId: ctx.organizationId },
      });

      const groups = (await (
        ctx.db.eInvoiceLifecycle.groupBy as (args: unknown) => Promise<unknown>
      )({
        by: ['validationStatus', 'transmissionStatus'],
        where: { organizationId: ctx.organizationId },
        _count: { _all: true },
      })) as Array<{
        validationStatus: 'NOT_VALIDATED' | 'VALID' | 'WARNINGS' | 'INVALID';
        transmissionStatus: 'NOT_SENT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
        _count: { _all: number };
      }>;

      const valid = sumBy(groups, g => g.validationStatus === 'VALID');
      const warnings = sumBy(groups, g => g.validationStatus === 'WARNINGS');
      const invalid = sumBy(groups, g => g.validationStatus === 'INVALID');
      const lifecycleTotal = sumBy(groups, () => true);
      const transmitted = sumBy(
        groups,
        g => g.transmissionStatus === 'SENT' || g.transmissionStatus === 'DELIVERED',
      );
      const failed = sumBy(groups, g => g.transmissionStatus === 'FAILED');
      const notGenerated = Math.max(0, total - lifecycleTotal);

      return { total, notGenerated, valid, warnings, invalid, transmitted, failed };
    }),
});

function sumBy<T extends { _count: { _all: number } }>(
  rows: T[],
  pred: (row: T) => boolean,
): number {
  let total = 0;
  for (const row of rows) if (pred(row)) total += row._count._all;
  return total;
}
