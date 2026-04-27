import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init.js';
import { portalProcedure } from '../../middleware/portal-auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import {
  getSigningUrl,
  resendToRecipient,
  sendForSignature,
  voidEnvelope,
} from '../../services/esign-orchestrator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const signerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(['signer', 'countersigner']),
  routingOrder: z.number().int().positive(),
});

const sendForSignatureInput = z.object({
  contractId: z.string().optional(),
  documentId: z.string(),
  connectionId: z.string(),
  provider: z.enum(['DOCUSIGN', 'AUTENTI']),
  signers: z.array(signerSchema).min(1),
  message: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(90).optional().default(14),
  reminderIntervalDays: z.number().int().min(1).max(30).nullish(),
});

const getSigningUrlInput = z.object({
  envelopeId: z.string(),
  recipientEmail: z.email(),
  returnUrl: z.url(),
});

const voidEnvelopeInput = z.object({
  envelopeId: z.string(),
  reason: z.string().min(1).max(500),
});

const resendToRecipientInput = z.object({
  envelopeId: z.string(),
  recipientEmail: z.email(),
});

const getEnvelopeDetailInput = z.object({
  envelopeId: z.string(),
});

const listEnvelopesInput = z.object({
  contractId: z.string(),
});

// ---------------------------------------------------------------------------
// E-Sign Router
// ---------------------------------------------------------------------------

