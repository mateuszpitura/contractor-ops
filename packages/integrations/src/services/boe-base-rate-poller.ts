// packages/integrations/src/services/boe-base-rate-poller.ts
//
// Phase 63 · Plan 03 · D-09 — Bank of England base rate polling service.
//
// Fetches the IUDBEDR series (Official Bank Rate) from the public BoE
// Interactive Database CSV endpoint and upserts a new BoEBaseRateHistory row
// when the latest rate differs from the most recently stored value.
//
// Why polling and not a webhook: BoE does not publish rate-change webhooks.
// MPC meets ~8x/year so daily polling is cheap and bounded. Cron schedule:
// daily at 06:00 UTC (set by the cron route in apps/web — see /api/cron/
// boe-rate-poll/route.ts).
//
// Failure mode: any fetch / parse / DB error returns
// `{ updated: false, currentRate: null, error }` and logs a warning.
// We never throw — manual entry via the admin BoE rate router (Plan 63-05)
// remains available, and a single missed poll has no statutory impact
// because the rate snapshot used for late-payment-interest (LPCDA §4(1))
// is the BoE rate on the LAST DAY of the preceding 6-month period.

import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'boe-rate-poller' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Bank of England Interactive Database CSV endpoint for the IUDBEDR
 * (Official Bank Rate) series. Returns CSV with a small metadata header
 * followed by `DD Mon YYYY,VALUE` rows.
 *
 * Reference: https://www.bankofengland.co.uk/boeapps/database/
 */
export const BOE_CSV_URL = 'https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp';

/**
 * Polite User-Agent — BoE rejects requests with an empty/unknown UA. Matches
 * the convention from the existing `gov-api` clients (HMRC, VIES).
 */
const USER_AGENT = 'contractor-ops/1.0 (BoE rate poller)';

/** Network timeout for the BoE fetch — generous to allow for slow responses. */
const FETCH_TIMEOUT_MS = 15_000;

/** Lookback window for the CSV query: how many days back to ask for. */
const LOOKBACK_DAYS = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PollBoeBaseRateResult {
  /** True iff a new BoEBaseRateHistory row was inserted on this run. */
  updated: boolean;
  /** Latest rate observed from BoE (null on fetch/parse failure). */
  currentRate: number | null;
  /** Set when the poll failed — never thrown, always returned. */
  error?: string;
}

interface ParsedRateRow {
  /** Date the BoE published the rate (UTC). */
  date: Date;
  /** Rate as a percentage (e.g. 4.75 for 4.75%). */
  ratePercent: number;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse the BoE IUDBEDR CSV body into structured rate rows.
 *
 * The BoE CSV looks like:
 *   ```
 *   "Title:" "Bank of England official Bank Rate"
 *   "Series Code:" "IUDBEDR"
 *   ...
 *   DATE,IUDBEDR
 *   06 Nov 2025,3.75
 *   08 May 2025,4.25
 *   ```
 *
 * We tolerate:
 *   - any number of header lines until we hit the `DATE,...` schema row
 *   - trailing whitespace, BOM, mixed CRLF/LF line endings
 *   - rows with extra columns (we only consume the first two)
 *
 * Rows that do not parse as `DD Mon YYYY,<number>` are skipped silently —
 * BoE occasionally emits empty rows or rows containing footnotes.
 */
export function parseBoeCsv(csv: string): ParsedRateRow[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/);

  // Find the header row that starts with "DATE,"
  let dataStartIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trim();
    if (line.toUpperCase().startsWith('DATE,')) {
      dataStartIndex = i + 1;
      break;
    }
  }

  // No header → assume the body is data-only (older endpoint variant).
  if (dataStartIndex === -1) {
    dataStartIndex = 0;
  }

  const rows: ParsedRateRow[] = [];
  for (let i = dataStartIndex; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trim();
    if (!line) continue;

    const cols = line.split(',');
    if (cols.length < 2) continue;

    const dateStr = (cols[0] ?? '').trim();
    const rateStr = (cols[1] ?? '').trim();
    if (!(dateStr && rateStr)) continue;

    const date = parseBoeDate(dateStr);
    if (!date) continue;

    const ratePercent = Number.parseFloat(rateStr);
    if (!Number.isFinite(ratePercent)) continue;

    rows.push({ date, ratePercent });
  }

  return rows;
}

/**
 * Parse a BoE-formatted date `DD Mon YYYY` → Date (UTC, midnight).
 * Returns null on any failure so the caller can skip the row.
 */
