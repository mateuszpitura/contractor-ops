'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
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
  className,
}: DocLinkChipProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const ProviderIcon = provider === 'notion' ? NotionIcon : ConfluenceIcon;
  const providerLabel = provider === 'notion' ? 'Notion' : 'Confluence';
  const showRemove = !readOnly && !!onRemove;

  const tooltipText = lastEditedTime
    ? `Last edited ${formatRelativeTime(lastEditedTime)}`
    : `Open in ${providerLabel}`;

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${title} in ${providerLabel} (new tab)`}
              className={cn(
                'group inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 max-w-[220px] hover:bg-muted transition-colors duration-150',
                className,
              )}>
              <span className="sr-only">{`Open ${title} in ${providerLabel}`}</span>
            </a>
          }>
          <ProviderIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{title}</span>
          {!!showRemove && (
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-muted-foreground hover:text-destructive ms-0.5 shrink-0"
              aria-label={`Remove link to ${title}`}
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
              <AlertDialogTitle>Remove Document Link</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the link to &ldquo;{title}&rdquo; from this step. The original page
                will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Link</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  onRemove(id);
                  setConfirmOpen(false);
                }}>
                Remove Link
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
