'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Gem, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
      className="flex h-full flex-col gap-3 border-l-4 border-primary bg-primary/5 py-3 px-6">
      <div className="flex items-center gap-3">
        <Gem size={16} className="text-primary shrink-0" aria-hidden="true" />
        <p className="text-sm">{t('requiresTier', { feature: featureName, tier: requiredTier })}</p>
      </div>
      <Button
        variant="default"
        size="sm"
        className="mt-auto self-start"
        render={<Link href="/settings?tab=billing" />}>
        <Zap className="me-1.5 size-4" />
        {t('upgradePlan')}
      </Button>
    </div>
  );
}
