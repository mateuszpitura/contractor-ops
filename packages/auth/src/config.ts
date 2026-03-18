import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";
import { prisma } from "@contractor-ops/db";
import { ac } from "./permissions.js";
import { roles } from "./roles.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // TODO: Enable after email service (Resend) is configured in Phase 7
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

  session: {
    expiresIn: 60 * 60 * 24, // 24 hours
    updateAge: 60 * 60, // Refresh session every hour on activity
  },

  plugins: [
    organization({
      ac,
      roles: {
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
          console.log(
            `[DEV] Invitation email to ${data.email}: ${data.invitation.id}`,
          );
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
