import { AuthLayout } from '../../components/layout/auth-layout.js';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

export default function VerifyEmailPage() {
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
