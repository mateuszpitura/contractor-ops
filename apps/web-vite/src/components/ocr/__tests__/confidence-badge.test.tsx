/**
 * Covers `getConfidenceConfig` thresholds plus the percent / aria-label /
 * variant rendering rules of `ConfidenceBadge`.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { ConfidenceBadge, getConfidenceConfig } from '../confidence-badge.js';
import { findByAriaLabel, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getConfidenceConfig', () => {
  it('returns success for confidence > 90', () => {
    const config = getConfidenceConfig(95);
    expect(config.variant).toBe('success');
    expect(config.tooltip).toBe('High confidence: 95%');
    expect(config.icon).toBeDefined();
  });

  it('returns success for confidence = 91', () => {
    expect(getConfidenceConfig(91).variant).toBe('success');
  });

  it('returns warning for confidence = 90 (boundary)', () => {
    expect(getConfidenceConfig(90).variant).toBe('warning');
  });

  it('returns warning for confidence = 70 with verify tooltip', () => {
    expect(getConfidenceConfig(70).variant).toBe('warning');
    expect(getConfidenceConfig(70).tooltip).toContain('please verify');
  });

  it('returns destructive for confidence = 69', () => {
    expect(getConfidenceConfig(69).variant).toBe('destructive');
  });

  it('returns destructive for confidence = 0 with manual-review tooltip', () => {
    expect(getConfidenceConfig(0).variant).toBe('destructive');
    expect(getConfidenceConfig(0).tooltip).toContain('manual review needed');
  });
});

describe('ConfidenceBadge (web-vite)', () => {
  it('shows the percentage by default', async () => {
    await mount(<ConfidenceBadge confidence={85} />);
    expect(findByText(document.body, '85%')).not.toBeNull();
  });

  it('hides the percentage when showPercentage=false', async () => {
    await mount(<ConfidenceBadge confidence={85} showPercentage={false} />);
    expect(findByText(document.body, '85%')).toBeNull();
  });

  it('sets an aria-label when the percentage is hidden', async () => {
    await mount(<ConfidenceBadge confidence={72} showPercentage={false} />);
    expect(findByAriaLabel(document.body, '72% confidence')).not.toBeNull();
  });

  it('omits the aria-label when the percentage is visible', async () => {
    await mount(<ConfidenceBadge confidence={72} showPercentage />);
    expect(findByAriaLabel(document.body, '72% confidence')).toBeNull();
  });

  it('uses tabular-nums for the percentage span', async () => {
    const { container } = await mount(<ConfidenceBadge confidence={85} />);
    const pct = container.querySelector('.tabular-nums');
    expect(pct?.textContent?.trim()).toBe('85%');
  });

  it('renders 100% at the upper edge', async () => {
    await mount(<ConfidenceBadge confidence={100} />);
    expect(findByText(document.body, '100%')).not.toBeNull();
  });

  it('renders 0% at the lower edge', async () => {
    await mount(<ConfidenceBadge confidence={0} />);
    expect(findByText(document.body, '0%')).not.toBeNull();
  });
});
