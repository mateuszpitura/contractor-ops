import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useLocale } from '../../i18n/navigation.js';
import { PageLoadingSpinner } from '../shared/page-loading-spinner.js';
import { useClassificationRouteGuard } from './hooks/use-classification-route-guard.js';

interface ClassificationGuardProps {
  children: ReactNode;
}

export function ClassificationGuard({ children }: ClassificationGuardProps) {
  const locale = useLocale();
  const { isPending, classificationEnabled } = useClassificationRouteGuard();

  if (isPending) {
    return <PageLoadingSpinner />;
  }

  if (!classificationEnabled) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  return children;
}
