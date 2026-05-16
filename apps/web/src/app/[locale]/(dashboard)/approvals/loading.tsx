import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function ApprovalsRouteLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="approvals" ariaLabel={t('ariaLabel')} />;
}
