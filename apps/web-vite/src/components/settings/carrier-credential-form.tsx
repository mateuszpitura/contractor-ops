import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Eye, EyeOff, Loader2, Save, Truck, Wifi } from 'lucide-react';
import type * as React from 'react';
import { useCallback, useState } from 'react';
import {
  useCarrierCredentialForm,
  type useCarrierCredentialForm as UseCarrierCredentialForm,
} from './hooks/use-carrier-credential-form.js';

interface CarrierCredentialFormBaseProps {
  carrier: 'dpd' | 'ups';
  carrierLabel: string;
}

export type CarrierCredentialFormProps = CarrierCredentialFormBaseProps &
  ReturnType<typeof UseCarrierCredentialForm>;

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange],
  );
  const toggleVisible = useCallback(() => setVisible(v => !v), []);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pe-10"
        />
        <button
          type="button"
          className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={toggleVisible}
          aria-label={visible ? 'Hide' : 'Show'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function CarrierCredentialFormView({
  carrier,
  carrierLabel,
  id,
  t,
  isConnected,
  dpdCreds,
  setDpdCreds,
  upsCreds,
  setUpsCreds,
  handleSave,
  handleTest,
  isPending,
  isTestPending,
  isSavePending,
}: CarrierCredentialFormProps) {
  const handleDpdUsername = useCallback(
    (v: string) => setDpdCreds(prev => ({ ...prev, username: v })),
    [setDpdCreds],
  );
  const handleDpdPassword = useCallback(
    (v: string) => setDpdCreds(prev => ({ ...prev, password: v })),
    [setDpdCreds],
  );
  const handleDpdFid = useCallback(
    (v: string) => setDpdCreds(prev => ({ ...prev, fid: v })),
    [setDpdCreds],
  );
  const handleDpdSandbox = useCallback(
    (checked: boolean | 'indeterminate') =>
      setDpdCreds(prev => ({ ...prev, sandbox: checked === true })),
    [setDpdCreds],
  );
  const handleUpsClientId = useCallback(
    (v: string) => setUpsCreds(prev => ({ ...prev, clientId: v })),
    [setUpsCreds],
  );
  const handleUpsClientSecret = useCallback(
    (v: string) => setUpsCreds(prev => ({ ...prev, clientSecret: v })),
    [setUpsCreds],
  );
  const handleUpsAccount = useCallback(
    (v: string) => setUpsCreds(prev => ({ ...prev, accountNumber: v })),
    [setUpsCreds],
  );
  const handleUpsSandbox = useCallback(
    (checked: boolean | 'indeterminate') =>
      setUpsCreds(prev => ({ ...prev, sandbox: checked === true })),
    [setUpsCreds],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Truck className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <CardTitle>{carrierLabel}</CardTitle>
          </div>
          <Badge variant={isConnected ? 'success' : 'secondary'}>
            {isConnected ? t('connected') : t('notConfigured')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {carrier === 'dpd' ? (
          <>
            <PasswordField
              label={t('username')}
              value={dpdCreds.username}
              onChange={handleDpdUsername}
            />
            <PasswordField
              label={t('password')}
              value={dpdCreds.password}
              onChange={handleDpdPassword}
            />
            <PasswordField label={t('fid')} value={dpdCreds.fid} onChange={handleDpdFid} />
            <label htmlFor={`${id}-dpd-sandbox`} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id={`${id}-dpd-sandbox`}
                checked={dpdCreds.sandbox}
                onCheckedChange={handleDpdSandbox}
              />
              <span className="text-sm">{t('sandbox')}</span>
            </label>
          </>
        ) : (
          <>
            <PasswordField
              label={t('clientId')}
              value={upsCreds.clientId}
              onChange={handleUpsClientId}
            />
            <PasswordField
              label={t('clientSecret')}
              value={upsCreds.clientSecret}
              onChange={handleUpsClientSecret}
            />
            <PasswordField
              label={t('accountNumber')}
              value={upsCreds.accountNumber}
              onChange={handleUpsAccount}
            />
            <label htmlFor={`${id}-ups-sandbox`} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id={`${id}-ups-sandbox`}
                checked={upsCreds.sandbox}
                onCheckedChange={handleUpsSandbox}
              />
              <span className="text-sm">{t('sandbox')}</span>
            </label>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={isPending}>
            {isTestPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wifi className="h-3.5 w-3.5" />
            )}
            {t('testConnection')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isSavePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {t('saveCredentials')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CarrierCredentialForm({
  carrier,
  carrierLabel,
}: Pick<CarrierCredentialFormBaseProps, 'carrier' | 'carrierLabel'>) {
  const form = useCarrierCredentialForm(carrier);
  return <CarrierCredentialFormView carrierLabel={carrierLabel} {...form} />;
}
