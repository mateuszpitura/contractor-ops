/**
 * Compact inline badge showing time entry source.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Clock, Pencil, Ticket } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';

const SOURCE_CONFIG = {
  MANUAL: {
    icon: Pencil,
    variant: 'secondary' as const,
    label: 'Manual',
  },
  CLOCKIFY: {
    icon: Clock,
    variant: 'info' as const,
    label: 'Clockify',
  },
  JIRA: {
    icon: Ticket,
    variant: 'info' as const,
    label: 'Jira',
  },
} as const;

interface TimeSourceBadgeProps {
  source: 'MANUAL' | 'CLOCKIFY' | 'JIRA';
  importedAt?: Date | string | null;
}

export function TimeSourceBadge({ source, importedAt }: TimeSourceBadgeProps) {
  const t = useTranslations('Time.sourceBadge');
  const { formatDate } = useDateFormatter();
  const config = SOURCE_CONFIG[source];
  const Icon = config.icon;

  const tooltipText =
    source === 'MANUAL'
      ? t('manualEntry')
      : t('importedFromOn', {
          source: config.label,
          date: importedAt ? formatDate(importedAt) : t('unknownDate'),
        });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Badge variant={config.variant} className="gap-1 px-1.5 py-0.5" />}>
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{config.label}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
