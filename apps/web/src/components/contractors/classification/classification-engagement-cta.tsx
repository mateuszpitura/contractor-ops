'use client';

// ---------------------------------------------------------------------------
// Engagement-level CTA — Phase 58 Plan 05 Task 2.
// ---------------------------------------------------------------------------
// Renders a single primary button that navigates the user to the wizard route
// for a given engagement. The wizard page itself handles createDraft
// idempotently, so a plain Link-wrapped button is enough.

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

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
