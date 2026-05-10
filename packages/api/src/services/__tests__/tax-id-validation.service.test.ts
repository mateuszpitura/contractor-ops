// Phase 57 · Plan 03 · Task 1 — tax-id-validation.service orchestrator.
//
// Dispatches between HmrcVatClient (GB_VAT) and ViesClient (DE_USTIDNR).
// Enforces:
//   - Pre-flight checksum short-circuit (no network on malformed input).
//   - Atomic $transaction dual-write (TaxIdValidation + Contractor summary).
//   - Soft-fail → `stale` within 90d window, else `unavailable` (D-08).
//   - PII mask on every log statement (T-57-03-02).
//   - Zod schema rejection → `unavailable` (D-08 outage from user POV).

import type { HmrcVatClient, ViesClient } from '@contractor-ops/gov-api';
import { HmrcApiError, ViesApiError } from '@contractor-ops/gov-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaxIdValidationInput } from '../tax-id-validation.service.js';
import { isValidationFresh, validateTaxId } from '../tax-id-validation.service.js';

// ---------------------------------------------------------------------------
// Prisma stub — per-test fresh fakes
// ---------------------------------------------------------------------------

type PrismaLike = {
  taxIdValidation: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  contractor: {
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

function makePrisma(): PrismaLike {
  const prisma: PrismaLike = {
    taxIdValidation: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    contractor: {
      update: vi.fn(),
    },
    // Default: array form runs resolves with each promise result (identical to real Prisma behavior for `$transaction([...])`).
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
  return prisma;
}

function makeHmrc(): HmrcVatClient {
  return {
    checkVatNumber: vi.fn(),
  } as unknown as HmrcVatClient;
}

function makeVies(): ViesClient {
  return {
    checkVatNumber: vi.fn(),
  } as unknown as ViesClient;
}

const baseInputGB: TaxIdValidationInput = {
  organizationId: 'org_1',
  contractorId: 'ctr_1',
  taxIdType: 'GB_VAT',
  taxIdValue: 'GB193054661',
  actor: { userId: 'usr_1' },
};

const baseInputDE: TaxIdValidationInput = {
  organizationId: 'org_1',
  contractorId: 'ctr_1',
  taxIdType: 'DE_USTIDNR',
  // Valid DE USt-IdNr (MOD 11,10 passes): 136695976
  taxIdValue: 'DE136695976',
  actor: { userId: 'usr_1' },
};

const NOW = new Date('2026-04-13T10:00:00Z');

// PII safety guard (T-57-03-02): the orchestrator must never write the raw
// `taxIdValue` to console — it relies on Pino redact paths in
// @contractor-ops/logger for structured bodies and never calls console.*
// directly. We spy on console regardless so the regression test below can
// verify the invariant even if a future change accidentally introduces
// `console.log(input)`.
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tax-id-validation.service — pre-flight short-circuit', () => {
  it('rejects format-invalid GB VRN locally without hitting HMRC', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_1' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    const out = await validateTaxId(
      { ...baseInputGB, taxIdValue: 'GB12' },
      { db: prisma as never, hmrcClient: hmrc, viesClient: vies, now: () => NOW },
    );

    expect(out.responseStatus).toBe('invalid');
    expect(out.source).toBe('local-checksum');
    expect(hmrc.checkVatNumber).not.toHaveBeenCalled();
    expect(vies.checkVatNumber).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const createArgs = prisma.taxIdValidation.create.mock.calls[0][0];
    expect(createArgs.data.apiProvider).toBe('local-checksum');
    expect(createArgs.data.responseStatus).toBe('invalid');
  });

  it('rejects format-invalid DE USt-IdNr locally without hitting VIES', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_2' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    const out = await validateTaxId(
      { ...baseInputDE, taxIdValue: 'DE1' },
      { db: prisma as never, hmrcClient: hmrc, viesClient: vies, now: () => NOW },
    );

    expect(out.responseStatus).toBe('invalid');
    expect(out.source).toBe('local-checksum');
    expect(vies.checkVatNumber).not.toHaveBeenCalled();
  });
});

