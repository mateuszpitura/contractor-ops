import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function ContractorsRouteLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="contractors" ariaLabel={t('ariaLabel')} />;
}
