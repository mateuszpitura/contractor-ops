import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import type { VersionHistoryProps } from './hooks/use-version-history.js';

export function VersionHistoryView({
  expanded,
  isLoading,
  versions,
  onToggle,
  onDownloadVersion,
}: VersionHistoryProps) {
  const t = useTranslations('Documents');
  const { formatDate } = useDateFormatter();

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
        <ChevronRight className="size-3" />
        {t('versionHistory')}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-primary hover:underline">
        <ChevronDown className="size-3" />
        {t('versionHistory')}
      </button>

      {isLoading ? (
        <p className="mt-1 text-xs text-muted-foreground">{t('loading')}</p>
      ) : versions.length <= 1 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t('noOtherVersions')}</p>
      ) : (
        <div className="mt-2 space-y-1">
          {versions.map((version, i) => (
            <div
              key={version.id}
              className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
              <div className="min-w-0">
                <span className="text-xs font-medium">
                  {t('version', { n: versions.length - i })}
                </span>
                <span className="ms-2 text-xs text-muted-foreground">
                  {formatDate(version.createdAt)}
                </span>
                {version.status === 'SUPERSEDED' && (
                  <span className="ms-2 text-xs text-muted-foreground/60">({t('superseded')})</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                // biome-ignore lint/nursery/noJsxPropsBind: per-row callback binding
                onClick={() => onDownloadVersion(version.id)}>
                <Download className="size-3" />
                <span className="sr-only">{t('download')}</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
