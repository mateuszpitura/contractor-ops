'use client';

import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';

/**
 * Returns a time-of-day greeting key.
 */
function getGreetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Personalized dashboard greeting with time-of-day awareness.
 * Shows "Good morning, Mateusz" with a brief contextual subtitle.
 */
export function DashboardGreeting() {
  const t = useTranslations('Dashboard.greeting');
  const session = authClient.useSession();
  const firstName = session.data?.user?.name?.split(' ')[0];

  if (!firstName) return null;

  const greetingKey = getGreetingKey();

  return (
    <div>
      <h1 className="gradient-text font-display text-3xl font-bold leading-tight tracking-tighter sm:text-4xl">
        {t(greetingKey, { name: firstName })}
      </h1>
      <p className="mt-1.5 text-base text-muted-foreground">{t('subtitle')}</p>
    </div>
  );
}
