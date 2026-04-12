import { describe, expect, it } from 'vitest';
import {
  getSyncLogSchema,
  getWebhookLogSchema,
  providerSlugSchema,
  slackOAuthInitSchema,
  slackUserLinkSchema,
} from '../integration.js';

describe('slackOAuthInitSchema', () => {
  it('accepts empty object', () => {
    const r = slackOAuthInitSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe('slackUserLinkSchema', () => {
  it('requires user and external ids', () => {
    const r = slackUserLinkSchema.safeParse({
      userId: 'u1',
      externalId: 'U123',
    });
    expect(r.success).toBe(true);
  });
});

describe('providerSlugSchema', () => {
  it('requires non-empty provider', () => {
    const r = providerSlugSchema.safeParse({ provider: 'jira' });
    expect(r.success).toBe(true);
    const bad = providerSlugSchema.safeParse({ provider: '' });
    expect(bad.success).toBe(false);
  });
});

describe('getSyncLogSchema', () => {
  it('defaults limit 10', () => {
    const r = getSyncLogSchema.safeParse({ provider: 'slack' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(10);
  });
});

describe('getWebhookLogSchema', () => {
  it('defaults limit 10', () => {
    const r = getWebhookLogSchema.safeParse({ provider: 'linear' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(10);
  });
});
