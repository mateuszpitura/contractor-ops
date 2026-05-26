import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AuthLayout } from '../layout/auth-layout.js';

// Decision: static i18n — renders the post-signup verification copy under
// AuthLayout with a back-to-login link. No hook layer beyond useTranslations.
export function AuthVerifyEmailContainer() {
  const t = useTranslations('Auth.verifyEmail');

  return (
    <AuthLayout>
      <main aria-labelledby="verify-email-heading" className="text-center">
        <section className="space-y-4">
          <h1 id="verify-email-heading" className="font-display text-2xl font-semibold">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('message')}</p>
          <p className="text-sm text-muted-foreground">{t('redirect')}</p>
          <p>
            <Link href="/login" className="text-primary hover:underline">
              {t('backToSignIn')}
            </Link>
          </p>
        </section>
      </main>
    </AuthLayout>
  );
}
