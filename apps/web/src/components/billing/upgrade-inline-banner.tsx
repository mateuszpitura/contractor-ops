'use client';

import { Gem, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpgradeInlineBannerProps {
  featureName: string;
  requiredTier: 'Pro' | 'Enterprise';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpgradeInlineBanner({ featureName, requiredTier }: UpgradeInlineBannerProps) {
  const t = useTranslations('Billing.gate');

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 border-l-4 border-primary bg-primary/5 py-2 px-6">
      <Gem size={16} className="text-primary shrink-0" aria-hidden="true" />
      <p className="text-sm flex-1">
        {t('requiresTier', { feature: featureName, tier: requiredTier })}
      </p>
      <Button variant="default" size="sm" render={<Link href="/settings?tab=billing" />}>
        <Zap className="me-1.5 size-4" />
        {t('upgradePlan')}
      </Button>
    </div>
  );
}
