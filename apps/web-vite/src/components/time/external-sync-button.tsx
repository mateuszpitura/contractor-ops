/**
 * External sync button for Clockify/Jira. Ported from
 * apps/web/src/components/time/external-sync-button.tsx:
 *   - next-intl → ../../i18n/useTranslations.js
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { formControlPopoverRender } from '@contractor-ops/ui/components/shadcn/form-control-trigger';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { endOfISOWeek, format, startOfISOWeek } from 'date-fns';
import { CalendarDays, Clock, Loader2, Ticket } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../i18n/useTranslations.js';

interface ExternalSyncButtonProps {
  provider: 'CLOCKIFY' | 'JIRA';
  connected: boolean;
  onSync: (startDate: string, endDate: string) => Promise<{ imported: number; skipped: number }>;
  isSyncing: boolean;
}

const PROVIDER_CONFIG = {
  CLOCKIFY: {
    icon: Clock,
    label: 'Clockify',
  },
  JIRA: {
    icon: Ticket,
    label: 'Jira',
  },
} as const;

export function ExternalSyncButton({
  provider,
  connected,
  onSync,
  isSyncing,
}: ExternalSyncButtonProps) {
  const t = useTranslations('Time');
  const config = PROVIDER_CONFIG[provider];
  const Icon = config.icon;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(startOfISOWeek(new Date()));
  const [toDate, setToDate] = useState<Date>(endOfISOWeek(new Date()));
  const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
  const [toCalendarOpen, setToCalendarOpen] = useState(false);

  const handleImport = useCallback(async () => {
    setPopoverOpen(false);
    try {
      const result = await onSync(format(fromDate, 'yyyy-MM-dd'), format(toDate, 'yyyy-MM-dd'));

      if (result.imported > 0) {
        toast.success(`${result.imported} entries imported from ${config.label}`);
      } else {
        toast.info(`No entries found in ${config.label} for the selected period`);
      }
    } catch {
      toast.error(`Failed to import from ${config.label}. Check your connection in Settings.`);
    }
  }, [config.label, fromDate, onSync, toDate]);

  const handleFromSelect = useCallback((d: Date | undefined) => {
    if (d) setFromDate(d);
    setFromCalendarOpen(false);
  }, []);

  const handleToSelect = useCallback((d: Date | undefined) => {
    if (d) setToDate(d);
    setToCalendarOpen(false);
  }, []);

  if (!connected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <Button variant="outline" disabled className="gap-2">
              <Icon className="h-4 w-4" />
              {t('externalSync.syncFrom', { provider: config.label })}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('externalSync.connectHint', { provider: config.label })}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isSyncing) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('externalSync.importing')}
      </Button>
    );
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger render={<Button variant="outline" className="gap-2" />}>
        <Icon className="h-4 w-4" />
        {t('externalSync.syncFrom', { provider: config.label })}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">
            {t('externalSync.importFrom', { provider: config.label })}
          </h4>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t('externalSync.from')}</Label>
            <Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
              <PopoverTrigger render={formControlPopoverRender(undefined, { size: 'sm' })}>
                <CalendarDays className="me-2 h-3.5 w-3.5" />
                {format(fromDate, 'MMM d, yyyy')}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={handleFromSelect}
                  defaultMonth={fromDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t('externalSync.to')}</Label>
            <Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
              <PopoverTrigger render={formControlPopoverRender(undefined, { size: 'sm' })}>
                <CalendarDays className="me-2 h-3.5 w-3.5" />
                {format(toDate, 'MMM d, yyyy')}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={handleToSelect}
                  defaultMonth={toDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button className="w-full" onClick={handleImport}>
            {t('externalSync.importEntries')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
