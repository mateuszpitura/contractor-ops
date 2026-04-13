'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useCallback } from 'react';
import { ContractDetailTabs } from '@/components/contracts/contract-detail/contract-detail-tabs';
import { DetailHeader } from '@/components/contracts/contract-detail/detail-header';
import { SigningProgressBar } from '@/components/contracts/contract-detail/signing-progress-bar';
import { useBreadcrumbOverride } from '@/components/layout/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-[240px]" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="size-7" />
      </div>
    </div>
  );
}

function TabContentSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <div key={`skel-${i}`} className="rounded-xl border bg-card p-4">
          <Skeleton className="mb-3 h-5 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('ContractDetail');

  const contractQuery = useQuery(trpc.contract.getById.queryOptions({ id: params.id }));

  const contract = contractQuery.data;

  // Set breadcrumb label for this detail page
  useBreadcrumbOverride(params.id, contract?.title);

  const handleRetry = useCallback(() => contractQuery.refetch(), [contractQuery]);

  // E-sign: check for connected providers
  const connectionsQuery = useQuery(trpc.esign.listConnections.queryOptions());
  const esignConnections = connectionsQuery.data ?? [];

  // E-sign: fetch signing envelopes for this contract
  const envelopesQuery = useQuery(
    trpc.esign.listEnvelopes.queryOptions({ contractId: params.id }, { enabled: !!params.id }),
  );
  const envelopes = envelopesQuery.data ?? [];
  const activeEnvelope = envelopes.find(e => ['SENT', 'DELIVERED', 'CREATED'].includes(e.status));

  if (contractQuery.isError) {
    const isNotFound =
      contractQuery.error?.message?.includes('not found') ||
      (contractQuery.error as { data?: { code?: string } })?.data?.code === 'NOT_FOUND';

    if (isNotFound) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-lg font-medium">{t('error.notFound')}</h2>
          <Button variant="outline" render={<Link href="/contracts" />}>
            {t('error.backToList')}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('error.loadFailed')}</h2>
        <Button variant="outline" onClick={handleRetry}>
          {t('error.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {contractQuery.isLoading || !contract ? (
        <HeaderSkeleton />
      ) : (
        <DetailHeader
          contract={{
            ...contract,
            _documentCount: contract.documents?.length ?? contract._meta?.documentCount ?? 0,
            _hasConnectedProvider: esignConnections.length > 0,
            _contractParties: contract.contractor
              ? [
                  {
                    name: contract.contractor.displayName,
                    email: contract.contractor.email ?? '',
                    role: 'signer' as const,
                  },
                ]
              : [],
            _firstDocumentId: contract.documents?.[0]?.id,
          }}
        />
      )}

      {/* Signing progress (between header and tabs) */}
      {activeEnvelope && (
        <SigningProgressBar
          envelope={
            activeEnvelope as unknown as Parameters<typeof SigningProgressBar>[0]['envelope']
          }
        />
      )}

      {/* Tabs */}
      {contractQuery.isLoading || !contract ? (
        <>
          <div className="mb-4 flex gap-2 border-b pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <Skeleton key={`skel-${i}`} className="h-7 w-24" />
            ))}
          </div>
          <TabContentSkeleton />
        </>
      ) : (
        <Suspense fallback={<TabContentSkeleton />}>
          <ContractDetailTabs contract={contract} />
        </Suspense>
      )}
    </div>
  );
}
