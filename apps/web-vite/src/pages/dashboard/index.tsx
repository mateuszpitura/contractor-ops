/**
 * Dashboard index — route shell with inlined page content.
 */

import { AtelierBackground } from '@contractor-ops/ui';
import { Suspense } from 'react';

import {
  DashboardHome,
  DashboardSkeleton,
} from '../../components/dashboard/dashboard-home.js';

export default function DashboardPage() {
  return (
    <div className="relative">
      <AtelierBackground />
      <div className="relative z-10">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardHome />
        </Suspense>
      </div>
    </div>
  );
}
