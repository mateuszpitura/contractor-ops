// DATEVconnect REST live-push seam — wired but dark.
//
// The shipping DE path is the DATEV Lohn ASCII file export. DATEVconnect REST
// requires a per-org DATEVconnect subscription + endpoint/credentials; until
// that lands the seam makes no network call and reports itself unavailable, so
// the export never hard-blocks on a subscription. The org enables it behind
// payroll.datev once subscribed.

import type { PayrollFeed } from '../../types/feed.js';

export interface DatevConnectConnection {
  endpointUrl: string;
  clientId: string;
}

export interface DatevConnectResult {
  source: 'DATEVCONNECT';
  available: boolean;
  note: string;
}

/**
 * Push a feed via DATEVconnect REST when subscribed. Until then this is a pure,
 * no-network stub that returns `available: false` — the caller falls back to the
 * ASCII file export.
 */
export async function pushViaDatevConnect(
  _feed: PayrollFeed,
  connection: DatevConnectConnection | null,
): Promise<DatevConnectResult> {
  if (!connection) {
    return {
      source: 'DATEVCONNECT',
      available: false,
      note: 'DATEVconnect REST is not subscribed for this organization; use the DATEV Lohn ASCII export.',
    };
  }
  return {
    source: 'DATEVCONNECT',
    available: false,
    note: 'DATEVconnect REST push is a wired-but-dark seam; the ASCII file export is the shipping path.',
  };
}