export const esignRouter = router({
  /**
   * List connected e-sign provider connections (DocuSign, Autenti).
   * Returns connection ID, provider, and status for the provider picker UI.
   */
  listConnections: tenantProcedure.query(async ({ ctx }) => {
    const connections = await ctx.db.integrationConnection.findMany({
      where: {
        organizationId: ctx.organizationId,
        provider: { in: ['DOCUSIGN', 'AUTENTI'] },
        status: 'CONNECTED',
      },
      select: {
        id: true,
        provider: true,
        status: true,
        displayName: true,
      },
      orderBy: { provider: 'asc' },
    });

    return connections;
  }),

  /**
   * Send a document for electronic signature.
   * Creates SigningEnvelope + recipients, updates contract status,
   * and creates audit events.
   */
  sendForSignature: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(sendForSignatureInput)
    .mutation(async ({ ctx, input }) => {
      const envelope = await sendForSignature({
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        contractId: input.contractId,
        documentId: input.documentId,
        connectionId: input.connectionId,
        provider: input.provider,
        signers: input.signers,
        message: input.message,
        expiresInDays: input.expiresInDays,
        reminderIntervalDays: input.reminderIntervalDays ?? undefined,
      });

      return envelope;
    }),

  /**
   * Get an embedded signing URL for a recipient.
   * Generated on-demand — never cache (DocuSign URLs expire in 5 min).
   */
  getSigningUrl: tenantProcedure.input(getSigningUrlInput).query(async ({ ctx, input }) => {
    const result = await getSigningUrl({
      organizationId: ctx.organizationId,
      envelopeId: input.envelopeId,
      recipientEmail: input.recipientEmail,
      returnUrl: input.returnUrl,
    });

    return result;
  }),

  /**
   * Get an embedded signing URL for a portal contractor.
   * Verifies the contractor is a recipient of the envelope before
   * delegating to the shared getSigningUrl orchestrator.
   */
  getPortalSigningUrl: portalProcedure.input(getSigningUrlInput).query(async ({ ctx, input }) => {
    const envelope = await ctx.db.signingEnvelope.findFirst({
      where: {
        id: input.envelopeId,
        organizationId: ctx.organizationId,
      },
      include: {
        recipients: { select: { email: true } },
      },
    });

    if (!envelope) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Envelope not found' });
    }

    const contractorEmail = ctx.contractor?.email?.toLowerCase();
    if (!contractorEmail) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a recipient of this envelope' });
    }

    const isRecipient = envelope.recipients.some(r => r.email.toLowerCase() === contractorEmail);

    if (!isRecipient) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a recipient of this envelope' });
    }

    return getSigningUrl({
      organizationId: ctx.organizationId,
      envelopeId: input.envelopeId,
      recipientEmail: input.recipientEmail,
      returnUrl: input.returnUrl,
    });
  }),

  /**
   * Void (cancel) a signing envelope.
   * Reverts contract to DRAFT if it was PENDING_SIGNATURE.
   */
  voidEnvelope: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(voidEnvelopeInput)
    .mutation(async ({ ctx, input }) => {
      await voidEnvelope({
        organizationId: ctx.organizationId,
        envelopeId: input.envelopeId,
        userId: ctx.user.id,
        reason: input.reason,
      });

      return { success: true };
    }),

  /**
   * Resend signing notification to a specific recipient.
   */
  resendToRecipient: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(resendToRecipientInput)
    .mutation(async ({ ctx, input }) => {
      await resendToRecipient({
        organizationId: ctx.organizationId,
        envelopeId: input.envelopeId,
        recipientEmail: input.recipientEmail,
      });

      return { success: true };
    }),

  /**
   * Get detailed information about a signing envelope.
   * Includes recipients and events (ordered by occurredAt desc).
   */
  getEnvelopeDetail: tenantProcedure.input(getEnvelopeDetailInput).query(async ({ ctx, input }) => {
    const envelope = await ctx.db.signingEnvelope.findFirst({
      where: {
        id: input.envelopeId,
        organizationId: ctx.organizationId,
      },
      include: {
        recipients: {
          orderBy: { routingOrder: 'asc' },
        },
        events: {
          orderBy: { occurredAt: 'desc' },
        },
        sentBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!envelope) {
      return null;
    }

    return envelope;
  }),

  /**
   * List all signing envelopes for a contract.
   * Ordered by createdAt desc with recipient summary.
   */
  listEnvelopes: tenantProcedure.input(listEnvelopesInput).query(async ({ ctx, input }) => {
    const envelopes = await ctx.db.signingEnvelope.findMany({
      where: {
        contractId: input.contractId,
        organizationId: ctx.organizationId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        recipients: {
          select: { id: true, name: true, email: true, status: true },
        },
        sentBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Add recipient summary (signed/total count)
    const items = envelopes.map(env => {
      const signedCount = env.recipients.filter(r => r.status === 'SIGNED').length;
      return {
        ...env,
        recipientSummary: {
          signed: signedCount,
          total: env.recipients.length,
        },
      };
    });

    return items;
  }),

  /**
   * List pending signing envelopes for the current contractor (portal).
   * Returns envelopes where a recipient matches the contractor's email
   * and the envelope is in a non-terminal state.
   */
  listPendingForContractor: portalProcedure.query(async ({ ctx }) => {
    const contractor = ctx.contractor;

    if (!contractor?.email) {
      return [];
    }

    // Find envelopes where this contractor's email is a recipient
    const recipients = await ctx.db.signingRecipient.findMany({
      where: {
        email: contractor.email,
        status: { in: ['PENDING', 'SENT', 'DELIVERED'] },
        signingEnvelope: {
          organizationId: ctx.organizationId,
          status: { in: ['SENT', 'DELIVERED'] },
        },
      },
      include: {
        signingEnvelope: {
          select: {
            id: true,
            contractId: true,
            status: true,
            message: true,
            expiresAt: true,
            sentAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        signingEnvelope: { createdAt: 'desc' },
      },
    });

    const items = recipients.map(r => ({
      envelopeId: r.signingEnvelope.id,
      contractId: r.signingEnvelope.contractId,
      recipientId: r.id,
      recipientName: r.name,
      recipientEmail: r.email,
      recipientStatus: r.status,
      envelopeStatus: r.signingEnvelope.status,
      message: r.signingEnvelope.message,
      expiresAt: r.signingEnvelope.expiresAt,
      sentAt: r.signingEnvelope.sentAt,
    }));

    return items;
  }),
});
