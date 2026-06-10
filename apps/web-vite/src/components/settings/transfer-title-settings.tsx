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
import { useTransferTitleSettings } from './hooks/use-transfer-title-settings.js';
import type { useTransferTitleSettings as UseTransferTitleSettings } from './hooks/use-transfer-title-settings.js';

export type TransferTitleSettingsProps = ReturnType<typeof UseTransferTitleSettings>;

export function TransferTitleSettingsView({
  id,
  t,
  register,
  handleSubmit,
  preview,
  isDirty,
  errors,
  isPending,
}: TransferTitleSettingsProps) {
  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{t('settingsHeading')}</CardTitle>
          <CardDescription>{t('settingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={`${id}-transfer-title-template`} className="text-sm font-medium">
              {t('templateLabel')}
            </label>
            <Input
              id={`${id}-transfer-title-template`}
              placeholder={t('templatePlaceholder')}
              {...register('template')}
            />
            <p className="text-xs text-muted-foreground">{t('templateHelper')}</p>
            {!!errors.template && (
              <p className="text-xs text-destructive">{errors.template.message}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{t('preview', { value: preview })}</p>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty || isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t('saveChanges')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export function TransferTitleSettings() {
  const settings = useTransferTitleSettings();
  return <TransferTitleSettingsView {...settings} />;
}
