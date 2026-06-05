/**
 * React Router loader helper — assert the caller is a platform operator.
 *
 * Server-side `requirePlatformOperator()` is replaced by a loader that:
 *
 *   1. Calls the Better Auth `getSession()` to confirm a session exists.
 *   2. Compares `session.session.activeOrganizationId` to the public
 *      operator-org constant exposed via VITE_PLATFORM_OPERATOR_ORG_ID
 *      (the legacy `getServerEnv().PLATFORM_OPERATOR_ORG_ID` is a
 *      server-only secret; the SPA loader treats the value as
 *      build-time inlined for the client check, and the real RBAC
 *      enforcement still runs on the API side via the tRPC procedure
 *      `auth.isPlatformOperator`).
 *   3. Throws a `404 notFound` response (React Router renders the SPA's
 *      404 element) rather than leaking the existence of admin surfaces.
 *
 * The server-side gate (`packages/api`'s `tenantProcedure` with the
 * `platform_operator` permission) is the authoritative check; this
 * loader is purely a UX short-circuit so users without the role don't
 * load admin chunks at all.
 */

import { redirect } from 'react-router-dom';
import type { Locale } from '../i18n/messages.js';
import { DEFAULT_LOCALE, isSupportedLocale } from '../i18n/messages.js';
import { getAuthClient } from '../providers/auth-provider.js';

const PLATFORM_OPERATOR_ORG_ID = import.meta.env.VITE_PLATFORM_OPERATOR_ORG_ID;

type SessionWithMember = {
  member?: { role?: string | null };
};

export interface RequirePlatformOperatorOptions {
  redirectTo?: string;
}

async function resolveActiveMemberRole(
  auth: ReturnType<typeof getAuthClient>,
  sessionData: NonNullable<
    Awaited<ReturnType<ReturnType<typeof getAuthClient>['getSession']>>['data']
  >,
): Promise<string | null | undefined> {
  const sessionRole = (sessionData as SessionWithMember).member?.role;
  if (sessionRole) return sessionRole;

  const memberResult = await auth.organization.getActiveMember();
  return memberResult.data?.role;
}

export async function requirePlatformOperator(
  localeParam: string | undefined,
  opts: RequirePlatformOperatorOptions = {},
): Promise<null> {
  const locale: Locale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const auth = getAuthClient();
  const session = await auth.getSession();

  if (!session.data?.user) {
    throw redirect(`/${locale}${opts.redirectTo ?? '/login'}`);
  }
  if (!PLATFORM_OPERATOR_ORG_ID) {
    // Misconfigured client build — fall back to 404 rather than reveal
    // the admin surface to a session that might otherwise be allowed.
    throw new Response(null, { status: 404 });
  }
  const activeOrgId = session.data.session.activeOrganizationId;
  if (activeOrgId !== PLATFORM_OPERATOR_ORG_ID) {
    throw new Response(null, { status: 404 });
  }

  const role = await resolveActiveMemberRole(auth, session.data);
  if (role !== 'platform_operator') {
    throw new Response(null, { status: 404 });
  }

  return null;
}
