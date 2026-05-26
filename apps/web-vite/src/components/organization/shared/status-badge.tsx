/**
 * Org definition status badge. Step 11 codemod port from
 * apps/web/src/components/organization/shared/status-badge.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js`
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';

import { useTranslations } from '../../../i18n/useTranslations.js';

export type OrgDefinitionStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

interface StatusBadgeProps {
  status: OrgDefinitionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const t = useTranslations('Organization');
  if (status === 'ACTIVE') {
    return <Badge variant="default">{t('active')}</Badge>;
  }
  if (status === 'INACTIVE') {
    return <Badge variant="secondary">{t('inactive')}</Badge>;
  }
  return <Badge variant="outline">{t('archived')}</Badge>;
}
