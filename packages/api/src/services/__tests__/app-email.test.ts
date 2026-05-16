import { resetServerEnvCacheForTesting, validateServerEnv } from '@contractor-ops/validators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({});
  const createTransport = vi.fn(() => ({ sendMail }));
  return { mockSendMail: sendMail, mockCreateTransport: createTransport };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (...args: unknown[]) => mockCreateTransport(...args),
  },
}));

const mockResendSend = vi.fn().mockResolvedValue({ id: 're_1' });
vi.mock('../resend-client', () => ({
  getResend: () => ({
    emails: { send: (...args: unknown[]) => mockResendSend(...args) },
  }),
}));

import { sendAppEmail } from '../app-email';

describe('sendAppEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetServerEnvCacheForTesting();
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_SMTP_HOST;
    delete process.env.DEV_SMTP_PORT;
    validateServerEnv(process.env);
  });

  afterEach(() => {
    resetServerEnvCacheForTesting();
  });

  it('delivers via SMTP when DEV_SMTP_HOST is set (e.g. Mailpit)', async () => {
    process.env.DEV_SMTP_HOST = '127.0.0.1';
    process.env.DEV_SMTP_PORT = '1025';
    resetServerEnvCacheForTesting();
    validateServerEnv(process.env);

    await sendAppEmail({
      from: 'from@test.com',
      to: 'to@test.com',
      subject: 'Subject',
      html: '<p>hello</p>',
    });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: '127.0.0.1', port: 1025, secure: false }),
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'from@test.com',
        to: 'to@test.com',
        subject: 'Subject',
        html: '<p>hello</p>',
      }),
    );
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('uses Resend when DEV_SMTP_HOST is unset', async () => {
    await sendAppEmail({
      from: 'from@test.com',
      to: 'to@test.com',
      subject: 'Subject',
      html: '<p>hello</p>',
    });

    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'from@test.com',
        to: 'to@test.com',
        subject: 'Subject',
        html: '<p>hello</p>',
      }),
      // F-INT-04 / DRIFT-01: fallback idempotency key now derived via the
      // canonical `deriveIdempotencyKey` helper — 64-char lowercase hex digest.
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('threads explicit idempotencyKey to Resend (F-INT-04)', async () => {
    await sendAppEmail({
      from: 'from@test.com',
      to: 'to@test.com',
      subject: 'Subject',
      html: '<p>hello</p>',
      idempotencyKey: 'notification:abc123',
    });

    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'from@test.com',
        to: 'to@test.com',
        subject: 'Subject',
        html: '<p>hello</p>',
      }),
      { idempotencyKey: 'notification:abc123' },
    );
  });
});