describe('tax-id-validation.service — happy path', () => {
  it('GB: dispatches to HmrcVatClient and atomically writes TaxIdValidation + Contractor summary', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    vi.mocked(hmrc.checkVatNumber).mockResolvedValue({
      status: 'valid',
      raw: {
        target: {
          vrn: '193054661',
          name: 'ACME Ltd',
          address: { line1: '1 High St', postcode: 'E1 7AA', countryCode: 'GB' },
        },
        processingDate: '2026-04-13T10:00:00Z',
        consultationNumber: 'HMRC-XYZ-001',
      } as never,
      confirmationRef: 'HMRC-XYZ-001',
    });
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_3' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    const out = await validateTaxId(baseInputGB, {
      db: prisma as never,
      hmrcClient: hmrc,
      viesClient: vies,
      now: () => NOW,
    });

    expect(hmrc.checkVatNumber).toHaveBeenCalledWith('193054661', {
      organizationId: 'org_1',
      useVerifiedLookup: true,
    });
    expect(out.responseStatus).toBe('valid');
    expect(out.confirmationRef).toBe('HMRC-XYZ-001');
    expect(out.source).toBe('api');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Both ops accepted into single $transaction array
    const txArgs = prisma.$transaction.mock.calls[0][0];
    expect(Array.isArray(txArgs)).toBe(true);
    expect(txArgs).toHaveLength(2);
    const createArgs = prisma.taxIdValidation.create.mock.calls[0][0];
    expect(createArgs.data.organizationId).toBe('org_1');
    expect(createArgs.data.apiProvider).toBe('hmrc');
    expect(createArgs.data.responseStatus).toBe('valid');
    expect(createArgs.data.confirmationRef).toBe('HMRC-XYZ-001');
    const updateArgs = prisma.contractor.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'ctr_1' });
    expect(updateArgs.data.latestVatValidatedAt).toEqual(NOW);
    expect(updateArgs.data.latestVatValidationStatus).toBe('valid');
  });

  it('DE: dispatches to ViesClient with qualified=true', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    vi.mocked(vies.checkVatNumber).mockResolvedValue({
      status: 'valid',
      raw: {
        countryCode: 'DE',
        vatNumber: '136695976',
        isValid: true,
        requestIdentifier: 'VIES-QUAL-42',
      } as never,
      confirmationRef: 'VIES-QUAL-42',
    });
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_4' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    const out = await validateTaxId(baseInputDE, {
      db: prisma as never,
      hmrcClient: hmrc,
      viesClient: vies,
      now: () => NOW,
    });

    expect(vies.checkVatNumber).toHaveBeenCalledWith('DE', '136695976', {
      organizationId: 'org_1',
      qualified: true,
    });
    expect(out.responseStatus).toBe('valid');
    expect(out.confirmationRef).toBe('VIES-QUAL-42');
    const createArgs = prisma.taxIdValidation.create.mock.calls[0][0];
    expect(createArgs.data.apiProvider).toBe('vies');
  });
});

describe('tax-id-validation.service — soft-fail (D-08)', () => {
  it('HMRC throws 503 + prior valid row within 90d → returns stale + writes stale row', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    vi.mocked(hmrc.checkVatNumber).mockRejectedValue(new HmrcApiError('HMRC down', 503));
    const priorDate = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    prisma.taxIdValidation.findFirst.mockResolvedValue({
      responseStatus: 'valid',
      requestedAt: priorDate,
      confirmationRef: 'HMRC-PRIOR-100',
    });
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_5' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    const out = await validateTaxId(baseInputGB, {
      db: prisma as never,
      hmrcClient: hmrc,
      viesClient: vies,
      now: () => NOW,
    });

    expect(out.responseStatus).toBe('stale');
    expect(out.source).toBe('stale-cache');
    expect(out.confirmationRef).toBe('HMRC-PRIOR-100');
    const createArgs = prisma.taxIdValidation.create.mock.calls[0][0];
    expect(createArgs.data.responseStatus).toBe('stale');
    expect(createArgs.data.errorMessage).toContain('HMRC down');
  });

  it('VIES throws 500 + no prior valid row → returns unavailable', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    vi.mocked(vies.checkVatNumber).mockRejectedValue(new ViesApiError('VIES 500', 500));
    prisma.taxIdValidation.findFirst.mockResolvedValue(null);
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_6' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    const out = await validateTaxId(baseInputDE, {
      db: prisma as never,
      hmrcClient: hmrc,
      viesClient: vies,
      now: () => NOW,
    });

    expect(out.responseStatus).toBe('unavailable');
    const createArgs = prisma.taxIdValidation.create.mock.calls[0][0];
    expect(createArgs.data.responseStatus).toBe('unavailable');
  });

  it('prior valid from 91 days ago → stale window exceeded → unavailable', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    vi.mocked(hmrc.checkVatNumber).mockRejectedValue(new HmrcApiError('HMRC down', 503));
    const oldDate = new Date(NOW.getTime() - 91 * 24 * 60 * 60 * 1000);
    prisma.taxIdValidation.findFirst.mockResolvedValue({
      responseStatus: 'valid',
      requestedAt: oldDate,
      confirmationRef: 'HMRC-OLD-001',
    });
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_7' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    const out = await validateTaxId(baseInputGB, {
      db: prisma as never,
      hmrcClient: hmrc,
      viesClient: vies,
      now: () => NOW,
    });

    expect(out.responseStatus).toBe('unavailable');
  });
});

