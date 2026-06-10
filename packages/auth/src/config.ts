import { createHash } from 'node:crypto';
import type { DataRegion } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins/admin';
import { magicLink } from 'better-auth/plugins/magic-link';
import { organization } from 'better-auth/plugins/organization';
import { z } from 'zod';
import {
  sendMagicLinkEmail,
  sendInvitationEmail as sendOrgInvitationEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from './auth-emails.js';
import { authEnv } from './env.js';
import { ac } from './permissions.js';
import { roles } from './roles.js';
import { verifyTurnstileToken } from './turnstile.js';

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

// ---------------------------------------------------------------------------
// Creation-time data-region assignment
// ---------------------------------------------------------------------------
//
// `organization.dataRegion` is set ONCE, at creation, from the billing-country
// selection the SPA passes into `authClient.organization.create`, and is
// IMMUTABLE afterward — there is NO update/afterCreate path that mutates it
// (see `organizationHooks.beforeCreateOrganization` below; no
// `beforeUpdateOrganization` sets it). US data residency is opt-in: only a US
// billing country routes to the `us-east-1` region; everything else (incl. an
// absent billing country) defaults to EU, preserving the schema `@default(EU)`
// intent. The `us-cross-border` add-on unlocks US tax features WITHOUT moving
// residency — it never touches `dataRegion`.

/** Zod schema validating the optional billing-country create input at the
 * Better Auth boundary. ISO 3166-1 alpha-2; case-insensitive, normalised to
 * upper-case. */
const billingCountrySchema = z
  .string()
  .trim()
  .length(2)
  .transform(c => c.toUpperCase())
  .optional();

/**
 * Maps a billing-country selection (untrusted client input) to the org's
 * persistent data region. Pure + exported so the assignment logic is
 * unit-testable without booting the full Better Auth server; the
 * `beforeCreateOrganization` hook delegates to it.
 *
 * US residency is opt-in and explicit — only `billingCountry: 'US'` resolves
 * to `'US'`. Any other country, an unparseable value, or an absent billing
 * country falls back to `'EU'` (never silently routes to US).
 */
export function resolveDataRegionFromBilling(input: { billingCountry?: string }): DataRegion {
  const parsed = billingCountrySchema.safeParse(input.billingCountry);
  if (parsed.success && parsed.data === 'US') return 'US';
  return 'EU';
}

/**
 * Reject sessions whose active organization membership is soft-disabled.
 * Used by the `databaseHooks.session.{create,update}.before` hooks below.
 *
 * No-ops when the session has no `activeOrganizationId` (Better Auth allows
 * sessions without an active org — the user can pick one later via
 * `setActiveOrganization`, which itself triggers the same check via
 * `session.update.before`).
 *
 * Throws Better Auth's `APIError` with `UNAUTHORIZED` on disabled membership;
 * Better Auth maps this to a 401 response and aborts session creation.
 */
async function assertActiveMembershipNotDisabled(
  activeOrganizationId: string | null | undefined,
  userId: string | undefined,
): Promise<void> {
  if (!(activeOrganizationId && userId)) return;

  const member = await prisma.member.findFirst({
    where: { organizationId: activeOrganizationId, userId },
    select: { id: true, disabledAt: true },
  });

  if (member?.disabledAt) {
    log.warn(
      {
        event: 'auth.session.blocked_disabled_member',
        memberId: member.id,
        organizationId: activeOrganizationId,
        userId,
        disabledAt: member.disabledAt.getTime(),
      },
      'session rejected: active org membership is disabled',
    );
    throw new APIError('UNAUTHORIZED', {
      message: 'MEMBERSHIP_DISABLED',
    });
  }
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

  // ---------------------------------------------------------------------
  // Better Auth built-in per-IP rate limiter
  // ---------------------------------------------------------------------
  //
  // This is the PRIMARY rate-limiting layer for auth endpoints. The
  // Fastify rate-limit plugin (apps/api/src/plugins/rate-limit.ts)
  // intentionally does NOT rate-limit /api/auth/* — Better Auth's granular
  // per-endpoint caps + per-account lockout (5 failed → 15min lock) +
  // Turnstile CAPTCHA are strictly superior to a blanket edge counter that
  // can't distinguish endpoints, success from failure, or session reads
  // from credential attempts.
  //
  // Storage: defaults to in-memory (per-pod). For multi-instance
  // deployments, configure `secondary-storage` (Upstash) so rate-limit
  // state is shared across pods.
  //
  // `enabled` is forced ON in every environment. The Better Auth default
  // is "production-only" which leaves dev/preview unprotected against
  // local credential stuffing testing — we'd rather see the limiter in
  // action everywhere.
  rateLimit: {
    enabled: true,
    // Global default for any route not explicitly listed below — matches
    // Better Auth's own default of 100 req / 10 s window.
    window: 10,
    max: 100,
    customRules: {
      // 10 sign-in attempts per minute per IP. Combined with the per-account
      // lockout (`failedLoginAttempts >= 5` → 15-min lock, see hooks.after
      // below) this gives an attacker at most 5 useful attempts before the
      // account is hard-locked, regardless of IP rotation.
      '/sign-in/email': { window: 60, max: 10 },
      // 5 sign-ups per minute per IP. Even with Turnstile in front, this
      // is a useful belt-and-braces against headless-browser bypasses.
      '/sign-up/email': { window: 60, max: 5 },
      // Password reset enumeration vector — keep it tight. One reset per
      // 12 s window per IP is plenty for legitimate users.
      '/forget-password': { window: 60, max: 5 },
      // Magic link is similarly enumeration-prone (and outbound email is
      // not free).
      '/sign-in/magic-link': { window: 60, max: 5 },
    },
  },

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    /**
     * Better Auth invokes this when a user requests a password reset
     * (`/forget-password`). The handler is mandatory in production — without
     * it the entire reset flow silently no-ops . We throw on send
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
     * registered users cannot verify and are locked out forever .
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
      // Cross-subdomain mode (apps/api ↔ apps/web-vite): env sets sameSite='none'
      // + Domain='.contractor-ops.com'. Single-origin dev posture: env omits
      // both → sameSite='lax', Domain unset. SameSite=None forces Secure=true
      // regardless of env so browsers honour the cookie (Chrome rejects
      // None+!Secure outright).
      sameSite: authEnv.cookieSameSite,
      secure: authEnv.isProduction || authEnv.cookieSameSite === 'none',
      // Explicit defence-in-depth — Better Auth defaults httpOnly to true,
      // but the cross-subdomain SameSite=None posture warrants pinning it
      // here so a future upstream default change can't silently expose the
      // session cookie to JS.
      httpOnly: true,
      path: '/',
      ...(authEnv.cookieDomain ? { domain: authEnv.cookieDomain } : {}),
    },
  },

  session: {
    expiresIn: 60 * 60 * 24, // 24 hours
    updateAge: 60 * 60, // Refresh session every hour on activity
    // Serve the session from a signed (JWE) data cookie so the common
    // `getSession` path skips a DB read for up to `maxAge`. Trade-off:
    // session revocation and `Session`-level field changes lag by up to
    // `maxAge`; sensitive endpoints (password change, account deletion)
    // already force a fresh DB read via Better Auth's `disableCookieCache`.
    // The active-member ROLE is NOT stored in this cookie — `requirePermission`
    // re-reads `member.role` live on every call, so RBAC/role changes still
    // take effect immediately. `refreshCache` is intentionally omitted: Better
    // Auth auto-disables it (and warns) when a `database` is configured.
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes — matches the org-meta cache TTL.
    },
  },

  /**
   * Block sessions whose `activeOrganizationId` resolves to a soft-disabled
   * `Member` row. The deactivate mutation flips `Member.disabledAt`; this hook
   * ensures sessions cannot be created (or refreshed) into a disabled
   * membership. The check runs on both create and update so a session refresh
   * re-evaluates the membership state.
   */
  databaseHooks: {
    session: {
      create: {
        before: async session => {
          const s = session as {
            activeOrganizationId?: string | null;
            userId?: string;
            [key: string]: unknown;
          };
          // Auto-seed `activeOrganizationId` to the user's first non-disabled
          // membership when Better Auth would otherwise create the session
          // without one. Without this seed, every tenant-scoped tRPC
          // procedure fails with `tenantNoActiveOrganization` immediately
          // after sign-in until the user manually picks an org via the
          // switcher — a regression vs. the legacy Next middleware which
          // chose the first org server-side. Idempotent for users with
          // exactly one org; users with multiple keep whatever they picked
          // last because Better Auth only enters this branch when the
          // value is null/undefined.
          if (!s.activeOrganizationId && s.userId) {
            const firstMembership = await prisma.member.findFirst({
              where: { userId: s.userId, disabledAt: null },
              orderBy: { createdAt: 'asc' },
              select: { organizationId: true },
            });
            if (firstMembership) {
              s.activeOrganizationId = firstMembership.organizationId;
            }
          }
          await assertActiveMembershipNotDisabled(s.activeOrganizationId, s.userId);
          return { data: s };
        },
      },
      update: {
        before: async session => {
          // `update.before` may receive a partial — only re-check when the
          // updated payload carries an `activeOrganizationId` (the typical
          // case is `setActiveOrganization` or session refresh).
          const s = session as { activeOrganizationId?: string | null; userId?: string };
          if (s.activeOrganizationId && s.userId) {
            await assertActiveMembershipNotDisabled(s.activeOrganizationId, s.userId);
          }
          return { data: session };
        },
      },
    },
    user: {
      create: {
        // Seed the new user's default pinned settings tabs. Non-fatal: if the
        // pin write fails (DB hiccup, hook retried after the previous attempt
        // already inserted, etc.) we log and continue so signup still succeeds.
        after: async user => {
          const u = user as { id?: string };
          if (!u.id) return;
          try {
            await prisma.userPinnedView.create({
              data: { userId: u.id, kind: 'settings-tab', key: 'integrations' },
            });
          } catch (err) {
            // P2002 — unique constraint hit because the hook fired twice for
            // the same user (Better Auth retry, replay). Idempotent: swallow.
            const code = (err as { code?: string } | null)?.code;
            if (code === 'P2002') return;
            log.warn(
              { event: 'auth.signup.default_pin_failed', userId: u.id, err },
              'failed to seed default pinned view',
            );
          }
        },
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async ctx => {
      // Cloudflare Turnstile bot protection on signup. The client widget
      // produces a token in `cf-turnstile-response` (custom body field)
      // which we forward to Cloudflare's siteverify endpoint BEFORE Better
      // Auth processes the signup body. On failure we throw a generic
      // FORBIDDEN so the response shape doesn't reveal whether the email was
      // valid (defence in depth alongside the existing sign-in account-lockout
      // PII protection).
      if (ctx.path === '/sign-up/email' && ctx.body) {
        const body = ctx.body as Record<string, unknown>;
        const token =
          (body['cf-turnstile-response'] as string | undefined) ??
          (body.turnstileToken as string | undefined) ??
          '';
        const remoteIp =
          ctx.request?.headers.get('x-real-ip') ??
          ctx.request?.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ??
          undefined;
        const ok = await verifyTurnstileToken({ token, remoteIp });
        if (!ok) {
          log.warn(
            {
              event: 'auth.signup.turnstile_failed',
              emailHash: body.email ? hashEmail(body.email as string) : null,
            },
            'sign-up blocked: turnstile verification failed',
          );
          throw new APIError('FORBIDDEN', {
            message: 'Verification failed. Please refresh and try again.',
          });
        }
      }

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
          // safe-raw-sql: User table is global identity (keyed by email, not org-scoped); sign-in lockout has no tenant dimension.
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
      // Accept an optional `billingCountry` on the create payload so the SPA
      // can declare data residency at org creation. It is input-only: validated
      // by Zod at the boundary, consumed by `beforeCreateOrganization` to derive
      // `dataRegion`, and NEVER persisted (no `billingCountry` column exists on
      // Organization) nor returned. The derived `dataRegion` enum column is the
      // single source of truth.
      schema: {
        organization: {
          additionalFields: {
            billingCountry: {
              type: 'string',
              required: false,
              input: true,
              returned: false,
              validator: { input: billingCountrySchema },
            },
          },
        },
      },
      // The SINGLE origin of `dataRegion`. Maps the billing-country selection
      // to a region and strips the transient `billingCountry` input so only
      // real columns are written. `dataRegion` is immutable after creation:
      // no update hook sets it.
      organizationHooks: {
        beforeCreateOrganization: async ({ organization: org }) => {
          const { billingCountry, ...rest } = org as typeof org & { billingCountry?: string };
          const dataRegion = resolveDataRegionFromBilling({ billingCountry });
          return { data: { ...rest, dataRegion } };
        },
      },
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
        // request-supplied origin) to prevent host-header injection.
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
          organizationId: data.organization.id,
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
