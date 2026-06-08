import type { Prisma, TaxIdType } from '@contractor-ops/db';
import type { UspsAddressCache } from '@contractor-ops/gov-api';
import { GovApiRateLimiter, USPS_RATE_LIMIT, UspsAddressClient } from '@contractor-ops/gov-api';
import { lookupCompanyByNip } from '@contractor-ops/integrations/services/company-registry-service';
import {
  companyLookupSchema,
  contractorCreateSchema,
  contractorLifecycleTransitionSchema,
  contractorListSchema,
  contractorUpdateSchema,
  countryFieldsSchemaMap,
  getServerEnv,
  isValidEin,
  isValidSsn,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { getHmrcVatClient, getViesClient } from '../../gov-api-clients';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { encryptBankAccount } from '../../services/bank-account-crypto';
import { syncSeatCountForOrg } from '../../services/billing-service';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { captureEvent } from '../../services/posthog';
import { sanitizeStrings } from '../../services/sanitize';
import { decryptSsn, encryptSsn } from '../../services/ssn-crypto';
import { validateTaxId } from '../../services/tax-id-validation.service';
import type { DbClient } from '../../services/types';

// ---------------------------------------------------------------------------
// Phase 84 · Plan 05 (US-FIELD-03 / D-03) — USPS advisory address validation
// ---------------------------------------------------------------------------
//
// A process-lifetime UspsAddressClient for the on-save CASS normalize. USPS is
// advisory and NON-BLOCKING (D-03): `validateAddress` never throws — missing
// creds (LOCAL-ONLY), self-throttle, USPS/Redis outage all resolve to an
// `unavailable` result so a contractor save can never be blocked by USPS.
//
// The client keys its limiter on a fixed GLOBAL identifier (the 60/hr cap is
// per-credential, not per-org — Pitfall 4); the cache is a no-op here (the
// limiter + USPS's own fail-open path are the safety net), so every save
// consults USPS directly when creds are present and within budget.
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
interface UsProfileFieldsInput {
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
function buildUsCountryFields(
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
 * Run USPS CASS validation advisory + non-blocking (D-03). Mutates `data` (USPS
 * verified flag + timestamp) and, on a normalized match, the `countryFields`
 * blob in place. NEVER throws to the save path — a USPS / limiter / cache
 * failure leaves the save successful with `uspsVerified = false`.
 */
async function applyUspsAdvisory(
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

const LEGAL_TRANSITIONS: Record<string, string[]> = {
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

function computeComplianceHealth(params: {
  complianceItems: Array<{ status: string; expiresAt: Date | null }>;
  activeContractCount: number;
  expiringContractCount: number;
  overdueTaskCount: number;
  unpaidInvoiceCount: number;
}): ComplianceHealthResult {
  const factors: HealthFactor[] = [];

  // Documents
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

  // Contract
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

  // Tasks (not yet in Phase 2 — default green)
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

  // Invoices (not yet in Phase 2 — default green)
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

  // Overall: red if any red, yellow if any yellow, green otherwise
  const hasRed = factors.some(f => f.status === 'red');
  const hasYellow = factors.some(f => f.status === 'yellow');
  const overall = hasRed ? 'red' : hasYellow ? 'yellow' : 'green';

  return { overall, factors };
}

/**
 * Simplified health badge for list view: based on compliance item counts only.
 */
function computeListHealthBadge(counts: {
  missingOrExpired: number;
  pending: number;
}): 'green' | 'yellow' | 'red' {
  if (counts.missingOrExpired > 0) return 'red';
  if (counts.pending > 0) return 'yellow';
  return 'green';
}

// ---------------------------------------------------------------------------
// Contractor update helpers
// ---------------------------------------------------------------------------

/**
 * Builds a Prisma relation connect/disconnect object for optional relation fields.
 */
function relationUpdate(
  id: string | undefined | null,
): { connect: { id: string } } | { disconnect: true } | undefined {
  if (id === undefined) return;
  return id ? { connect: { id } } : { disconnect: true };
}

/**
 * Builds the Prisma update data for contractor relation fields.
 */
function buildContractorRelationUpdates(input: {
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

/**
 * Merges billing custom fields into the existing customFieldsJson.
 */
function mergeCustomBillingFields(
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

/**
 * Resolves the TaxIdType for a contractor's country code, or null if unsupported.
 */
function resolveTaxIdType(countryCode: string): TaxIdType | null {
  if (countryCode === 'GB') return 'GB_VAT';
  if (countryCode === 'DE') return 'DE_USTIDNR';
  return null;
}

/**
 * Handles VAT ID change side-effects: validates new VAT IDs or clears
 * summary fields when VAT ID is removed.
 */
async function handleVatIdChange(
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

/**
 * Updates the contractor's default billing profile when bank account
 * or payment terms change.
 */
async function updateBillingProfileIfNeeded(
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

/**
 * Phase 60 CLASS-08 — picks the contractor fields the reassessment scan
 * treats as "material" (+ denormalised status/lifecycle) and diffs old/new
 * values for the audit payload. Keeps the audit row small and targeted so
 * the scan doesn't have to re-filter irrelevant noise.
 */
function diffContractorFields(
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

// ---------------------------------------------------------------------------
// HMRC / VIES VAT-ID validation helper (Phase 57 · Plan 04)
// ---------------------------------------------------------------------------

/**
 * Loads a tenant-scoped contractor, derives the supported tax-ID type from
 * its country, and dispatches HMRC / VIES validation through the shared
 * orchestrator. Used by both validateVat (D-07 trigger 3) and revalidateVat
 * (explicit re-run) which previously inlined identical 50-line bodies.
 */
async function validateContractorVatId(
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

// ---------------------------------------------------------------------------
// Contractor router
// ---------------------------------------------------------------------------

export const contractorRouter = router({
  /**
   * List contractors with pagination, sorting, filtering, and full-text search.
   */
  list: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(contractorListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, filters } = input;

      const where: Prisma.ContractorWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      // Apply filters
      if (filters?.status?.length) {
        where.status = { in: filters.status };
      }
      if (filters?.lifecycleStage?.length) {
        where.lifecycleStage = { in: filters.lifecycleStage };
      }
      if (filters?.ownerUserId?.length) {
        where.ownerUserId = { in: filters.ownerUserId };
      }
      if (filters?.primaryTeamId?.length) {
        where.primaryTeamId = { in: filters.primaryTeamId };
      }
      if (filters?.type?.length) {
        where.type = { in: filters.type };
      }
      if (filters?.billingModel?.length) {
        const bmIds: Array<{ id: string }> = await ctx.db.$queryRaw`
          SELECT id FROM "Contractor"
          WHERE "organizationId" = ${ctx.organizationId}
            AND "deletedAt" IS NULL
            AND "customFieldsJson"->>'billingModel' = ANY(${filters.billingModel}::text[])
        `;
        if (bmIds.length === 0) {
          return { items: [] as Record<string, unknown>[], total: 0, page, pageSize };
        }
        where.id = { ...(where.id as Record<string, unknown>), in: bmIds.map(r => r.id) };
      }

      // Full-text search via PostgreSQL tsvector
      if (search && search.length >= 2) {
        const terms = search
          .trim()
          .split(/\s+/)
          .map(t => t.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ''))
          .filter(Boolean)
          .map(t => `${t}:*`)
          .join(' & ');

        if (terms) {
          const matchingIds: Array<{ id: string }> = await ctx.db.$queryRaw`
            SELECT id FROM "Contractor"
            WHERE "organizationId" = ${ctx.organizationId}
              AND "deletedAt" IS NULL
              AND "search_vector" @@ to_tsquery('simple', ${terms})
          `;

          if (matchingIds.length === 0) {
            return { items: [] as Record<string, unknown>[], total: 0, page, pageSize };
          }

          where.id = { in: matchingIds.map(r => r.id) };
        }
      }

      const [contractors, total] = await Promise.all([
        ctx.db.contractor.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            owner: { select: { id: true, name: true, image: true } },
            primaryTeam: { select: { id: true, name: true } },
            billingProfiles: {
              where: { isDefault: true },
              take: 1,
              select: {
                id: true,
                legalEntityName: true,
                preferredCurrency: true,
                paymentTermsDays: true,
              },
            },
            _count: {
              select: {
                complianceItems: {
                  where: {
                    status: { in: ['MISSING', 'EXPIRED'] },
                  },
                },
              },
            },
          },
        }),
        ctx.db.contractor.count({ where }),
      ]);

      // Compute health badge and get pending counts for each contractor
      const contractorIds = contractors.map(c => c.id);
      const pendingCounts =
        contractorIds.length > 0
          ? await ctx.db.contractorComplianceItem.groupBy({
              by: ['contractorId'],
              where: {
                contractorId: { in: contractorIds },
                status: 'PENDING',
              },
              _count: true,
            })
          : [];

      const pendingMap = new Map(pendingCounts.map(p => [p.contractorId, p._count]));

      const items = contractors.map(c => ({
        ...c,
        complianceHealth: computeListHealthBadge({
          missingOrExpired: c._count.complianceItems,
          pending: pendingMap.get(c.id) ?? 0,
        }),
      }));

      // Post-filter by compliance health if requested
      if (filters?.complianceHealth?.length) {
        const filtered = items.filter(i => filters.complianceHealth?.includes(i.complianceHealth));
        return {
          items: filtered,
          total: filtered.length,
          page,
          pageSize,
        };
      }

      return { items, total, page, pageSize };
    }),

  /**
   * Get a contractor by ID with full relations and computed compliance health.
   */
  getById: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const contractor = await ctx.db.contractor.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          owner: { select: { id: true, name: true, image: true } },
          primaryTeam: { select: { id: true, name: true } },
          primaryProject: { select: { id: true, name: true } },
          defaultCostCenter: { select: { id: true, name: true } },
          billingProfiles: {
            orderBy: { isDefault: 'desc' },
            select: {
              id: true,
              legalEntityName: true,
              billingEmail: true,
              countryCode: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              postalCode: true,
              bankAccountMasked: true,
              bankName: true,
              swiftBic: true,
              preferredCurrency: true,
              paymentTermsDays: true,
              taxId: true,
              vatId: true,
              isDefault: true,
              validFrom: true,
              validTo: true,
              skontoTerms: {
                take: 1,
                select: {
                  discountPercent: true,
                  discountPeriodDays: true,
                  netPeriodDays: true,
                },
              },
            },
          },
          complianceItems: {
            include: {
              contract: { select: { id: true, title: true } },
            },
          },
          contracts: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              startDate: true,
              endDate: true,
              billingModel: true,
            },
          },
          _count: {
            select: {
              workflowRuns: true,
              invoices: true,
            },
          },
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      // Count active and expiring contracts
      const activeContractCount = contractor.contracts.filter(c => c.status === 'ACTIVE').length;
      const expiringContractCount = contractor.contracts.filter(
        c =>
          c.status === 'ACTIVE' && c.endDate && c.endDate <= thirtyDaysFromNow && c.endDate >= now,
      ).length;

      const health = computeComplianceHealth({
        complianceItems: contractor.complianceItems.map(i => ({
          status: i.status,
          expiresAt: i.expiresAt,
        })),
        activeContractCount,
        expiringContractCount,
        overdueTaskCount: 0, // Tasks not yet in Phase 2
        unpaidInvoiceCount: 0, // Invoices not yet in Phase 2
      });

      // CR-2: surface which compliance items have a document awaiting admin
      // review. satisfiedByDocumentId is set optimistically by
      // submitUploadReplacement and cleared on reject / confirmed on approve.
      // We batch-fetch statuses in one query rather than N+1 per item.
      const candidateDocIds = contractor.complianceItems
        .filter(i => i.satisfiedByDocumentId != null && i.status !== 'SATISFIED')
        .map(i => i.satisfiedByDocumentId as string);

      const pendingReviewDocIds =
        candidateDocIds.length > 0
          ? await ctx.db.document
              .findMany({
                where: { id: { in: candidateDocIds }, status: 'PENDING_REVIEW' },
                select: { id: true },
              })
              .then(docs => new Set(docs.map(d => d.id)))
          : new Set<string>();

      const complianceItems = contractor.complianceItems.map(i => ({
        ...i,
        pendingReviewDocumentId:
          i.satisfiedByDocumentId != null && pendingReviewDocIds.has(i.satisfiedByDocumentId)
            ? i.satisfiedByDocumentId
            : null,
      }));

      return {
        ...contractor,
        complianceItems,
        complianceHealth: health,
      };
    }),

  /**
   * Create a new contractor with billing profile.
   */
  create: tenantProcedure
    .use(requirePermission({ contractor: ['create'] }))
    .input(contractorCreateSchema)
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const {
        billingModel,
        rateValueMinor,
        bankAccount,
        paymentTermsDays,
        ownerUserId,
        primaryTeamId,
        primaryProjectId,
        defaultCostCenterId,
        ...companyFields
      } = input;

      const contractor = await ctx.db.$transaction(async tx => {
        const created = await tx.contractor.create({
          data: {
            organizationId: ctx.organizationId,
            legalName: companyFields.legalName,
            displayName: companyFields.displayName,
            type: companyFields.type,
            taxId: companyFields.taxId,
            vatId: companyFields.vatId,
            registrationNumber: companyFields.registrationNumber,
            email: companyFields.email,
            phone: companyFields.phone,
            countryCode: companyFields.countryCode,
            currency: companyFields.currency,
            addressLine1: companyFields.addressLine1,
            addressLine2: companyFields.addressLine2,
            city: companyFields.city,
            postalCode: companyFields.postalCode,
            status: 'ACTIVE',
            lifecycleStage: 'DRAFT',
            ownerUserId,
            primaryTeamId,
            primaryProjectId,
            defaultCostCenterId,
            customFieldsJson: { billingModel, rateValueMinor },
          },
        });

        // Create default billing profile
        const maskedIban = bankAccount ? `****${bankAccount.replace(/\s/g, '').slice(-4)}` : null;

        await tx.contractorBillingProfile.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: created.id,
            legalEntityName: companyFields.legalName,
            preferredCurrency: companyFields.currency,
            countryCode: companyFields.countryCode,
            bankAccountMasked: maskedIban,
            bankAccountEncrypted: bankAccount
              ? encryptBankAccount(bankAccount.replace(/\s/g, ''))
              : null,
            paymentTermsDays: paymentTermsDays ?? null,
            validFrom: new Date(),
            isDefault: true,
          },
        });

        // Phase 60 CLASS-08 — audit the contractor creation so the
        // reassessment-trigger scan has a deterministic event stream.
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          action: 'CREATE',
          resourceType: 'CONTRACTOR',
          resourceId: created.id,
          resourceName: created.displayName,
          oldValues: null,
          newValues: {
            legalName: created.legalName,
            displayName: created.displayName,
            countryCode: created.countryCode,
            status: created.status,
            lifecycleStage: created.lifecycleStage,
          },
          tx,
        });

        return created;
      });

      // Fire-and-forget: sync Stripe seat count after new contractor
      void syncSeatCountForOrg(ctx.organizationId);
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      // PostHog funnel: fire `first_contractor_added` only on the very first
      // contractor for the org (`activated` step in the launch funnel).
      // Performed AFTER the transaction so the count includes the row just
      // created. Fire-and-forget; PostHog failures must not block creation.
      void (async () => {
        try {
          const total = await ctx.db.contractor.count({
            where: { organizationId: ctx.organizationId },
          });
          if (total === 1 && ctx.user?.id) {
            await captureEvent({
              distinctId: ctx.user.id,
              event: 'first_contractor_added',
              organizationId: ctx.organizationId,
              properties: {
                contractor_id: contractor.id,
                country: contractor.countryCode,
              },
            });
          }
        } catch (err) {
          // Logged inside captureEvent; this catch guards the count query.
          // No re-throw — analytics is non-essential.
          void err;
        }
      })();

      return contractor;
    }),

  /**
   * Update a contractor (PATCH semantics).
   */
  update: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(z.intersection(contractorUpdateSchema, z.object({ id: z.string().min(1) })))
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const {
        id,
        billingModel,
        rateValueMinor,
        bankAccount,
        paymentTermsDays,
        ownerUserId,
        primaryTeamId,
        primaryProjectId,
        defaultCostCenterId,
        ...companyFields
      } = input;

      // Verify contractor belongs to org
      const existing = await findOrThrow(
        () =>
          ctx.db.contractor.findFirst({
            where: {
              id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACTOR_NOT_FOUND,
      );

      const updateData: Prisma.ContractorUpdateInput = {
        ...companyFields,
        ...buildContractorRelationUpdates({
          ownerUserId,
          primaryTeamId,
          primaryProjectId,
          defaultCostCenterId,
        }),
      };

      // Update customFieldsJson for billing fields
      const mergedCustomFields = mergeCustomBillingFields(
        (existing.customFieldsJson as Record<string, unknown>) ?? {},
        billingModel,
        rateValueMinor,
      );
      if (mergedCustomFields) {
        updateData.customFieldsJson = mergedCustomFields as Prisma.InputJsonValue;
      }

      const updated = await ctx.db.contractor.update({
        where: { id },
        data: updateData,
      });

      // Phase 60 CLASS-08 — audit row for reassessment-trigger scan.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id,
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: id,
        resourceName: updated.displayName,
        oldValues: diffContractorFields(existing, updateData).oldValues,
        newValues: diffContractorFields(existing, updateData).newValues,
      });

      // D-07 trigger 1: validate or clear VAT ID on change
      await handleVatIdChange(ctx.db, id, ctx.organizationId, ctx.user?.id, existing, updated);

      // Update default billing profile if billing fields changed
      await updateBillingProfileIfNeeded(
        ctx.db,
        id,
        ctx.organizationId,
        bankAccount,
        paymentTermsDays,
      );

      return updated;
    }),

  /**
   * Transition contractor lifecycle stage with validation.
   */
  updateLifecycleStage: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(contractorLifecycleTransitionSchema)
    .mutation(async ({ ctx, input }) => {
      const contractor = await findOrThrow(
        () =>
          ctx.db.contractor.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACTOR_NOT_FOUND,
      );

      const allowedTargets = LEGAL_TRANSITIONS[contractor.lifecycleStage] ?? [];
      if (!allowedTargets.includes(input.stage)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.CONTRACTOR_INVALID_TRANSITION,
        });
      }

      const updateData: Prisma.ContractorUpdateInput = {
        lifecycleStage: input.stage,
      };

      // Block ENDED transition if contractor has active contracts
      if (input.stage === 'ENDED') {
        const activeContracts = await ctx.db.contract.count({
          where: {
            contractorId: input.id,
            organizationId: ctx.organizationId,
            status: { in: ['ACTIVE', 'EXPIRING'] },
            deletedAt: null,
          },
        });

        if (activeContracts > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: E.CONTRACTOR_HAS_ACTIVE_CONTRACTS,
          });
        }
      }

      // Side-effects based on target stage
      if (input.stage === 'ENDED') {
        updateData.status = 'INACTIVE';
      } else if (input.stage === 'ACTIVE' && contractor.status === 'INACTIVE') {
        updateData.status = 'ACTIVE';
      }

      const updated = await ctx.db.contractor.update({
        where: { id: input.id },
        data: updateData,
      });

      // Sync seat count if status changed (ENDED→INACTIVE or restored→ACTIVE)
      if (updateData.status) {
        void syncSeatCountForOrg(ctx.organizationId);
      }
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return updated;
    }),

  /**
   * Archive a contractor (soft archive).
   */
  archive: tenantProcedure
    .use(requirePermission({ contractor: ['delete'] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contractor = await findOrThrow(
        () =>
          ctx.db.contractor.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACTOR_NOT_FOUND,
      );

      // Block archival if contractor has unpaid invoices
      const unpaidInvoiceCount = await ctx.db.invoice.count({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          paymentStatus: { notIn: ['PAID', 'NOT_READY'] },
        },
      });

      if (unpaidInvoiceCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.CONTRACTOR_HAS_UNPAID_INVOICES,
        });
      }

      // Block archival if contractor has active workflow runs
      const activeWorkflowCount = await ctx.db.workflowRun.count({
        where: {
          contractorId: input.id,
          status: { in: ['IN_PROGRESS', 'BLOCKED'] },
        },
      });

      if (activeWorkflowCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.CONTRACTOR_HAS_ACTIVE_WORKFLOWS,
        });
      }

      // Block archival if contractor has active contracts
      const activeContracts = await ctx.db.contract.count({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          status: { in: ['ACTIVE', 'EXPIRING'] },
          deletedAt: null,
        },
      });

      if (activeContracts > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.CONTRACTOR_HAS_ACTIVE_CONTRACTS,
        });
      }

      // Auto-reject any pending change requests before archiving
      await ctx.db.contractorChangeRequest.updateMany({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewComment: 'Auto-rejected: contractor archived',
        },
      });

      const updated = await ctx.db.contractor.update({
        where: { id: input.id },
        data: {
          status: 'ARCHIVED',
          lifecycleStage: 'ENDED',
          archivedAt: new Date(),
        },
      });

      // Phase 60 CLASS-08 — audit archive as a DELETE-equivalent transition.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id,
        action: 'DELETE',
        resourceType: 'CONTRACTOR',
        resourceId: input.id,
        resourceName: updated.displayName,
        oldValues: {
          status: contractor.status,
          lifecycleStage: contractor.lifecycleStage,
        },
        newValues: {
          status: 'ARCHIVED',
          lifecycleStage: 'ENDED',
        },
      });

      // Fire-and-forget: sync Stripe seat count after archiving
      void syncSeatCountForOrg(ctx.organizationId);
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return updated;
    }),

  /**
   * Bulk archive multiple contractors.
   */
  bulkArchive: tenantProcedure
    .use(requirePermission({ contractor: ['delete'] }))
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      // Block archival for contractors with unpaid invoices
      const contractorsWithUnpaid = await ctx.db.invoice.groupBy({
        by: ['contractorId'],
        where: {
          contractorId: { in: input.ids },
          organizationId: ctx.organizationId,
          paymentStatus: { notIn: ['PAID', 'NOT_READY'] },
        },
      });

      const blockedByUnpaid = new Set(
        contractorsWithUnpaid.map(i => i.contractorId).filter(Boolean),
      );

      // Block archival for contractors with active contracts
      const contractorsWithActiveContracts = await ctx.db.contract.groupBy({
        by: ['contractorId'],
        where: {
          contractorId: { in: input.ids },
          organizationId: ctx.organizationId,
          status: { in: ['ACTIVE', 'EXPIRING'] },
          deletedAt: null,
        },
      });

      const blockedByContracts = new Set(
        contractorsWithActiveContracts.map(c => c.contractorId).filter(Boolean),
      );
      const blockedIds = new Set([...blockedByUnpaid, ...blockedByContracts]);
      const archivableIds = input.ids.filter(id => !blockedIds.has(id));

      if (archivableIds.length === 0 && blockedIds.size > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            blockedByContracts.size > 0
              ? E.CONTRACTOR_HAS_ACTIVE_CONTRACTS
              : E.CONTRACTOR_HAS_UNPAID_INVOICES,
        });
      }

      const result = await ctx.db.contractor.updateMany({
        where: {
          id: { in: archivableIds },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        data: {
          status: 'ARCHIVED',
          lifecycleStage: 'ENDED',
          archivedAt: new Date(),
        },
      });

      // Fire-and-forget: sync Stripe seat count after bulk archiving
      if (result.count > 0) {
        void syncSeatCountForOrg(ctx.organizationId);
        void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));
      }

      return { count: result.count };
    }),

  /**
   * Bulk assign owner to multiple contractors.
   */
  bulkAssignOwner: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(100),
        ownerUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.contractor.updateMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        data: { ownerUserId: input.ownerUserId },
      });

      return { count: result.count };
    }),

  /**
   * Export contractors as CSV or XLSX (returns base64-encoded file).
   */
  export: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(500),
        format: z.enum(['csv', 'xlsx']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contractors');

      const contractors = await ctx.db.contractor.findMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          billingProfiles: {
            where: { isDefault: true },
            take: 1,
            select: {
              id: true,
              legalEntityName: true,
              preferredCurrency: true,
              bankAccountMasked: true,
              paymentTermsDays: true,
            },
          },
        },
      });

      const columns = [
        { header: 'Legal Name', key: 'legalName' },
        { header: 'Display Name', key: 'displayName' },
        { header: 'Type', key: 'type' },
        { header: 'Tax ID', key: 'taxId' },
        { header: 'VAT ID', key: 'vatId' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Country', key: 'country' },
        { header: 'Currency', key: 'currency' },
        { header: 'Status', key: 'status' },
        { header: 'Lifecycle Stage', key: 'lifecycleStage' },
        { header: 'City', key: 'city' },
        { header: 'Postal Code', key: 'postalCode' },
        { header: 'Payment Terms (days)', key: 'paymentTermsDays' },
      ] as const;

      worksheet.columns = columns.map(c => ({ header: c.header, key: c.key }));

      for (const c of contractors) {
        worksheet.addRow({
          legalName: c.legalName,
          displayName: c.displayName,
          type: c.type,
          taxId: c.taxId ?? '',
          vatId: c.vatId ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          country: c.countryCode,
          currency: c.currency,
          status: c.status,
          lifecycleStage: c.lifecycleStage,
          city: c.city ?? '',
          postalCode: c.postalCode ?? '',
          paymentTermsDays: c.billingProfiles[0]?.paymentTermsDays ?? '',
        });
      }

      const buffer = Buffer.from(
        input.format === 'csv'
          ? await workbook.csv.writeBuffer()
          : await workbook.xlsx.writeBuffer(),
      );

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `contractors-${timestamp}.${input.format}`;

      return {
        data: buffer.toString('base64'),
        filename,
        mimeType:
          input.format === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  /**
   * Look up Polish company data by NIP from the configured registry adapter
   * (Dataport in dev, GUS BIR1 in prod). Provider is selected via the
   * `COMPANY_REGISTRY_PROVIDER` env var; the underlying retry / error
   * normalisation lives in the company-registry service.
   */
  companyLookup: tenantProcedure
    .use(requirePermission({ contractor: ['create'] }))
    .input(companyLookupSchema)
    .query(async ({ input }) => {
      const result = await lookupCompanyByNip(input.nip);
      if (!result.found) {
        return { found: false as const, error: E.COMPANY_LOOKUP_FAILED };
      }
      return {
        found: true as const,
        legalName: result.legalName ?? '',
        regon: result.regon ?? '',
        addressLine1: result.addressLine1 ?? '',
        city: result.city ?? '',
        postalCode: result.postalCode ?? '',
      };
    }),

  // ---------------------------------------------------------------------------
  // Engagements (Phase 58 Plan 05 — classification tile dispatch)
  // ---------------------------------------------------------------------------

  /**
   * List ContractorAssignments (engagements) for a given contractor. Used by
   * the CountryComplianceSection to render one ClassificationTile per
   * engagement whose contractor.countryCode is in ['GB', 'DE'].
   * Tenant-scoped (Prisma extension) — cross-tenant lookups return empty.
   */
  listEngagements: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ contractorId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.contractorAssignment.findMany({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId,
        },
        orderBy: [{ activeTo: 'asc' }, { activeFrom: 'desc' }],
        select: {
          id: true,
          contractorId: true,
          activeFrom: true,
          activeTo: true,
          status: true,
          contractor: { select: { id: true, displayName: true, countryCode: true } },
          project: { select: { id: true, name: true } },
        },
      });
      return rows;
    }),

  // ---------------------------------------------------------------------------
  // Country-specific compliance fields (Phase 47)
  // ---------------------------------------------------------------------------

  /** Get country-specific field configuration for the org's country */
  getCountryFieldsConfig: tenantProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { countryCode: true },
    });
    if (!(org.countryCode && countryFieldsSchemaMap[org.countryCode])) {
      return { hasCountryFields: false, countryCode: org.countryCode };
    }
    // Phase 79 D-02 — the UAE free-zone freeform fields (tradeLicenseNumber,
    // freeZone, tradeLicenseExpiry) are migrated to the structured
    // FreeZoneAssignment model (gulf.freeZone router) and are no longer rendered
    // here; the data is backfilled by backfill-free-zone-assignment.ts and
    // retained in countryFields JSONB for audit/rollback. freelancePermitNumber
    // is NOT a free-zone license field, so it stays. The Saudi list is untouched.
    // Phase 84 (US-FIELD-04 / D-06) — place 1 of the 3-place US registration
    // (place 2 = countryFieldsSchemaMap.US in @contractor-ops/validators; place 3
    // = the CountryFieldsDispatch switch in web-vite). SSN is intentionally NOT
    // in this list: it is rendered by the dedicated masked-reveal control and
    // persisted to encrypted columns, never the generic JSONB field renderer.
    let fields: string[];
    if (org.countryCode === 'US') {
      fields = ['entityType', 'ein', 'addressLine1', 'city', 'state', 'zipCode'];
    } else if (org.countryCode === 'AE') {
      fields = ['freelancePermitNumber'];
    } else {
      fields = ['freelanceSaLicense', 'commercialRegistration', 'commercialRegistrationExpiry'];
    }
    return { hasCountryFields: true, countryCode: org.countryCode, fields };
  }),

  /** Get country fields for a specific contractor */
  getCountryFields: tenantProcedure
    .input(z.object({ contractorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findUnique({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { countryFields: true },
      });
      if (!contractor) throw new TRPCError({ code: 'NOT_FOUND' });
      return contractor.countryFields ?? {};
    }),

  /** Update country fields for a contractor (validated per org country) */
  updateCountryFields: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z.object({
        contractorId: z.string(),
        countryCode: z.string().length(2),
        fields: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true },
      });
      if (!org.countryCode) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.ORG_NO_COUNTRY });
      }
      const schema = countryFieldsSchemaMap[org.countryCode];
      if (!schema) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `No country-specific fields defined for ${org.countryCode}`,
        });
      }
      const parsed = schema.safeParse(input.fields);
      if (!parsed.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid country fields: ${parsed.error.message}`,
        });
      }
      return ctx.db.contractor.update({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        data: { countryFields: parsed.data as object },
      });
    }),

  // ---------------------------------------------------------------------------
  // Phase 57 · Plan 04 — HMRC / VIES VAT-ID validation
  // ---------------------------------------------------------------------------
  //
  // Explicit-revalidate (`revalidateVat`) routes through the Plan 57-03
  // orchestrator which handles pre-flight checksum, gov-api dispatch, atomic
  // dual-write, and soft-fail. Tenant isolation: the contractor is loaded
  // with `organizationId: ctx.organizationId` — cross-tenant calls surface
  // as NOT_FOUND.
  //
  // D-07 trigger 3 calls `validateContractorVatId` directly from the
  // contractor.update path; there is no separate `validateVat` tRPC
  // procedure (it was a duplicate alias, removed during the FE↔BE audit).
  // ---------------------------------------------------------------------------

  /** Re-validate VAT/USt-IdNr on demand against HMRC / VIES. */
  revalidateVat: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(z.object({ contractorId: z.string().min(1) }))
    .mutation(({ ctx, input }) => validateContractorVatId(ctx, input.contractorId)),

  // ---------------------------------------------------------------------------
  // Phase 84 · Plan 05 — US contractor profile (US-FIELD-01/02/03)
  // ---------------------------------------------------------------------------
  //
  // Storage contract (D-01 / Pitfall 3):
  //   - EIN + address → plain `countryFields` JSONB (low-sensitivity business IDs)
  //   - SSN          → encryptSsn() into the DEDICATED `ssnEncrypted`/`ssnLast4`
  //                    columns, NEVER the JSONB blob (it would leak via the wide
  //                    getCountryFields read path that returns the whole blob).
  //   - USPS         → advisory, non-blocking (D-03): a USPS/Redis/cred failure
  //                    leaves the save successful with `uspsVerified` false.
  // Tenant isolation: every read/update is scoped by `ctx.organizationId`.
  // ---------------------------------------------------------------------------

  /** Update a US contractor's profile: EIN/address (JSONB) + SSN (encrypted) + USPS advisory. */
  updateUsProfile: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z.object({
        contractorId: z.string().min(1),
        entityType: z.string().optional(),
        ein: z.string().optional(),
        ssn: z.string().optional(),
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // EIN — reject an invalid identifier before any write (US-FIELD-01).
      if (input.ein && !isValidEin(input.ein)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.CONTRACTOR_INVALID_EIN });
      }
      // SSN — reject an invalid value before encrypting (US-FIELD-02).
      if (input.ssn && !isValidSsn(input.ssn)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.CONTRACTOR_INVALID_SSN });
      }

      // Confirm the contractor belongs to the caller's org (IDOR → NOT_FOUND).
      const existing = await ctx.db.contractor.findUnique({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { id: true, countryFields: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      // The JSONB blob carries EIN + address only — SSN is excluded by
      // construction (it lives in the dedicated encrypted columns).
      const prevFields = (existing.countryFields ?? {}) as Record<string, unknown>;
      const countryFields = buildUsCountryFields(prevFields, input);

      const data: Prisma.ContractorUpdateInput = {
        countryFields: countryFields as Prisma.InputJsonValue,
      };

      // SSN → dedicated encrypted columns (mirrors the bankAccount precedent).
      if (input.ssn) {
        const cleaned = input.ssn.replace(/[\s-]/g, '');
        data.ssnEncrypted = encryptSsn(cleaned);
        data.ssnLast4 = cleaned.slice(-4);
      }

      // USPS advisory normalize (D-03) — only when a full address is present;
      // never throws to the save path.
      if (input.addressLine1 && input.city && input.state && input.zipCode) {
        await applyUspsAdvisory(data, countryFields, {
          addressLine1: input.addressLine1,
          city: input.city,
          state: input.state,
          zipCode: input.zipCode,
        });
      }

      return ctx.db.contractor.update({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        data,
      });
    }),

  // ---------------------------------------------------------------------------
  // Phase 84 · Plan 05 — SSN reveal (US-FIELD-02 / D-02 / D-09)
  // ---------------------------------------------------------------------------
  //
  // STAFF-router-ONLY (Pitfall 6 — never portalAppRouter). Gated by the
  // `contractorPii:['read']` permission (deny-by-default; only owner/admin/
  // finance_admin grant it — external_accountant is DENIED per D-09). Every
  // reveal writes an append-only audit row carrying `field:'ssn'` metadata but
  // NEVER the SSN value itself. Tenant-scoped: a cross-org id surfaces NOT_FOUND.
  // ---------------------------------------------------------------------------

  /** Reveal a contractor's full SSN (audit-logged, RBAC-gated, staff-only). */
  revealSsn: tenantProcedure
    .use(requirePermission({ contractorPii: ['read'] }))
    .input(z.object({ contractorId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Select ONLY the encrypted column — never widen this read (Pitfall 3).
      const contractor = await ctx.db.contractor.findUnique({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { id: true, ssnEncrypted: true },
      });
      if (!contractor?.ssnEncrypted) throw new TRPCError({ code: 'NOT_FOUND' });

      const ssn = decryptSsn(contractor.ssnEncrypted);

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id,
        action: 'contractor.ssn.revealed',
        resourceType: 'CONTRACTOR',
        resourceId: contractor.id,
        metadata: { field: 'ssn' },
      });

      return { ssn };
    }),
});
