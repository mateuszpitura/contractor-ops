import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function WorkflowsRouteLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="workflows" ariaLabel={t('ariaLabel')} />;
}
