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
import { useState } from 'react';
import type { useCarrierCredentialForm } from './hooks/use-carrier-credential-form.js';

interface CarrierCredentialFormBaseProps {
  carrier: 'dpd' | 'ups';
  carrierLabel: string;
}

export type CarrierCredentialFormProps = CarrierCredentialFormBaseProps &
  ReturnType<typeof useCarrierCredentialForm>;

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

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="pe-10"
        />
        <button
          type="button"
          className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Hide' : 'Show'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function CarrierCredentialForm({
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
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={v => setDpdCreds(prev => ({ ...prev, username: v }))}
            />
            <PasswordField
              label={t('password')}
              value={dpdCreds.password}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={v => setDpdCreds(prev => ({ ...prev, password: v }))}
            />
            <PasswordField
              label={t('fid')}
              value={dpdCreds.fid}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={v => setDpdCreds(prev => ({ ...prev, fid: v }))}
            />
            <label htmlFor={`${id}-dpd-sandbox`} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id={`${id}-dpd-sandbox`}
                checked={dpdCreds.sandbox}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                onCheckedChange={checked =>
                  setDpdCreds(prev => ({
                    ...prev,
                    sandbox: checked === true,
                  }))
                }
              />
              <span className="text-sm">{t('sandbox')}</span>
            </label>
          </>
        ) : (
          <>
            <PasswordField
              label={t('clientId')}
              value={upsCreds.clientId}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={v => setUpsCreds(prev => ({ ...prev, clientId: v }))}
            />
            <PasswordField
              label={t('clientSecret')}
              value={upsCreds.clientSecret}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={v => setUpsCreds(prev => ({ ...prev, clientSecret: v }))}
            />
            <PasswordField
              label={t('accountNumber')}
              value={upsCreds.accountNumber}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={v => setUpsCreds(prev => ({ ...prev, accountNumber: v }))}
            />
            <label htmlFor={`${id}-ups-sandbox`} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id={`${id}-ups-sandbox`}
                checked={upsCreds.sandbox}
                // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                onCheckedChange={checked =>
                  setUpsCreds(prev => ({
                    ...prev,
                    sandbox: checked === true,
                  }))
                }
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
