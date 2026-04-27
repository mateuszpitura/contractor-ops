import { getServerEnv } from '@contractor-ops/validators';
import nodemailer from 'nodemailer';
import type { ReactElement } from 'react';
import { render } from 'react-email';
import { getResend } from './resend-client.js';

export type SendAppEmailParams = {
  from: string;
  to: string | string[];
  subject: string;
  /** React Email template — preferred for Resend; rendered to HTML for dev SMTP. */
  react?: ReactElement | string;
  /** Plain HTML body (use when not using `react`). */
  html?: string;
  headers?: Record<string, string>;
};

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
  if (params.react && typeof params.react !== 'string') {
    await resend.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      react: params.react,
      headers: params.headers,
    });
    return;
  }

  const html = params.html ?? (typeof params.react === 'string' ? params.react : undefined);
  if (!html) {
    throw new Error('sendAppEmail: missing html or react');
  }

  await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html,
    headers: params.headers,
  });
}
