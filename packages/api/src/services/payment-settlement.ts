import { convertAmount, FX_CONVERSION_MAX_AGE_DAYS } from './exchange-rate';
import type { DbClient } from './types';

/**
 * Inputs to the settlement-currency decision for a single payout.
 *
 * `contractorCurrency` is the per-contractor default (`Contractor.currency`).
 * `perRunOverride` is the optional per-run choice threaded from the payout
 * request — when the operator settles a cross-border run in USD (contractor
 * receives USD) rather than the contractor's local currency.
 */
export interface ResolveSettlementCurrencyInput {
  contractorCurrency: string;
  perRunOverride?: string;
}

/**
 * Resolve the currency a payout settles in.
 *
 * A per-run override wins; otherwise the contractor's own currency is the
 * default. A blank/whitespace override counts as no override so an empty
 * choice never collapses the settlement currency to an empty string.
 */
export function resolveSettlementCurrency(input: ResolveSettlementCurrencyInput): string {
  const override = input.perRunOverride?.trim();
  if (override) return override;
  return input.contractorCurrency;
}

/**
 * Convert a gross amount into the settlement currency at the payment-date rate.
 *
 * Delegates verbatim to {@link convertAmount} — the same EUR-based ECB cross-rate
 * path the 1099 box-1 conversion uses — so there is no hand-rolled FX math and
 * exactly one HALF-UP round is applied on the integer minor-unit product.
 * Same-currency short-circuits to rate 1; a missing rate returns `null` so the
 * caller surfaces an error rather than settling a silently zeroed amount.
 *
 * A `maxAgeDays` floor (default {@link FX_CONVERSION_MAX_AGE_DAYS}) makes a rate
 * older than the threshold throw a `StaleExchangeRateError` instead of settling
 * at a stale rate — real money must never leave on a rate the ECB feed stopped
 * updating days ago.
 */
export async function convertForSettlement(
  db: DbClient,
  amountMinor: number,
  fromCurrency: string,
  settlementCurrency: string,
  paymentDate: Date,
  maxAgeDays: number = FX_CONVERSION_MAX_AGE_DAYS,
): Promise<{ amountMinor: number; rate: number; rateDate: Date } | null> {
  return convertAmount(db, amountMinor, fromCurrency, settlementCurrency, paymentDate, maxAgeDays);
}
