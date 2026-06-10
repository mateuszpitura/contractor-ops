import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { integrationProcedure, integrationSettingsProcedure } from '../integration-procedure';

describe('integrationProcedure', () => {
  it('returns a chainable procedure with query and mutation builders', () => {
    const proc = integrationProcedure();

    expect(proc).toHaveProperty('query');
    expect(proc).toHaveProperty('mutation');
    expect(proc).toHaveProperty('input');
    expect(proc).toHaveProperty('use');
    expect(typeof proc.query).toBe('function');
    expect(typeof proc.mutation).toBe('function');
  });

  it('accepts permission and tier options without breaking the chain', () => {
    const proc = integrationProcedure({
      permission: { settings: ['read'] },
      tier: 'PRO',
    });

    const withInput = proc.input(z.object({ id: z.string() }));
    expect(typeof withInput.query).toBe('function');
    expect(typeof withInput.mutation).toBe('function');
  });

  it('integrationSettingsProcedure presets settings permission', () => {
    const readProc = integrationSettingsProcedure('read');
    const updateProc = integrationSettingsProcedure('update', 'PRO');

    expect(typeof readProc.query).toBe('function');
    expect(typeof updateProc.mutation).toBe('function');
  });

  it('supports non-settings permission maps used by integration routers', () => {
    const memberRead = integrationProcedure({ permission: { member: ['read'] }, tier: 'PRO' });
    const invoiceRead = integrationProcedure({ permission: { invoice: ['read'] } });

    expect(typeof memberRead.mutation).toBe('function');
    expect(typeof invoiceRead.query).toBe('function');
  });
});
