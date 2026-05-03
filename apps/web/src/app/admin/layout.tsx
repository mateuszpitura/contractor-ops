// apps/web/src/app/admin/layout.tsx
//
// Phase 63 · Plan 05 · D-10 — Admin layout (cross-tenant operator surface).
// F-SEC-04 — Hardened: requires `platform_operator` role inside the dedicated
// PLATFORM_OPERATOR_ORG_ID org. Non-matching callers receive a 404 (notFound)
// rather than a "denied" page so the existence of admin surfaces does not
// leak. Per-page server-side checks live in apps/web/src/lib/admin-auth.ts
// and are duplicated on every page (defense-in-depth — the layout is not
// the sole gate).

import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { requirePlatformOperator } from '@/lib/admin-auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformOperator();

  return (
    <div className="flex min-h-screen">
      <AdminShell />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
