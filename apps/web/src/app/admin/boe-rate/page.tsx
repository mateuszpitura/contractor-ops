// apps/web/src/app/admin/boe-rate/page.tsx
//
// Phase 63 · Plan 05 · D-10 — Super-admin BoE base rate history page.
// F-SEC-04 — Server-side authorization wrapper around the client UI so the
// page never renders for non-platform-operator callers (defense-in-depth;
// the admin layout is not the sole gate).

import type { Metadata } from 'next';
import { BoeRatePageClient } from '@/components/admin/boe-rate/boe-rate-page-client';
import { requirePlatformOperator } from '@/lib/admin-auth';

export const metadata: Metadata = {
  title: 'BoE base-rate history — Admin',
};

export default async function BoeRatePage() {
  await requirePlatformOperator();
  return <BoeRatePageClient />;
}
