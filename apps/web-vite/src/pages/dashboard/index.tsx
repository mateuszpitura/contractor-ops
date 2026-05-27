/**
 * Dashboard index — thin route shell.
 *
 * Wraps the bento-layout container in an AtelierBackground so the route
 * picks up the dashboard tier ambient wash. Suspense fallback renders the
 * full bento skeleton (matching the eventual layout) instead of a generic
 * spinner, so the page does not pop between two loading shapes when the
 * lazy chunk lands and bootstrap query starts.
 */

import { AtelierBackground } from '@contractor-ops/ui';
import { Suspense } from 'react';

import { DashboardHomeContainer } from '../../components/dashboard/dashboard-home-container.js';
import { DashboardSkeleton } from '../../components/dashboard/dashboard-skeleton.js';

export default function DashboardPage() {
  return (
    <div className="relative">
      <AtelierBackground />
      <div className="relative z-10">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardHomeContainer />
        </Suspense>
      </div>
    </div>
  );
}
