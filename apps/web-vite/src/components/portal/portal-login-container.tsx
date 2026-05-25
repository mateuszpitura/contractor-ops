import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail } from 'lucide-react';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Link } from '../../i18n/navigation.js';
import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalLogin } from './hooks/use-portal-login.js';

function createLoginSchema(t: LooseTranslator) {
  return z.object({
    email: z.string().email(t('login.errors.invalidEmail')),
  });
}

type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;

export function PortalLoginContainer() {
  const t = useTranslations('Portal');
  const { isPending, sent, sentEmail, submitEmail, resetSent } = usePortalLogin();
  const id = useId();

  const loginSchema = createLoginSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  });

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
              {t('login.linkSentTo', { email: sentEmail })}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">{t('login.didntReceive')}</p>
            <Button variant="ghost" className="mt-4" onClick={resetSent}>
              {t('login.tryAnother')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <form
            onSubmit={handleSubmit(values => {
              void submitEmail(values.email);
            })}
            className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`} className="text-[13px]">
                {t('login.emailLabel')}
              </Label>
              <Input
                id={`${id}-email`}
                type="email"
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                disabled={isPending}
                {...register('email')}
              />
              {!!errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
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
            <Link href="/login" className="text-primary underline underline-offset-2">
              {t('login.signInHere')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
