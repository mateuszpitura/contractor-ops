import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { StatusfeststellungsverfahrenPanelContainer } from './classification/drv-clearance/index.js';
import { ClassificationDocumentsPanel } from './classification-documents/index.js';
import { useEngagementDetail } from './hooks/use-engagement-detail.js';
import { Ir35ChainPanelContainer } from './ir35-chain/ir35-chain-panel-container.js';
import { OtherClientAttestationFormContainer } from './other-client-attestation/index.js';

export function EngagementDetailContainer() {
  const params = useParams<{ id: string; engagementId: string }>();
  const engagementId = params.engagementId ?? '';
  const contractorId = params.id ?? '';
  const t = useTranslations('Classification');

  const { isLoading, isNotFound, countryCode, completedAssessmentId, attestationSigned } =
    useEngagementDetail(engagementId);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label={t('loading')} />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('engagement.notFound')}</h2>
        <Link
          href={`/contractors/${contractorId}`}
          className="text-sm text-primary underline-offset-4 hover:underline">
          {t('engagement.backToContractor')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <ClassificationDocumentsPanel
        engagementId={engagementId}
        countryCode={countryCode}
        completedAssessmentId={completedAssessmentId}
        attestationSigned={attestationSigned}
      />

      {countryCode === 'GB' ? <Ir35ChainPanelContainer engagementId={engagementId} /> : null}

      {countryCode === 'DE' ? (
        <>
          <StatusfeststellungsverfahrenPanelContainer engagementId={engagementId} />
          <OtherClientAttestationFormContainer engagementId={engagementId} />
        </>
      ) : null}
    </div>
  );
}
