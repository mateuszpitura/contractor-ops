import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Suspense } from 'react';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { ContractDetailTabs } from './contract-detail/contract-detail-tabs.js';
import { DetailHeaderContainer } from './contract-detail/detail-header-container.js';
import {
  DetailHeaderSkeleton,
  DetailTabContentSkeleton,
  DetailTabsSkeleton,
} from './contract-detail/detail-skeletons.js';
import { SigningProgressBarContainer } from './contract-detail/signing-progress-bar-container.js';
import { useContractDetailPage } from './hooks/use-contract-detail-page.js';

export function ContractDetailContainer() {
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
        <DetailHeaderContainer
          contract={{
            ...contract,
            _documentCount: contract.documentCount ?? 0,
            _hasConnectedProvider: esignConnections.length > 0,
            _contractParties: contractParties,
            _firstDocumentId: undefined,
          }}
        />
      )}

      {activeEnvelope && (
        <SigningProgressBarContainer
          envelope={
            activeEnvelope as unknown as Parameters<
              typeof SigningProgressBarContainer
            >[0]['envelope']
          }
        />
      )}

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
