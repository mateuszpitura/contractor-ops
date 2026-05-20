'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import type { DateTimeRange } from '@contractor-ops/ui/components/shadcn/date-time-range-picker';
import { DateTimeRangePicker } from '@contractor-ops/ui/components/shadcn/date-time-range-picker';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';

/**
 * "Out of office" section in user settings.
 * Wires user.setOutOfOffice / user.clearOutOfOffice.
 *
 * Uses our `<DateTimeRangePicker>` to pick the entire from/until window
 * (date + time) in a single popover.
 */
export function OutOfOfficeSection() {
  const t = useTranslations('Settings.outOfOffice');
  const queryClient = useQueryClient();
  const { timeFormat } = useDateFormatter();

  const [range, setRange] = useState<DateTimeRange | undefined>(undefined);
  const [reason, setReason] = useState('');

  const setOoo = useMutation(
    trpc.user.setOutOfOffice.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.saved'));
        queryClient.invalidateQueries(trpc.user.pathFilter());
        setRange(undefined);
        setReason('');
      },
      onError: err => toast.error(err.message),
    }),
  );
  const clearOoo = useMutation(
    trpc.user.clearOutOfOffice.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.cleared'));
        queryClient.invalidateQueries(trpc.user.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
  );

  const isPending = setOoo.isPending || clearOoo.isPending;
  const isValid = !!range && range.until.getTime() >= range.from.getTime();

  function handleSave() {
    if (!(isValid && range)) return;
    setOoo.mutate({
      from: range.from.toISOString(),
      until: range.until.toISOString(),
      reason: reason || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ooo-range">{t('rangePickerLabel')}</Label>
          <DateTimeRangePicker
            value={range}
            onChange={setRange}
            timeFormat={timeFormat}
            disabled={isPending}
            labels={{
              placeholder: t('rangePickerPlaceholder'),
              fromTime: t('fromTime'),
              untilTime: t('untilTime'),
              apply: t('applyCta'),
              clear: t('clearCta'),
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ooo-reason">{t('reason')}</Label>
          <Textarea
            id="ooo-reason"
            rows={2}
            value={reason}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setReason(e.target.value)}
            disabled={isPending}
            maxLength={500}
            placeholder={t('reasonPlaceholder')}
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button
          variant="outline"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => clearOoo.mutate()}
          disabled={isPending}>
          {clearOoo.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
          {t('clearCta')}
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isPending}>
          {setOoo.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {t('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
