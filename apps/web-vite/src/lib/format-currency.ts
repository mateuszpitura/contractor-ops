/**
 * @deprecated Import from `../lib/money.js` instead.
 * Re-exports preserved for existing call sites during migration.
 */
// biome-ignore lint/performance/noBarrelFile: intentional public aggregator — deprecated back-compat re-export of money helpers
export { formatAmount, formatMinorUnits, formatMoneyAmount } from './money.js';
