/**
 * Presentational login form.
 *
 * Submission, magic-link, redirect-sanitization, and Better Auth wiring
 * live in `hooks/use-login-form.ts`; this file owns the layout, copy,
 * and field rendering only.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useLoginForm } from './hooks/use-login-form.js';
import { SocialButtons } from './social-buttons.js';

export function LoginForm() {
  const t = useTranslations('Auth.login');
  const {
    fieldId,
    isLoading,
    magicLinkLoading,
    isMagicLinkSent,
    sentEmail,
    errors,
    register,
    onSubmit,
    onMagicLink,
    onBackFromMagicLink,
  } = useLoginForm();

  if (isMagicLinkSent) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="space-y-2">
            <h2 className="font-display text-[20px] font-semibold">{t('magicLinkSent')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('magicLinkSentBody')}{' '}
              <span className="font-medium text-foreground">{sentEmail}</span>
            </p>
          </div>
          <Button variant="ghost" className="mt-6" onClick={onBackFromMagicLink}>
            {t('magicLinkBack')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="conic-border rounded-xl">
      <Card className="glass-medium border-0 ring-0 shadow-2xl hover:ring-0 hover:shadow-2xl">
        <CardHeader className="space-y-1.5 text-center">
          <h1 className="gradient-text font-display text-2xl font-bold leading-[1.2] tracking-tight">
            {t('title')}
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
                autoComplete="username"
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
                autoComplete="current-password"
                disabled={isLoading}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? `${fieldId}-password-error` : undefined}
                {...register('password')}
              />
              {!!errors.password && (
                <p
                  id={`${fieldId}-password-error`}
                  role="alert"
                  className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('signingIn')}
                  </>
                ) : (
                  t('cta')
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={magicLinkLoading || isLoading}
                onClick={onMagicLink}>
                {magicLinkLoading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('magicLinkSending')}
                  </>
                ) : (
                  t('magicLinkCta')
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <SocialButtons />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('noAccount')}{' '}
            <Link to="../register" relative="path" className="text-primary hover:underline">
              {t('createOrgLink')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
