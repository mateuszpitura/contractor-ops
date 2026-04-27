import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function BoeRateAdminLayout({ children }: { children: ReactNode }) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect('/login');
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    redirect('/');
  }

  const membership = await prisma.member.findFirst({
    where: {
      userId: session.user.id,
      organizationId: activeOrgId,
    },
    select: { role: true },
  });

  if (membership?.role !== 'platform_operator') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You do not have permission to manage BoE reference data.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
