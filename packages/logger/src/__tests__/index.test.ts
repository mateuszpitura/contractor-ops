import { describe, expect, it } from 'vitest';
import {
  createCronLogger,
  createIntegrationLogger,
  createLogger,
  createTrpcLogger,
  createWebhookLogger,
} from '../index.js';

describe('@contractor-ops/logger factories', () => {
  it('createLogger merges context into bindings', () => {
    const log = createLogger({
      service: 'billing',
      organizationId: 'org_1',
    });
    expect(log.bindings()).toMatchObject({
      service: 'billing',
      organizationId: 'org_1',
    });
  });

  it('createTrpcLogger sets service trpc and procedure meta', () => {
    const log = createTrpcLogger({
      procedure: 'invoice.list',
      type: 'query',
      userId: 'u1',
    });
    expect(log.bindings()).toMatchObject({
      service: 'trpc',
      procedure: 'invoice.list',
      type: 'query',
      userId: 'u1',
    });
  });

  it('createCronLogger binds job name', () => {
    const log = createCronLogger('reminders');
    expect(log.bindings()).toMatchObject({ service: 'cron', job: 'reminders' });
  });

  it('createWebhookLogger binds provider', () => {
    const log = createWebhookLogger('stripe');
    expect(log.bindings()).toMatchObject({
      service: 'webhook',
      provider: 'stripe',
    });
  });

  it('createIntegrationLogger binds provider', () => {
    const log = createIntegrationLogger('jira');
    expect(log.bindings()).toMatchObject({
      service: 'integration',
      provider: 'jira',
    });
  });
});
