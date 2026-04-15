// apps/web/src/app/admin/layout.tsx
//
// Phase 63 · Plan 05 · D-10 — Admin layout with super-admin permission gate.
// First admin surface in the app. Non-super-admin users see a 403 empty state.

import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect('/login');
  }

  // Check if user has super-admin role
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

  const isSuperAdmin = membership?.role === 'owner';

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You do not have permission to access the admin area.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminShell />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
