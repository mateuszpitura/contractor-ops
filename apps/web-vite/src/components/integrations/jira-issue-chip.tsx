import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Status category color mapping
// ---------------------------------------------------------------------------

const dotColorMap: Record<string, string> = {
  new: 'bg-muted-foreground',
  indeterminate: 'bg-info',
  done: 'bg-success',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface JiraIssueChipProps {
  issueKey: string;
  summary: string;
  status: string;
  statusCategory: 'new' | 'indeterminate' | 'done';
  url: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JiraIssueChip({
  issueKey,
  summary,
  status,
  statusCategory,
  url,
  className,
}: JiraIssueChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open Jira issue ${issueKey} in new tab`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 max-w-[200px] hover:bg-muted transition-colors duration-150',
              className,
            )}>
            <span className="sr-only">{`Jira ${issueKey}`}</span>
          </a>
        }>
        {/* Status dot */}
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            dotColorMap[statusCategory] ?? 'bg-muted-foreground',
          )}
        />
        {/* Issue key */}
        <span className="font-mono text-xs font-semibold text-primary whitespace-nowrap">
          {issueKey}
        </span>
        {/* Status text */}
        <span className="text-xs text-muted-foreground truncate">{status}</span>
      </TooltipTrigger>
      <TooltipContent>{summary}</TooltipContent>
    </Tooltip>
  );
}
