/**
 * Centralized browser-cookie access for the web-vite SPA.
 *
 * The Cookie Store API (`cookieStore.set`) is the modern alternative to
 * `document.cookie`, but Safari does not implement it, so `document.cookie`
 * remains the portable write path. Funneling writes through this single
 * helper keeps that one unavoidable assignment in one place.
 */

export interface CookieOptions {
  /** Cookie lifetime in seconds (`max-age`). */
  maxAge?: number;
  /** Defaults to `/`. */
  path?: string;
  /** `SameSite` attribute; defaults to `lax`. */
  sameSite?: 'lax' | 'strict' | 'none';
  /** Adds the `secure` attribute when `true`. */
  secure?: boolean;
}

/** Reads a cookie value by name, or `undefined` when unset / SSR. */
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return;
  const prefix = `${name}=`;
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return part.slice(prefix.length);
  }
  return;
}

/** Writes a cookie. No-op during SSR. */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') return;

  const { maxAge, path = '/', sameSite = 'lax', secure = false } = options;
  const parts = [`${name}=${value}`, `path=${path}`];
  if (maxAge !== undefined) parts.push(`max-age=${maxAge}`);
  parts.push(`samesite=${sameSite}`);
  if (secure) parts.push('secure');

  // biome-ignore lint/suspicious/noDocumentCookie: canonical cookie write — Cookie Store API lacks Safari support, so document.cookie is the portable fallback; all SPA cookie writes funnel through here.
  document.cookie = parts.join('; ');
}
