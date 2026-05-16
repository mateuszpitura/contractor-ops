import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function EquipmentRouteLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="equipment" ariaLabel={t('ariaLabel')} />;
}
