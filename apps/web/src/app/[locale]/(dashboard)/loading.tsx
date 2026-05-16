import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function DashboardLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="dashboard" ariaLabel={t('ariaLabel')} />;
}
