import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { prisma } from "@contractor-ops/db";
import { validatePortalSession } from "@contractor-ops/api/services/portal-session";
import { PortalTopBar } from "@/components/portal/portal-top-bar";

/**
 * Portal route group layout.
 *
 * - Checks for portal_session cookie via validatePortalSession.
 * - If no valid session, renders children without top bar (login pages).
 * - If authenticated, renders PortalTopBar + main content area.
 *
 * Does NOT use SidebarProvider or AppSidebar (D-01 -- no sidebar).
 * Content constrained to max-w-[1200px] with centered layout.
 */
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("portal_session")?.value;

  // No session cookie: render without top bar (login/verify pages)
  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-background">{children}</div>
    );
  }

  // Validate session
  const session = await validatePortalSession(sessionToken);

  if (!session) {
    return (
      <div className="min-h-screen bg-background">{children}</div>
    );
  }

  // Fetch organization info for the top bar + branding (session only includes contractor)
  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, logo: true, settingsJson: true },
  });

  // Extract brand color from org settings for CSS custom property injection (D-12)
  const settings =
    (organization?.settingsJson as Record<string, unknown>) ?? {};
  const brandColor = (settings.brandColor as string) ?? null;

  return (
    <div
      className="min-h-screen bg-background"
      style={
        brandColor
          ? ({ "--brand-accent": brandColor } as React.CSSProperties)
          : undefined
      }
    >
      <PortalTopBar
        orgName={organization?.name ?? "Organization"}
        orgLogo={organization?.logo ?? null}
        contractorName={session.contractor?.displayName ?? "Contractor"}
        contractorEmail={session.email}
      />
      <main className="flex-1">
        <div className="mx-auto max-w-[1200px] p-6">{children}</div>
      </main>
    </div>
  );
}