describe('tax-id-validation.service — atomic dual-write', () => {
  it('if contractor.update throws inside $transaction, create is rolled back (both fail together)', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    vi.mocked(hmrc.checkVatNumber).mockResolvedValue({
      status: 'valid',
      raw: { target: { vrn: '193054661' } } as never,
      confirmationRef: 'HMRC-ABC',
    });
    // Simulate Prisma's $transaction failing atomically: the whole promise rejects
    // and neither the create nor the update "commits" (from caller's POV).
    prisma.$transaction.mockRejectedValue(new Error('contractor FK violation'));

    await expect(
      validateTaxId(baseInputGB, {
        db: prisma as never,
        hmrcClient: hmrc,
        viesClient: vies,
        now: () => NOW,
      }),
    ).rejects.toThrow('contractor FK violation');
    // Sanity: the orchestrator used $transaction (not separate writes).
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('tax-id-validation.service — PII logging safety', () => {
  it('error logs never contain the raw VAT value', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    vi.mocked(hmrc.checkVatNumber).mockRejectedValue(new HmrcApiError('HMRC exploded', 503));
    prisma.taxIdValidation.findFirst.mockResolvedValue(null);
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_pii' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    await validateTaxId(baseInputGB, {
      db: prisma as never,
      hmrcClient: hmrc,
      viesClient: vies,
      now: () => NOW,
    });

    // Inspect every console call — ensure no raw GB193054661 appears.
    const allCalls = [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls].flat();
    for (const arg of allCalls) {
      const s = typeof arg === 'string' ? arg : JSON.stringify(arg);
      expect(s).not.toContain('GB193054661');
    }
  });
});

describe('tax-id-validation.service — dispatch guards', () => {
  it('throws on unsupported taxIdType BEFORE any I/O', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();

    await expect(
      validateTaxId(
        { ...baseInputGB, taxIdType: 'FR_VAT' as never },
        { db: prisma as never, hmrcClient: hmrc, viesClient: vies, now: () => NOW },
      ),
    ).rejects.toThrow(/Unsupported taxIdType/);
    expect(hmrc.checkVatNumber).not.toHaveBeenCalled();
    expect(vies.checkVatNumber).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('tax-id-validation.service — Zod schema failure surfaces as unavailable', () => {
  it('ViesClient throws ViesApiError("VIES response schema violation", 500) → orchestrator maps to unavailable', async () => {
    const prisma = makePrisma();
    const hmrc = makeHmrc();
    const vies = makeVies();
    vi.mocked(vies.checkVatNumber).mockRejectedValue(
      new ViesApiError('VIES response schema violation', 500),
    );
    prisma.taxIdValidation.findFirst.mockResolvedValue(null);
    prisma.taxIdValidation.create.mockResolvedValue({ id: 'tiv_schema' });
    prisma.contractor.update.mockResolvedValue({ id: 'ctr_1' });

    const out = await validateTaxId(baseInputDE, {
      db: prisma as never,
      hmrcClient: hmrc,
      viesClient: vies,
      now: () => NOW,
    });
    expect(out.responseStatus).toBe('unavailable');
    const createArgs = prisma.taxIdValidation.create.mock.calls[0][0];
    expect(createArgs.data.errorMessage).toContain('schema violation');
  });
});

describe('isValidationFresh', () => {
  it('returns true for a valid row within 90 days', () => {
    const v = {
      responseStatus: 'valid' as const,
      requestedAt: new Date(NOW.getTime() - 89 * 24 * 60 * 60 * 1000),
    };
    expect(isValidationFresh(v, NOW)).toBe(true);
  });

  it('returns false for a valid row exactly 91 days old', () => {
    const v = {
      responseStatus: 'valid' as const,
      requestedAt: new Date(NOW.getTime() - 91 * 24 * 60 * 60 * 1000),
    };
    expect(isValidationFresh(v, NOW)).toBe(false);
  });

  it('returns false for a non-valid row even if recent', () => {
    const v = {
      responseStatus: 'invalid' as const,
      requestedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
    };
    expect(isValidationFresh(v, NOW)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidationFresh(null, NOW)).toBe(false);
  });
});
