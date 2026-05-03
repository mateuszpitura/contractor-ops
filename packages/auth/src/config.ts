import { createHash } from 'node:crypto';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins/admin';
import { magicLink } from 'better-auth/plugins/magic-link';
import { organization } from 'better-auth/plugins/organization';
import {
  sendMagicLinkEmail,
  sendInvitationEmail as sendOrgInvitationEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from './auth-emails.js';
import { authEnv } from './env.js';
import { ac } from './permissions.js';
import { roles } from './roles.js';

/** Maximum failed login attempts before account is locked */
const MAX_LOGIN_ATTEMPTS = 5;
/** Lockout duration in minutes */
const LOCKOUT_DURATION_MIN = 15;
/** Generic message returned for both invalid-credentials and locked accounts to avoid email enumeration. */
const GENERIC_AUTH_FAILURE_MESSAGE = 'Invalid email or password.';

const log = createLogger({ service: 'auth' });

/**
 * Hash an email for structured log fields. We log a stable identifier (so
 * operators can correlate brute-force attempts on a single account) without
 * exposing the raw PII.
 */
function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 16);
}

/**
 * Compose the social-providers map. We register Google/Microsoft only when a
 * full credential pair is present — partial config throws at module load via
 * `loadAuthEnv()`. This eliminates the prior `as string` cast that silently
 * registered OAuth endpoints with `undefined` credentials.
 */
const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
if (authEnv.google) socialProviders.google = authEnv.google;
if (authEnv.microsoft) socialProviders.microsoft = authEnv.microsoft;

/**
 * Trusted providers for automatic account linking.
 *
 * SECURITY NOTE: We deliberately exclude `microsoft` here. Microsoft consumer
 * tenants (outlook.com / personal accounts) historically allow self-asserted
 * email addresses on some flows — auto-linking on a Microsoft-supplied email
 * is an account-takeover vector. Google enforces verified email by default.
 *
 * If/when Entra is hard-restricted to a managed tenant, `microsoft` may be
 * re-added with explicit `email_verified` enforcement.
 */
const TRUSTED_OAUTH_PROVIDERS = ['google'] as const;

