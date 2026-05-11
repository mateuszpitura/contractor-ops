// Phase 64 · D-04 — Bundle hygiene: classification layout gate test (LEGAL-08).
//
// Verifies that:
// 1. The classification layout.tsx calls notFound() when the flag resolves to false.
// 2. The layout renders children when the flag resolves to true.
//
// Tests the gate logic rather than a full Next.js integration test (which would
// require a running server). Full route integration is covered by manual verification.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth
vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock feature-flags evaluator
vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(),
  registerClassificationDisclaimerGate: vi.fn(),
}));

// Mock next/navigation
const notFoundMock = vi.fn();
vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock prisma
vi.mock('@contractor-ops/db', () => ({
  prisma: {
    organization: {
      findFirst: vi.fn().mockResolvedValue({ countryCode: 'GB', dataRegion: 'EU' }),
    },
  },
}));

import { auth } from '@contractor-ops/auth';
import { evaluate } from '@contractor-ops/feature-flags';

const mockAuth = auth.api.getSession as unknown as ReturnType<typeof vi.fn>;
const mockEvaluate = evaluate as unknown as ReturnType<typeof vi.fn>;

const SESSION_FIXTURE = {
  session: { activeOrganizationId: 'org-1', userId: 'user-1' },
  user: { id: 'user-1' },
};

describe('Classification layout flag gate (Phase 64 D-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION_FIXTURE);
  });

  it('calls notFound() when flag is disabled', async () => {
    mockEvaluate.mockReturnValue({ enabled: false, reason: 'unleash' });

    const { default: ClassificationLayout } = await import('../layout');

    await ClassificationLayout({ children: null }).catch(() => {
      /* ignore notFound() throw */
    });

    expect(notFoundMock).toHaveBeenCalled();
  });

  it('does not call notFound() when flag is enabled', async () => {
    mockEvaluate.mockReturnValue({ enabled: true, reason: 'unleash' });

    const { default: ClassificationLayout } = await import('../layout');

    await ClassificationLayout({ children: null }).catch(() => {
      /* ignore notFound() throw */
    });

    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('calls notFound() when session has no activeOrganizationId', async () => {
    mockAuth.mockResolvedValue({ session: { activeOrganizationId: null }, user: { id: 'u' } });

    const { default: ClassificationLayout } = await import('../layout');
    await ClassificationLayout({ children: null }).catch(() => {
      /* ignore notFound() throw */
    });

    expect(notFoundMock).toHaveBeenCalled();
  });

  it('evaluate is called with module.classification-engine key', async () => {
    mockEvaluate.mockReturnValue({ enabled: true, reason: 'unleash' });

    const { default: ClassificationLayout } = await import('../layout');
    await ClassificationLayout({ children: null }).catch(() => {
      /* ignore notFound() throw */
    });

    expect(mockEvaluate).toHaveBeenCalledWith(
      'module.classification-engine',
      expect.objectContaining({ organizationId: 'org-1' }),
    );
  });
});
