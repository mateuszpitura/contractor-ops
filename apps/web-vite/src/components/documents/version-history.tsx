import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import type { VersionHistoryProps, VersionRow } from './hooks/use-version-history.js';

export function VersionHistoryCollapsedTrigger({ onToggle }: { onToggle: () => void }) {
  const t = useTranslations('Documents');
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

function ExpandedHeader({ onToggle }: { onToggle: () => void }) {
  const t = useTranslations('Documents');
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 text-xs text-primary hover:underline">
      <ChevronDown className="size-3" />
      {t('versionHistory')}
    </button>
  );
}

export function VersionHistoryLoading({ onToggle }: { onToggle: () => void }) {
  const t = useTranslations('Documents');
  return (
    <div className="mt-2">
      <ExpandedHeader onToggle={onToggle} />
      <p className="mt-1 text-xs text-muted-foreground">{t('loading')}</p>
    </div>
  );
}

export function VersionHistoryEmpty({ onToggle }: { onToggle: () => void }) {
  const t = useTranslations('Documents');
  return (
    <div className="mt-2">
      <ExpandedHeader onToggle={onToggle} />
      <p className="mt-1 text-xs text-muted-foreground">{t('noOtherVersions')}</p>
    </div>
  );
}

type VersionHistoryListProps = {
  versions: VersionRow[];
  onToggle: () => void;
  onDownloadVersion: (versionId: string) => void;
};

export function VersionHistoryList({
  versions,
  onToggle,
  onDownloadVersion,
}: VersionHistoryListProps) {
  const t = useTranslations('Documents');
  const { formatDate } = useDateFormatter();
  return (
    <div className="mt-2">
      <ExpandedHeader onToggle={onToggle} />
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
    </div>
  );
}

/**
 * Retained for backwards compatibility / legacy single-view callers. The
 * decisive `VersionHistory` container now selects between
 * `VersionHistoryCollapsedTrigger`, `VersionHistoryLoading`,
 * `VersionHistoryEmpty`, and `VersionHistoryList` directly. New code should
 * render the container instead of this composite view.
 */
export function VersionHistoryView({
  expanded,
  isLoading,
  versions,
  onToggle,
  onDownloadVersion,
}: VersionHistoryProps) {
  if (!expanded) return <VersionHistoryCollapsedTrigger onToggle={onToggle} />;
  if (isLoading) return <VersionHistoryLoading onToggle={onToggle} />;
  if (versions.length <= 1) return <VersionHistoryEmpty onToggle={onToggle} />;
  return (
    <VersionHistoryList
      versions={versions}
      onToggle={onToggle}
      onDownloadVersion={onDownloadVersion}
    />
  );
}
