import { describe, expect, it } from 'vitest';
import { enumKey } from '../enum-key';

describe('enumKey', () => {
  it('converts UPPER_SNAKE_CASE to camelCase', () => {
    expect(enumKey('DOCUMENT_COLLECTION')).toBe('documentCollection');
    expect(enumKey('FINANCE_ADMIN')).toBe('financeAdmin');
    expect(enumKey('B2B_MASTER_SERVICE')).toBe('b2bMasterService');
  });

  it('converts lower_snake_case to camelCase', () => {
    expect(enumKey('finance_admin')).toBe('financeAdmin');
    expect(enumKey('legal_compliance_viewer')).toBe('legalComplianceViewer');
  });

  it('converts kebab-case to camelCase', () => {
    expect(enumKey('document-collection')).toBe('documentCollection');
  });

  it('is idempotent for camelCase input', () => {
    expect(enumKey('documentCollection')).toBe('documentCollection');
    expect(enumKey('financeAdmin')).toBe('financeAdmin');
  });

  it('lowercases first char of PascalCase input without separators', () => {
    expect(enumKey('PascalCase')).toBe('pascalCase');
  });

  it('handles single-word UPPER values', () => {
    expect(enumKey('LAPTOP')).toBe('laptop');
    expect(enumKey('APPROVAL')).toBe('approval');
    expect(enumKey('approval')).toBe('approval');
  });

  it('handles empty and edge inputs', () => {
    expect(enumKey('')).toBe('');
    expect(enumKey('_')).toBe('_');
  });
});
