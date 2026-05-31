import { useOktaProviderSection } from './hooks/use-okta-provider-section.js';
import { OktaProviderSectionSkeleton, OktaProviderSectionView } from './okta-provider-section.js';

// Decisive container — branches on the hook's loading/error flags; the view is
// presentational. The hook is the sole tRPC boundary.
export function OktaProviderSection() {
  const { isLoading, isError, onRetry, t, ...rest } = useOktaProviderSection();

  if (isLoading) return <OktaProviderSectionSkeleton />;
  if (isError) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="text-sm text-destructive">{t('error')}</p>
        <button type="button" className="text-sm underline" onClick={onRetry}>
          {t('retry')}
        </button>
      </div>
    );
  }
  return <OktaProviderSectionView t={t} {...rest} />;
}
