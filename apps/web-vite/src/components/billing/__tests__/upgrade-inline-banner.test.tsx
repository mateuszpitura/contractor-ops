/**
 * `useTranslations` resolves against the real EN bundle so the assertions
 * pin the live `Billing.gate` copy.
 */

import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { UpgradeInlineBanner } from '../upgrade-inline-banner';

describe('UpgradeInlineBanner (web-vite)', () => {
  it('renders with status role and aria-live polite', () => {
    render(<UpgradeInlineBanner featureName="OCR" requiredTier="Pro" />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('displays the feature requirement message for Pro', () => {
    render(<UpgradeInlineBanner featureName="OCR" requiredTier="Pro" />);
    expect(screen.getByText('OCR requires Pro.')).toBeInTheDocument();
  });

  it('displays the upgrade button', () => {
    render(<UpgradeInlineBanner featureName="API access" requiredTier="Enterprise" />);
    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
  });

  it('shows correct message for Enterprise tier', () => {
    render(<UpgradeInlineBanner featureName="Audit log export" requiredTier="Enterprise" />);
    expect(screen.getByText('Audit log export requires Enterprise.')).toBeInTheDocument();
  });

  it('renders the upgrade CTA as an anchor pointing at the billing tab', () => {
    const { container } = render(<UpgradeInlineBanner featureName="OCR" requiredTier="Pro" />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toMatch(/settings\?tab=billing/);
  });
});
