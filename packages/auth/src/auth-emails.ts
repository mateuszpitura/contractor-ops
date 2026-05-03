/**
 * Better Auth transactional email handlers.
 *
 * Wires the four mandatory Better Auth flows — email verification, password
 * reset, magic-link sign-in, and organization invitation — to Resend so the
 * auth surface is functional in non-development environments (F-SEC-13).
 *
 * Design notes:
 * - This module lives in `@contractor-ops/auth` (rather than reusing
 *   `@contractor-ops/api`'s `sendAppEmail`) to avoid a dependency cycle —
 *   `@contractor-ops/api` already depends on `@contractor-ops/auth`.
 * - The Resend client is instantiated lazily so module load does not require
 *   `RESEND_API_KEY` (development tolerates its absence).
 * - All handlers throw on Resend failure so Better Auth surfaces a real error
 *   to the caller; we do not swallow delivery problems.
 * - Logging uses the project Pino logger — never `console.*` (per CLAUDE.md).
 * - Templates are intentionally plain-HTML strings (no React Email runtime
 *   dependency) so the auth package stays lean. The wording is English-only
 *   for now; the broader app i18n surface lives in `apps/web/messages/*` and
 *   is not consumed by Better Auth lifecycle handlers.
 */

import { createLogger } from '@contractor-ops/logger';
import { Resend } from 'resend';
import { authEnv } from './env.js';

const log = createLogger({ service: 'auth-emails' });

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!authEnv.resendApiKey) {
    throw new Error(
      '[@contractor-ops/auth] RESEND_API_KEY is not configured — cannot send transactional email.',
    );
  }
  resendClient ??= new Resend(authEnv.resendApiKey);
  return resendClient;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Stable identifier for log correlation (e.g. 'verify-email', 'reset-password'). */
  template: string;
}

/**
 * Internal Resend wrapper used by all four Better Auth handlers.
 *
 * Throws on send failure so Better Auth can surface the error upstream — never
 * swallow. In development without a Resend key we log the email contents and
 * resolve, so engineers can complete flows locally without spinning up Resend.
 */
async function sendAuthEmail(params: SendEmailParams): Promise<void> {
  if (!authEnv.resendApiKey) {
    if (authEnv.isDevelopment) {
      log.info(
        { event: 'auth.email.dev_only', template: params.template, to: params.to },
        'auth email skipped — RESEND_API_KEY unset in development',
      );
      return;
    }
    // In production / staging / test this should never be reached because
    // `loadAuthEnv` throws when RESEND_API_KEY is missing. Defensive guard.
    throw new Error(
      `[@contractor-ops/auth] Cannot send "${params.template}" email — RESEND_API_KEY missing.`,
    );
  }

  const resend = getResend();
  try {
    const result = await resend.emails.send({
      from: authEnv.emailFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (result.error) {
      log.error(
        {
          event: 'auth.email.send_failed',
          template: params.template,
          error: result.error,
        },
        'Resend returned an error sending auth email',
      );
      throw new Error(
        `[@contractor-ops/auth] Resend rejected "${params.template}" email: ${result.error.message}`,
      );
    }

    log.info(
      {
        event: 'auth.email.sent',
        template: params.template,
        messageId: result.data?.id ?? null,
      },
      'auth email sent',
    );
  } catch (err) {
    log.error(
      { event: 'auth.email.send_exception', template: params.template, err },
      'unexpected error sending auth email',
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// HTML escaping (defense-in-depth — Better Auth supplies trusted URLs but
// names / org names may flow through untrusted profile data).
// ---------------------------------------------------------------------------

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Email template strings
// ---------------------------------------------------------------------------

interface VerifyEmailParams {
  to: string;
  recipientName: string | null;
  url: string;
}

export async function sendVerificationEmail(params: VerifyEmailParams): Promise<void> {
  const greeting = params.recipientName ? `Hi ${escapeHtml(params.recipientName)},` : 'Hi,';
  const url = escapeHtml(params.url);
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
      <p>${greeting}</p>
      <p>Please confirm your email address to finish setting up your Contractor Ops account.</p>
      <p>
        <a href="${url}"
           style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
          Verify email
        </a>
      </p>
      <p style="font-size:12px;color:#555;">
        If the button does not work, paste this link into your browser:<br />
        <span style="word-break:break-all;">${url}</span>
      </p>
      <p style="font-size:12px;color:#555;">If you did not create this account, you can safely ignore this email.</p>
    </div>
  `.trim();

  await sendAuthEmail({
    to: params.to,
    subject: 'Verify your email address',
    template: 'verify-email',
    html,
  });
}

interface ResetPasswordEmailParams {
  to: string;
  recipientName: string | null;
  url: string;
}

export async function sendResetPasswordEmail(params: ResetPasswordEmailParams): Promise<void> {
  const greeting = params.recipientName ? `Hi ${escapeHtml(params.recipientName)},` : 'Hi,';
  const url = escapeHtml(params.url);
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
      <p>${greeting}</p>
      <p>We received a request to reset your Contractor Ops password.</p>
      <p>
        <a href="${url}"
           style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
          Reset password
        </a>
      </p>
      <p style="font-size:12px;color:#555;">
        If the button does not work, paste this link into your browser:<br />
        <span style="word-break:break-all;">${url}</span>
      </p>
      <p style="font-size:12px;color:#555;">
        This link expires shortly. If you did not request a password reset, you can ignore this email — your
        existing password will keep working.
      </p>
    </div>
  `.trim();

  await sendAuthEmail({
    to: params.to,
    subject: 'Reset your Contractor Ops password',
    template: 'reset-password',
    html,
  });
}

interface MagicLinkEmailParams {
  to: string;
  url: string;
}

export async function sendMagicLinkEmail(params: MagicLinkEmailParams): Promise<void> {
  const url = escapeHtml(params.url);
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
      <p>Hi,</p>
      <p>Click the link below to sign in to Contractor Ops:</p>
      <p>
        <a href="${url}"
           style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
          Sign in
        </a>
      </p>
      <p style="font-size:12px;color:#555;">
        If the button does not work, paste this link into your browser:<br />
        <span style="word-break:break-all;">${url}</span>
      </p>
      <p style="font-size:12px;color:#555;">
        This link expires shortly and can only be used once. If you did not request it, you can safely ignore this email.
      </p>
    </div>
  `.trim();

  await sendAuthEmail({
    to: params.to,
    subject: 'Your Contractor Ops sign-in link',
    template: 'magic-link',
    html,
  });
}

interface InvitationEmailParams {
  to: string;
  organizationName: string;
  inviterName: string | null;
  inviterEmail: string | null;
  url: string;
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
  const orgName = escapeHtml(params.organizationName);
  const inviter = params.inviterName
    ? escapeHtml(params.inviterName)
    : params.inviterEmail
      ? escapeHtml(params.inviterEmail)
      : 'A teammate';
  const url = escapeHtml(params.url);
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
      <p>Hi,</p>
      <p>${inviter} has invited you to join <strong>${orgName}</strong> on Contractor Ops.</p>
      <p>
        <a href="${url}"
           style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
          Accept invitation
        </a>
      </p>
      <p style="font-size:12px;color:#555;">
        If the button does not work, paste this link into your browser:<br />
        <span style="word-break:break-all;">${url}</span>
      </p>
      <p style="font-size:12px;color:#555;">
        If you were not expecting this invitation, you can ignore this email.
      </p>
    </div>
  `.trim();

  await sendAuthEmail({
    to: params.to,
    subject: `You're invited to join ${params.organizationName} on Contractor Ops`,
    template: 'organization-invitation',
    html,
  });
}
