import { createHash } from 'node:crypto';
import { deriveIdempotencyKey, GLOBAL_ORG_SENTINEL } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import nodemailer from 'nodemailer';
import type { ReactElement } from 'react';
import { render } from 'react-email';
import { isGlobalDemo } from '../lib/demo';
import { getResend } from './resend-client';

const log = createLogger({ service: 'app-email' });

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
   * Server-derived idempotency key. When set, Resend will dedupe retried
   * sends within 24h. Callers should derive this from a stable business
   * identifier — e.g. `notification:${notificationId}` —
   * NEVER from client-supplied input.
   *
   * If omitted, a deterministic key is computed from from+to+subject+body
   * digest so QStash retries of the same payload don't re-send.
   */
  idempotencyKey?: string;
};

// ---------------------------------------------------------------------------
// Idempotency-Key derivation
// ---------------------------------------------------------------------------

/**
 * Best-effort fallback when the caller did not supply an idempotency key:
 * derive a key through the canonical `deriveIdempotencyKey` helper from
 * `@contractor-ops/integrations`, using a content digest of
 * from+to+subject+body as the business key. Two identical payloads (e.g.
 * a QStash retry of the same notification) collapse to a single Resend
 * send.
 *
 * Resend documents `Idempotency-Key` retention as 24h — adequate for the
 * typical retry window. The helper returns a 64-char lowercase hex digest
 * that fits comfortably under every provider limit.
 *
 * `sendAppEmail` has no tenant context at the call site (it serves both
 * transactional notifications and pre-tenancy auth flows), so we partition
 * with {@link GLOBAL_ORG_SENTINEL}. Org-scoped callers SHOULD pass an
 * explicit `idempotencyKey` derived with their orgId for stronger
 * cross-tenant key isolation.
 */
function deriveEmailIdempotencyKey(params: SendAppEmailParams, body: string): string {
  const recipients = Array.isArray(params.to) ? params.to.join(',') : params.to;
  const contentDigest = createHash('sha256')
    .update(`${params.from}|${recipients}|${params.subject}|${body}`)
    .digest('hex');
  return deriveIdempotencyKey({
    orgId: GLOBAL_ORG_SENTINEL,
    operation: 'resend.email.send',
    businessKey: contentDigest,
  });
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

  // Demo read-only — a dedicated demo deployment (DEMO_MODE=true) sends no real
  // email at all. This helper has no org context (it also serves pre-tenancy
  // auth flows), so it can only honor the global signal; org-scoped sends are
  // already skipped one level up in `dispatch` (see lib/demo.ts isGlobalDemo).
  if (isGlobalDemo()) {
    log.info({ subject: params.subject }, 'demo mode — skipping outbound email');
    return;
  }

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

  // Thread Idempotency-Key on every Resend send so QStash retries
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
