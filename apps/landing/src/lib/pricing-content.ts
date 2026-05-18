/**
 * Per-tier marketing content (feature lists, exclusions) for landing pages.
 *
 * Prices come from Stripe via `@contractor-ops/billing` — never from here.
 * Per-market feature copy is delivered through i18n messages (Pricing.tiers.*).
 * This file ships only the structural fallback (when a translation is absent)
 * + credit-pack marketing copy.
 */
import type { Tier } from '@contractor-ops/billing/types';

interface TierContentFallback {
  features: string[];
  excludedFeatures: string[];
}

export const TIER_CONTENT_FALLBACK: Record<Tier, TierContentFallback> = {
  STARTER: {
    features: [
      'Contractor profiles & documents',
      'Onboarding checklists',
      'Invoice intake & matching',
      'Single-step approvals',
      'Audit trail',
    ],
    excludedFeatures: ['Integrations', 'OCR parsing', 'Advanced workflows', 'API access'],
  },
  PRO: {
    features: [
      'Everything in Starter',
      'Integrations (Jira, Linear, Calendar)',
      'OCR invoice parsing',
      'Multi-step approval chains',
      'E-signatures',
      'Batch payment export',
    ],
    excludedFeatures: ['Audit log export', 'API access'],
  },
  ENTERPRISE: {
    features: [
      'Everything in Pro',
      'SSO / SAML',
      'Audit log export',
      'API access & webhooks',
      'Dedicated CSM',
      'SLA guarantee',
    ],
    excludedFeatures: [],
  },
};

interface CreditPackContent {
  name: string;
  description: string;
  popular: boolean;
  order: number;
  /** Shown when STRIPE_SECRET_KEY is not set (dev/preview) */
  fallbackCredits: number;
  fallbackPrice: number;
}

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
