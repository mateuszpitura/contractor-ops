'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { useTranslations } from 'next-intl';

export type OrgDefinitionSource = 'MANUAL' | 'JIRA' | 'LINEAR';

interface SourceBadgeProps {
  source: OrgDefinitionSource;
}

/** Visual marker for the provenance of a Team / Project row. */
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
