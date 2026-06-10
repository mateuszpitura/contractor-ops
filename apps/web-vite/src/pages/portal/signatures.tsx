/**
 * Portal pending signatures — route shell with inlined page content.
 */

import { Suspense, useCallback } from 'react';

import {
  PendingSignaturesError,
  PendingSignaturesSkeleton,
  PortalSignaturesPage,
  PortalSignaturesPageHeader,
} from '../../components/portal/portal-pending-signatures.js';
import { usePortalPendingSignaturesView } from '../../components/portal/hooks/use-portal-pending-signatures-view.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

function PortalSignaturesPageContent() {
  const view = usePortalPendingSignaturesView();
  const { refetch } = view.pendingQuery;
  const handleRetry = useCallback(() => void refetch(), [refetch]);

  return (
    <div className="space-y-6">
      <PortalSignaturesPageHeader />
      {view.pendingQuery.isError ? (
        <PendingSignaturesError onRetry={handleRetry} />
      ) : view.pendingQuery.isPending ? (
        <PendingSignaturesSkeleton />
      ) : (
        <PortalSignaturesPage view={view} />
      )}
    </div>
  );
}

export default function PortalSignaturesRoutePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalSignaturesPageContent />
    </Suspense>
  );
}
