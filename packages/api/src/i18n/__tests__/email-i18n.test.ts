import { describe, expect, it } from 'vitest';
import { normalizeLocale, resolveMessage, resolveMessages } from '../email-i18n';

describe('email-i18n', () => {
  describe('normalizeLocale', () => {
    it.each([
      ['en', 'en'],
      ['pl', 'pl'],
      ['de', 'de'],
      ['ar', 'ar'],
      ['EN', 'en'],
      ['en-US', 'en'],
      ['de_DE', 'de'],
      ['pl-PL', 'pl'],
    ] as const)('normalises %s → %s', (input, expected) => {
      expect(normalizeLocale(input)).toBe(expected);
    });

    it.each([null, undefined, '', 'es', 'fr-FR', 'klingon'])('falls back to en for %s', input => {
      expect(normalizeLocale(input as string | null | undefined)).toBe('en');
    });
  });

  describe('resolveMessage', () => {
    it('resolves an EN key without params', () => {
      expect(resolveMessage('Api.email.labels.invoice', 'en')).toBe('Invoice');
    });

    it('interpolates {var} placeholders', () => {
      expect(
        resolveMessage('Api.email.subject.approvalRequest', 'en', { invoiceNumber: 'INV-9' }),
      ).toBe('Action required: Approve invoice INV-9');
    });

    it('falls back to EN when locale missing the path', () => {
      const result = resolveMessage('Api.email.labels.viewInApp', 'pl');
      // Either a Polish translation or the EN fallback — but not the key.
      expect(result).not.toBe('Api.email.labels.viewInApp');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns the key when path missing in every locale', () => {
      expect(resolveMessage('Api.email.subject.doesNotExist', 'en')).toBe(
        'Api.email.subject.doesNotExist',
      );
    });

    it('renders empty string for missing params', () => {
      expect(resolveMessage('Api.email.subject.taskAssigned', 'en')).toBe('New task assigned: ');
    });

    it('coerces non-string param values', () => {
      expect(resolveMessage('Api.email.subject.approvalRequest', 'en', { invoiceNumber: 42 })).toBe(
        'Action required: Approve invoice 42',
      );
    });
  });

  describe('resolveMessages', () => {
    it('maps a key bag in one pass', () => {
      const out = resolveMessages(
        {
          invoice: 'Api.email.labels.invoice',
          contractor: 'Api.email.labels.contractor',
        },
        'en',
      );
      expect(out).toEqual({ invoice: 'Invoice', contractor: 'Contractor' });
    });
  });
});
