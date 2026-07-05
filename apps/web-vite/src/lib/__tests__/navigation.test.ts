import { describe, expect, it } from 'vitest';
import { navigationGroups, navigationItems } from '../navigation.js';

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

  it('classification entry is gated behind classification-engine flag', () => {
    const classification = navigationItems.find(i => i.key === 'classification');
    expect(classification?.flag).toBe('module.classification-engine');
  });

  it('hr entry is gated behind hr-dashboard flag + the four HR roles', () => {
    const hr = navigationItems.find(i => i.key === 'hr');
    expect(hr?.flag).toBe('module.hr-dashboard');
    expect(hr?.href).toBe('/dashboard/hr');
    expect(hr?.permission).toBeNull();
    expect(hr?.roles).toEqual(['hr_admin', 'hr_manager', 'payroll_officer', 'leave_approver']);
  });

  it('navigationItems is flatMap of all groups', () => {
    const flat = navigationGroups.flatMap(g => g.items);
    expect(navigationItems).toEqual(flat);
  });

  it('every item has key, label, href, icon', () => {
    for (const item of navigationItems) {
      expect(item.key).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.href).toMatch(/^\//);
      expect(item.icon).toBeDefined();
    }
  });
});
