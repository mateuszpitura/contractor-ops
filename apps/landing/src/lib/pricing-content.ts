/**
 * Marketing content for pricing plans and credit packs.
 *
 * Prices come from Stripe at build/ISR time.
 * Features, descriptions, and display config live HERE — because they're
 * marketing decisions that should go through code review, not Stripe metadata.
 *
 * Keys must match the `slug` metadata on the corresponding Stripe product.
 */

interface PlanContent {
  name: string;
  description: string;
  features: string[];
  popular: boolean;
  order: number;
  /** Shown when STRIPE_SECRET_KEY is not set (dev/preview) */
  fallbackMonthlyPrice: number | null;
  fallbackAnnualPrice: number | null;
}

interface CreditPackContent {
  name: string;
  description: string;
  popular: boolean;
  order: number;
  /** Shown when STRIPE_SECRET_KEY is not set (dev/preview) */
  fallbackCredits: number;
  fallbackPrice: number;
}

export const PLAN_CONTENT: Record<string, PlanContent> = {
  starter: {
    name: 'Starter',
    description: 'Everything you need to get started. No credit card required.',
    features: [
      'Contractor profiles & documents',
      'Basic onboarding checklists',
      'Invoice upload & tracking',
      'Single-step approvals',
      'Audit trail',
    ],
    popular: false,
    order: 1,
    fallbackMonthlyPrice: 0,
    fallbackAnnualPrice: 0,
  },
  pro: {
    name: 'Pro',
    description: 'Full lifecycle management with KSeF integration and multi-step workflows.',
    features: [
      'Everything in Starter',
      'KSeF invoice auto-pull',
      'Multi-step approval chains',
      'Batch payment export',
      'Contract templates & e-sign',
      'Offboarding workflows',
      'Spend analytics',
      'Priority support',
    ],
    popular: true,
    order: 2,
    fallbackMonthlyPrice: 49,
    fallbackAnnualPrice: 468,
  },
  enterprise: {
    name: 'Enterprise',
    description:
      'For organizations with complex approval chains, custom integrations, and compliance needs.',
    features: [
      'Everything in Pro',
      'SSO / SAML',
      'Custom approval workflows',
      'API access & webhooks',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    popular: false,
    order: 3,
    fallbackMonthlyPrice: null,
    fallbackAnnualPrice: null,
  },
};

export const CREDIT_PACK_CONTENT: Record<string, CreditPackContent> = {
  'starter-pack': {
    name: 'Starter Pack',
    description: 'Good for small teams getting started with credits.',
    popular: false,
    order: 1,
    fallbackCredits: 100,
    fallbackPrice: 49,
  },
  'growth-pack': {
    name: 'Growth Pack',
    description: 'Best value for growing teams.',
    popular: true,
    order: 2,
    fallbackCredits: 500,
    fallbackPrice: 199,
  },
  'scale-pack': {
    name: 'Scale Pack',
    description: 'For teams with high-volume operations.',
    popular: false,
    order: 3,
    fallbackCredits: 2000,
    fallbackPrice: 599,
  },
  'enterprise-credits': {
    name: 'Enterprise',
    description: 'Maximum volume at the best per-credit rate.',
    popular: false,
    order: 4,
    fallbackCredits: 10000,
    fallbackPrice: 1999,
  },
};
