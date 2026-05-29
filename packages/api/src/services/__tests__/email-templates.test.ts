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

  it('throws for unknown type', () => {
    expect(() => renderNotificationEmail('UNKNOWN_TYPE', {}, 'en')).toThrow(
      /Unknown notification type/,
    );
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
