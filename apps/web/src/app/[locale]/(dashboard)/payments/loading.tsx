import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function PaymentsRouteLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="payments" ariaLabel={t('ariaLabel')} />;
}
