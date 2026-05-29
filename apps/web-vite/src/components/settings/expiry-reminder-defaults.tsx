import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Loader2, Save } from 'lucide-react';
import type * as React from 'react';
import { useCallback } from 'react';

import type { useExpiryReminderDefaults } from './hooks/use-expiry-reminder-defaults.js';

export type ExpiryReminderDefaultsProps = ReturnType<typeof useExpiryReminderDefaults>;

export function ExpiryReminderDefaults({
  id,
  t,
  inputValue,
  setInputValue,
  isDirty,
  isPending,
  handleSave,
}: ExpiryReminderDefaultsProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value),
    [setInputValue],
  );
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
            onChange={handleChange}
            placeholder={t('expiryReminders.placeholder')}
          />
          <p className="text-xs text-muted-foreground">{t('expiryReminders.description')}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={!isDirty || isPending}>
          {isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {isPending ? t('saving') : t('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
