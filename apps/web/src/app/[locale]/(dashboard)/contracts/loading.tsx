import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function ContractsRouteLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="contracts" ariaLabel={t('ariaLabel')} />;
}