export const auth = betterAuth({
  ...(authEnv.betterAuthSecret ? { secret: authEnv.betterAuthSecret } : {}),
  ...(authEnv.baseURL ? { baseURL: authEnv.baseURL } : {}),
  ...(authEnv.trustedOrigins.length > 0 ? { trustedOrigins: authEnv.trustedOrigins } : {}),

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    /**
     * Better Auth invokes this when a user requests a password reset
     * (`/forget-password`). The handler is mandatory in production — without
     * it the entire reset flow silently no-ops (F-SEC-13). We throw on send
     * failure so Better Auth surfaces the error to the caller.
     */
    sendResetPassword: async ({ user, url }) => {
      log.info(
        { event: 'auth.reset_password.send', emailHash: hashEmail(user.email) },
        'dispatching password-reset email',
      );
      await sendResetPasswordEmail({
        to: user.email,
        recipientName: user.name ?? null,
        url,
      });
    },
  },

  emailVerification: {
    /**
     * Sent on sign-up and on every sign-in attempt for unverified accounts
     * (because `requireEmailVerification: true`). Without this handler newly
     * registered users cannot verify and are locked out forever (F-SEC-13).
     */
    sendVerificationEmail: async ({ user, url }) => {
      log.info(
        { event: 'auth.verify_email.send', emailHash: hashEmail(user.email) },
        'dispatching email-verification email',
      );
      await sendVerificationEmail({
        to: user.email,
        recipientName: user.name ?? null,
        url,
      });
    },
    sendOnSignUp: true,
  },

  socialProviders,

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: [...TRUSTED_OAUTH_PROVIDERS],
    },
  },

  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: authEnv.isProduction,
      path: '/',
    },
  },

  session: {
    expiresIn: 60 * 60 * 24, // 24 hours
    updateAge: 60 * 60, // Refresh session every hour on activity
  },

  hooks: {
    before: createAuthMiddleware(async ctx => {
      // Account lockout: block sign-in if user is locked.
      //
      // To avoid leaking account existence (email enumeration), the message and
      // status returned here are identical to a normal "invalid credentials"
      // failure. Operators should rely on structured logs (below) for forensics.
      if (ctx.path === '/sign-in/email' && ctx.body?.email) {
        const email = ctx.body.email as string;
        const user = await prisma.user.findUnique({
          where: { email },
          select: { lockedUntil: true },
        });

        if (user?.lockedUntil && user.lockedUntil > new Date()) {
          const lockUntilMs = user.lockedUntil.getTime();
          log.warn(
            {
              event: 'auth.signin.locked',
              emailHash: hashEmail(email),
              lockUntilMs,
            },
            'sign-in blocked: account locked',
          );
          // Use UNAUTHORIZED + generic message — same shape as Better Auth's
          // own invalid-credentials response.
          throw new APIError('UNAUTHORIZED', {
            message: GENERIC_AUTH_FAILURE_MESSAGE,
          });
        }
      }
    }),
    after: createAuthMiddleware(async ctx => {
      // Track failed/successful sign-in attempts.
      if (ctx.path === '/sign-in/email' && ctx.body?.email) {
        const email = ctx.body.email as string;
        const emailHash = hashEmail(email);

        if (ctx.context.newSession) {
          // Successful login: reset failed attempts.
          await prisma.user.updateMany({
            where: { email },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
          log.info({ event: 'auth.signin.success', emailHash }, 'sign-in success');
        } else {
          // Failed login: atomically increment AND set `lockedUntil` in a single
          // SQL statement. This closes the prior TOCTOU window between increment
          // and read (two concurrent failed sign-ins could both observe a
          // pre-lock count and skip the lock).
          //
          // The expression sets lockedUntil only when the post-increment count
          // crosses the threshold; otherwise it leaves the existing value alone
          // (so a stale lock window from a previous run is not extended).
          const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MIN * 60_000);
          const rows = await prisma.$queryRaw<
            Array<{ failedLoginAttempts: number; lockedUntil: Date | null }>
          >`
            UPDATE "User"
            SET
              "failedLoginAttempts" = "failedLoginAttempts" + 1,
              "lockedUntil" = CASE
                WHEN "failedLoginAttempts" + 1 >= ${MAX_LOGIN_ATTEMPTS}
                THEN ${lockUntil}
                ELSE "lockedUntil"
              END
            WHERE "email" = ${email}
            RETURNING "failedLoginAttempts", "lockedUntil"
          `;

          if (rows.length === 0) {
            // No row updated — email does not exist. We deliberately do NOT
            // reveal this; emit a debug log for ops only.
            log.debug(
              { event: 'auth.signin.unknown_email', emailHash },
              'sign-in for unknown email',
            );
          } else {
            const { failedLoginAttempts, lockedUntil } = rows[0]!;
            const justLocked =
              failedLoginAttempts >= MAX_LOGIN_ATTEMPTS &&
              lockedUntil !== null &&
              lockedUntil.getTime() > Date.now();
            log.warn(
              {
                event: justLocked ? 'auth.signin.locked_now' : 'auth.signin.failed',
                emailHash,
                attempts: failedLoginAttempts,
                lockUntilMs: lockedUntil ? lockedUntil.getTime() : null,
              },
              justLocked ? 'sign-in failed: account locked' : 'sign-in failed',
            );
          }
        }
      }
    }),
  },

  plugins: [
    organization({
      ac,
      allowCreatorAllPermissions: true,
      roles: {
        owner: roles.owner,
        admin: roles.admin,
        finance_admin: roles.finance_admin,
        ops_manager: roles.ops_manager,
        team_manager: roles.team_manager,
        legal_compliance_viewer: roles.legal_compliance_viewer,
        it_admin: roles.it_admin,
        external_accountant: roles.external_accountant,
        readonly: roles.readonly,
        platform_operator: roles.platform_operator,
      },
      async sendInvitationEmail(data) {
        // Better Auth's organization plugin does not synthesise an acceptance
        // URL — it provides the invitation id and expects the host application
        // to construct the link. We use the canonical app base URL (never a
        // request-supplied origin) to prevent host-header injection (cf.
        // F-SEC-08).
        const base = (authEnv.baseURL ?? 'http://localhost:3000').replace(/\/$/, '');
        const acceptUrl = `${base}/accept-invitation/${data.id}`;

        log.info(
          {
            event: 'auth.invitation.send',
            emailHash: hashEmail(data.email),
            invitationId: data.id,
            organizationId: data.organization.id,
          },
          'dispatching organization invitation email',
        );

        await sendOrgInvitationEmail({
          to: data.email,
          organizationName: data.organization.name,
          inviterName: data.inviter.user.name ?? null,
          inviterEmail: data.inviter.user.email ?? null,
          url: acceptUrl,
        });
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url, token: _token }) => {
        log.info(
          { event: 'auth.magic_link.send', emailHash: hashEmail(email) },
          'dispatching magic-link email',
        );
        await sendMagicLinkEmail({ to: email, url });
      },
    }),
    admin(),
    nextCookies(), // Must be last plugin
  ],
});

/** Session type inferred from the auth configuration */
export type Session = typeof auth.$Infer.Session;

/**
 * Better Auth `api` surface with plugins (organization, admin, …). Prefer over `auth.api`
 * where you want an explicit type.
 */
export type AuthServerAPI = typeof auth.api;

export const authApi: AuthServerAPI = auth.api;
