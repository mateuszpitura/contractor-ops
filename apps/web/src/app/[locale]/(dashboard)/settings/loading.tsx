import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function SettingsRouteLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="settings" ariaLabel={t('ariaLabel')} />;
}
