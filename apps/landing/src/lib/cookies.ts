/**
 * Centralized browser-cookie access for the landing app.
 *
 * The Cookie Store API (`cookieStore.set`) is the modern alternative to
 * `document.cookie`, but Safari does not implement it, so `document.cookie`
 * remains the portable write path. Routing all writes through this single
 * helper keeps that one unavoidable `document.cookie` assignment in one
 * place instead of scattered across components.
 */

export interface CookieOptions {
  /** Cookie lifetime in seconds (`Max-Age`). */
  maxAge?: number;
  /** Defaults to `/`. */
  path?: string;
  /** `SameSite` attribute; defaults to `Lax`. */
  sameSite?: 'Lax' | 'Strict' | 'None';
  /** Adds the `Secure` attribute when `true`. */
  secure?: boolean;
  /** Optional `Domain` scope (e.g. `.contractor-ops.com`). */
  domain?: string;
}

/** Reads a cookie value by name, or `null` when unset / SSR. */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]+)`),
  );
  return match ? (match[1] ?? null) : null;
}

/** Writes a cookie. No-op during SSR. */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') return;

  const { maxAge, path = '/', sameSite = 'Lax', secure = false, domain } = options;
  const parts = [`${name}=${value}`, `Path=${path}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  parts.push(`SameSite=${sameSite}`);
  if (secure) parts.push('Secure');
  if (domain) parts.push(`Domain=${domain}`);

  // biome-ignore lint/suspicious/noDocumentCookie: canonical cookie write — Cookie Store API lacks Safari support, so document.cookie is the portable fallback; all landing cookie writes funnel through here.
  document.cookie = parts.join('; ');
}
