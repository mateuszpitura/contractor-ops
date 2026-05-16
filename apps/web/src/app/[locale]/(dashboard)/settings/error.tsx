'use client';

import { useTranslations } from 'next-intl';
import { RouteError } from '@/components/boundaries/route-error';

export default function SettingsRouteError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('boundaries.error');
  return (
    <RouteError
      {...props}
      routeName="settings"
      title={t('title')}
      description={t('description')}
      reloadLabel={t('reload')}
    />
  );
}
