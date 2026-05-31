import {
  GitHubProviderSectionSkeleton,
  GitHubProviderSectionView,
} from './github-provider-section.js';
import { useGitHubProviderSection } from './hooks/use-github-provider-section.js';

// Decisive container — branches on the hook's loading/error flags; the view is
// presentational. The hook is the sole tRPC boundary.
export function GitHubProviderSection() {
  const { isLoading, isError, onRetry, t, ...rest } = useGitHubProviderSection();

  if (isLoading) return <GitHubProviderSectionSkeleton />;
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
  return <GitHubProviderSectionView t={t} {...rest} />;
}
