import { getOrgMeta } from '@contractor-ops/api/services/org-cache';
import { validatePortalSession } from '@contractor-ops/api/services/portal-session';
import { prisma } from '@contractor-ops/db';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PortalTopBar } from '@/components/portal/portal-top-bar';

/**
 * Portal route group layout.
 *
 * - Checks for portal_session cookie via validatePortalSession.
 * - Reads x-portal-org-subdomain header set by Next.js middleware for
 *   subdomain-based portal routing (PORT-08, D-10).
 * - If no valid session but subdomain header exists, renders branded shell
 *   (org logo/color) around children (e.g., login page at acme.portal.app.com
 *   shows Acme branding before contractor logs in).
 * - If authenticated, renders PortalTopBar + main content area.
 *
 * Does NOT use SidebarProvider or AppSidebar (D-01 -- no sidebar).
 * Content constrained to max-w-[1200px] with centered layout.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const [cookieStore, tLayout] = await Promise.all([cookies(), getTranslations('Layout')]);
  const sessionToken = cookieStore.get('portal_session')?.value;
  const headerStore = await headers();
  const subdomainSlug = headerStore.get('x-portal-org-subdomain');

  // No session cookie: try to resolve org from subdomain for branding
  if (!sessionToken) {
    if (subdomainSlug) {
      // Subdomain → org lookup is NOT covered by getOrgMeta (the org cache
      // is keyed by id, not by portalSubdomain). This branch only runs on
      // anonymous portal landing requests (no session cookie), so the
      // per-request cost is bounded and not on the per-navigation hot path.
      // A subdomain → orgId cache would be a future Phase-D follow-up.
      const org = await prisma.organization.findFirst({
        where: { portalSubdomain: subdomainSlug },
        select: { name: true, logo: true },
      });
      if (org) {
        return <div className="min-h-screen bg-background">{children}</div>;
      }
    }
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  // Validate session
  const session = await validatePortalSession(sessionToken);

  if (!session) {
    redirect('/portal/login');
  }

  // F-DB-03 / Phase C.7.b — top-bar branding (name + logo) flows through
  // the cross-pod Upstash org-cache (5 min TTL). settingsJson.brandColor is
  // currently unused (`_brandColor` discarded below); when D-12 wires it up
  // it should land via a dedicated org-branding cache row, not the meta
  // envelope — keeping settingsJson out of the broad meta cache prevents
  // accidentally widening what other callers consume.
  const organization = await getOrgMeta(session.organizationId);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#portal-content"
        className="fixed start-4 top-4 z-[100] -translate-y-16 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0">
        {tLayout('skipToContent')}
      </a>
      <PortalTopBar
        orgName={organization?.name ?? 'Organization'}
        orgLogo={organization?.logo ?? null}
        contractorName={session.contractor?.displayName ?? 'Contractor'}
        contractorEmail={session.email}
      />
      {/* biome-ignore lint/correctness/useUniqueElementIds: skip-link target for accessibility */}
      <main id="portal-content" className="flex-1">
        <div className="mx-auto max-w-[1200px] p-6">{children}</div>
      </main>
    </div>
  );
}
