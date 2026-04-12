'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { SocialButtons } from '@/components/auth/social-buttons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';

interface InviteAcceptFormProps {
  token: string;
  email?: string;
  orgName?: string;
}

/**
 * Invite acceptance form.
 * Pre-filled email from invite. User creates account or uses social auth,
 * then accepts the organization invitation.
 */
export function InviteAcceptForm({
  token,
  email = '',
  orgName = 'the organization',
}: InviteAcceptFormProps) {
  const t = useTranslations('Auth.invite');
  const tv = useTranslations('Validation');
  const tc = useTranslations('Common');
  const tToast = useTranslations('Auth.toast');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const inviteSchema = z.object({
    password: z.string().min(8, tv('passwordTooShort')),
  });

  type InviteValues = z.infer<typeof inviteSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = async (values: InviteValues) => {
    setIsLoading(true);
    try {
      // Step 1: Create user account
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password: values.password,
        name: email.split('@')[0],
      });

      if (signUpError) {
        toast.error(signUpError.message ?? tToast('createAccountFailed'));
        setIsLoading(false);
        return;
      }

      // Step 2: Accept invitation
      const { error: acceptError } = await authClient.organization.acceptInvitation({
        invitationId: token,
      });

      if (acceptError) {
        toast.error(acceptError.message ?? tToast('acceptInviteFailed'));
        setIsLoading(false);
        return;
      }

      router.push('/');
    } catch {
      toast.error(tc('networkError'));
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-tight">
          {t('title', { orgName })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px]">
              {t('emailLabel')}
            </Label>
            <Input id="email" type="email" value={email} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[13px]">
              {t('passwordLabel')}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              disabled={isLoading}
              {...register('password')}
            />
            {errors.password && (
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
