import { describe, expect, it } from 'vitest';
import { accessControlStatement } from '../permissions.js';
import { roles } from '../roles.js';

describe('roles', () => {
  const roleNames = [
    'owner',
    'admin',
    'finance_admin',
    'ops_manager',
    'team_manager',
    'legal_compliance_viewer',
    'it_admin',
    'external_accountant',
    'readonly',
  ] as const;

  it('defines all exported platform roles', () => {
    expect(Object.keys(roles)).toHaveLength(roleNames.length);
    for (const name of roleNames) {
      expect(roles[name].statements).toBeDefined();
    }
  });

  it('owner matches the full access control statement', () => {
    const o = roles.owner.statements;
    for (const [resource, actions] of Object.entries(accessControlStatement)) {
      expect(o[resource as keyof typeof o]?.slice().sort()).toEqual([...actions].sort());
    }
  });

  it('admin matches owner (full org permissions)', () => {
    expect(roles.admin.statements).toEqual(roles.owner.statements);
  });

  it('finance_admin cannot create or bulk-update contractors', () => {
    expect(roles.finance_admin.statements.contractor).toEqual(['read']);
  });

  it('readonly has only read actions on every granted resource', () => {
    for (const actions of Object.values(roles.readonly.statements)) {
      for (const a of actions) {
        expect(a).toBe('read');
      }
    }
  });

  it('it_admin cannot read invoices or contractors', () => {
    expect(roles.it_admin.statements.invoice).toBeUndefined();
    expect(roles.it_admin.statements.contractor).toBeUndefined();
  });

  it('external_accountant has read-only payment access', () => {
    expect(roles.external_accountant.statements.payment).toEqual(['read']);
  });

  it('ops_manager cannot manage members, invitations, or organization', () => {
    expect(roles.ops_manager.statements.member).toBeUndefined();
    expect(roles.ops_manager.statements.invitation).toBeUndefined();
    expect(roles.ops_manager.statements.organization).toBeUndefined();
  });

  it('ops_manager cannot approve invoices', () => {
    expect(roles.ops_manager.statements.invoice).toEqual(expect.not.arrayContaining(['approve']));
  });

  it('team_manager cannot create or delete contractors', () => {
    expect(roles.team_manager.statements.contractor).toEqual(['read', 'update']);
  });

  it('team_manager cannot manage documents, settings, or integrations', () => {
    expect(roles.team_manager.statements.document).toBeUndefined();
    expect(roles.team_manager.statements.settings).toBeUndefined();
    expect(roles.team_manager.statements.integration).toBeUndefined();
  });

  it('legal_compliance_viewer has no write access on any resource', () => {
    for (const actions of Object.values(roles.legal_compliance_viewer.statements)) {
      for (const a of actions) {
        expect(a).toBe('read');
      }
    }
  });

  it('legal_compliance_viewer cannot access payment, settings, or integration', () => {
    expect(roles.legal_compliance_viewer.statements.payment).toBeUndefined();
    expect(roles.legal_compliance_viewer.statements.settings).toBeUndefined();
    expect(roles.legal_compliance_viewer.statements.integration).toBeUndefined();
  });

  it('external_accountant cannot modify anything (all permissions are read or export)', () => {
    for (const actions of Object.values(roles.external_accountant.statements)) {
      for (const a of actions) {
        expect(['read', 'export']).toContain(a);
      }
    }
  });
});
