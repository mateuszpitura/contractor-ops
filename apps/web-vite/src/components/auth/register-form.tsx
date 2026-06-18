/**
 * Presentational registration form.
 *
 * Sign-up + org-create chain and Turnstile state live in
 * `hooks/use-register-form.ts`; this file owns layout and field rendering.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Turnstile } from '@marsidev/react-turnstile';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useRegisterForm } from './hooks/use-register-form.js';
import { SocialButtons } from './social-buttons.js';

export function RegisterForm() {
  const t = useTranslations('Auth.register');
  const {
    fieldId,
    isLoading,
    turnstileSiteKey,
    turnstileSubmitDisabled,
    turnstileRef,
    errors,
    register,
    onSubmit,
    onTurnstileSuccess,
    onTurnstileExpire,
    onTurnstileError,
  } = useRegisterForm();

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-tight">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-orgName`} className="text-[13px]">
              {t('orgNameLabel')}
            </Label>
            <Input
              id={`${fieldId}-orgName`}
              placeholder={t('orgNamePlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.orgName}
              aria-describedby={errors.orgName ? `${fieldId}-orgName-error` : undefined}
              {...register('orgName')}
            />
            {!!errors.orgName && (
              <p id={`${fieldId}-orgName-error`} role="alert" className="text-sm text-destructive">
                {errors.orgName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-email`} className="text-[13px]">
              {t('emailLabel')}
            </Label>
            <Input
              id={`${fieldId}-email`}
              type="email"
              placeholder={t('emailPlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? `${fieldId}-email-error` : undefined}
              {...register('email')}
            />
            {!!errors.email && (
              <p id={`${fieldId}-email-error`} role="alert" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
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
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? `${fieldId}-password-error` : undefined}
              {...register('password')}
            />
            {!!errors.password && (
              <p id={`${fieldId}-password-error`} role="alert" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {turnstileSiteKey ? (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={turnstileSiteKey}
                onSuccess={onTurnstileSuccess}
                onExpire={onTurnstileExpire}
                onError={onTurnstileError}
                options={{ theme: 'auto' }}
              />
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={turnstileSubmitDisabled}>
            {isLoading ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('creating')}
              </>
            ) : (
              t('cta')
            )}
          </Button>
        </form>

        <div className="mt-6">
          <SocialButtons />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t('hasAccount')}{' '}
          <Link to="../login" relative="path" className="text-primary hover:underline">
            {t('signInLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
