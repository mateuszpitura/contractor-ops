'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Default fallback values (displayed when not configured)
// ---------------------------------------------------------------------------

const DEFAULT_DAYS = [30, 60, 90];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpiryReminderDefaults() {
  const id = useId();
  const t = useTranslations('Settings');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();

  const defaultsQuery = useQuery(trpc.settings.getExpiryReminderDefaults.queryOptions());

  const serverDefaults = defaultsQuery.data?.reminderDaysBefore as number[] | undefined;

  const [inputValue, setInputValue] = useState('');
  const [serverInputValue, setServerInputValue] = useState('');

  // Sync input from server state once loaded
  useEffect(() => {
    if (serverDefaults) {
      const value = serverDefaults.join(', ');
      setInputValue(value);
      setServerInputValue(value);
    } else if (!defaultsQuery.isLoading) {
      const value = DEFAULT_DAYS.join(', ');
      setInputValue(value);
      setServerInputValue(value);
    }
  }, [serverDefaults, defaultsQuery.isLoading]);

  const isDirty = inputValue !== serverInputValue;

  const updateMutation = useMutation(
    trpc.settings.updateExpiryReminderDefaults.mutationOptions({
      onSuccess: () => {
        toast.success(t('expiryReminders.successToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getExpiryReminderDefaults.queryKey(),
        });
      },
      onError: () => {
        toast.error(tToast('reminderDefaultsFailed'));
      },
    }),
  );

  function handleSave() {
    const days = inputValue
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !Number.isNaN(n) && n > 0)
      .sort((a, b) => a - b);

    if (days.length === 0) return;

    updateMutation.mutate({
      reminderDaysBefore: days,
    } as Parameters<typeof updateMutation.mutate>[0]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('expiryReminders.heading')}</CardTitle>
        <CardDescription>{t('expiryReminders.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor={`${id}-reminder-days`} className="text-sm font-medium">
            {t('expiryReminders.label')}
          </label>
          <Input
            id={`${id}-reminder-days`}
            value={inputValue}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setInputValue(e.target.value)}
            placeholder={t('expiryReminders.placeholder')}
          />
          <p className="text-xs text-muted-foreground">{t('expiryReminders.description')}</p>
        </div>
      </CardContent>
      <CardFooter>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {updateMutation.isPending ? t('saving') : t('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
