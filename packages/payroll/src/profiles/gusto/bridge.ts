import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportResult } from '../../types/profile.js';
import { GustoCsvProfile } from '../gusto-csv/index.js';

// Flag-gated bridge: push to Gusto's REST API when payroll.gusto is enabled AND
// the org has connected, otherwise fall back to the Gusto CSV export. The
// connection lookup, flag evaluator, and native push all live in packages/api
// (which owns db + integrations); they are injected as callbacks so
// packages/payroll stays free of api/db/integrations imports.
export interface GustoBridgeContext {
  evaluateFlag?: (flagKey: string) => boolean;
  resolveConnection?: () => Promise<unknown | null>;
  pushNative?: (feed: PayrollFeed) => Promise<PayrollExportResult>;
}

export async function gustoBridgeGenerate(
  feed: PayrollFeed,
  ctx: GustoBridgeContext,
): Promise<PayrollExportResult> {
  const enabled = ctx.evaluateFlag?.('payroll.gusto') ?? false;
  if (enabled && ctx.resolveConnection && ctx.pushNative) {
    const connection = await ctx.resolveConnection();
    if (connection) {
      return ctx.pushNative(feed);
    }
  }
  return GustoCsvProfile.generate(feed);
}
