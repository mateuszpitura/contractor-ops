import { describe, expect, it } from 'vitest';
import { renderNotificationEmail } from '../email-templates';

describe('renderNotificationEmail', () => {
  it('builds subject for APPROVAL_REQUEST', () => {
    const { subject, react } = renderNotificationEmail('APPROVAL_REQUEST', {
      invoiceNumber: 'INV-42',
      ctaUrl: 'https://example.com',
      preferencesUrl: 'https://example.com/prefs',
    });
    expect(subject.key).toBe('email.subject.approvalRequest');
    expect(subject.params.invoiceNumber).toBe('INV-42');
    expect(react).toBeDefined();
  });

  it('throws for unknown type', () => {
    expect(() => renderNotificationEmail('UNKNOWN_TYPE', {})).toThrow(/Unknown notification type/);
  });
});
