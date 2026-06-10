/**
 * Login-form domain hook — drives the email+password and magic-link flows.
 *
 * Owns: react-hook-form wiring, redirect-target sanitization, Better Auth
 * mutations (`signIn.email`, `signIn.magicLink`), Sentry capture, toasts.
 * The matching `<LoginForm />` stays presentational.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useId, useState } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useAuth } from '../../../providers/auth-provider.js';
import { Sentry } from '../../../sentry.js';

const REDIRECT_FALLBACK = '/';

function sanitizeRedirectTo(raw: string): string {
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes(':')) {
    return REDIRECT_FALLBACK;
  }
  return raw;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginFormFieldError {
  message?: string;
}

export interface LoginFormProps {
  fieldId: string;
  isLoading: boolean;
  magicLinkLoading: boolean;
  isMagicLinkSent: boolean;
  sentEmail: string;
  errors: { email?: LoginFormFieldError; password?: LoginFormFieldError };
  register: UseFormRegister<LoginFormValues>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onMagicLink: () => void;
  onBackFromMagicLink: () => void;
}

export function useLoginForm(): LoginFormProps {
  const tv = useTranslations('Validation');
  const tc = useTranslations('Common');
  const tToast = useTranslations('Auth.toast');
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = sanitizeRedirectTo(searchParams.get('redirectTo') ?? REDIRECT_FALLBACK);
  const fieldId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(tv('invalidEmail')),
    password: z.string().min(1, tv('required')),
  });

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onValid = useCallback(
    async (values: LoginFormValues): Promise<void> => {
      setIsLoading(true);
      try {
        const { error } = await auth.signIn.email({
          email: values.email,
          password: values.password,
        });
        if (error) {
          toast.error(error.message ?? tToast('invalidCredentials'));
          setIsLoading(false);
          return;
        }
        navigate(redirectTo, { replace: true });
      } catch (err) {
        // Surface flow failures even when navigate succeeds.
        Sentry.captureException(err, { tags: { 'auth.flow': 'login.password' } });
        toast.error(tc('networkError'));
        setIsLoading(false);
      }
    },
    [auth, navigate, redirectTo, tToast, tc],
  );

  const onSubmit = handleSubmit(onValid);

  const onMagicLink = useCallback(async () => {
    const email = getValues('email');
    if (!(email && z.string().email().safeParse(email).success)) {
      toast.error(tv('invalidEmail'));
      return;
    }
    setMagicLinkLoading(true);
    try {
      const { error } = await auth.signIn.magicLink({ email, callbackURL: redirectTo });
      if (error) {
        toast.error(error.message ?? tToast('magicLinkFailed'));
        setMagicLinkLoading(false);
        return;
      }
      setIsMagicLinkSent(true);
    } catch (err) {
      Sentry.captureException(err, { tags: { 'auth.flow': 'login.magic_link' } });
      toast.error(tc('networkError'));
    } finally {
      setMagicLinkLoading(false);
    }
  }, [auth, getValues, redirectTo, tToast, tc, tv]);

  const onBackFromMagicLink = useCallback(() => setIsMagicLinkSent(false), []);

  return {
    fieldId,
    isLoading,
    magicLinkLoading,
    isMagicLinkSent,
    sentEmail: getValues('email'),
    errors,
    register,
    onSubmit,
    onMagicLink,
    onBackFromMagicLink,
  };
}
