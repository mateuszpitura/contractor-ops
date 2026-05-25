/**
 * Registration-form domain hook — drives the sign-up + org-create flow
 * with Turnstile gating (F-SEC-22 token forward).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import type { Ref } from 'react';
import { useCallback, useId, useRef, useState } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { getClientEnv } from '../../../env.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useAuth } from '../../../providers/auth-provider.js';
import { Sentry } from '../../../sentry.js';

const TURNSTILE_SITE_KEY = getClientEnv().VITE_TURNSTILE_SITE_KEY;

export interface RegisterFormValues {
  orgName: string;
  email: string;
  password: string;
}

export interface RegisterFormFieldError {
  message?: string;
}

export interface RegisterFormProps {
  fieldId: string;
  isLoading: boolean;
  turnstileSiteKey: string | undefined;
  turnstileSubmitDisabled: boolean;
  turnstileRef: Ref<never>;
  errors: {
    orgName?: RegisterFormFieldError;
    email?: RegisterFormFieldError;
    password?: RegisterFormFieldError;
  };
  register: UseFormRegister<RegisterFormValues>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onTurnstileSuccess: (token: string) => void;
  onTurnstileExpire: () => void;
  onTurnstileError: () => void;
}

export function useRegisterForm(): RegisterFormProps {
  const tv = useTranslations('Validation');
  const tc = useTranslations('Common');
  const tToast = useTranslations('Auth.toast');
  const auth = useAuth();
  const navigate = useNavigate();
  const fieldId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<{ reset: () => void } | null>(null);

  const registerSchema = z.object({
    orgName: z.string().min(2, tv('orgNameTooShort')),
    email: z.string().email(tv('invalidEmail')),
    password: z.string().min(8, tv('passwordTooShort')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { orgName: '', email: '', password: '' },
  });

  const onValid = useCallback(
    async (values: RegisterFormValues): Promise<void> => {
      if (TURNSTILE_SITE_KEY && !turnstileToken) {
        toast.error(tc('verificationRequired'));
        return;
      }
      setIsLoading(true);
      try {
        const { error: signUpError } = await auth.signUp.email({
          email: values.email,
          password: values.password,
          name: values.email.split('@')[0] ?? values.email,
          // @ts-expect-error — Better Auth types don't model the F-SEC-22 field
          'cf-turnstile-response': turnstileToken,
        });
        if (signUpError) {
          toast.error(signUpError.message ?? tToast('createAccountFailed'));
          turnstileRef.current?.reset();
          setTurnstileToken('');
          setIsLoading(false);
          return;
        }

        const { error: orgError } = await auth.organization.create({
          name: values.orgName,
          slug: values.orgName.toLowerCase().replace(/\s+/g, '-'),
        });
        if (orgError) {
          toast.error(orgError.message ?? tToast('createOrgFailed'));
          setIsLoading(false);
          return;
        }

        navigate('/', { replace: true });
      } catch (err) {
        Sentry.captureException(err, { tags: { 'auth.flow': 'register' } });
        toast.error(tc('networkError'));
        setIsLoading(false);
      }
    },
    [auth, navigate, tToast, tc, turnstileToken],
  );

  const onSubmit = handleSubmit(onValid);

  const onTurnstileSuccess = useCallback((token: string) => setTurnstileToken(token), []);
  const onTurnstileExpire = useCallback(() => setTurnstileToken(''), []);
  const onTurnstileError = useCallback(() => setTurnstileToken(''), []);

  return {
    fieldId,
    isLoading,
    turnstileSiteKey: TURNSTILE_SITE_KEY,
    turnstileSubmitDisabled: isLoading || (!!TURNSTILE_SITE_KEY && !turnstileToken),
    turnstileRef: turnstileRef as unknown as Ref<never>,
    errors,
    register,
    onSubmit,
    onTurnstileSuccess,
    onTurnstileExpire,
    onTurnstileError,
  };
}
