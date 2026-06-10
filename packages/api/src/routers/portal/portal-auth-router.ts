import { prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { portalProcedure, portalPublicProcedure } from '../../middleware/portal-auth';
import {
  createMagicLinkToken,
  findContractorsByEmail,
  sendPortalMagicLink,
  verifyMagicLinkToken,
} from '../../services/portal-magic-link';
import { createPortalSession, deletePortalSession } from '../../services/portal-session';
import {
  deriveBaseUrl,
  extractPortalToken,
  signPortalSessionToken,
  withOrgRegionalDb,
} from './portal-shared';

export const portalAuthRouter = router({
  // =========================================================================
  // AUTH ENDPOINTS (public -- no session required)
  // =========================================================================

  /**
   * Request a magic link email for portal login.
   * ALWAYS returns { success: true } regardless of whether the email
   * matches a contractor -- prevents email enumeration.
   */
  requestMagicLink: portalPublicProcedure
    .input(z.object({ email: z.email() }))
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase().trim();
      const contractors = await findContractorsByEmail(email);

      if (contractors.length > 0) {
        const { token } = await createMagicLinkToken(email);
        // Use trusted env URL only — never from `ctx.headers`.
        const baseUrl = deriveBaseUrl();
        await sendPortalMagicLink({ email, token, baseUrl });
      }

      return { success: true as const };
    }),

  /**
   * Verify a magic link token and either create a session (single org)
   * or return org picker data (multi-org).
   */
  verifyMagicLink: portalPublicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await verifyMagicLinkToken(input.token);

      if (!result) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.PORTAL_INVALID_LINK,
        });
      }

      const contractors = await findContractorsByEmail(result.email);

      if (contractors.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Single org -- auto-create session
      if (contractors.length === 1) {
        const c = contractors[0];
        if (!c) throw new TRPCError({ code: 'NOT_FOUND' });
        const ipAddress = ctx.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
        const userAgent = ctx.headers.get('user-agent') ?? undefined;

        const session = await createPortalSession({
          contractorId: c.id,
          organizationId: c.organizationId,
          email: result.email,
          ipAddress,
          userAgent,
        });

        // Bind a server-issued HMAC to the (token, expiresAt) pair
        // so `/portal/set-session` can verify the cookie value really came
        // from this mutation (CSRF / session-fixation defence).
        const signature = signPortalSessionToken(session.rawToken, session.expiresAt);

        return {
          session: {
            rawToken: session.rawToken,
            expiresAt: session.expiresAt,
            signature,
          },
          orgs: null,
          needsOrgPicker: false as const,
        };
      }

      // Multi-org -- create a short-lived verification nonce so selectOrg
      // can prove the email was actually verified (prevents IDOR).
      const { token: verificationNonce } = await createMagicLinkToken(result.email);

      return {
        session: null,
        orgs: contractors.map(c => ({
          contractorId: c.id,
          organizationId: c.organizationId,
          orgName: c.organization.name,
          orgLogo: c.organization.logo,
        })),
        needsOrgPicker: true as const,
        email: result.email,
        verificationNonce,
      };
    }),

  /**
   * Select an organization for multi-org contractors after verification.
   */
  selectOrg: portalPublicProcedure
    .input(
      z.object({
        verificationNonce: z.string().min(1, 'Verification token required'),
        contractorId: z.string(),
        organizationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the nonce to prove email was verified via magic link.
      // This prevents IDOR — the client can't just guess email + IDs.
      const verification = await verifyMagicLinkToken(input.verificationNonce);

      if (!verification) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: E.PORTAL_INVALID_VERIFICATION,
        });
      }

      const email = verification.email.toLowerCase().trim();

      // Verify contractor exists and matches the verified email (regional DB)
      const contractor = await withOrgRegionalDb(input.organizationId, db =>
        db.contractor.findFirst({
          where: {
            id: input.contractorId,
            organizationId: input.organizationId,
            email,
            status: 'ACTIVE',
            deletedAt: null,
          },
        }),
      );

      if (!contractor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      const ipAddress = ctx.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
      const userAgent = ctx.headers.get('user-agent') ?? undefined;

      const session = await createPortalSession({
        contractorId: input.contractorId,
        organizationId: input.organizationId,
        email,
        ipAddress,
        userAgent,
      });

      // Same HMAC-session defence as verifyMagicLink applies to selectOrg.
      const signature = signPortalSessionToken(session.rawToken, session.expiresAt);

      return { rawToken: session.rawToken, expiresAt: session.expiresAt, signature };
    }),

  /**
   * Logout -- delete the current portal session.
   */
  logout: portalProcedure.mutation(async ({ ctx }) => {
    const rawToken = extractPortalToken(ctx.headers);
    if (rawToken) {
      await deletePortalSession(rawToken);
    }
    return { success: true as const };
  }),

  /**
   * List every organization the authenticated contractor belongs to (same
   * email, status ACTIVE, not soft-deleted). Drives the in-session org
   * switcher in the profile dropdown.
   *
   * Reuses `findContractorsByEmail` so the membership semantics stay
   * byte-identical to magic-link login (single source of truth for "which
   * orgs is this person in?").
   */
  listMyOrgs: portalProcedure.query(async ({ ctx }) => {
    const contractors = await findContractorsByEmail(ctx.portalSession.email);
    return contractors.map(c => ({
      contractorId: c.id,
      organizationId: c.organizationId,
      orgName: c.organization.name,
      orgLogo: c.organization.logo,
      isCurrent: c.id === ctx.contractorId && c.organizationId === ctx.organizationId,
    }));
  }),

  /**
   * Issue a new portal session for a different (contractorId, organizationId)
   * pair belonging to the same authenticated email. Returns the same
   * `{rawToken, expiresAt, signature}` envelope as `selectOrg` so the client
   * can hand it to `/portal/set-session`.
   *
   * Security:
   * - Validates ownership against the target org's regional DB (cross-region
   *   contractors are routed via `withOrgRegionalDb`).
   * - Email comes from the trusted server-side portal session, NEVER from
   *   client input — prevents cross-account session minting.
   * - Old session is deleted before the new one is signed so two valid
   *   `portal_session` cookies never coexist for the same user.
   */
  switchOrg: portalProcedure
    .input(
      z.object({
        contractorId: z.string().min(1),
        organizationId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = ctx.portalSession.email.toLowerCase().trim();

      // No-op when the target matches the active session.
      if (input.contractorId === ctx.contractorId && input.organizationId === ctx.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.PORTAL_ALREADY_ACTIVE_ORG,
        });
      }

      // Verify the (contractorId, organizationId, email) triple is real in
      // the target org's regional DB. The active session's region may differ
      // from the target org's region — never trust the active ctx.db here.
      const contractor = await withOrgRegionalDb(input.organizationId, db =>
        db.contractor.findFirst({
          where: {
            id: input.contractorId,
            organizationId: input.organizationId,
            email,
            status: 'ACTIVE',
            deletedAt: null,
          },
          select: { id: true },
        }),
      );

      if (!contractor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      // Tear down the active session first — don't let two valid portal
      // cookies exist for the same user across the switch.
      const oldToken = extractPortalToken(ctx.headers);
      if (oldToken) {
        await deletePortalSession(oldToken);
      }

      const ipAddress = ctx.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
      const userAgent = ctx.headers.get('user-agent') ?? undefined;

      const session = await createPortalSession({
        contractorId: input.contractorId,
        organizationId: input.organizationId,
        email,
        ipAddress,
        userAgent,
      });

      const signature = signPortalSessionToken(session.rawToken, session.expiresAt);

      return { rawToken: session.rawToken, expiresAt: session.expiresAt, signature };
    }),

  /**
   * Get current session info for portal layout (contractor + org info).
   */
  getSession: portalProcedure.query(async ({ ctx }) => {
    // Routing table (`Organization`) lives on primary — not regional `ctx.db`
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, name: true, logo: true, metadata: true },
    });

    const metadata = org?.metadata ? (JSON.parse(org.metadata) as Record<string, unknown>) : {};

    return {
      contractor: {
        id: ctx.contractor.id,
        displayName: ctx.contractor.displayName,
        email: ctx.portalSession.email,
      },
      organization: {
        id: ctx.organizationId,
        name: org?.name ?? '',
        logo: org?.logo ?? null,
        dateFormat: (metadata.dateFormat as string) ?? null,
        timeFormat: (metadata.timeFormat as string) ?? null,
        timezone: (metadata.timezone as string) ?? null,
      },
    };
  }),
});
