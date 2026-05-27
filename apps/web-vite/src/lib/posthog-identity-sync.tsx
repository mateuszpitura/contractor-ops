/**
 * Stitches the signed-in user id onto the active PostHog session so the
 * anonymous landing → signup → dashboard funnel stays in one timeline.
 *
 * Mounted once inside the AuthProvider tree (see `main.tsx`). Watches
 * the Better Auth session and calls `identifyPostHogUser(user.id)` the
 * first time a user appears. On sign-out (user transitions back to
 * `null`) it calls `resetPostHogIdentity()` so the next session's
 * anonymous events do not get attributed to the previous user.
 */

import { useEffect } from 'react';

import { useSession } from '../providers/auth-provider.js';
import { identifyPostHogUser, resetPostHogIdentity } from './posthog.js';

export function PostHogIdentitySync() {
  const sessionResult = useSession() as
    | { data?: { user?: { id?: string; email?: string } | null } | null }
    | undefined;
  const userId = sessionResult?.data?.user?.id;
  const email = sessionResult?.data?.user?.email;

  useEffect(() => {
    if (userId) {
      // Pass `email` so PostHog can resolve the user in the dashboard.
      // No PII beyond what the user already shares with us at sign-up.
      identifyPostHogUser(userId, email ? { email } : undefined);
    } else {
      // Either pre-auth (no session) or just-signed-out. Drop the
      // identified id so subsequent anonymous events do not attach to
      // the previous user. `resetPostHogIdentity` is a no-op until
      // PostHog actually initialised, so calling it pre-consent is safe.
      resetPostHogIdentity();
    }
  }, [userId, email]);

  return null;
}
