import { describe, expect, it } from 'vitest';
import {
  notificationListSchema,
  notificationMarkReadSchema,
  notificationPreferenceUpdateSchema,
} from '../notification.js';

describe('notificationListSchema', () => {
  it('defaults pagination', () => {
    const r = notificationListSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.perPage).toBe(10);
    }
  });
});

describe('notificationMarkReadSchema', () => {
  it('requires notificationId', () => {
    const r = notificationMarkReadSchema.safeParse({
      notificationId: 'n1',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty notificationId', () => {
    const r = notificationMarkReadSchema.safeParse({ notificationId: '' });
    expect(r.success).toBe(false);
  });
});

describe('notificationPreferenceUpdateSchema', () => {
  it('accepts preference rows', () => {
    const r = notificationPreferenceUpdateSchema.safeParse({
      preferences: [
        {
          notificationType: 'APPROVAL_REQUEST',
          channelEmail: true,
          channelSlack: false,
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});
