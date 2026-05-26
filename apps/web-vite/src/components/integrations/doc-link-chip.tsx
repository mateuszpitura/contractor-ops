import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils';
import { ConfluenceIcon, NotionIcon } from './provider-icons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DocLinkChipProps {
  id: string;
  title: string;
  url: string;
  provider: 'notion' | 'confluence';
  lastEditedTime?: string;
  readOnly?: boolean;
  onRemove?: (id: string) => void;
  /**
   * Optional callback to refresh cached metadata (title, lastEditedTime, icon)
   * for this link from the external provider. When omitted, the refresh
   * affordance is hidden.
   */
  onRefresh?: (id: string) => void;
  /** True while the refresh request is in-flight; disables the button + spins icon. */
  isRefreshing?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocLinkChip({
  id,
  title,
  url,
  provider,
  lastEditedTime,
  readOnly,
  onRemove,
  onRefresh,
  isRefreshing,
  className,
}: DocLinkChipProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const t = useTranslations('Integrations');

  const ProviderIcon = provider === 'notion' ? NotionIcon : ConfluenceIcon;
  const providerLabel = provider === 'notion' ? 'Notion' : 'Confluence';
  const showRemove = !readOnly && !!onRemove;
  const showRefresh = !readOnly && !!onRefresh;

  const tooltipText = lastEditedTime
    ? t('docs.chip.lastEdited', { time: formatRelativeTime(lastEditedTime) })
    : t('docs.chip.openIn', { provider: providerLabel });

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('docs.chip.openInProvider', { title, provider: providerLabel })}
              className={cn(
                'group inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 max-w-[220px] hover:bg-muted transition-colors duration-150',
                className,
              )}>
              <span className="sr-only">
                {t('docs.chip.openSrOnly', { title, provider: providerLabel })}
              </span>
            </a>
          }>
          <ProviderIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{title}</span>
          {!!showRefresh && (
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-muted-foreground hover:text-foreground ms-0.5 shrink-0 disabled:opacity-50"
              aria-label={t('docs.chip.refreshAriaLabel', { title })}
              disabled={isRefreshing}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onRefresh(id);
              }}>
              <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
            </button>
          )}
          {!!showRemove && (
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-muted-foreground hover:text-destructive ms-0.5 shrink-0"
              aria-label={t('docs.chip.removeAriaLabel', { title })}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmOpen(true);
              }}>
              <X className="h-3 w-3" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>

      {!!showRemove && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('docs.chip.removeDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('docs.chip.removeDialog.description', { title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('docs.chip.removeDialog.keepLink')}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => {
                  onRemove(id);
                  setConfirmOpen(false);
                }}>
                {t('docs.chip.removeDialog.removeLink')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
