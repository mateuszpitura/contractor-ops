/**
 * Org definition source badge. Step 11 codemod port from
 * apps/web/src/components/organization/shared/source-badge.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js`
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';

import { useTranslations } from '../../../i18n/useTranslations.js';

export type OrgDefinitionSource = 'MANUAL' | 'JIRA' | 'LINEAR';

interface SourceBadgeProps {
  source: OrgDefinitionSource;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const t = useTranslations('Organization');
  if (source === 'MANUAL') {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {t('sourceManual')}
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className={source === 'JIRA' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'}>
      {source === 'JIRA' ? t('sourceJira') : t('sourceLinear')}
    </Badge>
  );
}
