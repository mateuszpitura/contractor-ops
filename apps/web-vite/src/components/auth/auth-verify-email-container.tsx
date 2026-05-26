import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AuthLayout } from '../layout/auth-layout.js';

// Decision: static post-signup verification screen — no domain hook layer
// (no mutation, no query), so the container composes the `AuthLayout`
// chrome around inline i18n copy and a link back to login. Page shell
// (`src/pages/verify-email.tsx`) only mounts this container; i18n
// (`useTranslations`) and the localized `Link` must live in the container,
// not the page, per the architecture rule.
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
