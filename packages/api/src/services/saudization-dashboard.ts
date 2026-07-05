// ---------------------------------------------------------------------------
// Saudization dashboard derivation + offboarding band-trajectory.
// ---------------------------------------------------------------------------
//
// Pure derivation functions mirroring computeComplianceHealth
// (packages/api/src/routers/core/contractor.ts) — params in, structured result
// out, NO DB client, NO writes, NO throws. The router reads the
// SaudiHeadcount / SaudizationConfig rows + the ksa.iqama compliance items via
// the region-aware ctx.db and passes them here.
//
// Two locked anti-features enforced by structure, not discipline:
//   - The nationalisation rate is computed ONLY from the manual SaudiHeadcount
//     numbers (Nitaqat counts the whole workforce; the platform sees contractors
//     only). The platform-derived contractor breakdown is returned side-by-side,
//     clearly subordinate, and NEVER drives the rate.
//   - The band is read-through from the manual SaudizationConfig entry — it is
//     NEVER recomputed or inferred from the rate. No band-derivation code path
//     exists here by design. The offboarding trajectory is ephemeral,
//     advisory-only, non-authoritative, and asserts no band.

import type { NitaqatBand } from '@contractor-ops/db';

/** Manual org-wide headcount — the ONLY source of the nationalisation rate. */
export interface SaudiHeadcountInput {
  totalHeadcount: number;
  saudiHeadcount: number;
}

/** Manual Saudization config — band is recorded by an admin, never computed. */
export interface SaudizationConfigInput {
  /** Read-through manual band; null until an admin records it. NEVER auto-computed. */
  band: NitaqatBand | null;
  industrySegment: string | null;
  bandLastUpdatedAt: Date | null;
}

/** Per-engagement platform-derived flags — side-by-side sanity-check only. */
export interface PlatformContractorInput {
  isSaudi: boolean | null;
  qiwaContractAuthenticated: boolean | null;
}

/** A ksa.iqama ContractorComplianceItem row — reused F1 expiry data (D — reuse, do not re-derive). */
export interface IqamaItemInput {
  status: string;
  expiresAt: Date | null;
}

export interface SaudizationDashboardParams {
  headcount: SaudiHeadcountInput | null;
  config: SaudizationConfigInput;
  platformContractors: PlatformContractorInput[];
  iqamaItems: IqamaItemInput[];
  /** Injectable clock for deterministic tests; defaults to new Date(). */
  now?: Date;
}

export interface PlatformDerivedBreakdown {
  contractorCount: number;
  saudiContractorCount: number;
}

export interface IqamaRollup {
  total: number;
  expired: number;
  expiringSoon: number;
}

export interface SaudizationDashboardResult {
  /** From manual numbers ONLY; null when no headcount recorded. */
  nationalisationRate: number | null;
  totalHeadcount: number | null;
  saudiHeadcount: number | null;
  /** Read-through manual band — never computed. */
  band: NitaqatBand | null;
  industrySegment: string | null;
  bandLastUpdatedAt: Date | null;
  /** True when the recorded band is older than the quarterly (~90 day) re-entry window. */
  quarterlyReentryDue: boolean;
  /** Visibility-only: contracts WHERE qiwaContractAuthenticated=false. */
  qiwaGapCount: number;
  iqamaRollup: IqamaRollup;
  /** Subordinate platform-derived breakdown shown beside the manual numbers. */
  platformDerived: PlatformDerivedBreakdown;
}

const QUARTERLY_REENTRY_DAYS = 90;
const IQAMA_EXPIRING_SOON_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Derive the Saudization dashboard read model. Pure: no DB access, no writes.
 *
 * The nationalisation rate comes EXCLUSIVELY from the manual headcount; the
 * platform contractor list only produces the side-by-side breakdown + the Qiwa
 * gap count. The band is surfaced verbatim from the manual config and is never
 * inferred from the rate.
 */
