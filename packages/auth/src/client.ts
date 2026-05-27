import { magicLinkClient, organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Resolve the auth client base URL.
 *
 * Build-time inlined vars (Vite `import.meta.env`, Next.js `NEXT_PUBLIC_*`)
 * bake a missing var as a permanently-empty string. We fail fast in
 * non-development to convert that latent misconfiguration into a build/boot-time
 * error.
 *
 * In development we allow the empty-string fallback (relative-URL same-origin
 * behaviour) since local dev frequently runs on `localhost:3000` without
 * `PUBLIC_APP_URL` exported.
 */
function resolveClientBaseURL(): string {
  const url = process.env.PUBLIC_APP_URL;
  if (url) return url;
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error(
      '[@contractor-ops/auth] PUBLIC_APP_URL must be set in non-development builds. ' +
        'Set it in your env file before building so the value is inlined into the client bundle.',
    );
  }
  return '';
}

/**
 * Better Auth client for browser usage.
 * Includes organization and magic link client plugins
 * to match the server-side plugin configuration.
 */
export const authClient = createAuthClient({
  baseURL: resolveClientBaseURL(),
  plugins: [organizationClient(), magicLinkClient()],
});
