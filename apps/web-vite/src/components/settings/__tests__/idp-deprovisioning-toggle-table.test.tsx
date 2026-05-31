/**
 * Phase 77 D-15 — IdpDeprovisioningToggleTable presentational tests. The per-row
 * switch is disabled when the provider flag is not APPROVED; GWS and Slack rows
 * are independent.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

import type { ProviderToggleRow } from '../hooks/use-idp-deprovisioning-toggles';
import { IdpDeprovisioningToggleTable } from '../idp-deprovisioning-toggle-table';

function row(overrides: Partial<ProviderToggleRow>): ProviderToggleRow {
  return {
    provider: 'GOOGLE_WORKSPACE',
    connected: true,
    flagApproved: true,
    enabled: false,
    toggleDisabled: false,
    ...overrides,
  };
}

describe('IdpDeprovisioningToggleTable', () => {
  it('renders one row per provider', () => {
    render(
      <IdpDeprovisioningToggleTable
        rows={[
          row({ provider: 'GOOGLE_WORKSPACE' }),
          row({ provider: 'SLACK', flagApproved: false, toggleDisabled: true }),
        ]}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
    expect(screen.getByText('Slack')).toBeInTheDocument();
  });

  it('disables the switch when the provider flag is not approved', () => {
    render(
      <IdpDeprovisioningToggleTable
        rows={[row({ provider: 'SLACK', flagApproved: false, toggleDisabled: true })]}
        onToggle={vi.fn()}
      />,
    );
    // base-ui Switch reflects disabled state via aria-disabled / data-disabled.
    const switches = screen.getAllByRole('switch');
    expect(switches[0].getAttribute('aria-disabled')).toBe('true');
  });

  it('GWS and Slack toggle independently — GWS enabled while Slack disabled', () => {
    const onToggle = vi.fn();
    render(
      <IdpDeprovisioningToggleTable
        rows={[
          row({
            provider: 'GOOGLE_WORKSPACE',
            flagApproved: true,
            toggleDisabled: false,
            enabled: true,
          }),
          row({ provider: 'SLACK', flagApproved: false, toggleDisabled: true, enabled: false }),
        ]}
        onToggle={onToggle}
      />,
    );
    const switches = screen.getAllByRole('switch');
    expect(switches[0].getAttribute('aria-disabled')).not.toBe('true');
    expect(switches[0].getAttribute('aria-checked')).toBe('true');
    expect(switches[1].getAttribute('aria-disabled')).toBe('true');
  });

  it('calls onToggle with the provider + next enabled value', async () => {
    const onToggle = vi.fn();
    render(
      <IdpDeprovisioningToggleTable
        rows={[row({ provider: 'GOOGLE_WORKSPACE', enabled: false, toggleDisabled: false })]}
        onToggle={onToggle}
      />,
    );
    screen.getByRole('switch').click();
    expect(onToggle).toHaveBeenCalledWith('GOOGLE_WORKSPACE', true);
  });
});
