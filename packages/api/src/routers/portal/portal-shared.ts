import { createHmac } from 'node:crypto';
import type { DataRegion } from '@contractor-ops/db';
import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import { getServerEnv } from '@contractor-ops/validators';
import type { TenantScopedDb } from '../../lib/tenant-db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Runs a callback with the regional tenant-scoped client for an org (e.g. public
 * `selectOrg` before `portalProcedure` attaches `ctx.db`). Routing: primary
 * `Organization` → `dataRegion` → `getRegionalClient` + `createTenantClientFrom`.
 */
export async function withOrgRegionalDb<T>(
  organizationId: string,
  fn: (db: TenantScopedDb) => Promise<T>,
): Promise<T> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { dataRegion: true },
  });
  const region: DataRegion = org?.dataRegion ?? 'EU';
  const db = createTenantClientFrom(getRegionalClient(region));
  return tenantStore.run({ organizationId, region }, () => fn(db));
}

/**
 * Extract the portal_session cookie value from request headers.
 * Used by logout to identify the session to delete.
 */
export function extractPortalToken(headers: Headers): string | null {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split('; ');
  for (const cookie of cookies) {
    if (cookie.startsWith('portal_session=')) {
      return cookie.slice('portal_session='.length);
    }
  }
  return null;
}

/**
 * Derive the base URL used to build outbound magic-link emails.
 *
 * SECURITY: This function INTENTIONALLY ignores the inbound request headers
 * (`Origin`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `Host`) — every one of
 * those is attacker-controlled on a public endpoint. Trusting them lets any
 * caller spoof the host inside `requestMagicLink` and have the system mail a
 * one-time login link pointing at `https://attacker.example.com/...?token=…`,
 * which the victim then clicks and the attacker captures.
 *
 * The trusted source is the validated server env `PUBLIC_APP_URL`. When
 * a per-org portal subdomain is needed in the future, look it up from the
 * `Organization` table against an explicit allowlist (e.g. `*.PORTAL_BASE_DOMAIN`)
 * — never accept it from request headers.
 *
 * Do NOT change this back to read from `headers` without re-auditing the
 * magic-link delivery path.
 */
export function deriveBaseUrl(): string {
  return getServerEnv().PUBLIC_APP_URL;
}

/**
 * Sign a freshly-issued portal session token so the
 * `/portal/set-session` route handler can prove the value originated from
 * `verifyMagicLink` / `selectOrg` rather than a CSRF / session-fixation attempt.
 *
 * Uses HMAC-SHA256 keyed off `BETTER_AUTH_SECRET` with a fixed domain-separator
 * label — no extra env variable needed, no extra DB column. The matching
 * verifier lives in `apps/api/src/routes/portal-session.ts` and computes
 * the signature identically. Keep both in sync.
 *
 * Inputs hashed: `${rawToken}.${expiresAt.toISOString()}` — binding the
 * signature to both the token bytes and the exact expiry the client will set
 * on the cookie prevents an attacker from replaying an old (signature, token)
 * pair with a forged future expiry.
 */
export function signPortalSessionToken(rawToken: string, expiresAt: Date): string {
  const secret = getServerEnv().BETTER_AUTH_SECRET;
  return createHmac('sha256', `${secret}|portal-set-session-v1`)
    .update(`${rawToken}.${expiresAt.toISOString()}`)
    .digest('base64url');
}

/**
 * Strip the `bankAccountEncrypted` field from a `requestedChanges`
 * JSON blob before sending it to a portal client. The encrypted bank account
 * ciphertext (IV + auth tag + payload) must never leave the server — only the
 * server-derived `bankAccountMasked` is safe to expose. Same JSON is used by
 * the admin approval UI where the cleartext `bankName`/`swiftBic`/`taxId` are
 * fine, but the contractor portal must never see ciphertext.
 */
export function stripBankAccountEncrypted(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { bankAccountEncrypted: _bankAccountEncrypted, ...rest } = value as Record<string, unknown>;
  return rest;
}

// ---------------------------------------------------------------------------
// Activity log types
// ---------------------------------------------------------------------------

/**
 * Extracts the most recent status event from an invoice's timestamp fields.
 */
export function extractLatestInvoiceEvent(inv: {
  invoiceNumber: string | null;
  receivedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
}): ActivityEntry | null {
  const events: { ts: Date; event: string; detail?: string | null }[] = [];

  if (inv.paidAt)
    events.push({ ts: inv.paidAt, event: `Invoice ${inv.invoiceNumber} - Payment completed` });
  if (inv.rejectedAt)
    events.push({
      ts: inv.rejectedAt,
      event: `Invoice ${inv.invoiceNumber} - Invoice rejected`,
      detail: inv.rejectionReason,
    });
  if (inv.approvedAt)
    events.push({ ts: inv.approvedAt, event: `Invoice ${inv.invoiceNumber} - Invoice approved` });
  if (inv.reviewedAt)
    events.push({ ts: inv.reviewedAt, event: `Invoice ${inv.invoiceNumber} - Under review` });
  if (inv.receivedAt)
    events.push({ ts: inv.receivedAt, event: `Invoice ${inv.invoiceNumber} - Invoice submitted` });

  if (events.length === 0) return null;

  events.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  const latest = events[0];
  if (!latest) return null;
  return { timestamp: latest.ts, event: latest.event, detail: latest.detail };
}

export interface ActivityEntry {
  timestamp: Date;
  event: string;
  detail?: string | null;
}
