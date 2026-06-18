import type {
  ComplianceHealth,
  ContractorFilters,
  ContractorLifecycleStage,
  ContractorType,
} from '@contractor-ops/validators';
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs';

/**
 * URL state management for contractor list filters.
 * Uses nuqs to persist filter state in the URL search params, enabling
 * shareable filtered views and browser history navigation.
 *
 * Note: a legacy `status` array used to live here but nothing on the new
 * contractor list reads or writes it — the analogue field is
 * `lifecycleStage` (the actual API filter). Keeping the dead field caused
 * the toolbar's "Filters" badge to count an invisible chip when a stale
 * URL carried `?status=active`. Drop it.
 */
export function useContractorFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
    search: parseAsString.withDefault(''),
    sortBy: parseAsString.withDefault('createdAt'),
    sortOrder: parseAsString.withDefault('desc'),
    lifecycleStage: parseAsArrayOf(parseAsString).withDefault([]),
    type: parseAsArrayOf(parseAsString).withDefault([]),
    owner: parseAsArrayOf(parseAsString).withDefault([]),
    team: parseAsArrayOf(parseAsString).withDefault([]),
    billingModel: parseAsArrayOf(parseAsString).withDefault([]),
    health: parseAsArrayOf(parseAsString).withDefault([]),
    // Jurisdiction segment + attention-rail facets (insight band entry-points).
    country: parseAsArrayOf(parseAsString).withDefault([]),
    expiringWithin: parseAsInteger,
    paymentBlocked: parseAsBoolean.withDefault(false),
    stalled: parseAsBoolean.withDefault(false),
  });
}

/** The nuqs filter state object (first tuple element of `useContractorFilters`). */
export type ContractorNuqsFilters = ReturnType<typeof useContractorFilters>[0];

/**
 * Map the URL filter state to the `contractorFiltersSchema` input shared by
 * `contractor.list` (the table) and `contractor.insights` (the band). One
 * mapping for both queries → the band's counts and the table's rows are always
 * derived from the same filter contract.
 */
export function toContractorFilterInput(filters: ContractorNuqsFilters): ContractorFilters {
  return {
    lifecycleStage: filters.lifecycleStage.length
      ? (filters.lifecycleStage as ContractorLifecycleStage[])
      : undefined,
    type: filters.type.length ? (filters.type as ContractorType[]) : undefined,
    ownerUserId: filters.owner.length ? filters.owner : undefined,
    primaryTeamId: filters.team.length ? filters.team : undefined,
    billingModel: filters.billingModel.length ? filters.billingModel : undefined,
    complianceHealth: filters.health.length ? (filters.health as ComplianceHealth[]) : undefined,
    countryCode: filters.country.length ? filters.country : undefined,
    expiringWithin: filters.expiringWithin ?? undefined,
    paymentBlocked: filters.paymentBlocked || undefined,
    stalled: filters.stalled || undefined,
  };
}
