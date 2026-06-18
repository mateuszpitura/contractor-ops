import type { Prisma, TaxIdType } from '@contractor-ops/db';
import type { UspsAddressCache } from '@contractor-ops/gov-api';
import { GovApiRateLimiter, USPS_RATE_LIMIT, UspsAddressClient } from '@contractor-ops/gov-api';
import type { ContractorFilters } from '@contractor-ops/validators';
import { getServerEnv } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { getHmrcVatClient, getViesClient } from '../../gov-api-clients';
import { findOrThrow } from '../../lib/find-or-throw';
import { encryptBankAccount } from '../../services/bank-account-crypto';
import { validateTaxId } from '../../services/tax-id-validation.service';
import type { DbClient } from '../../services/types';

// ---------------------------------------------------------------------------
// USPS advisory address validation
// ---------------------------------------------------------------------------

/** No-op address cache — the limiter + USPS fail-open path are the safety net. */
const uspsNoopCache: UspsAddressCache = {
  get: async () => null,
  set: async () => {
    // Intentional no-op: this surface does not cache USPS results (the 60/hr
    // limiter + USPS's own fail-open path are the budget/safety controls).
  },
};

let uspsClientInstance: UspsAddressClient | null = null;

/** Process-lifetime USPS client (creds from optional env; absent → unavailable). */
function getUspsAddressClient(): UspsAddressClient {
  if (uspsClientInstance) return uspsClientInstance;
  const env = getServerEnv();
  uspsClientInstance = new UspsAddressClient({
    clientId: env.USPS_CLIENT_ID,
    clientSecret: env.USPS_CLIENT_SECRET,
    rateLimiter: new GovApiRateLimiter('usps-address', USPS_RATE_LIMIT),
    cache: uspsNoopCache,
  });
  return uspsClientInstance;
}

/** The flat US-profile fields the JSONB blob carries (SSN is excluded by design). */
export interface UsProfileFieldsInput {
  entityType?: string;
  ein?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

/**
 * Merge the provided US profile fields onto the prior `countryFields` blob.
 * EIN + address only — SSN is NEVER written here (it has dedicated encrypted
 * columns; mixing it into the JSONB would leak via the wide read path).
 */
export function buildUsCountryFields(
  prev: Record<string, unknown>,
  input: UsProfileFieldsInput,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...prev };
  if (input.entityType !== undefined) next.entityType = input.entityType;
  if (input.ein !== undefined) next.ein = input.ein;
  if (input.addressLine1 !== undefined) next.addressLine1 = input.addressLine1;
  if (input.city !== undefined) next.city = input.city;
  if (input.state !== undefined) next.state = input.state;
  if (input.zipCode !== undefined) next.zipCode = input.zipCode;
  return next;
}

/**
 * Run USPS CASS validation advisory + non-blocking. Mutates `data` (USPS
 * verified flag + timestamp) and, on a normalized match, the `countryFields`
 * blob in place. NEVER throws to the save path — a USPS / limiter / cache
 * failure leaves the save successful with `uspsVerified = false`.
 */
