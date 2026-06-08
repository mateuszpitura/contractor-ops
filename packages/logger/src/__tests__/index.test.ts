import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

import {
  createCronLogger,
  createIntegrationLogger,
  createLogger,
  createTrpcLogger,
  createWebhookLogger,
} from '../index.js';
import { PII_MASK_PATHS } from '../pii-mask.js';

/** Mount a fresh pino over an in-memory sink with the package's redact paths. */
function captureRedacted(record: Record<string, unknown>): string {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  const log = pino(
    { level: 'debug', redact: { paths: [...PII_MASK_PATHS], censor: '[REDACTED]' } },
    sink,
  );
  log.info(record, 'msg');
  return chunks.join('');
}

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

// Phase 84 US-FIELD-02 (D-08) — SSN/EIN must never reach the log sink in cleartext.
describe('PII redaction for US contractor fields (D-08)', () => {
  it('redacts ssn + ein nested under a wrapper key', () => {
    const out = captureRedacted({ contractor: { ssn: '123-45-6789', ein: '12-3456789' } });
    expect(out).not.toContain('123-45-6789');
    expect(out).not.toContain('12-3456789');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts ssn + ein inside the countryFields bundle', () => {
    const out = captureRedacted({ countryFields: { ssn: '987-65-4321', ein: '98-7654321' } });
    expect(out).not.toContain('987-65-4321');
    expect(out).not.toContain('98-7654321');
    expect(out).toContain('[REDACTED]');
  });
});
