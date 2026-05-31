import {
  EntraProviderSectionSkeleton,
  EntraProviderSectionView,
} from './entra-provider-section.js';
import { useEntraProviderSection } from './hooks/use-entra-provider-section.js';

// Decisive container — branches on the hook's loading/error flags; the view is
// presentational (props-in / JSX-out). The hook is the sole tRPC boundary.
export function EntraProviderSection() {
  const { isLoading, isError, onRetry, t, ...rest } = useEntraProviderSection();

  if (isLoading) return <EntraProviderSectionSkeleton />;
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
  return <EntraProviderSectionView t={t} {...rest} />;
}
