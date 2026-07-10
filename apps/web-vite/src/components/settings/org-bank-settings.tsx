import { QueryErrorPanel } from '@contractor-ops/ui';
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

import type { useOrgBankSettings as UseOrgBankSettings } from './hooks/use-org-bank-settings.js';
import { useOrgBankSettings } from './hooks/use-org-bank-settings.js';

export type OrgBankSettingsProps = ReturnType<typeof UseOrgBankSettings>;

export function OrgBankSettingsView({
  id,
  t,
  register,
  handleSubmit,
  isDirty,
  errors,
  isPending,
  isLoading,
  isError,
  onRetry,
}: OrgBankSettingsProps) {
  if (isLoading) {
    return null;
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('orgBankHeading')}</CardTitle>
          <CardDescription>{t('orgBankDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <QueryErrorPanel
            message={t('orgBankLoadError')}
            retryLabel={t('orgBankRetry')}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{t('orgBankHeading')}</CardTitle>
          <CardDescription>{t('orgBankDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={`${id}-org-iban`} className="text-sm font-medium">
              {t('orgBankIbanLabel')}
            </label>
            <Input
              id={`${id}-org-iban`}
              placeholder={t('orgBankIbanPlaceholder')}
              autoComplete="off"
              {...register('iban')}
            />
            {!!errors.iban && <p className="text-xs text-destructive">{errors.iban.message}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-org-bic`} className="text-sm font-medium">
              {t('orgBankBicLabel')}
            </label>
            <Input
              id={`${id}-org-bic`}
              placeholder={t('orgBankBicPlaceholder')}
              autoComplete="off"
              {...register('bic')}
            />
            {!!errors.bic && <p className="text-xs text-destructive">{errors.bic.message}</p>}
          </div>
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

export function OrgBankSettings() {
  const settings = useOrgBankSettings();
  return <OrgBankSettingsView {...settings} />;
}