export function computeSaudizationDashboard(
  params: SaudizationDashboardParams,
): SaudizationDashboardResult {
  const now = params.now ?? new Date();
  const { headcount, config } = params;

  // Rate from MANUAL numbers only. No platform fallback.
  const totalHeadcount = headcount?.totalHeadcount ?? null;
  const saudiHeadcount = headcount?.saudiHeadcount ?? null;
  const nationalisationRate =
    headcount && headcount.totalHeadcount > 0
      ? headcount.saudiHeadcount / headcount.totalHeadcount
      : null;

  // Band is read-through; we NEVER compute it from the rate.
  const band = config.band;

  const quarterlyReentryDue =
    config.bandLastUpdatedAt === null
      ? false
      : (now.getTime() - config.bandLastUpdatedAt.getTime()) / MS_PER_DAY > QUARTERLY_REENTRY_DAYS;

  // Qiwa-auth coverage gap = count of contracts not authenticated.
  const qiwaGapCount = params.platformContractors.filter(
    c => c.qiwaContractAuthenticated === false,
  ).length;

  // Platform-derived breakdown (subordinate sanity check; never drives the rate).
  const platformDerived: PlatformDerivedBreakdown = {
    contractorCount: params.platformContractors.length,
    saudiContractorCount: params.platformContractors.filter(c => c.isSaudi === true).length,
  };

  // Iqama roll-up reuses the existing F1 ksa.iqama expiry data (do not re-derive).
  const iqamaRollup = params.iqamaItems.reduce<IqamaRollup>(
    (acc, item) => {
      acc.total += 1;
      if (item.status === 'EXPIRED') {
        acc.expired += 1;
      } else if (item.expiresAt !== null) {
        const daysUntil = (item.expiresAt.getTime() - now.getTime()) / MS_PER_DAY;
        if (daysUntil >= 0 && daysUntil <= IQAMA_EXPIRING_SOON_DAYS) {
          acc.expiringSoon += 1;
        }
      }
      return acc;
    },
    { total: 0, expired: 0, expiringSoon: 0 },
  );

  return {
    nationalisationRate,
    totalHeadcount,
    saudiHeadcount,
    band,
    industrySegment: config.industrySegment,
    bandLastUpdatedAt: config.bandLastUpdatedAt,
    quarterlyReentryDue,
    qiwaGapCount,
    iqamaRollup,
    platformDerived,
  };
}

// ---------------------------------------------------------------------------
// Per-country nationalisation rollup (KSA Saudization + UAE Emiratisation).
// ---------------------------------------------------------------------------
//
// The nationalisation math is country-agnostic — a rate is manual national /
// manual total and a band is read-through, whether the quota regime is Nitaqat
// (KSA) or the UAE Emiratisation quota. This wrapper composes the existing pure
// derivation per country WITHOUT re-deriving anything: the KSA path is unchanged
// (byte-for-byte `computeSaudizationDashboard`), and the UAE path reuses the same
// function, feeding the manual Emirati headcount as `saudiHeadcount` and the
// visa / Emirates-ID compliance items as `iqamaItems` (the permit rollup math is
// identical). The locked anti-features hold for BOTH countries by construction:
// the rate comes ONLY from the manual headcount (never an EmployeeProfile groupBy)
// and the band is read-through, never inferred.

export type NationalisationCountry = 'KSA' | 'UAE';

export interface NationalisationDashboardResult extends SaudizationDashboardResult {
  country: NationalisationCountry;
}

/**
 * Compute a per-country nationalisation rollup. Delegates to the unchanged pure
 * `computeSaudizationDashboard` and tags the result with its country. For UAE,
 * `headcount.saudiHeadcount` carries the manual Emirati national count and
 * `iqamaItems` the visa/Emirates-ID expiry rows; the derivation is identical.
 * Pure: no DB, no writes, no throws; no platform-derived rate path exists.
 */
export function computeNationalisationDashboard(
  country: NationalisationCountry,
  params: SaudizationDashboardParams,
): NationalisationDashboardResult {
  return { country, ...computeSaudizationDashboard(params) };
}

export interface OffboardingTrajectoryParams {
  headcount: SaudiHeadcountInput | null;
  /** The currently-recorded band (read-through); surfaced verbatim, never asserted as projected. */
  currentBand: NitaqatBand | null;
  /** Whether the contractor being offboarded is a Saudi national. */
  offboardingContractorIsSaudi: boolean | null;
}

export interface OffboardingTrajectoryResult {
  currentRate: number | null;
  /** Projected rate from SaudiHeadcount minus one (Saudi count drops only if the leaver is Saudi). */
  projectedRate: number | null;
  /** The recorded band, surfaced verbatim. NO projected band is asserted. */
  currentBand: NitaqatBand | null;
  /** Always true — this is a non-gating advisory banner. */
  advisory: true;
  /** Always false — the projection never authoritatively sets a band. */
  authoritative: false;
}

/**
 * Live, ephemeral offboarding band-trajectory recompute. Projects the
 * nationalisation rate from SaudiHeadcount minus one (the Saudi count drops only
 * when the leaver is Saudi). Returns advisory flags only — it never sets a band,
 * never persists, never gates, and never throws. Pure single-arg function so it
 * cannot gate the offboarding flow.
 */
export function projectOffboardingTrajectory(
  params: OffboardingTrajectoryParams,
): OffboardingTrajectoryResult {
  const { headcount, offboardingContractorIsSaudi } = params;

  const currentRate =
    headcount && headcount.totalHeadcount > 0
      ? headcount.saudiHeadcount / headcount.totalHeadcount
      : null;

  let projectedRate: number | null = null;
  if (headcount) {
    const projectedTotal = headcount.totalHeadcount - 1;
    const projectedSaudi =
      offboardingContractorIsSaudi === true
        ? headcount.saudiHeadcount - 1
        : headcount.saudiHeadcount;
    projectedRate = projectedTotal > 0 ? projectedSaudi / projectedTotal : null;
  }

  return {
    currentRate,
    projectedRate,
    currentBand: params.currentBand,
    advisory: true,
    authoritative: false,
  };
}
