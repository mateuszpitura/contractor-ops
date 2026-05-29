import { useCallback } from 'react';

import { usePortalPendingSignaturesView } from './hooks/use-portal-pending-signatures-view.js';
import {
  PendingSignaturesError,
  PendingSignaturesSkeleton,
  PortalPendingSignatures,
  PortalSignaturesPage,
  PortalSignaturesPageHeader,
} from './portal-pending-signatures.js';

export function PortalPendingSignaturesContainer() {
  const view = usePortalPendingSignaturesView();

  if (view.pendingQuery.isPending) return <PendingSignaturesSkeleton />;
  if (view.items.length === 0) return null;

  return <PortalPendingSignatures view={view} />;
}

export function PortalSignaturesContainer() {
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
