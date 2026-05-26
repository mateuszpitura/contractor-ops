import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { DateTimeRangePicker } from '@contractor-ops/ui/components/shadcn/date-time-range-picker';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { Loader2, Save } from 'lucide-react';
import type { useOutOfOfficeSection } from './hooks/use-out-of-office-section.js';

export type OutOfOfficeSectionProps = ReturnType<typeof useOutOfOfficeSection>;

export function OutOfOfficeSection({
  t,
  timeFormat,
  range,
  setRange,
  reason,
  setReason,
  isPending,
  isValid,
  handleSave,
  handleClear,
  isClearPending,
  isSavePending,
}: OutOfOfficeSectionProps) {
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
          onClick={handleClear}
          disabled={isPending}>
          {isClearPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
          {t('clearCta')}
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isPending}>
          {isSavePending ? (
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
