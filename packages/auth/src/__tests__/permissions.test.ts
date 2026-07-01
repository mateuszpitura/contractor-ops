import { describe, expect, it } from 'vitest';
import type { Permission } from '../permissions.js';
import { ac, accessControlStatement } from '../permissions.js';

describe('accessControlStatement', () => {
  it('defines all expected resources with non-empty action lists', () => {
    const expectedResources = [
      'organization',
      'member',
      'invitation',
      'contractor',
      'contract',
      'compliance',
      'document',
      'invoice',
      'workflow',
      'idp',
      'payment',
      'report',
      'settings',
      'integration',
      'time',
      'equipment',
      'team',
      'project',
      'costCenter',
      'contractorPii',
      'employee',
      'employeePii',
      'employeeFileA',
      'employeeFileB',
      'employeeFileC',
      'employeeFileD',
      'admin:boe-rate',
    ];
    const keys = Object.keys(accessControlStatement);
    expect(keys).toHaveLength(expectedResources.length);
    for (const resource of expectedResources) {
      expect(keys, `missing resource: ${resource}`).toContain(resource);
    }
    for (const k of keys) {
      const actions = accessControlStatement[k as keyof typeof accessControlStatement];
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    }
  });

  it('creates an access control instance from the statement', () => {
    expect(ac).toBeDefined();
    expect(ac.newRole).toBeTypeOf('function');
  });

  it('every resource has at least one action and actions are non-empty strings', () => {
    for (const [resource, actions] of Object.entries(accessControlStatement)) {
      expect(actions.length, `${resource} has no actions`).toBeGreaterThan(0);
      for (const action of actions) {
        expect(typeof action).toBe('string');
        expect(action.length, `empty action in ${resource}`).toBeGreaterThan(0);
      }
    }
  });

  it('has no duplicate actions within any single resource', () => {
    for (const [resource, actions] of Object.entries(accessControlStatement)) {
      const unique = new Set(actions);
      expect(unique.size, `duplicate actions in ${resource}`).toBe(actions.length);
    }
  });

  it('Permission type allows valid resource-action pairs', () => {
    // This is a compile-time check: if the Permission type is wrong, TS will fail.
    const validPermission: Permission = {
      contractor: ['read', 'update'],
      invoice: ['approve'],
    };
    expect(validPermission.contractor).toEqual(['read', 'update']);
    expect(validPermission.invoice).toEqual(['approve']);
  });

  it('Permission type allows partial (subset of resources)', () => {
    const partial: Permission = { report: ['read'] };
    expect(Object.keys(partial)).toHaveLength(1);
  });

  it('ac.newRole creates a role from the access control statement', () => {
    const testRole = ac.newRole({
      contractor: ['read'],
      invoice: ['read'],
    });
    expect(testRole).toBeDefined();
  });

  it('all CRUD resources include at least read action', () => {
    const crudResources = ['member', 'contractor', 'contract', 'document', 'invoice', 'equipment'];
    for (const resource of crudResources) {
      const actions = accessControlStatement[resource as keyof typeof accessControlStatement];
      expect(
        (actions as readonly string[]).includes('read'),
        `${resource} missing read action`,
      ).toBe(true);
    }
  });

  it('organization resource does not include create (orgs are created via auth)', () => {
    const orgActions = accessControlStatement.organization;
    expect((orgActions as readonly string[]).includes('create')).toBe(false);
  });
});
