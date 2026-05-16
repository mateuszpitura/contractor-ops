import { getTranslations } from 'next-intl/server';
import { RouteLoading } from '@/components/boundaries/route-loading';

export default async function InvoicesRouteLoading() {
  const t = await getTranslations('boundaries.loading');
  return <RouteLoading routeName="invoices" ariaLabel={t('ariaLabel')} />;
}
