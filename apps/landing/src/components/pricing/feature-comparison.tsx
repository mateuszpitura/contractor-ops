'use client';

import { Check, Minus } from 'lucide-react';
import { Fragment } from 'react';
import { FadeUp, ScaleIn } from '@/components/motion-wrapper';
import { useLocale } from '@/i18n';
import { intlLocaleFor } from '@/lib/market';
import type { LandingPlanView } from '@/lib/pricing-types';
import { formatPrice } from '@/lib/pricing-types';

type FeatureValue = boolean | string;

interface FeatureRow {
  name: string;
  starter: FeatureValue;
  pro: FeatureValue;
  enterprise: FeatureValue;
}

const categories: { category: string; features: FeatureRow[] }[] = [
  {
    category: 'Contractor Management',
    features: [
      { name: 'Contractor profiles', starter: true, pro: true, enterprise: true },
      { name: 'Document storage', starter: '100 MB', pro: '10 GB', enterprise: 'Unlimited' },
      {
        name: 'Onboarding checklists',
        starter: 'Basic',
        pro: 'Custom',
        enterprise: 'Custom + API',
      },
      { name: 'Offboarding workflows', starter: false, pro: true, enterprise: true },
      { name: 'Contractor self-service portal', starter: false, pro: true, enterprise: true },
    ],
  },
  {
    category: 'Contracts & Compliance',
    features: [
      { name: 'Contract templates', starter: '3', pro: 'Unlimited', enterprise: 'Unlimited' },
      { name: 'E-signatures (DocuSign)', starter: false, pro: true, enterprise: true },
      { name: 'Version history', starter: false, pro: true, enterprise: true },
      { name: 'Renewal alerts', starter: true, pro: true, enterprise: true },
      { name: 'Full audit trail', starter: true, pro: true, enterprise: true },
      { name: 'Custom compliance gates', starter: false, pro: false, enterprise: true },
    ],
  },
  {
    category: 'Invoicing & Payments',
    features: [
      { name: 'Invoice upload & tracking', starter: true, pro: true, enterprise: true },
      { name: 'KSeF auto-pull', starter: false, pro: true, enterprise: true },
      { name: 'Contract rate matching', starter: false, pro: true, enterprise: true },
      { name: 'Discrepancy flagging', starter: false, pro: true, enterprise: true },
      { name: 'Multi-step approval chains', starter: false, pro: true, enterprise: true },
      { name: 'Batch payment export', starter: false, pro: true, enterprise: true },
      { name: 'Payment reconciliation', starter: false, pro: true, enterprise: true },
    ],
  },
  {
    category: 'Analytics & Integrations',
    features: [
      { name: 'Spend dashboard', starter: 'Basic', pro: 'Advanced', enterprise: 'Custom' },
      { name: 'Budget tracking', starter: false, pro: true, enterprise: true },
      { name: 'Cost breakdowns', starter: false, pro: true, enterprise: true },
      { name: 'API access', starter: false, pro: false, enterprise: true },
      { name: 'Webhooks', starter: false, pro: false, enterprise: true },
      { name: 'Custom integrations', starter: false, pro: false, enterprise: true },
      { name: 'SSO / SAML', starter: false, pro: false, enterprise: true },
    ],
  },
  {
    category: 'Support',
    features: [
      { name: 'Community support', starter: true, pro: true, enterprise: true },
      { name: 'Email support', starter: true, pro: true, enterprise: true },
      { name: 'Priority support', starter: false, pro: true, enterprise: true },
      { name: 'Dedicated account manager', starter: false, pro: false, enterprise: true },
      { name: 'SLA guarantee', starter: false, pro: false, enterprise: true },
      { name: 'Custom onboarding', starter: false, pro: false, enterprise: true },
    ],
  },
];

function CellValue({ value }: { value: FeatureValue }) {
  if (value === true) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex items-center justify-center">
        <Minus className="h-4 w-4 text-muted-foreground/30" />
      </div>
    );
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

interface FeatureComparisonProps {
  views: LandingPlanView[];
}

function findByTier(views: LandingPlanView[], tier: 'STARTER' | 'PRO' | 'ENTERPRISE') {
  return views.find(v => v.plan.tier === tier);
}

export function FeatureComparison({ views }: FeatureComparisonProps) {
  const locale = useLocale();
  const intlLocale = intlLocaleFor(locale);

  const starter = findByTier(views, 'STARTER');
  const pro = findByTier(views, 'PRO');
  const enterprise = findByTier(views, 'ENTERPRISE');

  const priceLabel = (view: LandingPlanView | undefined): string => {
    if (!view) return '—';
    const monthly = view.plan.monthly;
    if (!monthly) return view.plan.tier === 'ENTERPRISE' ? 'Custom' : '—';
    return `${formatPrice(monthly.amount, monthly.currency, { locale: intlLocale })}/mo`;
  };

  return (
    <section className="relative py-28 sm:py-36 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-2/30 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Compare plans
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            Every feature, <span className="gradient-text">side by side</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            See exactly what you get at each tier. No surprises, no fine print.
          </p>
        </FadeUp>

        <ScaleIn className="mt-16" delay={0.15}>
          <section
            aria-label="Feature comparison table"
            className="overflow-x-auto rounded-2xl border border-border/50 bg-surface-1/60 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <table className="w-full min-w-[640px]">
              {/* Header */}
              <thead>
                <tr className="border-b border-border/40">
                  <th className="py-5 px-6 text-left text-sm font-medium text-muted-foreground w-[40%]">
                    Feature
                  </th>
                  <th className="py-5 px-4 text-center w-[20%]">
                    <div className="text-sm font-bold text-foreground">
                      {starter?.plan.name ?? 'Starter'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {priceLabel(starter)}
                    </div>
                  </th>
                  <th className="py-5 px-4 text-center w-[20%] bg-primary/3">
                    <div className="text-sm font-bold text-primary">{pro?.plan.name ?? 'Pro'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{priceLabel(pro)}</div>
                  </th>
                  <th className="py-5 px-4 text-center w-[20%]">
                    <div className="text-sm font-bold text-foreground">
                      {enterprise?.plan.name ?? 'Enterprise'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {priceLabel(enterprise)}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {categories.map(cat => (
                  <Fragment key={cat.category}>
                    {/* Category header */}
                    <tr className="border-t border-border/30">
                      <td
                        colSpan={4}
                        className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-muted-foreground bg-surface-2/40">
                        {cat.category}
                      </td>
                    </tr>
                    {cat.features.map((row, i) => (
                      <tr
                        key={row.name}
                        className={`border-t border-border/20 transition-colors hover:bg-muted/20 ${
                          i % 2 === 0 ? '' : 'bg-surface-2/10'
                        }`}>
                        <td className="py-3 px-6 text-sm text-foreground/85">{row.name}</td>
                        <td className="py-3 px-4 text-center">
                          <CellValue value={row.starter} />
                        </td>
                        <td className="py-3 px-4 text-center bg-primary/3">
                          <CellValue value={row.pro} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <CellValue value={row.enterprise} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </section>
        </ScaleIn>
      </div>
    </section>
  );
}
