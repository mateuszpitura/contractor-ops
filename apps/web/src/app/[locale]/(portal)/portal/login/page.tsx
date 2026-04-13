'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Schema factory
// ---------------------------------------------------------------------------

function createLoginSchema(t: ReturnType<typeof useTranslations<'Portal'>>) {
  return z.object({
    email: z.string().email(t('login.errors.invalidEmail')),
  });
}

type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal login page.
 *
 * Centered card with email input and "Send Magic Link" button.
 * After successful submission, shows "Check your inbox" confirmation state.
 *
 * Per UI-SPEC D-16:
 * - Centered card max-w-[400px] on muted background
 * - "Contractor Portal" heading at text-[28px]
 * - "Enter your email to receive a sign-in link" subheading
 * - Link to admin login below form
 */
export default function PortalLoginPage() {
  const t = useTranslations('Portal');
  const [sent, setSent] = useState(false);
  const resetSent = useCallback(() => setSent(false), []);

  const loginSchema = createLoginSchema(t);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  });

  const requestMagicLink = useMutation(trpc.portal.requestMagicLink.mutationOptions());

  const onSubmit = async (values: LoginValues) => {
    try {
      await requestMagicLink.mutateAsync({ email: values.email });
      setSent(true);
    } catch {
      toast.error(t('login.errors.somethingWentWrong'));
    }
  };

  // ----- Magic link sent confirmation state -----
  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-[400px]">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">{t('login.checkInbox')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('login.linkSentTo', { email: getValues('email') })}
            </p>
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            <p className="mt-4 text-sm text-muted-foreground">{t('login.didntReceive')}</p>
            <Button variant="ghost" className="mt-4" onClick={resetSent}>
              {t('login.tryAnother')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Login form state -----
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="space-y-1 text-center">
          <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight">
            {t('login.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px]">
                {t('login.emailLabel')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                disabled={requestMagicLink.isPending}
                {...register('email')}
              />
              {!!errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={requestMagicLink.isPending}>
              {requestMagicLink.isPending ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('login.sending')}
                </>
              ) : (
                t('login.sendMagicLink')
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('login.adminPrompt')}{' '}
            <a href="/login" className="text-primary hover:underline">
              {t('login.signInHere')}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
