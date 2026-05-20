'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile } from '@marsidev/react-turnstile';
import * as Sentry from '@sentry/nextjs';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { SocialButtons } from '@/components/auth/social-buttons';
import { Link, useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';

/**
 * F-SEC-22 — Cloudflare Turnstile site key. Sourced from the public env
 * (NEXT_PUBLIC_ prefix) so the bundler inlines it. When unset (local dev
 * without Turnstile configured), the widget is omitted and the server-side
 * verifier short-circuits to "ok" in non-production environments.
 */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Registration form with org name, email, password.
 * Creates account via authClient.signUp.email(), then creates organization,
 * and redirects to email verification.
 */
export function RegisterForm() {
  const t = useTranslations('Auth.register');
  const tv = useTranslations('Validation');
  const tc = useTranslations('Common');
  const tToast = useTranslations('Auth.toast');
  const router = useRouter();
  const id = useId();
  const [isLoading, setIsLoading] = useState(false);
  // F-SEC-22 — Turnstile token from the widget. Required for signup when
  // NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured; the server-side verifier
  // (packages/auth/src/turnstile.ts) rejects the mutation without it.
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<{ reset: () => void } | null>(null);

  const registerSchema = z.object({
    orgName: z.string().min(2, tv('orgNameTooShort')),
    email: z.string().email(tv('invalidEmail')),
    password: z.string().min(8, tv('passwordTooShort')),
  });

  type RegisterValues = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      orgName: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: RegisterValues) => {
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error(tc('verificationRequired'));
      return;
    }
    setIsLoading(true);
    try {
      // Step 1: Create user account. The Turnstile token is forwarded as
      // an extra body field; Better Auth's `before` hook in
      // packages/auth/src/config.ts verifies it server-side via Cloudflare
      // siteverify before the credentials are processed.
      const { error: signUpError } = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.email.split('@')[0],
        // Custom field consumed by the auth `before` hook (F-SEC-22).
        // @ts-expect-error — Better Auth types don't model the extra field
        'cf-turnstile-response': turnstileToken,
      });

      if (signUpError) {
        toast.error(signUpError.message ?? tToast('createAccountFailed'));
        // Reset the widget so the next attempt gets a fresh challenge.
        turnstileRef.current?.reset();
        setTurnstileToken('');
        setIsLoading(false);
        return;
      }

      // Step 2: Create organization
      const { error: orgError } = await authClient.organization.create({
        name: values.orgName,
        slug: values.orgName.toLowerCase().replace(/\s+/g, '-'),
      });

      if (orgError) {
        toast.error(orgError.message ?? tToast('createOrgFailed'));
        setIsLoading(false);
        return;
      }

      router.push('/');
    } catch (err) {
      // F-OBS-13 — capture so registration failures surface in Sentry instead
      // of being masked as a generic networkError toast.
      Sentry.captureException(err, { tags: { 'auth.flow': 'register' } });
      toast.error(tc('networkError'));
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-tight">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-orgName`} className="text-[13px]">
              {t('orgNameLabel')}
            </Label>
            <Input
              id={`${id}-orgName`}
              placeholder={t('orgNamePlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.orgName}
              aria-describedby={errors.orgName ? `${id}-orgName-error` : undefined}
              {...register('orgName')}
            />
            {!!errors.orgName && (
              <p id={`${id}-orgName-error`} role="alert" className="text-sm text-destructive">
                {errors.orgName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-email`} className="text-[13px]">
              {t('emailLabel')}
            </Label>
            <Input
              id={`${id}-email`}
              type="email"
              placeholder={t('emailPlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? `${id}-email-error` : undefined}
              {...register('email')}
            />
            {!!errors.email && (
              <p id={`${id}-email-error`} role="alert" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-password`} className="text-[13px]">
              {t('passwordLabel')}
            </Label>
            <Input
              id={`${id}-password`}
              type="password"
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? `${id}-password-error` : undefined}
              {...register('password')}
            />
            {!!errors.password && (
              <p id={`${id}-password-error`} role="alert" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {TURNSTILE_SITE_KEY && (
            <div className="flex justify-center">
              {/* F-SEC-22 — Cloudflare Turnstile bot challenge. The
                  invisible/managed mode is the default; the widget calls
                  onSuccess when the token is ready. */}
              <Turnstile
                ref={turnstileRef as unknown as React.Ref<never>}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={token => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
                options={{ theme: 'auto' }}
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}>
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
          <Link href="/login" className="text-primary hover:underline">
            {t('signInLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