export async function applyUspsAdvisory(
  data: Prisma.ContractorUpdateInput,
  countryFields: Record<string, unknown>,
  address: { addressLine1: string; city: string; state: string; zipCode: string },
): Promise<void> {
  data.uspsValidatedAt = new Date();
  try {
    const usps = await getUspsAddressClient().validateAddress({
      streetAddress: address.addressLine1,
      city: address.city,
      state: address.state,
      ZIPCode: address.zipCode,
    });
    data.uspsVerified = usps.verified;
    if (usps.normalized) {
      countryFields.addressLine1 = usps.normalized.streetAddress;
      countryFields.city = usps.normalized.city;
      countryFields.state = usps.normalized.state;
      countryFields.zipCode = usps.normalized.ZIPCode;
      data.countryFields = countryFields as Prisma.InputJsonValue;
    }
  } catch {
    // Defensive: validateAddress is already fail-open, but a save must never
    // fail because USPS (or an injected limiter/cache) threw.
    data.uspsVerified = false;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle transition map
// ---------------------------------------------------------------------------

export const LEGAL_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ONBOARDING', 'ACTIVE'],
  ONBOARDING: ['ACTIVE', 'ENDED'],
  ACTIVE: ['OFFBOARDING', 'ENDED'],
  OFFBOARDING: ['ENDED'],
  ENDED: [],
};

// ---------------------------------------------------------------------------
// Compliance health computation
// ---------------------------------------------------------------------------

type HealthFactor = {
  key: 'documents' | 'contract' | 'tasks' | 'invoices';
  status: 'green' | 'yellow' | 'red';
  label: string;
  detail?: string;
};

type ComplianceHealthResult = {
  overall: 'green' | 'yellow' | 'red';
  factors: HealthFactor[];
};

export function computeComplianceHealth(params: {
  complianceItems: Array<{ status: string; expiresAt: Date | null }>;
  activeContractCount: number;
  expiringContractCount: number;
  overdueTaskCount: number;
  unpaidInvoiceCount: number;
}): ComplianceHealthResult {
  const factors: HealthFactor[] = [];

  const hasMissing = params.complianceItems.some(i => i.status === 'MISSING');
  const hasExpiredOrPending = params.complianceItems.some(
    i => i.status === 'EXPIRED' || i.status === 'PENDING',
  );
  if (hasMissing) {
    factors.push({
      key: 'documents',
      status: 'red',
      label: 'Missing compliance documents',
    });
  } else if (hasExpiredOrPending) {
    factors.push({
      key: 'documents',
      status: 'yellow',
      label: 'Pending or expired compliance documents',
    });
  } else {
    factors.push({
      key: 'documents',
      status: 'green',
      label: 'Documents OK',
    });
  }

  if (params.activeContractCount === 0) {
    factors.push({
      key: 'contract',
      status: 'red',
      label: 'No active contract',
    });
  } else if (params.expiringContractCount > 0) {
    factors.push({
      key: 'contract',
      status: 'yellow',
      label: 'Contract expiring soon',
    });
  } else {
    factors.push({ key: 'contract', status: 'green', label: 'Contract OK' });
  }

  if (params.overdueTaskCount > 0) {
    factors.push({
      key: 'tasks',
      status: 'red',
      label: 'Overdue tasks',
      detail: `${params.overdueTaskCount} overdue`,
    });
  } else {
    factors.push({ key: 'tasks', status: 'green', label: 'Tasks OK' });
  }

  if (params.unpaidInvoiceCount > 0) {
    factors.push({
      key: 'invoices',
      status: 'red',
      label: 'Unpaid invoices',
      detail: `${params.unpaidInvoiceCount} unpaid`,
    });
  } else {
    factors.push({ key: 'invoices', status: 'green', label: 'Invoices OK' });
  }

  const hasRed = factors.some(f => f.status === 'red');
  const hasYellow = factors.some(f => f.status === 'yellow');
  const overall = hasRed ? 'red' : hasYellow ? 'yellow' : 'green';

  return { overall, factors };
}

/** Simplified health badge for list view: based on compliance item counts only. */
export function computeListHealthBadge(counts: {
  missingOrExpired: number;
  pending: number;
}): 'green' | 'yellow' | 'red' {
  if (counts.missingOrExpired > 0) return 'red';
  if (counts.pending > 0) return 'yellow';
  return 'green';
}

// ---------------------------------------------------------------------------
// Contractor list filtering — shared predicates + where-builder
//
// `list` (the table) and `insights` (the band) both build their population from
// these helpers so a count in the band always matches the rows in the table.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Onboarding is "stalled" once a run is BLOCKED or has sat IN_PROGRESS this long. */
export const STALLED_ONBOARDING_AGE_DAYS = 14;

/** Contractors holding an active/expiring contract that ends within `withinDays`. */
export function expiringContractsPredicate(
  now: Date,
  withinDays: number,
): Prisma.ContractorWhereInput {
  return {
    contracts: {
      some: {
        status: { in: ['ACTIVE', 'EXPIRING'] },
        endDate: { gte: now, lte: new Date(now.getTime() + withinDays * MS_PER_DAY) },
        deletedAt: null,
      },
    },
  };
}

/** Contractors with at least one payment-blocked (FAILED) invoice. */
export function paymentBlockedPredicate(): Prisma.ContractorWhereInput {
  return { invoices: { some: { paymentStatus: 'FAILED', deletedAt: null } } };
}

/** Onboarding contractors whose onboarding workflow has stalled. */
export function stalledOnboardingPredicate(now: Date): Prisma.ContractorWhereInput {
  const staleBefore = new Date(now.getTime() - STALLED_ONBOARDING_AGE_DAYS * MS_PER_DAY);
  return {
    lifecycleStage: 'ONBOARDING',
    workflowRuns: {
      some: {
        OR: [{ status: 'BLOCKED' }, { status: 'IN_PROGRESS', startedAt: { lt: staleBefore } }],
      },
    },
  };
}

type WhereBuilderClient = Pick<DbClient, '$queryRaw'>;

/**
 * Build the `Contractor` where-clause shared by `list` and `insights`. Column
 * facets become direct predicates; the FTS `search` and JSONB `billingModel`
 * facets resolve to id-sets via raw SQL and are intersected. An id-set facet
 * that matches nothing returns **null** — callers must short-circuit to an empty
 * / all-zero result rather than running an unconstrained scan.
 *
 * `complianceHealth` is intentionally NOT handled here: it is derived in JS from
 * compliance-item counts. `list` post-filters on it; `insights` tallies it.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: query where-clause builder — one guarded predicate per filter facet plus id-set intersection with null short-circuit; the branch count mirrors the filter surface and must stay in one place.
export async function buildContractorListWhere(
  db: WhereBuilderClient,
  organizationId: string,
  params: { search?: string; filters?: ContractorFilters },
  now: Date = new Date(),
): Promise<Prisma.ContractorWhereInput | null> {
  const { search, filters } = params;
  const where: Prisma.ContractorWhereInput = { organizationId, deletedAt: null };
  const and: Prisma.ContractorWhereInput[] = [];

  if (filters?.status?.length) where.status = { in: filters.status };
  if (filters?.lifecycleStage?.length) where.lifecycleStage = { in: filters.lifecycleStage };
  if (filters?.ownerUserId?.length) where.ownerUserId = { in: filters.ownerUserId };
  if (filters?.primaryTeamId?.length) where.primaryTeamId = { in: filters.primaryTeamId };
  if (filters?.type?.length) where.type = { in: filters.type };
  if (filters?.countryCode?.length) where.countryCode = { in: filters.countryCode };

  if (filters?.expiringWithin) and.push(expiringContractsPredicate(now, filters.expiringWithin));
  if (filters?.paymentBlocked) and.push(paymentBlockedPredicate());
  if (filters?.stalled) and.push(stalledOnboardingPredicate(now));

  const idSets: string[][] = [];

  if (filters?.billingModel?.length) {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Contractor"
      WHERE "organizationId" = ${organizationId}
        AND "deletedAt" IS NULL
        AND "customFieldsJson"->>'billingModel' = ANY(${filters.billingModel}::text[])
    `;
    if (rows.length === 0) return null;
    idSets.push(rows.map(r => r.id));
  }

  if (search && search.length >= 2) {
    const terms = search
      .trim()
      .split(/\s+/)
      .map(t => t.replace(/[^a-zA-Z0-9À-ɏ]/g, ''))
      .filter(Boolean)
      .map(t => `${t}:*`)
      .join(' & ');
    if (terms) {
      const rows = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Contractor"
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
          AND "search_vector" @@ to_tsquery('simple', ${terms})
      `;
      if (rows.length === 0) return null;
      idSets.push(rows.map(r => r.id));
    }
  }

  if (idSets.length > 0) {
    let intersection = idSets[0] ?? [];
    for (let i = 1; i < idSets.length; i++) {
      const set = new Set(idSets[i]);
      intersection = intersection.filter(id => set.has(id));
    }
    if (intersection.length === 0) return null;
    where.id = { in: intersection };
  }

  if (and.length > 0) where.AND = and;

  return where;
}

// ---------------------------------------------------------------------------
// Contractor update helpers
// ---------------------------------------------------------------------------

function relationUpdate(
  id: string | undefined | null,
): { connect: { id: string } } | { disconnect: true } | undefined {
  if (id === undefined) return;
  return id ? { connect: { id } } : { disconnect: true };
}

export function buildContractorRelationUpdates(input: {
  ownerUserId?: string | null;
  primaryTeamId?: string | null;
  primaryProjectId?: string | null;
  defaultCostCenterId?: string | null;
}): Prisma.ContractorUpdateInput {
  const updateData: Prisma.ContractorUpdateInput = {};

  const ownerUpdate = relationUpdate(input.ownerUserId);
  if (ownerUpdate) updateData.owner = ownerUpdate;

  const teamUpdate = relationUpdate(input.primaryTeamId);
  if (teamUpdate) updateData.primaryTeam = teamUpdate;

  const projectUpdate = relationUpdate(input.primaryProjectId);
  if (projectUpdate) updateData.primaryProject = projectUpdate;

  const costCenterUpdate = relationUpdate(input.defaultCostCenterId);
  if (costCenterUpdate) updateData.defaultCostCenter = costCenterUpdate;

  return updateData;
}

export function mergeCustomBillingFields(
  existing: Record<string, unknown>,
  billingModel: unknown,
  rateValueMinor: unknown,
): Record<string, unknown> | undefined {
  if (billingModel === undefined && rateValueMinor === undefined) return;

  return {
    ...existing,
    ...(billingModel === undefined ? {} : { billingModel }),
    ...(rateValueMinor === undefined ? {} : { rateValueMinor }),
  };
}

function resolveTaxIdType(countryCode: string): TaxIdType | null {
  if (countryCode === 'GB') return 'GB_VAT';
  if (countryCode === 'DE') return 'DE_USTIDNR';
  return null;
}

export async function handleVatIdChange(
  db: DbClient,
  contractorId: string,
  organizationId: string,
  userId: string,
  prior: { vatId: string | null },
  updated: { vatId: string | null; countryCode: string },
): Promise<void> {
  const priorVatId = prior.vatId ?? null;
  const nextVatId = updated.vatId ?? null;
  if (priorVatId === nextVatId) return;

  if (nextVatId) {
    const taxIdType = resolveTaxIdType(updated.countryCode);
    if (taxIdType) {
      await validateTaxId(
        { organizationId, contractorId, taxIdType, taxIdValue: nextVatId, actor: { userId } },
        { db, hmrcClient: getHmrcVatClient(), viesClient: getViesClient() },
      );
    }
  } else {
    await db.contractor.update({
      where: { id: contractorId },
      data: { latestVatValidatedAt: null, latestVatValidationStatus: null },
    });
  }
}

export async function updateBillingProfileIfNeeded(
  db: DbClient,
  contractorId: string,
  organizationId: string,
  bankAccount: string | undefined | null,
  paymentTermsDays: number | undefined | null,
): Promise<void> {
  if (bankAccount === undefined && paymentTermsDays === undefined) return;

  const defaultProfile = await db.contractorBillingProfile.findFirst({
    where: { contractorId, organizationId, isDefault: true },
  });
  if (!defaultProfile) return;

  const profileUpdate: Prisma.ContractorBillingProfileUpdateInput = {};
  if (bankAccount !== undefined) {
    const cleaned = bankAccount ? bankAccount.replace(/\s/g, '') : null;
    profileUpdate.bankAccountEncrypted = cleaned ? encryptBankAccount(cleaned) : null;
    profileUpdate.bankAccountMasked = cleaned ? `****${cleaned.slice(-4)}` : null;
  }
  if (paymentTermsDays !== undefined) {
    profileUpdate.paymentTermsDays = paymentTermsDays ?? null;
  }
  await db.contractorBillingProfile.update({
    where: { id: defaultProfile.id },
    data: profileUpdate,
  });
}

export function diffContractorFields(
  existing: Record<string, unknown>,
  updateData: Record<string, unknown>,
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const WATCHED = [
    'countryCode',
    'status',
    'lifecycleStage',
    'legalName',
    'displayName',
    'vatId',
    'taxId',
    'ownerUserId',
    'primaryTeamId',
    'primaryProjectId',
  ] as const;
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const field of WATCHED) {
    if (field in updateData && existing[field] !== updateData[field]) {
      oldValues[field] = existing[field] ?? null;
      newValues[field] = updateData[field] ?? null;
    }
  }
  return { oldValues, newValues };
}

export async function validateContractorVatId(
  ctx: { db: DbClient; organizationId: string; user?: { id: string } | null },
  contractorId: string,
) {
  const contractor = await findOrThrow(
    () =>
      ctx.db.contractor.findFirst({
        where: {
          id: contractorId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true, countryCode: true, vatId: true },
      }),
    E.CONTRACTOR_NOT_FOUND,
  );
  if (!contractor.vatId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.CONTRACTOR_NO_VAT_ID,
    });
  }
  const taxIdType: TaxIdType | null =
    contractor.countryCode === 'GB'
      ? 'GB_VAT'
      : contractor.countryCode === 'DE'
        ? 'DE_USTIDNR'
        : null;
  if (!taxIdType) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.VAT_VALIDATION_UNSUPPORTED_COUNTRY,
    });
  }
  const result = await validateTaxId(
    {
      organizationId: ctx.organizationId,
      contractorId: contractor.id,
      taxIdType,
      taxIdValue: contractor.vatId,
      actor: { userId: ctx.user?.id },
    },
    {
      db: ctx.db,
      hmrcClient: getHmrcVatClient(),
      viesClient: getViesClient(),
    },
  );
  return {
    responseStatus: result.responseStatus,
    confirmationRef: result.confirmationRef,
    validatedAt: result.requestedAt,
    source: result.source,
  };
}
