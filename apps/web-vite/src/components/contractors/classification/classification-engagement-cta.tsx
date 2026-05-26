// Phase 58 Plan 05 Task 2 — Engagement-level CTA.
// Step 11 codemod port from apps/web/src/components/contractors/classification/classification-engagement-cta.tsx.

import { Button } from '@contractor-ops/ui/components/shadcn/button';

import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

export interface ClassificationEngagementCtaProps {
  readonly contractorId: string;
  readonly engagementId: string;
  readonly variant?: 'default' | 'outline' | 'ghost';
  readonly size?: 'default' | 'sm';
  readonly className?: string;
  readonly label?: string;
  readonly dataTestId?: string;
}

export function ClassificationEngagementCta(props: ClassificationEngagementCtaProps) {
  const { contractorId, engagementId, variant = 'default', size = 'default', className } = props;
  const t = useTranslations('Classification');
  const label = props.label ?? t('start');

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      data-testid={props.dataTestId ?? 'classification-engagement-cta'}
      render={
        <Link href={`/contractors/${contractorId}/engagements/${engagementId}/classification`} />
      }>
      {label}
    </Button>
  );
}
