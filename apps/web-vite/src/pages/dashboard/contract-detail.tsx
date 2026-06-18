/**
 * Contract detail — route shell with inlined page content.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Suspense } from 'react';

import { ContractDetailTabs } from '../../components/contracts/contract-detail/contract-detail-tabs.js';
import { DetailHeaderWired } from '../../components/contracts/contract-detail/detail-header.js';
import {
  DetailHeaderSkeleton,
  DetailTabContentSkeleton,
  DetailTabsSkeleton,
} from '../../components/contracts/contract-detail/detail-skeletons.js';
import { SigningProgressBarPanel } from '../../components/contracts/contract-detail/signing-progress-bar.js';
import { useContractDetailPage } from '../../components/contracts/hooks/use-contract-detail-page.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function ContractDetailPageContent() {
  const t = useTranslations('ContractDetail');
  const {
    contract,
    activeEnvelope,
    esignConnections,
    handleRetry,
    isNotFound,
    isError,
    isLoading,
    contractParties,
  } = useContractDetailPage();

  if (isError) {
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
    <div className="space-y-section-gap">
      {isLoading || !contract ? (
        <DetailHeaderSkeleton />
      ) : (
        <DetailHeaderWired
          contract={{
            ...contract,
            _documentCount: contract.documentCount ?? 0,
            _hasConnectedProvider: esignConnections.length > 0,
            _contractParties: contractParties,
            _firstDocumentId: undefined,
          }}
        />
      )}

      {activeEnvelope ? <SigningProgressBarPanel envelope={activeEnvelope} /> : null}

      {isLoading || !contract ? (
        <DetailTabsSkeleton />
      ) : (
        <Suspense fallback={<DetailTabContentSkeleton />}>
          <ContractDetailTabs contract={contract} contractParties={contractParties} />
        </Suspense>
      )}
    </div>
  );
}

export default function ContractDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ContractDetailPageContent />
    </Suspense>
  );
}
