import { createHash } from 'node:crypto';
import { getServerEnv } from '@contractor-ops/validators';
import nodemailer from 'nodemailer';
import type { ReactElement } from 'react';
import { render } from 'react-email';
import { getResend } from './resend-client';

export type SendAppEmailParams = {
  from: string;
  to: string | string[];
  subject: string;
  /** React Email template — preferred for Resend; rendered to HTML for dev SMTP. */
  react?: ReactElement | string;
  /** Plain HTML body (use when not using `react`). */
  html?: string;
  headers?: Record<string, string>;
  /**
   * Server-derived idempotency key (F-INT-04). When set, Resend will dedupe
   * retried sends within 24h. Callers should derive this from a stable
   * business identifier — e.g. `notification:${notificationId}` —
   * NEVER from client-supplied input.
   *
   * If omitted, a deterministic key is computed from from+to+subject+body
   * digest so QStash retries of the same payload don't re-send.
   */
  idempotencyKey?: string;
};

// ---------------------------------------------------------------------------
// Idempotency-Key derivation (F-INT-04)
// ---------------------------------------------------------------------------

/**
 * Best-effort fallback when the caller did not supply an idempotency key:
 * sha256 of from+to+subject+body so two identical payloads (e.g. QStash
 * retry of the same notification) collapse into a single Resend send.
 *
 * Resend documents `Idempotency-Key` retention as 24h — adequate for the
 * typical retry window. The output is base64url-trimmed to 64 chars to fit
 * comfortably under any provider limit (Resend has none documented; Stripe
 * caps at 255).
 */
function deriveEmailIdempotencyKey(params: SendAppEmailParams, body: string): string {
  const recipients = Array.isArray(params.to) ? params.to.join(',') : params.to;
  const digest = createHash('sha256')
    .update(`${params.from}|${recipients}|${params.subject}|${body}`)
    .digest('base64url');
  return `email:${digest.slice(0, 56)}`;
}

function isDevSmtpEnabled(
  env: ReturnType<typeof getServerEnv>,
): env is typeof env & { DEV_SMTP_HOST: string } {
  return (
    env.NODE_ENV === 'development' &&
    typeof env.DEV_SMTP_HOST === 'string' &&
    env.DEV_SMTP_HOST.trim().length > 0
  );
}

async function buildHtmlForSmtp(params: SendAppEmailParams): Promise<string> {
  if (params.html) return params.html;
  if (params.react !== undefined) {
    if (typeof params.react === 'string') return params.react;
    return await render(params.react);
  }
  throw new Error('sendAppEmail: provide html or react');
}

/**
 * Sends transactional app email (notifications, portal magic links, billing notices).
 *
 * In **development**, set `DEV_SMTP_HOST` (e.g. `127.0.0.1`) and `DEV_SMTP_PORT` (default `1025`)
 * to deliver to [Mailpit](https://mailpit.axllent.org/) or any SMTP sink instead of calling the Resend API.
 *
 * In **production** (and dev when `DEV_SMTP_HOST` is unset), uses Resend via {@link getResend}.
 */
export async function sendAppEmail(params: SendAppEmailParams): Promise<void> {
  const env = getServerEnv();

  if (isDevSmtpEnabled(env)) {
    const transporter = nodemailer.createTransport({
      host: env.DEV_SMTP_HOST.trim(),
      port: env.DEV_SMTP_PORT,
      secure: false,
    });
    const html = await buildHtmlForSmtp(params);
    await transporter.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html,
      headers: params.headers,
    });
    return;
  }

  const resend = getResend();

  // F-INT-04: thread Idempotency-Key on every Resend send so QStash retries
  // (or fixer cron retries) cannot deliver the same email twice. Resend
  // dedupes against this header for 24h.
  if (params.react && typeof params.react !== 'string') {
    const renderedForKey = await render(params.react);
    const idempotencyKey =
      params.idempotencyKey ?? deriveEmailIdempotencyKey(params, renderedForKey);
    await resend.emails.send(
      {
        from: params.from,
        to: params.to,
        subject: params.subject,
        react: params.react,
        headers: params.headers,
      },
      { idempotencyKey },
    );
    return;
  }

  const html = params.html ?? (typeof params.react === 'string' ? params.react : undefined);
  if (!html) {
    throw new Error('sendAppEmail: missing html or react');
  }

  const idempotencyKey = params.idempotencyKey ?? deriveEmailIdempotencyKey(params, html);
  await resend.emails.send(
    {
      from: params.from,
      to: params.to,
      subject: params.subject,
      html,
      headers: params.headers,
    },
    { idempotencyKey },
  );
}
