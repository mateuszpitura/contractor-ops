'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

// Inline type to avoid cross-package build dependency in parallel execution
interface CalendarTaskConfig {
  calendarEnabled: boolean;
  titleTemplate?: string;
  duration: '30m' | '1h' | '2h' | '4h' | 'full_day';
  attendees: string[];
}

// ---------------------------------------------------------------------------
// Duration options
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '2h', label: '2 hours' },
  { value: '4h', label: '4 hours' },
  { value: 'full_day', label: 'Full day' },
] as const;

// ---------------------------------------------------------------------------
// CalendarEventConfigDialog
// ---------------------------------------------------------------------------

interface CalendarEventConfigDialogProps {
  taskTemplateId: string;
  config: CalendarTaskConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: CalendarTaskConfig) => void;
}

export function CalendarEventConfigDialog({
  config,
  open,
  onOpenChange,
  onSave,
}: CalendarEventConfigDialogProps) {
  const t = useTranslations('CalendarSettings');
  const reactId = useId();

  // Local form state (same pattern as OcrReviewPanel)
  const [titleTemplate, setTitleTemplate] = useState(config.titleTemplate ?? '');
  const [duration, setDuration] = useState<string>(config.duration ?? '1h');
  const [attendeesText, setAttendeesText] = useState((config.attendees ?? []).join(', '));

  // Reset form state when dialog opens with fresh config
  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      setTitleTemplate(config.titleTemplate ?? '');
      setDuration(config.duration ?? '1h');
      setAttendeesText((config.attendees ?? []).join(', '));
    }
    onOpenChange(newOpen);
  }

  function handleSave() {
    // Parse attendees from comma-separated string
    const attendees: string[] = attendeesText
      .split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0 && email.includes('@'));

    onSave({
      calendarEnabled: config.calendarEnabled,
      titleTemplate: titleTemplate || undefined,
      duration: duration as CalendarTaskConfig['duration'],
      attendees,
    });

    onOpenChange(false);
  }

  return (
    // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('calendarEventTitle')}</DialogTitle>
          <DialogDescription>{t('calendarEventDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor={`${reactId}-calendar-event-title`}>{t('eventTitleLabel')}</Label>
            <Input
              id={`${reactId}-calendar-event-title`}
              value={titleTemplate}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setTitleTemplate(e.target.value)}
              placeholder={t('eventTitlePlaceholder')}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">{t('eventTitleHint')}</p>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor={`${reactId}-calendar-event-duration`}>{t('durationLabel')}</Label>
            {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
            <Select value={duration} onValueChange={val => setDuration(val ?? '1h')}>
              <SelectTrigger id={`${reactId}-calendar-event-duration`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label htmlFor={`${reactId}-calendar-event-attendees`}>{t('attendeesLabel')}</Label>
            <Textarea
              id={`${reactId}-calendar-event-attendees`}
              value={attendeesText}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => setAttendeesText(e.target.value)}
              placeholder={t('attendeesPlaceholder')}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{t('attendeesHint')}</p>
          </div>
        </div>

        <DialogFooter>
          {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancelButton')}
          </Button>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button onClick={handleSave}>{t('saveEventConfig')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
