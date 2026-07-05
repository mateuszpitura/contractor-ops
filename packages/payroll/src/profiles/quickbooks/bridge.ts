import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportResult } from '../../types/profile.js';
import { QuickbooksCsvProfile } from '../quickbooks-csv/index.js';

// Flag-gated bridge: push to QuickBooks' REST API when payroll.quickbooks is
// enabled AND the org has connected, otherwise fall back to the QuickBooks CSV
// export. The connection lookup, flag evaluator, and native push are injected as
// callbacks so packages/payroll stays free of api/db/integrations imports.
export interface QuickBooksBridgeContext {
  evaluateFlag?: (flagKey: string) => boolean;
  resolveConnection?: () => Promise<unknown | null>;
  pushNative?: (feed: PayrollFeed) => Promise<PayrollExportResult>;
}

export async function quickbooksBridgeGenerate(
  feed: PayrollFeed,
  ctx: QuickBooksBridgeContext,
): Promise<PayrollExportResult> {
  const enabled = ctx.evaluateFlag?.('payroll.quickbooks') ?? false;
  if (enabled && ctx.resolveConnection && ctx.pushNative) {
    const connection = await ctx.resolveConnection();
    if (connection) {
      return ctx.pushNative(feed);
    }
  }
  return QuickbooksCsvProfile.generate(feed);
}
