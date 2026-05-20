import { getOrgBranding } from '@contractor-ops/api/services/org-cache';
import { validatePortalSession } from '@contractor-ops/api/services/portal-session';
import { prisma } from '@contractor-ops/db';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';
import { PortalTopBar } from '@/components/portal/portal-top-bar';

/**
 * Portal shell brand-color style — when an org-supplied brand color is
 * present, expose it as `--portal-brand` AND override `--primary` for the
 * shell subtree only so existing Tailwind `text-primary`/`bg-primary`
 * utilities tint with the brand. Scoped via inline style → never leaks to
 * dashboard/admin routes (those don't render this layout).
 *
 * Brand color is pre-validated by `parseBrandColor` in `org-cache.ts` so
 * passing it into a CSS variable is safe (no `expression()`, no `url(...)`).
 */
function getPortalShellStyle(brandColor: string | null): CSSProperties | undefined {
  if (!brandColor) return;
  return {
    '--portal-brand': brandColor,
    '--primary': brandColor,
  } as CSSProperties;
}

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

  // D-12 — read portal branding (name, logo, validated brandColor) from the
  // dedicated org-branding cache row. Kept separate from getOrgMeta so the
  // hot meta envelope stays free of settingsJson.
  const organization = await getOrgBranding(session.organizationId);
  const shellStyle = getPortalShellStyle(organization?.brandColor ?? null);

  return (
    <div className="min-h-screen bg-background" style={shellStyle}>
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
