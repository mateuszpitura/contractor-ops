/**
 * Presentational invite-accept form.
 *
 * Sign-up + acceptInvitation chain lives in `hooks/use-invite-accept-form.ts`.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Loader2 } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useInviteAcceptForm } from './hooks/use-invite-accept-form.js';
import { SocialButtons } from './social-buttons.js';

interface InviteAcceptFormProps {
  token: string;
  email?: string;
  orgName?: string;
}

export function InviteAcceptForm({
  token,
  email = '',
  orgName = 'the organization',
}: InviteAcceptFormProps) {
  const t = useTranslations('Auth.invite');
  const { fieldId, isLoading, errors, register, onSubmit } = useInviteAcceptForm({ token, email });

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-tight">
          {t('title', { orgName })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-email`} className="text-[13px]">
              {t('emailLabel')}
            </Label>
            <Input
              id={`${fieldId}-email`}
              type="email"
              value={email}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-password`} className="text-[13px]">
              {t('passwordLabel')}
            </Label>
            <Input
              id={`${fieldId}-password`}
              type="password"
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              disabled={isLoading}
              {...register('password')}
            />
            {!!errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('joining')}
              </>
            ) : (
              t('cta')
            )}
          </Button>
        </form>

        <div className="mt-6">
          <SocialButtons />
        </div>
      </CardContent>
    </Card>
  );
}
