import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPortalCreate, mockPortalUpdateMany, mockPortalFindUnique, mockContractorFindMany } =
  vi.hoisted(() => ({
    mockPortalCreate: vi.fn(),
    mockPortalUpdateMany: vi.fn(),
    mockPortalFindUnique: vi.fn(),
    mockContractorFindMany: vi.fn(),
  }));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    portalMagicToken: {
      create: mockPortalCreate,
      updateMany: mockPortalUpdateMany,
      findUnique: mockPortalFindUnique,
    },
    contractor: {
      findMany: mockContractorFindMany,
    },
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'email_1' }) },
  })),
}));

import { createHash } from 'node:crypto';
import {
  createMagicLinkToken,
  findContractorsByEmail,
  sendPortalMagicLink,
  verifyMagicLinkToken,
} from '../portal-magic-link.js';

describe('createMagicLinkToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPortalCreate.mockResolvedValue({});
  });

  it('stores normalized email and hashed token', async () => {
    const { token, expiresAt } = await createMagicLinkToken('  User@Example.COM ');

    expect(mockPortalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'user@example.com',
        token: createHash('sha256').update(token).digest('hex'),
        expiresAt: expect.any(Date),
      }),
    });
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('verifyMagicLinkToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no row was updated', async () => {
    mockPortalUpdateMany.mockResolvedValue({ count: 0 });
    const result = await verifyMagicLinkToken('raw-token');
    expect(result).toBeNull();
    expect(mockPortalFindUnique).not.toHaveBeenCalled();
  });

  it('returns email after successful updateMany', async () => {
    mockPortalUpdateMany.mockResolvedValue({ count: 1 });
    mockPortalFindUnique.mockResolvedValue({ email: 'ok@example.com' });
    const result = await verifyMagicLinkToken('raw-token');
    expect(result).toEqual({ email: 'ok@example.com' });
  });
});

describe('findContractorsByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractorFindMany.mockResolvedValue([]);
  });

  it('queries active contractors with normalized email', async () => {
    await findContractorsByEmail('  Test@X.org ');
    expect(mockContractorFindMany).toHaveBeenCalledWith({
      where: {
        email: 'test@x.org',
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        organization: {
          select: { id: true, name: true, logo: true },
        },
      },
    });
  });
});

describe('sendPortalMagicLink', () => {
  it('logs in dev when RESEND_API_KEY is unset', async () => {
    const prev = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await sendPortalMagicLink({
      email: 'a@b.com',
      token: 'tok',
      baseUrl: 'https://app.example.com',
    });

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('https://app.example.com/portal/login/verify?token=tok'),
    );
    log.mockRestore();
    process.env.RESEND_API_KEY = prev;
  });
});
