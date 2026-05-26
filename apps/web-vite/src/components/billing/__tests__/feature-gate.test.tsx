/**
 * Web-vite port of apps/web/src/components/billing/__tests__/feature-gate.test.tsx.
 *
 * The web-vite FeatureGate is now a pure presentational component:
 * `isLoading` and `isAllowed` are props rather than derived from a tRPC
 * subscription query. Container/component split moved the gating logic to
 * `feature-gate-container.tsx` + `useFeatureGate` hook, so the test drives
 * the visible branches directly through props.
 */

import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { FeatureGate } from '../feature-gate';

describe('FeatureGate (web-vite)', () => {
  it('shows children while loading (no flash of upgrade banner)', () => {
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR" isLoading isAllowed={false}>
        <div>Protected content</div>
      </FeatureGate>,
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows upgrade banner when not allowed', () => {
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR" isLoading={false} isAllowed={false}>
        <div>Protected content</div>
      </FeatureGate>,
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders children when allowed', () => {
    render(
      <FeatureGate requiredTier="Pro" featureName="OCR" isLoading={false} isAllowed>
        <div>Protected content</div>
      </FeatureGate>,
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders Enterprise upgrade banner when Enterprise gate fails', () => {
    render(
      <FeatureGate
        requiredTier="Enterprise"
        featureName="API access"
        isLoading={false}
        isAllowed={false}>
        <div>Enterprise content</div>
      </FeatureGate>,
    );
    expect(screen.queryByText('Enterprise content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders children for Enterprise gate when allowed', () => {
    render(
      <FeatureGate requiredTier="Enterprise" featureName="API access" isLoading={false} isAllowed>
        <div>Enterprise content</div>
      </FeatureGate>,
    );
    expect(screen.getByText('Enterprise content')).toBeInTheDocument();
  });

  it('keeps children visible during loading even if not allowed', () => {
    render(
      <FeatureGate requiredTier="Enterprise" featureName="API" isLoading isAllowed={false}>
        <div>Loading content</div>
      </FeatureGate>,
    );
    expect(screen.getByText('Loading content')).toBeInTheDocument();
  });
});
