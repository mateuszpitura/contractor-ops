import { describe, expect, it } from 'vitest';
import { EMAIL_SUBJECT_KEYS, renderNotificationEmail } from '../email-templates';

describe('renderNotificationEmail', () => {
  it('resolves subject for APPROVAL_REQUEST in en', () => {
    const { subject, react } = renderNotificationEmail(
      'APPROVAL_REQUEST',
      {
        invoiceNumber: 'INV-42',
        ctaUrl: 'https://example.com',
        preferencesUrl: 'https://example.com/prefs',
      },
      'en',
    );
    expect(subject).toBe('Action required: Approve invoice INV-42');
    expect(react).toBeDefined();
  });

  it('resolves subject in non-en locale and falls back to en when missing', () => {
    const { subject: pl } = renderNotificationEmail(
      'TASK_OVERDUE',
      { taskName: 'Compliance review' },
      'pl',
    );
    expect(pl.length).toBeGreaterThan(0);
    expect(pl).not.toBe(EMAIL_SUBJECT_KEYS.taskOverdue);
    expect(pl).toContain('Compliance review');
  });

  it('falls back to generic template for unknown types instead of throwing', () => {
    const result = renderNotificationEmail(
      'PAYMENT_COMPLETED',
      {
        title: 'Payment completed: INV-99',
        body: 'Invoice INV-99 marked paid.',
        ctaUrl: 'https://example.com',
        preferencesUrl: 'https://example.com/prefs',
      },
      'en',
    );

    expect(result.usedGenericFallback).toBe(true);
    expect(result.subject).toBe('Payment completed: INV-99');
    expect(result.react).toBeDefined();
  });

  it('produces a string subject (no [object Object])', () => {
    const { subject } = renderNotificationEmail(
      'APPROVAL_DECISION',
      { invoiceNumber: 'INV-7', decision: 'APPROVED' },
      'en',
    );
    expect(typeof subject).toBe('string');
    expect(subject).not.toContain('[object Object]');
  });
});
