import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Status dot color mapping (Linear state types)
// ---------------------------------------------------------------------------

const dotColorMap: Record<string, string> = {
  triage: 'bg-muted-foreground',
  backlog: 'bg-muted-foreground',
  unstarted: 'bg-muted-foreground',
  started: 'bg-info',
  completed: 'bg-success',
  cancelled: 'bg-destructive',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinearIssueChipProps {
  /** Linear issue identifier, e.g. "ENG-123" */
  identifier: string;
  /** Full issue title for tooltip */
  title: string;
  /** State name for display */
  status: string;
  /** Linear state type category */
  statusType: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';
  /** Linear issue URL */
  url: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinearIssueChip({
  identifier,
  title,
  status,
  statusType,
  url,
  className,
}: LinearIssueChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open Linear issue ${identifier} in new tab`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-1 max-w-[200px] transition-colors duration-150',
              'bg-[oklch(0.58_0.14_290/8%)] border-[oklch(0.58_0.14_290/20%)] hover:bg-[oklch(0.58_0.14_290/14%)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}>
            <span className="sr-only">{`Linear ${identifier}`}</span>
          </a>
        }>
        {/* Status dot */}
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            dotColorMap[statusType] ?? 'bg-muted-foreground',
          )}
          aria-hidden="true"
        />
        {/* Issue identifier */}
        <span className="font-mono text-xs font-semibold text-primary whitespace-nowrap">
          {identifier}
        </span>
        {/* Status text */}
        <span className="text-xs text-muted-foreground truncate">{status}</span>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
