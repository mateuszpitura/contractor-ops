/**
 * Invite-accept domain hook — sign-up against the invite email then accept
 * the organization invitation by token.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useId, useState } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useAuth } from '../../../providers/auth-provider.js';
import { Sentry } from '../../../sentry.js';

export interface InviteAcceptFormValues {
  password: string;
}

export interface InviteAcceptFormFieldError {
  message?: string;
}

export interface UseInviteAcceptFormArgs {
  token: string;
  email: string;
}

export interface InviteAcceptFormProps {
  fieldId: string;
  isLoading: boolean;
  errors: { password?: InviteAcceptFormFieldError };
  register: UseFormRegister<InviteAcceptFormValues>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function useInviteAcceptForm({
  token,
  email,
}: UseInviteAcceptFormArgs): InviteAcceptFormProps {
  const tv = useTranslations('Validation');
  const tc = useTranslations('Common');
  const tToast = useTranslations('Auth.toast');
  const auth = useAuth();
  const navigate = useNavigate();
  const fieldId = useId();
  const [isLoading, setIsLoading] = useState(false);

  const inviteSchema = z.object({
    password: z.string().min(8, tv('passwordTooShort')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteAcceptFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { password: '' },
  });

  const onValid = useCallback(
    async (values: InviteAcceptFormValues): Promise<void> => {
      setIsLoading(true);
      try {
        const { error: signUpError } = await auth.signUp.email({
          email,
          password: values.password,
          name: email.split('@')[0] ?? email,
        });
        if (signUpError) {
          toast.error(signUpError.message ?? tToast('createAccountFailed'));
          setIsLoading(false);
          return;
        }

        const { error: acceptError } = await auth.organization.acceptInvitation({
          invitationId: token,
        });
        if (acceptError) {
          toast.error(acceptError.message ?? tToast('acceptInviteFailed'));
          setIsLoading(false);
          return;
        }

        navigate('/', { replace: true });
      } catch (err) {
        Sentry.captureException(err, { tags: { 'auth.flow': 'invite_accept' } });
        toast.error(tc('networkError'));
        setIsLoading(false);
      }
    },
    [auth, email, navigate, tToast, tc, token],
  );

  const onSubmit = handleSubmit(onValid);

  return { fieldId, isLoading, errors, register, onSubmit };
}
