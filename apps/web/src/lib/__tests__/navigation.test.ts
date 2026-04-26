import { describe, expect, it } from 'vitest';
import { navigationGroups, navigationItems } from '../navigation';

describe('navigationGroups', () => {
  it('exposes stable group keys in sidebar order', () => {
    expect(navigationGroups.map(g => g.key)).toEqual([
      'overview',
      'operations',
      'finance',
      'system',
    ]);
  });

  it('dashboard is always visible with root href', () => {
    const dash = navigationGroups[0]?.items[0];
    expect(dash).toBeDefined();
    expect(dash?.key).toBe('dashboard');
    expect(dash?.permission).toBeNull();
    expect(dash?.href).toBe('/');
  });

  it('contractors entry requires contractor:read', () => {
    const contractors = navigationGroups.flatMap(g => g.items).find(i => i.key === 'contractors');
    expect(contractors?.permission).toEqual({
      resource: 'contractor',
      actions: ['read'],
    });
  });

  it('approvals entry requires invoice:approve', () => {
    const approvals = navigationItems.find(i => i.key === 'approvals');
    expect(approvals?.permission).toEqual({
      resource: 'invoice',
      actions: ['approve'],
    });
  });

  it('integrations href targets settings integrations tab', () => {
    const integrations = navigationItems.find(i => i.key === 'integrations');
    expect(integrations?.href).toBe('/settings?tab=integrations');
  });

  it('navigationItems is flatMap of all groups', () => {
    const flat = navigationGroups.flatMap(g => g.items);
    expect(navigationItems).toEqual(flat);
  });
});
