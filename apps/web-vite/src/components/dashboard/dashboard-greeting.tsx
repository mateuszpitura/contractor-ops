/**
 * Personalized dashboard greeting with time-of-day awareness. Step 11
 * codemod port from apps/web/src/components/dashboard/dashboard-greeting.tsx:
 *   - `next-intl`              → `../../i18n/useTranslations.js`
 *   - `@/lib/auth-client`      → `../../providers/auth-provider.js#useAuth`
 */

import { useTranslations } from '../../i18n/useTranslations.js';
import { useAuth } from '../../providers/auth-provider.js';

function getGreetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function DashboardGreeting() {
  const t = useTranslations('Dashboard.greeting');
  const auth = useAuth();
  const session = auth.useSession();
  const firstName = session.data?.user?.name?.split(' ')[0];

  if (!firstName) return null;

  const greetingKey = getGreetingKey();

  return (
    <div>
      <h1 className="gradient-text font-display text-3xl font-bold leading-tight tracking-tighter text-balance sm:text-4xl">
        {t(greetingKey, { name: firstName })}
      </h1>
      <p className="mt-1.5 text-base text-muted-foreground">{t('subtitle')}</p>
    </div>
  );
}
