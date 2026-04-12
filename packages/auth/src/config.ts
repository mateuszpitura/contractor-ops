import { prisma } from "@contractor-ops/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";
import { ac } from "./permissions.js";
import { roles } from "./roles.js";

/** Maximum failed login attempts before account is locked */
const MAX_LOGIN_ATTEMPTS = 5;
/** Lockout duration in minutes */
const LOCKOUT_DURATION_MIN = 15;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["microsoft", "google"],
    },
  },

  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  },

  session: {
    expiresIn: 60 * 60 * 24, // 24 hours
    updateAge: 60 * 60, // Refresh session every hour on activity
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Account lockout: block sign-in if user is locked
      if (ctx.path === "/sign-in/email" && ctx.body?.email) {
        const user = await prisma.user.findUnique({
          where: { email: ctx.body.email },
          select: { lockedUntil: true },
        });

        if (user?.lockedUntil && user.lockedUntil > new Date()) {
          const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
          throw new APIError("TOO_MANY_REQUESTS", {
            message: `Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
          });
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Track failed/successful sign-in attempts
      if (ctx.path === "/sign-in/email" && ctx.body?.email) {
        const email = ctx.body.email as string;

        if (ctx.context.newSession) {
          // Successful login: reset failed attempts
          await prisma.user.updateMany({
            where: { email },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        } else {
          // Failed login: atomically increment attempts
          const updated = await prisma.user.updateMany({
            where: { email },
            data: { failedLoginAttempts: { increment: 1 } },
          });

          if (updated.count > 0) {
            // Check if threshold reached and lock if needed
            const user = await prisma.user.findUnique({
              where: { email },
              select: { failedLoginAttempts: true },
            });

            if (user && user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
              await prisma.user.updateMany({
                where: { email },
                data: {
                  lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MIN * 60_000),
                },
              });
            }
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
      },
      async sendInvitationEmail(data) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[DEV] Invitation email to ${data.email}: ${data.invitation.id}`);
          return;
        }
        // TODO: Implement production email sending via Resend (Phase 7)
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (process.env.NODE_ENV === "development") {
          console.log(`[DEV] Magic link for ${email}: ${url}`);
          return;
        }
        // TODO: Implement production email sending via Resend (Phase 7)
      },
    }),
    admin(),
    nextCookies(), // Must be last plugin
  ],
});

/** Session type inferred from the auth configuration */
export type Session = typeof auth.$Infer.Session;