function parseBoeDate(input: string): Date | null {
  const match = input.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;

  const day = Number.parseInt(match[1] ?? '', 10);
  const monthAbbrev = (match[2] ?? '').toLowerCase();
  const year = Number.parseInt(match[3] ?? '', 10);

  const months: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const month = months[monthAbbrev];
  if (month === undefined) return null;
  if (!(Number.isFinite(day) && Number.isFinite(year))) return null;

  // Construct UTC midnight to match BoEBaseRateHistory.effectiveFrom (@db.Date).
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// HTTP fetch
// ---------------------------------------------------------------------------

/**
 * Build the parameterised CSV URL for the IUDBEDR series.
 * Lookback window is `LOOKBACK_DAYS` ending at `now`.
 */
export function buildBoeCsvUrl(now: Date = new Date()): string {
  const dateTo = formatBoeQueryDate(now);
  const lookback = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const dateFrom = formatBoeQueryDate(lookback);

  const params = new URLSearchParams({
    'csv.x': 'yes',
    Datefrom: dateFrom,
    Dateto: dateTo,
    SeriesCodes: 'IUDBEDR',
    CSVF: 'TN',
    UsingCodes: 'Y',
    Filter: 'N',
  });

  return `${BOE_CSV_URL}?${params.toString()}`;
}

/** Format a JS Date as `DD/Mmm/YYYY` per the BoE query-string convention. */
function formatBoeQueryDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Main poll
// ---------------------------------------------------------------------------

interface PollDeps {
  /**
   * Optional fetch override for tests. Defaults to global `fetch`.
   */
  fetcher?: typeof fetch;
  /**
   * Optional db override for tests — must support
   * `boEBaseRateHistory.findFirst` and `boEBaseRateHistory.upsert`.
   */
  db?: typeof prisma;
  /**
   * Optional clock override for deterministic tests.
   */
  now?: () => Date;
}

/**
 * Poll the BoE IUDBEDR series and upsert a new BoEBaseRateHistory row when
 * the latest fetched rate differs from the most recently stored rate.
 *
 * Always resolves — never throws. Failures are surfaced via the `error`
 * field of the result so the cron route can serialise them into a JSON
 * response.
 */
export async function pollBoeBaseRate(deps: PollDeps = {}): Promise<PollBoeBaseRateResult> {
  const fetcher = deps.fetcher ?? fetch;
  const db = deps.db ?? prisma;
  const now = deps.now?.() ?? new Date();

  const url = buildBoeCsvUrl(now);

  let csvText: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetcher(url, {
        method: 'GET',
        headers: {
          Accept: 'text/csv,application/csv,*/*',
          'User-Agent': USER_AGENT,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const message = `BoE CSV endpoint returned HTTP ${response.status}`;
      log.warn(
        { url, status: response.status },
        'BoE rate poll failed — manual entry still possible via admin router',
      );
      return { updated: false, currentRate: null, error: message };
    }

    csvText = await response.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(
      { err: message, url },
      'BoE rate poll fetch failed — manual entry still possible via admin router',
    );
    return { updated: false, currentRate: null, error: message };
  }

  const rows = parseBoeCsv(csvText);
  if (rows.length === 0) {
    log.warn({ url }, 'BoE rate poll returned no parseable rows');
    return {
      updated: false,
      currentRate: null,
      error: 'No parseable rows in BoE CSV response',
    };
  }

  // Sort descending by date, take the latest.
  rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  const latest = rows[0];
  if (!latest) {
    return {
      updated: false,
      currentRate: null,
      error: 'No latest row after sort (unexpected)',
    };
  }

  const fetchedRate = latest.ratePercent;

  // Read the most recently stored rate.
  let stored: { ratePercent: { toNumber?: () => number } | number } | null;
  try {
    stored = (await db.boEBaseRateHistory.findFirst({
      orderBy: { effectiveFrom: 'desc' },
      select: { ratePercent: true },
    })) as typeof stored;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err: message }, 'BoE rate poll DB read failed');
    return { updated: false, currentRate: fetchedRate, error: message };
  }

  const storedRate = stored
    ? typeof stored.ratePercent === 'number'
      ? stored.ratePercent
      : (stored.ratePercent.toNumber?.() ?? Number(stored.ratePercent))
    : null;

  // Same rate → no-op.
  if (storedRate !== null && storedRate === fetchedRate) {
    log.info({ fetchedRate, storedRate }, 'BoE rate unchanged — skipping insert');
    return { updated: false, currentRate: fetchedRate };
  }

  // Different rate → insert a new history row keyed by today's UTC date.
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  try {
    await db.boEBaseRateHistory.upsert({
      where: { effectiveFrom: todayUtc },
      create: {
        effectiveFrom: todayUtc,
        ratePercent: fetchedRate,
        source: 'BOE_API',
      },
      update: {
        ratePercent: fetchedRate,
        source: 'BOE_API',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err: message, fetchedRate, storedRate }, 'BoE rate poll upsert failed');
    return { updated: false, currentRate: fetchedRate, error: message };
  }

  log.info({ fetchedRate, storedRate, effectiveFrom: todayUtc.toISOString() }, 'BoE rate updated');
  return { updated: true, currentRate: fetchedRate };
}
