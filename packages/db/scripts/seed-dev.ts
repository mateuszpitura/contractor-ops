#!/usr/bin/env tsx
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: this is a seed script */
/**
 * scripts/seed-dev.ts — comprehensive dev/test data seed.
 *
 * NOT FOR PRODUCTION. Refuses to run when NODE_ENV=production or when the
 * resolved DATABASE_URL host falls outside SEED_DEV_ALLOWED_HOST allowlist.
 *
 * ---------------------------------------------------------------------------
 * Batching policy
 * ---------------------------------------------------------------------------
 * Every per-row `prisma.X.create()` inside a loop has been converted to a
 * chunked `prisma.X.createMany({ data, skipDuplicates: true })` (default
 * chunk = 1000 rows; wide tables drop to 500/250 to stay under Postgres'
 * 65535 bind-parameter ceiling). This reduces Neon HTTP round-trip count
 * from O(rows) to O(rows / chunk) and brings `pnpm seed:qa` down from
 * ~60 min to single-digit minutes against Neon. Child primary keys that
 * downstream seeders need are pre-computed in-process with
 * `crypto.randomUUID()` (already imported below) before the parent
 * `createMany` runs, so children can reference parent ids without a
 * follow-up `findMany`. Intentionally one-shot calls
 * (e.g. `prisma.organization.create({ ..., members: { create: [...] } })`)
 * stay as nested `create` because they are already a single round-trip.
 *
 * ---------------------------------------------------------------------------
 * What it produces
 * ---------------------------------------------------------------------------
 * Creates a coherent slice of data across the whole tenant surface so the app
 * can be exercised in many states from a single command:
 *   - users, organisations, members, teams, projects, cost centres
 *   - contractors with contacts, billing profiles, assignments, tags
 *   - contracts (subset) with rate periods and amendments
 *   - invoices in mixed lifecycle states (RECEIVED → PAID, plus REJECTED/VOID)
 *   - InvoiceMatchResult + InvoiceIntakeRequest history per invoice
 *   - matching approval flows / steps / decisions for non-RECEIVED invoices
 *   - payment runs + items linked to APPROVED / PAID invoices
 *   - Skonto (term/snapshot/application) and InvoiceInterestClaim chains
 *   - reminder rules + instances (PENDING / SENT / FAILED)
 *   - notifications + user notification preferences
 *   - outbox events, webhook deliveries, audit log trails
 *   - equipment, assignments, shipments + events, return requests
 *   - e-invoice lifecycle + events; Peppol participants + transmissions
 *   - LeitwegId (DE B2G); ZatcaInvoiceChain (SA)
 *   - SigningEnvelope/Recipient/Event timelines for a subset of contracts
 *   - OcrExtraction history with PendingUpload precursors
 *   - 90-day ExchangeRate history per active currency pair
 *   - ClassificationAssessment / Document / EscalationEvent / SdsApproval
 *   - jurisdiction-aware tax compliance (Statusfeststellungsverfahren, IR35
 *     chain, TaxIdValidation, EconomicDependencyAlertState,
 *     ReassessmentTrigger, WhtCertificate)
 *   - workflow templates, runs, task comments + attachments
 *   - PrivacyNotice, ConsentRecord, ConsentEvent + per-contractor prefs
 *   - OrganizationApiKey (ACTIVE + REVOKED), UserPinnedView
 *   - cron/observability markers (StripeEvent, GovApiAuditLog,
 *     IntegrationSyncLog, NotificationCronDedup, CronScanState)
 *   - auth-surface display rows (Session / Account / Verification /
 *     OAuthChallenge / PortalMagicToken — for UI display only, see comment
 *     in `seedOrganizationCore` for why these don't bypass Better Auth)
 *   - portal sessions (live + expired)
 *
 * ---------------------------------------------------------------------------
 * Profiles
 * ---------------------------------------------------------------------------
 *   empty     1 org, 1 owner, no contractors / invoices — empty-state UIs
 *   solo      1 org, 1 user, 2 contractors, a handful of invoices
 *   small     3 orgs, 3-5 users, ~10 contractors, mixed invoices       (default)
 *   medium    5 orgs, 5-15 users, ~100 contractors, ~500 invoices total
 *   huge      mix: 3 huge + 1 medium + 1 empty + 1 solo (~10k invoices)
 *   showcase  1 fully-populated demo org with every state present
 *   all       union of every profile above
 *   qa        3 deterministic orgs for the QA walk-and-fix loop:
 *               - qa-default-org (showcase template, every state)
 *               - qa-empty-org (empty template, blank slate)
 *               - qa-stress-org (huge template + 200 payment runs)
 *
 *   Per-profile defaults (overridable via --orgs / --users-per-org /
 *   --contractors-per-org / --invoices-per-contractor):
 *
 *     profile     orgs  users/org  contractors/org  invoices/contractor
 *     empty        1       1            0                  0
 *     solo         1       1            2                 1–3
 *     small        3       4           10                 2–6
 *     medium       5      10          100                 3–8
 *     huge         6      30         1000                5–12     (mixed)
 *     showcase     1       8           40                 4–7
 *     all          8     (mix)        (mix)              (mix)
 *     qa           3     (mix)        (mix)              (mix)    (default+empty+stress)
 *
 * ---------------------------------------------------------------------------
 * Sample invocations
 * ---------------------------------------------------------------------------
 *   pnpm db:seed:dev --profile=small --confirm
 *   pnpm db:seed:dev --profile=huge --regions=EU,ME --confirm --seed=123
 *   SEED_PASSWORD=letmein pnpm db:seed:dev --profile=showcase --confirm
 *   # Add a showcase org on top of an already-seeded dev DB (no wipe):
 *   pnpm db:seed:dev --profile=showcase --append
 *
 * ---------------------------------------------------------------------------
 * CLI flags
 * ---------------------------------------------------------------------------
 *   --profile=NAME            One of empty|solo|small|medium|huge|showcase|all
 *   --orgs=N                  Override profile org count
 *   --users-per-org=N         Override users-per-org
 *   --contractors-per-org=N   Override contractors-per-org
 *   --invoices-per-contractor Override invoices-per-contractor
 *   --regions=EU,ME           Comma list. Default EU.
 *   --seed=N                  Faker seed (default 42). Faker draws are
 *                             deterministic per seed; row IDs and timestamps
 *                             are NOT (they use crypto.randomUUID + Date.now).
 *   --confirm                 Required (unless --append). Wipes tenant data
 *                             before reseeding.
 *   --append                  Skip the wipe and seed on top of existing data.
 *                             Each run creates fresh orgs (slugs include a
 *                             random token), so conflicts are impossible.
 *                             Mutually replaces --confirm.
 *   --omit=SECTION[,…]        Skip listed seed sections; transitive children
 *                             are skipped automatically. Validated against
 *                             the section registry BEFORE any DB connection
 *                             opens. Empty value (or flag absent) = "omit
 *                             nothing". Composes with --confirm (omitted
 *                             sections' tables are left untouched) and with
 *                             --append.
 *                             Example: --omit=workflow-runs,esign
 *   --progress / --no-progress
 *                             Bottom-anchored progress bar is ON by default.
 *                             Pass --no-progress to stream phase log lines.
 *   --help, -h                Print this help text and exit 0.
 *
 * ---------------------------------------------------------------------------
 * Env
 * ---------------------------------------------------------------------------
 *   DATABASE_URL              Used when --regions=EU and DATABASE_URL_EU unset
 *   DATABASE_URL_EU           Per-region overrides
 *   DATABASE_URL_ME
 *   SEED_PASSWORD             Shared dev password (default Test1234!)
 *   SEED_DEV_ALLOWED_HOST     Extra regex of allowed DB hostnames
 *   LOG_LEVEL                 trace|debug|info|warn|error
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { Logger } from '@contractor-ops/logger';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { ar, de, en, en_GB, Faker, pl } from '@faker-js/faker';
import { hashPassword } from 'better-auth/crypto';
import { defineCommand, runMain } from 'citty';
import cliProgress from 'cli-progress';
import CliTable3 from 'cli-table3';
import { config as loadEnv } from 'dotenv';
import pino from 'pino';
import pinoPretty from 'pino-pretty';

import { createPrismaClientForUrl } from '../src/client.js';
import type { PrismaClient } from '../src/generated/prisma/client/client.js';
import { Prisma } from '../src/generated/prisma/client/client.js';
import { seedQaFixtureUsers } from './seed-qa-fixtures.js';

// Load .env from the repo root so DATABASE_URL_* / SEED_PASSWORD work without
// the user having to source it manually.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

/**
 * Build a pino-pretty pipeline with the seed-dev style (emoji per phase,
 * colorised level/time, compact single-line). Used both for normal stdout
 * output and (with destination=multibar.log) for the --progress mode.
 */
function createSeedPrettyLogger(destination: NodeJS.WritableStream): Logger {
  const prettyStream = pinoPretty({
    colorize: true,
    translateTime: 'HH:MM:ss',
    ignore: 'pid,hostname,service',
    singleLine: true,
    destination,
    messageFormat: (record, messageKey): string => {
      const msg = String(record[messageKey] ?? '');
      const phaseMatch = msg.match(/^(.+?) seeded$/);
      const phaseIcon = phaseMatch?.[1] ? PHASE_EMOJI[phaseMatch[1]] : undefined;
      const levelIcon = LEVEL_EMOJI[Number(record.level)] ?? '·';
      const orgKey = record.orgKey ? ` [${String(record.orgKey)}]` : '';
      return `${phaseIcon ?? levelIcon}${orgKey} ${msg}`;
    },
  });
  return pino(getBaseLoggerOptions(), prettyStream).child({ service: 'seed-dev' });
}

// `let` so --progress can swap in a logger whose destination forwards lines
// through MultiBar.log(), making them appear above the bottom-anchored bar.
// Default destination is stdout so even non-progress runs get pretty output.
let log: Logger = createSeedPrettyLogger(process.stdout);

// ---------------------------------------------------------------------------
// CLI parsing — minimal built-in to avoid extra deps
// ---------------------------------------------------------------------------

type ProfileName = 'empty' | 'solo' | 'small' | 'medium' | 'huge' | 'showcase' | 'all' | 'qa';

interface CliFlags {
  profile: ProfileName;
  orgs?: number;
  usersPerOrg?: number;
  contractorsPerOrg?: number;
  invoicesPerContractor?: number;
  regions: readonly ('EU' | 'ME')[];
  seed: number;
  confirm: boolean;
  /**
   * Skip the tenant-table wipe and add seed rows on top of existing data.
   * Each invocation creates fresh orgs (slug includes a random token), so
   * conflicts with prior runs are impossible. Useful for stacking a
   * `--profile=showcase` org alongside an already-seeded `small` dataset.
   * Bypasses the `--confirm` requirement (no destruction = no acknowledgement).
   */
  append: boolean;
  help: boolean;
  /** Show a bottom-anchored progress bar instead of per-phase log lines. */
  progress: boolean;
  /**
   * User-supplied list of section keys to skip. Validated against `SECTION_KEYS`
   * before any DB connection opens. Transitive children (per
   * `SECTION_DEPENDENCIES`) are skipped automatically.
   */
  omit: readonly SectionKey[];
}

// ---------------------------------------------------------------------------
// Section registry — every named seed phase is a "section". The --omit flag
// accepts these keys (plus any whose parent was omitted).
// ---------------------------------------------------------------------------

/**
 * Canonical, ordered list of every section seed-dev knows about. Order
 * mirrors `seedOrg()` execution so the printed omit summary reads top-down.
 *
 * ⚠️ Keep in sync with:
 *   - `SECTION_DEPENDENCIES` below — every key here must have an entry there.
 *   - `seedOrg()` callsites — every section here either fires or is skipped
 *     under --omit.
 *   - `--help` text in `defineCommand` below.
 */
const SECTION_KEYS = [
  // Tenant data (existing)
  'contractors',
  'contracts',
  'invoices',
  'equipment',
  'payment-runs',
  'reminders',
  'notifications',
  'outbox',
  'webhook-deliveries',
  'audit-logs',
  'e-invoice-lifecycle',
  'portal-sessions',
  'integration-connections',
  'invoice-documents',
  'workflow-templates',
  'subscription',
  'courier-configs',
  'comments',
  'workflow-runs',
  'timesheets',
  // Newly-added coverage (declared up-front so the registry is stable while
  // later steps wire in the actual seeders).
  'tax-compliance',
  'classification',
  'skonto',
  'interest',
  'peppol',
  'zatca',
  'esign',
  'ocr',
  'exchange-rates',
  'consent',
  'api-keys',
  'pinned-views',
  'cron-state',
  'auth-surface',
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_KEY_SET: ReadonlySet<string> = new Set(SECTION_KEYS);

/**
 * Direct parents per child section. If a parent is omitted, every transitive
 * child is omitted too (resolved by `expandOmittedSections`). Sections with
 * no parent list `[]`.
 *
 * Edges encode "section X cannot be seeded without rows produced by section Y".
 */
const SECTION_DEPENDENCIES: Readonly<Record<SectionKey, readonly SectionKey[]>> = {
  contractors: [],
  contracts: ['contractors'],
  invoices: ['contractors'],
  equipment: ['contractors'],
  'payment-runs': ['invoices'],
  reminders: ['invoices'],
  notifications: [],
  outbox: [],
  'webhook-deliveries': [],
  'audit-logs': [],
  'e-invoice-lifecycle': ['invoices'],
  'portal-sessions': ['contractors'],
  'integration-connections': [],
  'invoice-documents': ['invoices'],
  'workflow-templates': [],
  subscription: [],
  'courier-configs': [],
  comments: [],
  'workflow-runs': ['workflow-templates', 'contractors'],
  timesheets: ['contractors', 'contracts'],
  // tax-compliance touches ReassessmentTrigger which references
  // ClassificationAssessment, so omitting `classification` must transitively
  // omit `tax-compliance` too.
  'tax-compliance': ['contractors', 'classification', 'payment-runs'],
  classification: ['contractors'],
  skonto: ['invoices'],
  interest: ['invoices'],
  peppol: ['invoices'],
  zatca: ['invoices'],
  esign: ['contracts'],
  ocr: ['invoice-documents'],
  'exchange-rates': [],
  consent: [],
  'api-keys': [],
  'pinned-views': [],
  'cron-state': [],
  'auth-surface': [],
};

interface OmitResolution {
  /** Every section that will be skipped (user-requested ∪ transitive). */
  resolved: Set<SectionKey>;
  /** For each transitively-omitted section: the parent(s) that triggered it. */
  transitively: Map<SectionKey, SectionKey[]>;
}

/**
 * Walk the reverse dependency graph until fixed point. Pure function so it can
 * be unit-tested without spinning up a Prisma client.
 */
function expandOmittedSections(omitted: readonly SectionKey[]): OmitResolution {
  const resolved = new Set<SectionKey>(omitted);
  const transitively = new Map<SectionKey, SectionKey[]>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const child of SECTION_KEYS) {
      if (resolved.has(child)) continue;
      const triggeringParents = SECTION_DEPENDENCIES[child].filter(p => resolved.has(p));
      if (triggeringParents.length > 0) {
        resolved.add(child);
        transitively.set(child, [...triggeringParents]);
        changed = true;
      }
    }
  }
  return { resolved, transitively };
}

/**
 * Parse the raw `--omit=foo,bar` string. Empty value (or flag absent) = "omit
 * nothing". Throws on unknown keys with a clear listing of valid keys so the
 * error fires *before* any DB connection opens.
 */
function parseOmitFlag(raw: string | undefined): SectionKey[] {
  if (!raw || raw.trim() === '') return [];
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const unknown = parts.filter(p => !SECTION_KEY_SET.has(p));
  if (unknown.length > 0) {
    const valid = [...SECTION_KEYS].sort().join(', ');
    throw new Error(
      `flag --omit contains unknown section key(s): ${unknown.join(', ')}\n` +
        `Valid keys: ${valid}`,
    );
  }
  return parts as SectionKey[];
}

/**
 * Render the resolved omit summary (user-supplied + transitively-skipped) plus
 * the final list of running sections. Uses the existing CliTable3 style. The
 * write callback is injected so callers can choose between stdout (non-progress
 * mode, before the bar starts) and `MultiBar.log()` (progress mode, above the
 * bottom-anchored bar).
 */
function printOmitSummary(
  userOmitted: readonly SectionKey[],
  resolution: OmitResolution,
  write: (line: string) => void,
): void {
  if (resolution.resolved.size === 0) return;

  const table = new CliTable3({
    head: ['Section', 'Reason'],
    style: { head: ['cyan'], border: ['gray'] },
    wordWrap: true,
  });
  const userSet = new Set<SectionKey>(userOmitted);
  // Walk SECTION_KEYS so the table preserves canonical ordering.
  for (const key of SECTION_KEYS) {
    if (!resolution.resolved.has(key)) continue;
    if (userSet.has(key)) {
      table.push([key, 'requested via --omit']);
    } else {
      const parents = resolution.transitively.get(key);
      const reason =
        parents && parents.length > 0
          ? `transitively skipped (parent omitted: ${parents.join(', ')})`
          : 'transitively skipped';
      table.push([key, reason]);
    }
  }

  const running = SECTION_KEYS.filter(k => !resolution.resolved.has(k));
  write('\n');
  write('Omit summary:\n');
  write(`${table.toString()}\n`);
  write(`\nSections that will run (${running.length}/${SECTION_KEYS.length}):\n`);
  write(`  ${running.join(', ')}\n\n`);
}

// ---------------------------------------------------------------------------
// Phase reporter — toggles between per-phase log lines and a bottom progress bar
// ---------------------------------------------------------------------------

/** Emoji shown for each named phase in pretty log lines (--progress mode).
 *  Keys are SECTION_KEYS values so a single label drives both gating and
 *  display. */
const PHASE_EMOJI: Record<string, string> = {
  contractors: '👥',
  contracts: '📜',
  invoices: '🧾',
  equipment: '💻',
  'payment-runs': '💰',
  reminders: '⏰',
  notifications: '🔔',
  outbox: '📤',
  'webhook-deliveries': '🪝',
  'audit-logs': '📋',
  'e-invoice-lifecycle': '📨',
  'portal-sessions': '🚪',
  'integration-connections': '🔌',
  'invoice-documents': '📑',
  'workflow-templates': '🌀',
  subscription: '💳',
  'courier-configs': '📦',
  comments: '💬',
  'workflow-runs': '🔁',
  timesheets: '🕒',
  classification: '🧠',
  'tax-compliance': '⚖️ ',
  skonto: '💸',
  interest: '📈',
  peppol: '🛰️ ',
  zatca: '🏛️ ',
  esign: '✍️ ',
  ocr: '🔎',
  'exchange-rates': '💱',
  consent: '📜',
  'api-keys': '🔑',
  'pinned-views': '📌',
  'cron-state': '⏱️ ',
  'auth-surface': '🔐',
};

/**
 * Number of distinct `reporter.tick()` calls a single `seedOrg()` makes.
 * Derived from `PHASE_EMOJI` so adding a section to the emoji map and a tick
 * call in `seedOrg()` stays in sync without a manual constant bump.
 */
const PHASES_PER_ORG = Object.keys(PHASE_EMOJI).length;

/** Emoji shown by log level when no phase emoji matched. */
const LEVEL_EMOJI: Record<number, string> = {
  10: '🔍', // trace
  20: '🔍', // debug
  30: '✨', // info
  40: '⚠️ ', // warn
  50: '❌', // error
  60: '🔥', // fatal
};

/**
 * Empirical "cost" per phase, used for weighted ETA. Numbers don't have to be
 * exact seconds — only their RATIO matters. Calibrated against `showcase`
 * profile runs:
 *   - contractors: 40 rows + tags/assignments/billing-profiles per row
 *   - invoices: ~210 rows with lines/approvals/matches — dominant cost
 *   - equipment, e-invoice, invoice-documents: mid-tier (joined records)
 *   - outbox/webhook/portal-session/integration: near-instant batch inserts
 *
 * Without this, cli-progress' built-in ETA divides elapsed time by tick count
 * (each phase weighs the same), which produces wildly wrong estimates: it
 * predicts "10 minutes left" after the fast early phases, then crashes to "5
 * minutes" once the bigger phases finish.
 */
const PHASE_WEIGHTS: Record<string, number> = {
  contractors: 20,
  contracts: 5,
  invoices: 30,
  equipment: 10,
  'payment-runs': 5,
  reminders: 3,
  notifications: 2,
  outbox: 1,
  'webhook-deliveries': 1,
  'audit-logs': 3,
  'e-invoice-lifecycle': 5,
  'portal-sessions': 1,
  'integration-connections': 1,
  'invoice-documents': 5,
  'workflow-templates': 3,
  subscription: 1,
  'courier-configs': 1,
  comments: 3,
  'workflow-runs': 4,
  timesheets: 4,
  classification: 3,
  'tax-compliance': 3,
  skonto: 4,
  interest: 3,
  peppol: 3,
  zatca: 2,
  esign: 3,
  ocr: 2,
  'exchange-rates': 4,
  consent: 3,
  'api-keys': 1,
  'pinned-views': 1,
  'cron-state': 2,
  'auth-surface': 2,
};
const PHASE_WEIGHT_DEFAULT = 3;
const TOTAL_WEIGHT_PER_ORG = Object.values(PHASE_WEIGHTS).reduce((a, b) => a + b, 0);

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m${s.toString().padStart(2, '0')}s`;
}

interface Reporter {
  start(totalTicks: number): void;
  tick(orgKey: string, phase: string): void;
  stop(): void;
}

class LogReporter implements Reporter {
  start(): void {
    /* no-op — log lines provide their own structure */
  }
  tick(orgKey: string, phase: string): void {
    log.info({ orgKey }, `${phase} seeded`);
  }
  stop(): void {
    /* no-op */
  }
}

/** Braille spinner — 10 frames @ 80ms cycles every ~800ms, classic feel. */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;
const SPINNER_FPS_MS = 80;

class BarReporter implements Reporter {
  private readonly multibar: cliProgress.MultiBar;
  private bar: cliProgress.SingleBar | null = null;
  private spinnerInterval: ReturnType<typeof setInterval> | null = null;
  private spinnerIdx = 0;
  /** Last payload set by tick() — re-used during spinner-only redraws so the
   *  bar doesn't flicker back to a stale orgKey/phase between ticks. */
  private lastPayload: Record<string, string> = { orgKey: '-', phase: 'starting' };
  /** Wall-clock when start() ran; basis for elapsed + weighted ETA. */
  private startedAtMs = 0;
  /** Sum of weights of completed phases — input to weighted ETA. */
  private completedWeight = 0;
  /** Total weight across all orgs (set in start() once we know orgs count). */
  private totalWeight = 1;
  /**
   * ETA snapshot taken at the moment of the last tick. The spinner interval
   * COUNTS DOWN from this value rather than recomputing from `elapsed /
   * completedWeight * remaining` every frame — otherwise ETA grows linearly
   * with `elapsed` while we wait for the next tick, which is the opposite of
   * what a countdown should do.
   */
  private etaAtLastTickMs = 0;
  /** When `etaAtLastTickMs` was set — countdown floor. */
  private etaSetAt = 0;

  constructor() {
    // MultiBar (with a single visible bar) is used here specifically because
    // it exposes `.log(message)`, which prints text *above* the progress line
    // while the bar stays anchored at the bottom of the terminal. SingleBar
    // doesn't support this — log lines would trample the bar redraw.
    this.multibar = new cliProgress.MultiBar(
      {
        // Note: {eta_weighted} is our custom payload field (filled by tick()
        // and the spinner interval); cli-progress' built-in {eta_formatted}
        // would be the naive "elapsed / ticks" estimate that gave the
        // 10m→5m jump.
        format:
          '{spinner} {bar} {percentage}% ({value}/{total}) │ {orgKey} │ {phase} │ ⏱ {elapsed} │ ETA {eta_weighted}',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
        clearOnComplete: false,
        stopOnComplete: false,
        autopadding: true,
        forceRedraw: true,
        noTTYOutput: false,
      },
      cliProgress.Presets.shades_classic,
    );
  }

  /**
   * Recompute the ETA snapshot from the latest tick state (called from tick()).
   * Stored separately from the render so the spinner interval can count down
   * from it without growing the value.
   */
  private recomputeEta(): void {
    if (this.completedWeight <= 0) {
      this.etaAtLastTickMs = 0;
      this.etaSetAt = Date.now();
      return;
    }
    const elapsedMs = Date.now() - this.startedAtMs;
    const remaining = Math.max(0, this.totalWeight - this.completedWeight);
    this.etaAtLastTickMs = (elapsedMs / this.completedWeight) * remaining;
    this.etaSetAt = Date.now();
  }

  /** Render-time payload — elapsed (live) + ETA (counts down between ticks). */
  private timePayload(): { elapsed: string; eta_weighted: string } {
    const now = Date.now();
    const elapsedMs = now - this.startedAtMs;
    let eta: string;
    if (this.completedWeight <= 0) {
      eta = '—';
    } else {
      // Countdown from the most recent tick's ETA snapshot. Floored at 0 so
      // the bar reads "0s" rather than negatives if a phase outruns its weight.
      const remainingEtaMs = Math.max(0, this.etaAtLastTickMs - (now - this.etaSetAt));
      eta = formatDurationMs(remainingEtaMs);
    }
    return { elapsed: formatDurationMs(elapsedMs), eta_weighted: eta };
  }

  start(totalTicks: number): void {
    this.startedAtMs = Date.now();
    this.etaSetAt = Date.now();
    // totalTicks = orgsPlanned.length * PHASES_PER_ORG, so the weight total
    // scales with the org count.
    const orgsCount = Math.max(1, Math.round(totalTicks / PHASES_PER_ORG));
    this.totalWeight = TOTAL_WEIGHT_PER_ORG * orgsCount;

    this.bar = this.multibar.create(totalTicks, 0, {
      ...this.lastPayload,
      spinner: SPINNER_FRAMES[0],
      ...this.timePayload(),
    });
    // Animate the spinner + refresh elapsed/ETA so the bar visibly "breathes"
    // while a long phase (e.g. seeding 500 invoices) is still in flight
    // between two ticks.
    this.spinnerInterval = setInterval(() => {
      this.spinnerIdx = (this.spinnerIdx + 1) % SPINNER_FRAMES.length;
      this.bar?.update({
        ...this.lastPayload,
        spinner: SPINNER_FRAMES[this.spinnerIdx],
        ...this.timePayload(),
      });
    }, SPINNER_FPS_MS);
  }
  tick(orgKey: string, phase: string): void {
    // Log first (lands above the bar via asLogStream → multibar.log), THEN
    // increment so the bar's redraw is the last terminal write of the tick
    // and stays anchored at the bottom.
    log.info({ orgKey }, `${phase} seeded`);
    this.lastPayload = { orgKey, phase };
    this.completedWeight += PHASE_WEIGHTS[phase] ?? PHASE_WEIGHT_DEFAULT;
    // Refresh the ETA snapshot now that we have one more data point; spinner
    // interval will count down from this value until the next tick.
    this.recomputeEta();
    this.bar?.increment({
      orgKey,
      phase,
      spinner: SPINNER_FRAMES[this.spinnerIdx],
      ...this.timePayload(),
    });
  }
  stop(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    // Final frame: replace spinner with a checkmark and zero out ETA so the
    // last visible bar reads as "done" rather than mid-animation.
    this.bar?.update({
      ...this.lastPayload,
      spinner: '✔',
      phase: 'done',
      elapsed: formatDurationMs(Date.now() - this.startedAtMs),
      eta_weighted: '0s',
    });
    this.multibar.stop();
  }

  /**
   * Writable sink that the pretty-logger pipeline writes into. Each chunk is
   * one already-formatted log line (colors, emoji, human time) which we
   * forward through `multibar.log()` so it lands above the bottom-anchored
   * progress bar. The pino-pretty stage itself is built in
   * `createSeedPrettyLogger()` and shared with non-progress runs.
   */
  asLogSink(): NodeJS.WritableStream {
    return new Writable({
      write: (chunk: Buffer | string, _enc, cb) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        this.multibar.log(text);
        cb();
      },
    });
  }

  /** Forward a single text chunk above the bar. Used by `printOmitSummary`. */
  logRaw(text: string): void {
    this.multibar.log(text);
  }
}

let reporter: Reporter = new LogReporter();

// ---------------------------------------------------------------------------
// Safety guardrails
// ---------------------------------------------------------------------------

const ALLOWED_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^::1$/,
  /^host\.docker\.internal$/i,
  /\.neon\.tech$/i, // Neon hosts — additionally require dev/local/staging in URL
];

function ensureSafeDbUrl(connectionString: string, regionLabel: string): void {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch (err) {
    throw new Error(`[${regionLabel}] DATABASE_URL is not a valid URL: ${(err as Error).message}`);
  }

  const customAllow = process.env.SEED_DEV_ALLOWED_HOST;
  const customRegex = customAllow ? new RegExp(customAllow) : null;
  const matchesBuiltIn = ALLOWED_HOST_PATTERNS.some(p => p.test(host));
  const matchesCustom = customRegex?.test(host) ?? false;

  if (!(matchesBuiltIn || matchesCustom)) {
    throw new Error(
      `[${regionLabel}] refusing to seed against host "${host}". ` +
        `Set SEED_DEV_ALLOWED_HOST to a regex that matches it if this is a dev DB.`,
    );
  }

  // Extra guardrail for neon.tech hosts: require explicit dev/local/staging
  // in the URL or in the database name to avoid catastrophic prod hits.
  if (/\.neon\.tech$/i.test(host) && !matchesCustom) {
    const looksDev = /(\bdev\b|\blocal\b|\bstaging\b|\bseed\b)/i.test(connectionString);
    if (!looksDev) {
      throw new Error(
        `[${regionLabel}] neon.tech host "${host}" lacks a dev/staging/local marker. ` +
          'Override via SEED_DEV_ALLOWED_HOST if intentional.',
      );
    }
  }
}

function ensureSafeEnvironment(flags: CliFlags): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to seed: NODE_ENV=production');
  }
  if (!(flags.confirm || flags.append)) {
    throw new Error(
      'refusing to seed: pass --confirm to acknowledge data wipe, or --append to seed on top of existing data',
    );
  }
}

// ---------------------------------------------------------------------------
// Profiles — single source of truth for volume tiers
// ---------------------------------------------------------------------------

interface OrgVolume {
  /** Distinct id used in slug + email prefixes. */
  key: string;
  /** Maps to OrgVolume.region. */
  region: 'EU' | 'ME';
  usersPerOrg: number;
  contractorsPerOrg: number;
  invoicesPerContractor: { min: number; max: number };
  equipmentPerOrg: number;
  webhookDeliveriesPerOrg: number;
  outboxEventsPerOrg: number;
  auditLogsPerOrg: number;
  notificationsPerUser: number;
  reminderRules: number;
  paymentRunsPerOrg: number;
  /** When true, force-emit at least one row in every status enum. */
  showcase?: boolean;
}

const VOLUME_TEMPLATES = {
  empty: {
    usersPerOrg: 1,
    contractorsPerOrg: 0,
    invoicesPerContractor: { min: 0, max: 0 },
    equipmentPerOrg: 0,
    webhookDeliveriesPerOrg: 0,
    outboxEventsPerOrg: 0,
    auditLogsPerOrg: 0,
    notificationsPerUser: 0,
    reminderRules: 0,
    paymentRunsPerOrg: 0,
  },
  solo: {
    usersPerOrg: 1,
    contractorsPerOrg: 2,
    invoicesPerContractor: { min: 1, max: 3 },
    equipmentPerOrg: 2,
    webhookDeliveriesPerOrg: 4,
    outboxEventsPerOrg: 6,
    auditLogsPerOrg: 20,
    notificationsPerUser: 4,
    reminderRules: 1,
    paymentRunsPerOrg: 1,
  },
  small: {
    usersPerOrg: 4,
    contractorsPerOrg: 10,
    invoicesPerContractor: { min: 2, max: 6 },
    equipmentPerOrg: 8,
    webhookDeliveriesPerOrg: 20,
    outboxEventsPerOrg: 30,
    auditLogsPerOrg: 120,
    notificationsPerUser: 12,
    reminderRules: 3,
    paymentRunsPerOrg: 3,
  },
  medium: {
    usersPerOrg: 10,
    contractorsPerOrg: 100,
    invoicesPerContractor: { min: 3, max: 8 },
    equipmentPerOrg: 25,
    webhookDeliveriesPerOrg: 80,
    outboxEventsPerOrg: 150,
    auditLogsPerOrg: 600,
    notificationsPerUser: 25,
    reminderRules: 5,
    paymentRunsPerOrg: 8,
  },
  huge: {
    usersPerOrg: 30,
    contractorsPerOrg: 1000,
    invoicesPerContractor: { min: 5, max: 12 },
    equipmentPerOrg: 80,
    webhookDeliveriesPerOrg: 250,
    outboxEventsPerOrg: 600,
    auditLogsPerOrg: 2500,
    notificationsPerUser: 40,
    reminderRules: 8,
    paymentRunsPerOrg: 20,
  },
  showcase: {
    usersPerOrg: 8,
    contractorsPerOrg: 40,
    invoicesPerContractor: { min: 4, max: 7 },
    equipmentPerOrg: 14,
    webhookDeliveriesPerOrg: 35,
    outboxEventsPerOrg: 60,
    auditLogsPerOrg: 200,
    notificationsPerUser: 18,
    reminderRules: 4,
    paymentRunsPerOrg: 4,
  },
} as const;

function buildOrgs(profile: ProfileName, regions: readonly ('EU' | 'ME')[]): OrgVolume[] {
  const orgs: OrgVolume[] = [];
  const pickRegion = (idx: number): 'EU' | 'ME' => {
    // ~70% EU, 30% ME when both regions are configured
    if (regions.length === 1) {
      const only = regions[0];
      if (only === undefined) throw new Error('regions list is empty');
      return only;
    }
    const r = idx % 10 < 7 ? 'EU' : 'ME';
    return regions.includes(r) ? r : (regions[0] as 'EU' | 'ME');
  };

  const push = (
    key: string,
    template: keyof typeof VOLUME_TEMPLATES,
    region: 'EU' | 'ME',
    showcase = false,
  ): void => {
    orgs.push({ key, region, ...VOLUME_TEMPLATES[template], showcase });
  };

  switch (profile) {
    case 'empty':
      push('empty-1', 'empty', pickRegion(0));
      break;
    case 'solo':
      push('solo-1', 'solo', pickRegion(0));
      break;
    case 'small':
      for (let i = 0; i < 3; i += 1) push(`small-${i + 1}`, 'small', pickRegion(i));
      break;
    case 'medium':
      for (let i = 0; i < 5; i += 1) push(`medium-${i + 1}`, 'medium', pickRegion(i));
      break;
    case 'huge':
      for (let i = 0; i < 3; i += 1) push(`huge-${i + 1}`, 'huge', pickRegion(i));
      push('huge-medium-1', 'medium', pickRegion(3));
      push('huge-empty-1', 'empty', pickRegion(4));
      push('huge-solo-1', 'solo', pickRegion(5));
      break;
    case 'showcase':
      push('showcase-1', 'showcase', pickRegion(0), true);
      break;
    case 'all':
      push('all-empty-1', 'empty', pickRegion(0));
      push('all-solo-1', 'solo', pickRegion(1));
      for (let i = 0; i < 2; i += 1) push(`all-small-${i + 1}`, 'small', pickRegion(i + 2));
      for (let i = 0; i < 2; i += 1) push(`all-medium-${i + 1}`, 'medium', pickRegion(i + 4));
      push('all-huge-1', 'huge', pickRegion(6));
      push('all-showcase-1', 'showcase', pickRegion(7), true);
      break;
    case 'qa':
      // Deterministic three-org layout driving the QA walk-and-fix loop.
      // Pinned to EU so currency/language defaults are stable across runs.
      push('qa-default-org', 'showcase', 'EU', true);
      push('qa-empty-org', 'empty', 'EU');
      // Stress org overrides paymentRunsPerOrg up from the huge template's 20
      // so the payments page renders pagination + virtualization properly.
      orgs.push({
        ...VOLUME_TEMPLATES.huge,
        key: 'qa-stress-org',
        region: 'EU',
        paymentRunsPerOrg: 200,
        showcase: false,
      });
      break;
  }
  return orgs;
}

function applyOverrides(input: readonly OrgVolume[], flags: CliFlags): OrgVolume[] {
  let resized: OrgVolume[] = [...input];
  if (flags.orgs !== undefined && resized.length > 0) {
    if (flags.orgs === 0) return [];
    if (flags.orgs <= resized.length) {
      resized = resized.slice(0, flags.orgs);
    } else {
      const template = resized[resized.length - 1] as OrgVolume;
      while (resized.length < flags.orgs) {
        resized.push({ ...template, key: `${template.key}-extra-${resized.length}` });
      }
    }
  }
  return resized.map(o => ({
    ...o,
    usersPerOrg: flags.usersPerOrg ?? o.usersPerOrg,
    contractorsPerOrg: flags.contractorsPerOrg ?? o.contractorsPerOrg,
    invoicesPerContractor:
      flags.invoicesPerContractor === undefined
        ? o.invoicesPerContractor
        : {
            min: flags.invoicesPerContractor,
            max: flags.invoicesPerContractor,
          },
  }));
}

// ---------------------------------------------------------------------------
// Faker setup — per-region locale instances, deterministic
// ---------------------------------------------------------------------------

interface OrgFakers {
  /** Org-level faker, locale matches the org's primary jurisdiction */
  org: Faker;
  /** English fallback for fields that must be ASCII-safe (slugs, emails) */
  ascii: Faker;
}

function makeFakers(region: 'EU' | 'ME', countryCode: string, seed: number): OrgFakers {
  const locales = (() => {
    if (region === 'ME') return [ar, en];
    if (countryCode === 'DE') return [de, en];
    if (countryCode === 'PL') return [pl, en];
    if (countryCode === 'GB') return [en_GB, en];
    return [en];
  })();
  const orgFaker = new Faker({ locale: locales });
  orgFaker.seed(seed);
  const asciiFaker = new Faker({ locale: [en] });
  asciiFaker.seed(seed + 1);
  return { org: orgFaker, ascii: asciiFaker };
}

// ---------------------------------------------------------------------------
// Region / locale / currency catalog
// ---------------------------------------------------------------------------

interface RegionProfile {
  countryCode: string;
  language: 'en' | 'pl' | 'ar' | 'de';
  defaultCurrency: 'EUR' | 'GBP' | 'AED' | 'SAR';
  timezone: string;
}

const EU_PROFILES: readonly RegionProfile[] = [
  {
    countryCode: 'DE',
    language: 'de',
    defaultCurrency: 'EUR',
    timezone: 'Europe/Berlin',
  },
  {
    countryCode: 'PL',
    language: 'pl',
    defaultCurrency: 'EUR',
    timezone: 'Europe/Warsaw',
  },
  {
    countryCode: 'GB',
    language: 'en',
    defaultCurrency: 'GBP',
    timezone: 'Europe/London',
  },
  {
    countryCode: 'NL',
    language: 'en',
    defaultCurrency: 'EUR',
    timezone: 'Europe/Amsterdam',
  },
];

const ME_PROFILES: readonly RegionProfile[] = [
  {
    countryCode: 'AE',
    language: 'ar',
    defaultCurrency: 'AED',
    timezone: 'Asia/Dubai',
  },
  {
    countryCode: 'SA',
    language: 'ar',
    defaultCurrency: 'SAR',
    timezone: 'Asia/Riyadh',
  },
];

function pickRegionProfile(region: 'EU' | 'ME', faker: Faker): RegionProfile {
  const list = region === 'EU' ? EU_PROFILES : ME_PROFILES;
  return faker.helpers.arrayElement(list);
}

// ---------------------------------------------------------------------------
// Helpers — IDs, money, dates, picking
// ---------------------------------------------------------------------------

const newId = (): string => randomUUID();

const moneyMinor = (faker: Faker, min = 100, max = 50_000): number =>
  faker.number.int({ min, max }) * 100;

const pastDate = (faker: Faker, daysBack: number): Date => {
  const ms = Date.now() - faker.number.int({ min: 0, max: daysBack * 86_400_000 });
  return new Date(ms);
};

const futureDate = (faker: Faker, daysAhead: number): Date => {
  const ms = Date.now() + faker.number.int({ min: 1, max: daysAhead * 86_400_000 });
  return new Date(ms);
};

const dateOnly = (d: Date): Date => {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const tokenHex = (bytes = 24): string => randomBytes(bytes).toString('hex');

const weightedPick = <T>(faker: Faker, choices: ReadonlyArray<readonly [T, number]>): T => {
  const first = choices[0];
  if (first === undefined) {
    throw new Error('weightedPick called with empty choices array');
  }
  const total = choices.reduce((acc, [, w]) => acc + w, 0);
  let r = faker.number.float({ min: 0, max: total });
  let last: T = first[0];
  for (const [val, w] of choices) {
    last = val;
    r -= w;
    if (r <= 0) return val;
  }
  return last;
};

/**
 * Adds `days` to `d` and clips to "now" (so generated dates never fall in the
 * future). Used to chain a forward timeline of invoice / approval timestamps.
 */
const advanceCapped = (d: Date, days: number): Date => {
  const candidate = d.getTime() + days * 86_400_000;
  return new Date(Math.min(candidate, Date.now()));
};

/**
 * Random date in the half-open range [from, to) — both bounds inclusive of
 * day-precision. Used to scatter `createdAt` values realistically across an
 * organisation's lifespan.
 */
const dateBetween = (faker: Faker, from: Date, to: Date): Date => {
  const min = from.getTime();
  const max = Math.max(min, to.getTime());
  return new Date(faker.number.int({ min, max }));
};

/**
 * `pastDate(daysBack)` clamped at `anchor` — the generated date never
 * pre-dates `anchor`. Used so notification / outbox / webhook / integration
 * timestamps never sit outside the org's lifespan (a 90-day-old notification
 * on a 5-day-old org was the bug).
 */
const pastDateAfter = (faker: Faker, daysBack: number, anchor: Date): Date => {
  const earliest = anchor.getTime();
  const candidate = Date.now() - faker.number.int({ min: 0, max: daysBack * 86_400_000 });
  return new Date(Math.max(earliest, candidate));
};

// ---------------------------------------------------------------------------
// Country-aware formatters
// ---------------------------------------------------------------------------

/**
 * Standard VAT rate by country (the rate small B2B service invoices typically
 * carry). Reduced rates exist but the seed deliberately uses standard so the
 * UI never surfaces a "0% / reduced VAT" edge case unless we explicitly want
 * it.
 */
const VAT_RATE_BY_COUNTRY: Readonly<Record<string, number>> = {
  DE: 19,
  PL: 23,
  NL: 21,
  GB: 20,
  AE: 5,
  SA: 15,
};

/**
 * Country-formatted national tax ID (Steuernummer / NIP / UTR / TRN).
 * Format-correct enough to look right in lists; not check-digit valid.
 */
function makeTaxId(country: string, faker: Faker): string {
  const digits = (n: number) => faker.string.numeric({ length: n });
  switch (country) {
    case 'DE':
      // Steuernummer: 13 digits formatted as 12/345/67890 (regional code +
      // district + serial). We keep the slashes for visual realism.
      return `${digits(2)}/${digits(3)}/${digits(5)}`;
    case 'PL':
      // NIP: 10 digits, conventionally rendered with hyphens.
      return `${digits(3)}-${digits(3)}-${digits(2)}-${digits(2)}`;
    case 'GB':
      // UTR: 10 digits, no separators.
      return digits(10);
    case 'NL':
      // BSN-style 9 digits.
      return digits(9);
    case 'AE':
    case 'SA':
      // Both use a 15-digit TRN — same shape as the VAT registration number.
      return digits(15);
    default:
      return digits(10);
  }
}

/**
 * Country-formatted VAT registration number. Most EU countries prefix with
 * the ISO country code; Gulf states use a 15-digit TRN with no prefix.
 */
function makeVatId(country: string, faker: Faker): string {
  const digits = (n: number) => faker.string.numeric({ length: n });
  switch (country) {
    case 'DE':
      return `DE${digits(9)}`;
    case 'PL':
      return `PL${digits(10)}`;
    case 'GB':
      return `GB${digits(9)}`;
    case 'NL':
      // NL VAT is 9 digits + 'B' + 2-digit suffix.
      return `NL${digits(9)}B${digits(2)}`;
    case 'AE':
    case 'SA':
      return digits(15);
    default:
      return `${country}${digits(9)}`;
  }
}

/**
 * Plausible BIC: 4-letter bank code + ISO country + 2-char location + optional
 * 3-char branch. Picked from a small per-country list of well-known banks so
 * BICs LOOK like BICs, not like random strings.
 */
const BIC_FRAGMENTS: Readonly<Record<string, readonly string[]>> = {
  DE: ['DEUTDEFF', 'COBADEFF', 'GENODEFF', 'HYVEDEMM', 'BYLADEM1'],
  PL: ['BPKOPLPW', 'BREXPLPW', 'INGBPLPW', 'PKOPPLPW', 'WBKPPLPP'],
  GB: ['BARCGB22', 'HBUKGB4B', 'NWBKGB2L', 'LOYDGB2L', 'MIDLGB22'],
  NL: ['INGBNL2A', 'ABNANL2A', 'RABONL2U', 'BUNQNL2A', 'KNABNL2H'],
  AE: ['EBILAEAD', 'NBADAEAA', 'ADCBAEAA', 'BBMEAEAD', 'INVLAEAD'],
  SA: ['NCBKSAJE', 'RJHISARI', 'SABBSARI', 'BSFRSARI', 'ARNBSARI'],
};
function makeBic(country: string, faker: Faker): string {
  const list = BIC_FRAGMENTS[country] ?? ['DEUTDEFF'];
  return faker.helpers.arrayElement(list);
}

/**
 * Plausible IBAN-style masked account: visible country prefix + check digits,
 * masked middle, last 4 digits visible. Real IBANs vary in length per country
 * (DE 22, PL 28, GB 22, NL 18, AE 23, SA 24); we render the right length for
 * each so list views look right.
 */
const IBAN_LENGTH: Readonly<Record<string, number>> = {
  DE: 22,
  PL: 28,
  GB: 22,
  NL: 18,
  AE: 23,
  SA: 24,
};
function makeMaskedIban(country: string, faker: Faker): string {
  const len = IBAN_LENGTH[country] ?? 22;
  const checksum = faker.string.numeric({ length: 2 });
  const last4 = faker.string.numeric({ length: 4 });
  const middleStars = '*'.repeat(Math.max(0, len - 2 - 2 - 4));
  // Insert spaces every 4 chars so the value renders like a real printed IBAN.
  const raw = `${country}${checksum}${middleStars}${last4}`;
  return raw.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Equipment serial number with a type-specific shape. Apple-style for laptops,
 * IMEI for phones, vendor-prefixed for monitors / accessories.
 */
function makeEquipmentSerial(type: string, faker: Faker): string {
  const upper = (n: number) => faker.string.alphanumeric({ length: n, casing: 'upper' });
  const digits = (n: number) => faker.string.numeric({ length: n });
  switch (type) {
    case 'LAPTOP':
      // Apple-style 12-char serial.
      return `C02${upper(9)}`;
    case 'PHONE':
      // 15-digit IMEI.
      return digits(15);
    case 'MONITOR':
      return `MX-${digits(4)}-${upper(6)}`;
    case 'KEYBOARD':
    case 'MOUSE':
    case 'HEADSET':
      return `${type.slice(0, 2)}-${upper(8)}`;
    default:
      return `SN-${upper(10)}`;
  }
}

// ---------------------------------------------------------------------------
// Wipe routine — full DB wipe of tenant tables (--confirm only)
// ---------------------------------------------------------------------------

/**
 * Tables wiped in dependency-safe order (children before parents).
 * Production reference data (Tax_Rate, Wht_Rate, B_o_E_Base_Rate_History,
 * KOSIT schematron caches, etc.) is intentionally NOT in this list.
 */
interface WipeEntry {
  table: string;
  /**
   * Section that owns this table. When the section is in the omit set, the
   * table is left untouched by --confirm. `undefined` = foundational (always
   * wiped, including User / Organization / Document and the org-structure
   * tables that have no per-section gate).
   */
  section?: SectionKey;
}

const WIPE_TABLES_IN_ORDER: readonly WipeEntry[] = [
  // Audit / outbox / webhook / notification noise first
  { table: '"AuditLog"', section: 'audit-logs' },
  { table: '"OutboxEvent"', section: 'outbox' },
  { table: '"WebhookDelivery"', section: 'webhook-deliveries' },
  { table: '"IntegrationSyncLog"', section: 'cron-state' },
  { table: '"ExternalLink"', section: 'integration-connections' },
  { table: '"IntegrationConnection"', section: 'integration-connections' },
  { table: '"NotificationCronDedup"', section: 'cron-state' },
  { table: '"Notification"', section: 'notifications' },
  { table: '"UserNotificationPreference"', section: 'notifications' },
  { table: '"Comment"', section: 'comments' },
  { table: '"ReminderInstance"', section: 'reminders' },
  { table: '"ReminderRule"', section: 'reminders' },
  // Approval chain — implicit dep of invoices
  { table: '"ApprovalDecision"', section: 'invoices' },
  { table: '"ApprovalStep"', section: 'invoices' },
  { table: '"ApprovalFlow"', section: 'invoices' },
  { table: '"ApprovalChainConfig"', section: 'invoices' },
  // Payments
  { table: '"PaymentExport"', section: 'payment-runs' },
  // WhtCertificate references PaymentRunItem — wipe before PaymentRunItem
  { table: '"WhtCertificate"', section: 'tax-compliance' },
  { table: '"SkontoApplication"', section: 'skonto' },
  { table: '"PaymentRunItem"', section: 'payment-runs' },
  { table: '"PaymentRun"', section: 'payment-runs' },
  { table: '"InvoicePayment"', section: 'invoices' },
  // Billing (Subscription + OCR ledger — wiped per org, reseeded per org)
  { table: '"Subscription"', section: 'subscription' },
  { table: '"OcrCreditLedger"', section: 'subscription' },
  // Invoices + e-invoice + zatca + peppol (transmission/participant before invoice)
  { table: '"OcrExtraction"', section: 'ocr' },
  { table: '"EInvoiceLifecycleEvent"', section: 'e-invoice-lifecycle' },
  { table: '"EInvoiceLifecycle"', section: 'e-invoice-lifecycle' },
  { table: '"PeppolTransmission"', section: 'peppol' },
  { table: '"PeppolCapabilityCache"', section: 'peppol' },
  { table: '"PeppolParticipant"', section: 'peppol' },
  { table: '"ZatcaInvoiceChain"', section: 'zatca' },
  { table: '"LeitwegId"', section: 'peppol' },
  { table: '"InvoiceIntakeRequest"', section: 'invoices' },
  { table: '"InvoiceMatchResult"', section: 'invoices' },
  { table: '"SkontoSnapshot"', section: 'skonto' },
  { table: '"SkontoTerm"', section: 'skonto' },
  { table: '"InvoiceInterestWaiver"', section: 'interest' },
  { table: '"InvoiceInterestCompensation"', section: 'interest' },
  { table: '"InvoiceInterestClaim"', section: 'interest' },
  { table: '"InvoiceFile"', section: 'invoices' },
  { table: '"InvoiceLine"', section: 'invoices' },
  { table: '"Invoice"', section: 'invoices' },
  // eSign — recipient + event before envelope
  { table: '"SigningEvent"', section: 'esign' },
  { table: '"SigningRecipient"', section: 'esign' },
  { table: '"SigningEnvelope"', section: 'esign' },
  // Equipment / shipments
  { table: '"ShipmentEvent"', section: 'equipment' },
  { table: '"ReturnRequest"', section: 'equipment' },
  { table: '"Shipment"', section: 'equipment' },
  { table: '"EquipmentAssignment"', section: 'equipment' },
  { table: '"Equipment"', section: 'equipment' },
  { table: '"CourierConfig"', section: 'courier-configs' },
  // Contracts
  { table: '"ContractRatePeriod"', section: 'contracts' },
  { table: '"ContractAmendment"', section: 'contracts' },
  { table: '"Contract"', section: 'contracts' },
  // Compliance / templates
  { table: '"ContractorComplianceItem"', section: 'contractors' },
  { table: '"ComplianceRequirementTemplate"', section: 'contractors' },
  // Workflow runs + supporting (children before parent)
  { table: '"WorkflowAttachment"', section: 'workflow-runs' },
  { table: '"WorkflowComment"', section: 'workflow-runs' },
  { table: '"WorkflowTaskRun"', section: 'workflow-runs' },
  { table: '"WorkflowRun"', section: 'workflow-runs' },
  { table: '"WorkflowTaskTemplate"', section: 'workflow-templates' },
  { table: '"WorkflowTemplate"', section: 'workflow-templates' },
  // Workflow role / task templates (Phase 74) — children before parent
  { table: '"WorkflowRoleTaskTemplate"', section: 'workflow-templates' },
  { table: '"WorkflowRoleTemplate"', section: 'workflow-templates' },
  // Tax-compliance models (child rows before assessments)
  { table: '"SdsApproval"', section: 'classification' },
  { table: '"ReassessmentTrigger"', section: 'tax-compliance' },
  { table: '"ClassificationEscalationEvent"', section: 'classification' },
  { table: '"ClassificationDocument"', section: 'classification' },
  { table: '"ClassificationAssessment"', section: 'classification' },
  { table: '"Statusfeststellungsverfahren"', section: 'tax-compliance' },
  { table: '"Ir35OtherClientAttestation"', section: 'tax-compliance' },
  { table: '"Ir35ChainParticipant"', section: 'tax-compliance' },
  { table: '"TaxIdValidation"', section: 'tax-compliance' },
  { table: '"EconomicDependencyAlertState"', section: 'tax-compliance' },
  // Timesheets — child rows before parent
  { table: '"TimeEntry"', section: 'timesheets' },
  { table: '"Timesheet"', section: 'timesheets' },
  // Consent / privacy
  { table: '"ConsentEvent"', section: 'consent' },
  { table: '"ConsentRecord"', section: 'consent' },
  { table: '"PrivacyNotice"', section: 'consent' },
  // Per-user admin surfaces
  { table: '"UserPinnedView"', section: 'pinned-views' },
  { table: '"OrganizationApiKey"', section: 'api-keys' },
  // Gov-API audit + cron singletons
  { table: '"GovApiAuditLog"', section: 'cron-state' },
  { table: '"CronScanState"', section: 'cron-state' },
  // Contractor sub-records
  { table: '"ContractorTagLink"', section: 'contractors' },
  { table: '"ContractorTag"', section: 'contractors' },
  { table: '"ContractorAssignment"', section: 'contractors' },
  { table: '"ContractorBillingProfile"', section: 'contractors' },
  { table: '"ContractorContact"', section: 'contractors' },
  { table: '"ContractorChangeRequest"', section: 'consent' },
  { table: '"ContractorNotificationPreference"', section: 'consent' },
  { table: '"PortalSession"', section: 'portal-sessions' },
  { table: '"PortalMagicToken"', section: 'auth-surface' },
  { table: '"PendingUpload"', section: 'ocr' },
  { table: '"Contractor"', section: 'contractors' },
  // Documents (after Contractor — InvoiceFile is wiped earlier; DocumentLink
  // cascades from Document). Foundational — touched by many sections, so
  // wiped unconditionally.
  { table: '"DocumentLink"' },
  { table: '"Document"' },
  // OAuth challenges + StripeEvents (global tables)
  { table: '"OAuthChallenge"', section: 'auth-surface' },
  { table: '"StripeEvent"', section: 'cron-state' },
  // ExchangeRate is global; wiping per region risks nuking another region's
  // history mid-run — keep it conditional on the `exchange-rates` section.
  { table: '"ExchangeRate"', section: 'exchange-rates' },
  // Org structure — foundational
  { table: '"CostCenter"' },
  { table: '"Project"' },
  { table: '"Team"' },
  { table: '"Invitation"' },
  { table: '"Member"' },
  // Auth (after Member, since Member references both User and Organization)
  { table: '"Session"', section: 'auth-surface' },
  { table: '"Account"', section: 'auth-surface' },
  { table: '"Verification"', section: 'auth-surface' },
  { table: '"User"' },
  { table: '"Organization"' },
];

function effectiveWipeList(omitted: ReadonlySet<SectionKey>): string[] {
  return WIPE_TABLES_IN_ORDER.filter(e => e.section === undefined || !omitted.has(e.section)).map(
    e => e.table,
  );
}

async function wipeAllTenantData(
  prisma: PrismaClient,
  regionLabel: string,
  omitted: ReadonlySet<SectionKey>,
): Promise<void> {
  const tables = effectiveWipeList(omitted);
  log.warn(
    {
      region: regionLabel,
      tables: tables.length,
      omittedSections: [...omitted],
    },
    'wiping tenant tables',
  );
  // One TRUNCATE per table — safer than CASCADE which would also nuke
  // production reference tables that share FKs (none today, but defensive).
  // Wrap in transaction so a failure rolls back nothing-half-done. Bump
  // timeouts above the Prisma defaults (maxWait=2s, timeout=5s) so the wipe
  // survives Neon's cloud round-trip on a multi-table cascade.
  //
  // Each TRUNCATE is wrapped in a SAVEPOINT so a 42P01 (missing table on a
  // freshly-pushed schema) can be rolled back without aborting the outer
  // transaction — otherwise Postgres marks the whole tx as 25P02 and every
  // subsequent statement silently no-ops.
  await prisma.$transaction(
    async tx => {
      for (const table of tables) {
        const savepoint = `sp_wipe_${table.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
        try {
          await tx.$executeRawUnsafe(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
        } catch (err) {
          // Table may not exist yet on a freshly-pushed schema; roll back to
          // the savepoint so the outer tx stays alive, then continue.
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          log.debug(
            { region: regionLabel, table, err: (err as Error).message },
            'skipping wipe (table missing)',
          );
        }
      }
    },
    { maxWait: 30_000, timeout: 120_000 },
  );
  log.info({ region: regionLabel }, 'wipe complete');
}

// ---------------------------------------------------------------------------
// Catalog seeders — global users + shared password hash
// ---------------------------------------------------------------------------

interface SeededUser {
  id: string;
  email: string;
  name: string;
  role: string; // Member.role string
}

interface OrgSeed {
  org: OrgVolume;
  profile: RegionProfile;
  users: SeededUser[];
  ownerUserId: string;
  fakers: OrgFakers;
  organizationId: string;
  /** When the org was "founded" — drives all relative createdAt timestamps. */
  foundedAt: Date;
}

const ROLE_DISTRIBUTION: ReadonlyArray<readonly [string, number]> = [
  ['admin', 1],
  ['finance_admin', 2],
  ['ops_manager', 2],
  ['team_manager', 3],
  ['legal_compliance_viewer', 1],
  ['it_admin', 1],
  ['external_accountant', 1],
  ['readonly', 1],
];

function pickMemberRole(faker: Faker, ordinal: number): string {
  // Reserved positions ensure the approval-chain lookups
  // (`ctx.users.find(u => u.role === 'team_manager' | 'finance_admin' | 'admin')`)
  // always hit a role-matched approver — without this, a small org could roll
  // four `readonly` members and silently fall back to the owner for every step.
  if (ordinal === 0) return 'owner';
  if (ordinal === 1) return 'admin';
  if (ordinal === 2) return 'team_manager';
  if (ordinal === 3) return 'finance_admin';
  return weightedPick(faker, ROLE_DISTRIBUTION);
}

async function seedUsersForOrg(
  prisma: PrismaClient,
  orgKey: string,
  faker: Faker,
  count: number,
  passwordHash: string,
): Promise<SeededUser[]> {
  const users: SeededUser[] = [];
  const userRows: Prisma.UserCreateManyInput[] = [];
  const accountRows: Prisma.AccountCreateManyInput[] = [];
  for (let i = 0; i < count; i += 1) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const role = pickMemberRole(faker, i);
    // ASCII-safe email: faker locale chars (de/pl/ar) break email-validators
    // downstream. Use lower-ascii of name + a per-org token.
    const asciiFirst = slugify(first) || 'user';
    const asciiLast = slugify(last) || `${i}`;
    const email = `${asciiFirst}.${asciiLast}.${orgKey}@seed.local`;
    const id = randomUUID();
    const name = `${first} ${last}`;
    userRows.push({ id, name, email, emailVerified: true });
    accountRows.push({
      userId: id,
      accountId: email,
      providerId: 'credential', // Better Auth's emailAndPassword provider
      password: passwordHash,
    });
    users.push({ id, email, name, role });
  }
  for (let i = 0; i < userRows.length; i += 1000) {
    await prisma.user.createMany({ data: userRows.slice(i, i + 1000), skipDuplicates: true });
  }
  for (let i = 0; i < accountRows.length; i += 1000) {
    await prisma.account.createMany({ data: accountRows.slice(i, i + 1000), skipDuplicates: true });
  }
  return users;
}

// ---------------------------------------------------------------------------
// Per-org pipeline — Organization, Members, Teams, Projects, CostCenters
// ---------------------------------------------------------------------------

async function seedOrganizationCore(
  prisma: PrismaClient,
  org: OrgVolume,
  profile: RegionProfile,
  users: SeededUser[],
  fakers: OrgFakers,
): Promise<{
  organizationId: string;
  organizationName: string;
  ownerUserId: string;
  teamIds: string[];
  projectIds: string[];
  costCenterIds: string[];
  foundedAt: Date;
}> {
  const owner = users[0];
  if (!owner) throw new Error(`org ${org.key} has no users`);

  // Anchor: org "founded" 1–3 years ago (empty profile is younger so it
  // really feels like a fresh-tenant shell).
  const ageDaysMax = org.contractorsPerOrg === 0 ? 60 : 1095;
  const ageDaysMin = org.contractorsPerOrg === 0 ? 1 : 365;
  const foundedAt = new Date(
    Date.now() - fakers.org.number.int({ min: ageDaysMin, max: ageDaysMax }) * 86_400_000,
  );

  const orgName = `${fakers.ascii.company.name()} (${org.key})`;
  const slug = `seed-${slugify(orgName)}-${tokenHex(2)}`.slice(0, 60);

  const created = await prisma.organization.create({
    data: {
      name: orgName,
      slug,
      legalName: orgName,
      countryCode: profile.countryCode,
      dataRegion: org.region,
      defaultCurrency: profile.defaultCurrency,
      timezone: profile.timezone,
      language: profile.language,
      fiscalYearStartMonth: 1,
      status: 'ACTIVE',
      billingEmail: `billing.${slug}@seed.local`,
      metadata: JSON.stringify({
        seeded: true,
        profile: org.key,
        foundedAt: foundedAt.toISOString(),
      }),
      createdAt: foundedAt,
      members: {
        // Members trickle in over the first 60 days. Owner joins on day 0;
        // others land on random days within that window so the "Members"
        // page shows a believable join history.
        create: users.map((u, idx) => ({
          userId: u.id,
          role: idx === 0 ? 'owner' : u.role,
          createdAt:
            idx === 0
              ? foundedAt
              : dateBetween(
                  fakers.org,
                  foundedAt,
                  advanceCapped(foundedAt, fakers.org.number.int({ min: 1, max: 60 })),
                ),
        })),
      },
    },
    select: { id: true },
  });
  const organizationId = created.id;

  // NOTE: We do NOT pre-create Session/Account/Verification rows here. The
  // dedicated `seedAuthSurface()` step (gated by the `auth-surface` section
  // key) writes those rows for *UI-display* only — the admin "active
  // sessions" / "linked accounts" pages are otherwise empty.
  // Better Auth signs the session cookie with `BETTER_AUTH_SECRET`; a
  // manually-inserted Session has no matching browser-side cookie, so it
  // CANNOT be used to skip login. Users still authenticate via the seeded
  // password (printed in the final summary log line).

  // Teams (3 per org, none for empty) — created during the org's first 90 days
  const teamIds: string[] = [];
  if (org.contractorsPerOrg > 0) {
    const teamCount = org.showcase ? 4 : Math.min(3, Math.max(1, Math.ceil(users.length / 3)));
    const teamRows: Prisma.TeamCreateManyInput[] = [];
    for (let i = 0; i < teamCount; i += 1) {
      const manager = users[Math.min(i, users.length - 1)] as SeededUser;
      const id = randomUUID();
      teamRows.push({
        id,
        organizationId,
        name: `${fakers.org.commerce.department()} ${i + 1}`,
        code: `T${(i + 1).toString().padStart(2, '0')}`,
        managerUserId: manager.id,
        status: 'ACTIVE',
        createdAt: dateBetween(fakers.org, foundedAt, advanceCapped(foundedAt, 90)),
      });
      teamIds.push(id);
    }
    for (let i = 0; i < teamRows.length; i += 1000) {
      await prisma.team.createMany({
        data: teamRows.slice(i, i + 1000),
        skipDuplicates: true,
      });
    }
  }

  // Projects (2 per team) — start dates anchored to the org's lifespan, not "now − 365".
  // Code uses deterministic team+project ordinals (P-T01-1, P-T01-2, P-T02-1, …)
  // so the [organizationId, code] unique constraint can never collide on
  // re-seed and remains human-readable in lists.
  const projectIds: string[] = [];
  const projectRows: Prisma.ProjectCreateManyInput[] = [];
  for (let tIdx = 0; tIdx < teamIds.length; tIdx += 1) {
    const teamId = teamIds[tIdx] as string;
    for (let i = 0; i < 2; i += 1) {
      const start = dateBetween(fakers.org, foundedAt, new Date());
      const end = fakers.org.datatype.boolean() ? futureDate(fakers.org, 365) : null;
      const id = randomUUID();
      projectRows.push({
        id,
        organizationId,
        teamId,
        name: fakers.org.commerce.productName(),
        code: `P-T${(tIdx + 1).toString().padStart(2, '0')}-${i + 1}`,
        status: 'ACTIVE',
        startDate: dateOnly(start),
        endDate: end ? dateOnly(end) : null,
        budgetMinor: moneyMinor(fakers.org, 5_000, 200_000),
        budgetCurrency: profile.defaultCurrency,
        createdAt: start,
      });
      projectIds.push(id);
    }
  }
  for (let i = 0; i < projectRows.length; i += 1000) {
    await prisma.project.createMany({
      data: projectRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // Cost centres
  const costCenterIds: string[] = [];
  if (org.contractorsPerOrg > 0) {
    const ccRows: Prisma.CostCenterCreateManyInput[] = [];
    for (let i = 0; i < Math.min(3, Math.max(1, teamIds.length)); i += 1) {
      const id = randomUUID();
      ccRows.push({
        id,
        organizationId,
        name: `Cost Centre ${i + 1}`,
        code: `CC${(i + 1).toString().padStart(3, '0')}-${tokenHex(2)}`,
        status: 'ACTIVE',
        createdAt: dateBetween(fakers.org, foundedAt, advanceCapped(foundedAt, 120)),
      });
      costCenterIds.push(id);
    }
    for (let i = 0; i < ccRows.length; i += 1000) {
      await prisma.costCenter.createMany({
        data: ccRows.slice(i, i + 1000),
        skipDuplicates: true,
      });
    }
  }

  // Pending invitations — a small splash so the invite-list UI is non-empty
  if (org.contractorsPerOrg > 0) {
    const invitationRows: Prisma.InvitationCreateManyInput[] = [];
    for (let i = 0; i < Math.min(2, users.length); i += 1) {
      invitationRows.push({
        organizationId,
        email: `invitee-${i}-${slug}@seed.local`,
        role: 'team_manager',
        status: 'pending',
        expiresAt: futureDate(fakers.org, 14),
        inviterId: owner.id,
        createdAt: pastDate(fakers.org, 7),
      });
    }
    if (invitationRows.length > 0) {
      await prisma.invitation.createMany({
        data: invitationRows,
        skipDuplicates: true,
      });
    }
  }

  return {
    organizationId,
    organizationName: orgName,
    ownerUserId: owner.id,
    teamIds,
    projectIds,
    costCenterIds,
    foundedAt,
  };
}

// ---------------------------------------------------------------------------
// Contractors + sub-records
// ---------------------------------------------------------------------------

interface SeededContractor {
  id: string;
  legalName: string;
  /** Contractor's primary contact email — reused by portal sessions etc. */
  email: string;
  /** Currency on the contractor — may differ from org default for ~20% (FX coverage). */
  currency: string;
  /** Net payment terms in days — surfaces on every invoice's dueDate. */
  paymentTermsDays: number;
  ownerUserId: string;
  primaryTeamId: string | null;
  defaultBillingProfileId: string | null;
}

async function seedContractors(
  prisma: PrismaClient,
  ctx: OrgSeed,
  teamIds: string[],
  projectIds: string[],
  costCenterIds: string[],
  refs: EntityRef[],
): Promise<readonly SeededContractor[]> {
  if (ctx.org.contractorsPerOrg === 0) return [];

  // Contractor tags catalogue — semantic names, not "blue-0/red-1". Real
  // teams tag contractors by relationship / risk / classification.
  const TAG_NAMES = [
    'preferred-vendor',
    'high-risk',
    'remote',
    'eu-vat',
    'reverse-charge',
    'long-term',
    'agency',
    'individual',
    'on-hold',
    'top-tier',
  ];
  const tagPalette = ctx.fakers.org.helpers.shuffle(TAG_NAMES.slice()).slice(0, 5);
  const tagIds: string[] = [];
  const tagRows: Prisma.ContractorTagCreateManyInput[] = [];
  for (const name of tagPalette) {
    const id = randomUUID();
    tagRows.push({
      id,
      organizationId: ctx.organizationId,
      name,
      color: ctx.fakers.org.color.rgb({ format: 'hex' }),
    });
    tagIds.push(id);
  }
  if (tagRows.length > 0) {
    await prisma.contractorTag.createMany({ data: tagRows, skipDuplicates: true });
  }

  // Compliance requirement templates — light-touch, drives compliance items
  const complianceTemplateIds: string[] = [];
  const docTypes = ['MASTER_CONTRACT', 'INSURANCE', 'TAX_CERTIFICATE'] as const;
  const tplRows: Prisma.ComplianceRequirementTemplateCreateManyInput[] = [];
  for (const dt of docTypes) {
    const id = randomUUID();
    tplRows.push({
      id,
      organizationId: ctx.organizationId,
      name: `${dt} requirement`,
      documentType: dt,
      isRequired: true,
      expires: dt !== 'MASTER_CONTRACT',
      defaultValidityDays: dt === 'MASTER_CONTRACT' ? null : 365,
    });
    complianceTemplateIds.push(id);
  }
  if (tplRows.length > 0) {
    await prisma.complianceRequirementTemplate.createMany({
      data: tplRows,
      skipDuplicates: true,
    });
  }

  // FX coverage: ~20% of contractors bill in a non-default currency. EU orgs
  // can have GBP/USD/CHF contractors; ME orgs can have AED/SAR/USD/EUR. Real
  // freelancer rosters are mixed-currency and the FX-conversion UI never
  // lights up otherwise.
  const altCurrencies =
    ctx.org.region === 'EU'
      ? (['GBP', 'USD', 'CHF'] as const)
      : (['USD', 'EUR', 'AED', 'SAR'] as const);

  const contractors: SeededContractor[] = [];
  const contractorRows: Prisma.ContractorCreateManyInput[] = [];
  const contactRows: Prisma.ContractorContactCreateManyInput[] = [];
  const billingRows: Prisma.ContractorBillingProfileCreateManyInput[] = [];
  const assignmentRows: Prisma.ContractorAssignmentCreateManyInput[] = [];
  const tagLinkRows: Prisma.ContractorTagLinkCreateManyInput[] = [];
  const complianceItemRows: Prisma.ContractorComplianceItemCreateManyInput[] = [];
  for (let i = 0; i < ctx.org.contractorsPerOrg; i += 1) {
    const isCompany = ctx.fakers.org.datatype.boolean({ probability: 0.6 });
    const legalName = isCompany
      ? ctx.fakers.org.company.name()
      : `${ctx.fakers.org.person.firstName()} ${ctx.fakers.org.person.lastName()}`;
    const ownerUser = ctx.users[i % ctx.users.length] as SeededUser;
    const team = teamIds.length > 0 ? teamIds[i % teamIds.length] : null;
    const project = projectIds.length > 0 ? projectIds[i % projectIds.length] : null;
    const costCenter = costCenterIds.length > 0 ? costCenterIds[i % costCenterIds.length] : null;
    const useAltCurrency = ctx.fakers.org.datatype.boolean({ probability: 0.2 });
    const currency = useAltCurrency
      ? ctx.fakers.org.helpers.arrayElement(altCurrencies)
      : ctx.profile.defaultCurrency;
    const paymentTermsDays = ctx.fakers.org.helpers.arrayElement([14, 30, 45, 60]);

    // Hire date scattered across the org's lifespan, with status / lifecycle
    // skewed sensibly: contractors hired recently tend to be ONBOARDING / ACTIVE,
    // older ones can be ENDED / ARCHIVED.
    const hiredAt = dateBetween(ctx.fakers.org, ctx.foundedAt, new Date());
    const tenureDays = Math.floor((Date.now() - hiredAt.getTime()) / 86_400_000);

    const status =
      ctx.org.showcase && i < 4
        ? (['ACTIVE', 'INACTIVE', 'ARCHIVED', 'ACTIVE'][i] as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED')
        : weightedPick<'ACTIVE' | 'INACTIVE' | 'ARCHIVED'>(ctx.fakers.org, [
            ['ACTIVE', 8],
            ['INACTIVE', 1],
            ['ARCHIVED', 1],
          ]);
    const lifecycle =
      tenureDays < 30
        ? weightedPick<'DRAFT' | 'ONBOARDING' | 'ACTIVE'>(ctx.fakers.org, [
            ['DRAFT', 1],
            ['ONBOARDING', 4],
            ['ACTIVE', 1],
          ])
        : tenureDays < 365
          ? 'ACTIVE'
          : weightedPick<'ACTIVE' | 'OFFBOARDING' | 'ENDED'>(ctx.fakers.org, [
              ['ACTIVE', 4],
              ['OFFBOARDING', 1],
              ['ENDED', 2],
            ]);

    const contractorEmail = `${slugify(legalName)}-${i}@seed.local`;
    const contractorId = randomUUID();
    contractorRows.push({
      id: contractorId,
      organizationId: ctx.organizationId,
      type: isCompany ? 'COMPANY' : 'SOLE_TRADER',
      legalName,
      displayName: legalName,
      taxId: makeTaxId(ctx.profile.countryCode, ctx.fakers.org),
      vatId: isCompany ? makeVatId(ctx.profile.countryCode, ctx.fakers.org) : null,
      countryCode: ctx.profile.countryCode,
      currency,
      email: contractorEmail,
      phone: ctx.fakers.org.phone.number(),
      website: isCompany ? `https://${slugify(legalName)}.example.com` : null,
      addressLine1: ctx.fakers.org.location.streetAddress(),
      city: ctx.fakers.org.location.city(),
      postalCode: ctx.fakers.org.location.zipCode(),
      status,
      lifecycleStage: lifecycle,
      ownerUserId: ownerUser.id,
      primaryTeamId: team,
      primaryProjectId: project,
      defaultCostCenterId: costCenter,
      customFieldsJson: {
        billingModel: ctx.fakers.org.helpers.arrayElement([
          'FIXED',
          'HOURLY',
          'PROJECT',
          'MILESTONE',
        ]),
        rateValueMinor: moneyMinor(ctx.fakers.org, 50, 250),
      },
      notes: ctx.fakers.org.lorem.sentence(),
      createdAt: hiredAt,
    });

    // Primary contact
    contactRows.push({
      organizationId: ctx.organizationId,
      contractorId,
      fullName: `${ctx.fakers.org.person.firstName()} ${ctx.fakers.org.person.lastName()}`,
      email: `contact.${i}-${slugify(legalName)}@seed.local`,
      phone: ctx.fakers.org.phone.number(),
      roleTitle: ctx.fakers.org.person.jobTitle(),
      isPrimary: true,
      createdAt: hiredAt,
    });

    // Default billing profile — country-formatted bank fields so list views
    // look like real customer data.
    const billingId = randomUUID();
    billingRows.push({
      id: billingId,
      organizationId: ctx.organizationId,
      contractorId,
      legalEntityName: legalName,
      billingEmail: `billing.${i}-${slugify(legalName)}@seed.local`,
      countryCode: ctx.profile.countryCode,
      addressLine1: ctx.fakers.org.location.streetAddress(),
      city: ctx.fakers.org.location.city(),
      postalCode: ctx.fakers.org.location.zipCode(),
      bankAccountMasked: makeMaskedIban(ctx.profile.countryCode, ctx.fakers.org),
      bankName: ctx.fakers.org.company.name(),
      swiftBic: makeBic(ctx.profile.countryCode, ctx.fakers.org),
      preferredCurrency: currency,
      paymentTermsDays,
      isDefault: true,
      validFrom: dateOnly(hiredAt),
      createdAt: hiredAt,
    });

    // Assignment
    if (team || project || costCenter) {
      assignmentRows.push({
        organizationId: ctx.organizationId,
        contractorId,
        teamId: team,
        projectId: project,
        costCenterId: costCenter,
        ownerUserId: ownerUser.id,
        allocationPercent: ctx.fakers.org.helpers.arrayElement([
          '25.00',
          '50.00',
          '75.00',
          '100.00',
        ]),
        activeFrom: dateOnly(hiredAt),
        status: 'ACTIVE',
        createdAt: hiredAt,
      });
    }

    // 0–2 tag links
    const tagsForThis = ctx.fakers.org.helpers.arrayElements(tagIds, {
      min: 0,
      max: 2,
    });
    for (const tagId of tagsForThis) {
      tagLinkRows.push({ contractorId, tagId });
    }

    // Compliance items — dueDate / expiresAt now match the status:
    //   MISSING   → due in the future, no expiresAt yet
    //   PENDING   → due imminently
    //   SATISFIED → due in the past (was supplied), expires in the future
    //   EXPIRED   → due AND expiresAt both in the past
    for (const tplId of complianceTemplateIds) {
      const itemStatus = weightedPick<'MISSING' | 'PENDING' | 'SATISFIED' | 'EXPIRED'>(
        ctx.fakers.org,
        [
          ['MISSING', 1],
          ['PENDING', 1],
          ['SATISFIED', 4],
          ['EXPIRED', 1],
        ],
      );
      // dueDate / expiresAt anchored to org lifespan — an EXPIRED item due
      // 2 years ago is impossible for a 1-year-old org.
      const dueDate = (() => {
        switch (itemStatus) {
          case 'MISSING':
            return dateOnly(futureDate(ctx.fakers.org, 180));
          case 'PENDING':
            return dateOnly(futureDate(ctx.fakers.org, 14));
          case 'SATISFIED':
            return dateOnly(pastDateAfter(ctx.fakers.org, 365, ctx.foundedAt));
          case 'EXPIRED':
            return dateOnly(pastDateAfter(ctx.fakers.org, 730, ctx.foundedAt));
        }
      })();
      const expiresAt =
        itemStatus === 'SATISFIED'
          ? dateOnly(futureDate(ctx.fakers.org, 365))
          : itemStatus === 'EXPIRED'
            ? dateOnly(pastDateAfter(ctx.fakers.org, 30, ctx.foundedAt))
            : null;
      complianceItemRows.push({
        organizationId: ctx.organizationId,
        contractorId,
        requirementTemplateId: tplId,
        name: `Auto-seeded ${tplId.slice(0, 6)}`,
        documentType: ctx.fakers.org.helpers.arrayElement([
          'MASTER_CONTRACT',
          'INSURANCE',
          'TAX_CERTIFICATE',
        ]),
        status: itemStatus,
        dueDate,
        expiresAt,
        createdAt: hiredAt,
      });
    }

    contractors.push({
      id: contractorId,
      legalName,
      email: contractorEmail,
      currency,
      paymentTermsDays,
      ownerUserId: ownerUser.id,
      primaryTeamId: team,
      defaultBillingProfileId: billingId,
    });
    refs.push({ type: 'CONTRACTOR', id: contractorId, name: legalName, createdAt: hiredAt });
  }

  // Wave 1: parent contractor rows (wide table → chunk 500)
  for (let i = 0; i < contractorRows.length; i += 500) {
    await prisma.contractor.createMany({
      data: contractorRows.slice(i, i + 500),
      skipDuplicates: true,
    });
  }
  // Wave 2: direct children referencing contractorId.
  for (let i = 0; i < contactRows.length; i += 1000) {
    await prisma.contractorContact.createMany({
      data: contactRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < billingRows.length; i += 1000) {
    await prisma.contractorBillingProfile.createMany({
      data: billingRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < assignmentRows.length; i += 1000) {
    await prisma.contractorAssignment.createMany({
      data: assignmentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < tagLinkRows.length; i += 1000) {
    await prisma.contractorTagLink.createMany({
      data: tagLinkRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < complianceItemRows.length; i += 1000) {
    await prisma.contractorComplianceItem.createMany({
      data: complianceItemRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  return contractors;
}

// ---------------------------------------------------------------------------
// Contracts (subset of contractors)
// ---------------------------------------------------------------------------

async function seedContracts(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
  refs: EntityRef[],
): Promise<Map<string, string>> {
  const contractByContractor = new Map<string, string>();
  if (contractors.length === 0) return contractByContractor;

  // ~70% of contractors get a contract
  const subset = contractors.filter(() => ctx.fakers.org.datatype.boolean({ probability: 0.7 }));
  const contractRows: Prisma.ContractCreateManyInput[] = [];
  const ratePeriodRows: Prisma.ContractRatePeriodCreateManyInput[] = [];
  const amendmentRows: Prisma.ContractAmendmentCreateManyInput[] = [];
  for (const c of subset) {
    // Contracts are negotiated, signed, then start 7–30 days later. Anchor
    // signedAt to org lifespan so a 365-day-old org doesn't have contracts
    // signed 540 days ago. start = signedAt + 7..30d (clamped to now); end,
    // when set, follows start by 90–730 days.
    const signedAt = pastDateAfter(ctx.fakers.org, 540, ctx.foundedAt);
    const startMs =
      signedAt.getTime() + ctx.fakers.org.number.int({ min: 7, max: 30 }) * 86_400_000;
    const start = new Date(Math.min(startMs, Date.now()));
    const end = ctx.fakers.org.datatype.boolean({ probability: 0.4 })
      ? new Date(start.getTime() + ctx.fakers.org.number.int({ min: 90, max: 730 }) * 86_400_000)
      : null;
    const isSigned = ctx.fakers.org.datatype.boolean({ probability: 0.7 });
    // The same rate value flows into the Contract row AND its single rate
    // period — they used to drift apart from independent draws.
    const rateValueMinor = moneyMinor(ctx.fakers.org, 50, 250);
    const contractId = randomUUID();
    contractRows.push({
      id: contractId,
      organizationId: ctx.organizationId,
      contractorId: c.id,
      contractNumber: `C-${tokenHex(3).toUpperCase()}`,
      title: `Service Agreement — ${c.legalName}`.slice(0, 200),
      type: ctx.fakers.org.helpers.arrayElement([
        'B2B_MASTER_SERVICE',
        'STATEMENT_OF_WORK',
        'NDA',
        'IP_ASSIGNMENT',
        'OTHER',
      ]),
      status: ctx.fakers.org.helpers.arrayElement([
        'DRAFT',
        'ACTIVE',
        'ACTIVE',
        'EXPIRED',
        'TERMINATED',
      ]),
      startDate: dateOnly(start),
      endDate: end ? dateOnly(end) : null,
      currency: c.currency,
      billingModel: ctx.fakers.org.helpers.arrayElement([
        'HOURLY',
        'DAILY',
        'MONTHLY_RETAINER',
        'MILESTONE',
      ]),
      rateType: 'PER_HOUR',
      rateValueMinor,
      paymentTermsDays: c.paymentTermsDays,
      invoiceCycle: 'MONTHLY',
      internalOwnerUserId: ctx.fakers.org.helpers.arrayElement(ctx.users).id,
      complianceRiskLevel: ctx.fakers.org.helpers.arrayElement(['LOW', 'LOW', 'MEDIUM', 'HIGH']),
      signedAt: isSigned ? signedAt : null,
      notes: ctx.fakers.org.lorem.sentence(),
      createdAt: signedAt,
    });
    contractByContractor.set(c.id, contractId);
    refs.push({
      type: 'CONTRACT',
      id: contractId,
      name: `Contract ${c.legalName}`,
      createdAt: signedAt,
    });

    // ~25% have an amendment — pre-decide so the rate-period table reflects
    // the rate change (otherwise the contract page shows only the original
    // rate even though an "Amendment A1: rate +5%" row exists).
    // amendmentEffective ∈ [start, now] so an amendment never pre-dates the
    // contract it amends.
    const hasAmendment = ctx.fakers.org.datatype.boolean({ probability: 0.25 });
    const amendmentEffective = hasAmendment ? dateBetween(ctx.fakers.org, start, new Date()) : null;
    const newRateMinor = hasAmendment ? Math.round(rateValueMinor * 1.05) : null;

    // Original rate period — runs from start until amendment kicks in (or
    // contract end / open-ended if no amendment).
    const originalValidTo = amendmentEffective
      ? dateOnly(new Date(amendmentEffective.getTime() - 86_400_000))
      : end
        ? dateOnly(end)
        : null;
    ratePeriodRows.push({
      organizationId: ctx.organizationId,
      contractId,
      rateType: 'PER_HOUR',
      rateValueMinor,
      currency: c.currency,
      validFrom: dateOnly(start),
      validTo: originalValidTo,
      createdAt: signedAt,
    });

    if (hasAmendment && amendmentEffective && newRateMinor !== null) {
      // New rate period kicks in on the amendment's effectiveDate.
      ratePeriodRows.push({
        organizationId: ctx.organizationId,
        contractId,
        rateType: 'PER_HOUR',
        rateValueMinor: newRateMinor,
        currency: c.currency,
        validFrom: dateOnly(amendmentEffective),
        validTo: end ? dateOnly(end) : null,
        createdAt: amendmentEffective,
      });
      amendmentRows.push({
        organizationId: ctx.organizationId,
        contractId,
        amendmentNumber: 'A1',
        title: 'Rate adjustment',
        effectiveDate: dateOnly(amendmentEffective),
        changesSummaryJson: {
          reason: 'inflation_adjustment',
          previousRateMinor: rateValueMinor,
          newRateMinor,
        },
        description: ctx.fakers.org.lorem.sentence(),
        createdAt: amendmentEffective,
      });
    }
  }

  // Wave: parent Contract → child rate periods + amendments.
  for (let i = 0; i < contractRows.length; i += 1000) {
    await prisma.contract.createMany({
      data: contractRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < ratePeriodRows.length; i += 1000) {
    await prisma.contractRatePeriod.createMany({
      data: ratePeriodRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < amendmentRows.length; i += 1000) {
    await prisma.contractAmendment.createMany({
      data: amendmentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  return contractByContractor;
}

// ---------------------------------------------------------------------------
// Approval chain config (per org, reused across invoices)
// ---------------------------------------------------------------------------

async function seedApprovalChainConfig(prisma: PrismaClient, ctx: OrgSeed): Promise<string | null> {
  if (ctx.org.contractorsPerOrg === 0) return null;
  const cfg = await prisma.approvalChainConfig.create({
    data: {
      organizationId: ctx.organizationId,
      name: 'Default invoice approval (tiered by amount)',
      resourceType: 'INVOICE',
      isDefault: true,
      isActive: true,
      // Three-tier policy: under €500 → manager only; under €5k → manager
      // + finance; over €5k → adds executive approval.
      conditionsJson: {
        applyWhen: 'always',
        amountTiersMinor: [50_000, 500_000],
      },
      stepsJson: [
        {
          order: 1,
          name: 'Manager review',
          approverRole: 'team_manager',
          required: true,
          appliesAtAmountMinor: 0,
        },
        {
          order: 2,
          name: 'Finance sign-off',
          approverRole: 'finance_admin',
          required: true,
          appliesAtAmountMinor: 50_000,
        },
        {
          order: 3,
          name: 'Executive approval',
          approverRole: 'admin',
          required: true,
          appliesAtAmountMinor: 500_000,
        },
      ],
      createdAt: ctx.foundedAt,
    },
    select: { id: true },
  });
  return cfg.id;
}

// ---------------------------------------------------------------------------
// Invoices + lines (with coherent approval / payment state)
// ---------------------------------------------------------------------------

type InvoiceLifecycle =
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'READY_FOR_PAYMENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'VOID';

interface SeededInvoice {
  id: string;
  contractorId: string;
  /** Stable invoice number used as the shared payment reference downstream. */
  invoiceNumber: string;
  status: InvoiceLifecycle;
  approvalStatus: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  paymentStatus: 'NOT_READY' | 'READY' | 'IN_RUN' | 'PARTIALLY_PAID' | 'PAID' | 'FAILED';
  totalMinor: number;
  /** Outstanding balance: total − sum of partial payments already applied. */
  amountToPayMinor: number;
  /** Already-paid amount (only > 0 for PARTIALLY_PAID). */
  partialPaidMinor: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  /** Used by reminders/audit/e-invoice to anchor downstream timestamps. */
  approvedAt: Date | null;
  paidAt: Date | null;
  receivedAt: Date;
}

/**
 * Coherent forward timeline for an invoice, anchored on its issue date.
 * Each step is `prev + N days, clipped at now()` so reads of a single invoice
 * never show "paid before received" or "approved after paid".
 */
interface InvoiceTimeline {
  receivedAt: Date;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  readyForPaymentAt: Date | null;
  paidAt: Date | null;
  rejectedAt: Date | null;
}

function buildInvoiceTimeline(
  issue: Date,
  lifecycle: InvoiceLifecycle,
  faker: Faker,
): InvoiceTimeline {
  const receivedAt = advanceCapped(issue, faker.number.int({ min: 0, max: 2 }));
  const isPostReview = lifecycle !== 'RECEIVED';
  const reviewedAt = isPostReview
    ? advanceCapped(receivedAt, faker.number.int({ min: 1, max: 5 }))
    : null;
  const isPostApprove = (
    ['APPROVED', 'READY_FOR_PAYMENT', 'PARTIALLY_PAID', 'PAID'] as InvoiceLifecycle[]
  ).includes(lifecycle);
  const approvedAt =
    isPostApprove && reviewedAt
      ? advanceCapped(reviewedAt, faker.number.int({ min: 1, max: 14 }))
      : null;
  const isReadyForPay = (
    ['READY_FOR_PAYMENT', 'PARTIALLY_PAID', 'PAID'] as InvoiceLifecycle[]
  ).includes(lifecycle);
  const readyForPaymentAt =
    isReadyForPay && approvedAt
      ? advanceCapped(approvedAt, faker.number.int({ min: 0, max: 2 }))
      : null;
  const paidAt =
    lifecycle === 'PAID' && readyForPaymentAt
      ? advanceCapped(readyForPaymentAt, faker.number.int({ min: 1, max: 30 }))
      : null;
  const rejectedAt =
    lifecycle === 'REJECTED' && reviewedAt
      ? advanceCapped(reviewedAt, faker.number.int({ min: 0, max: 7 }))
      : null;
  return {
    receivedAt,
    reviewedAt,
    approvedAt,
    readyForPaymentAt,
    paidAt,
    rejectedAt,
  };
}

/**
 * Pointer to a real seeded entity. Used so audit logs and notifications
 * reference rows that actually exist (instead of random IDs that 404).
 *
 * `createdAt` is required so audit-log rows can be drawn from a window that
 * starts AT-OR-AFTER the entity existed — previously audit logs could claim
 * "invoice.create at 2024-01-01" for an invoice that wasn't created until
 * 2025-06-01.
 */
type EntityRefType = 'INVOICE' | 'CONTRACTOR' | 'CONTRACT' | 'EQUIPMENT' | 'PAYMENT_RUN';
interface EntityRef {
  type: EntityRefType;
  id: string;
  name: string;
  createdAt: Date;
}

const INVOICE_LIFECYCLE_DISTRIBUTION: ReadonlyArray<readonly [InvoiceLifecycle, number]> = [
  ['RECEIVED', 2],
  ['UNDER_REVIEW', 2],
  ['APPROVAL_PENDING', 3],
  ['APPROVED', 2],
  ['READY_FOR_PAYMENT', 2],
  ['PARTIALLY_PAID', 1],
  ['PAID', 4],
  ['REJECTED', 1],
  ['VOID', 1],
];

async function seedInvoices(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
  contractByContractor: ReadonlyMap<string, string>,
  approvalChainConfigId: string | null,
  refs: EntityRef[],
): Promise<SeededInvoice[]> {
  const invoices: SeededInvoice[] = [];
  if (contractors.length === 0) return invoices;

  const vatPercent = VAT_RATE_BY_COUNTRY[ctx.profile.countryCode] ?? 19;
  // Per-org per-fiscal-year invoice counter so numbers look like
  // "INV-2026-0001" instead of random hex blobs. Real bookkeeping demands
  // strict yearly sequences (PL law) — this isn't perfect (we don't
  // backfill across orgs) but it's much closer than tokenHex was.
  const counterByYear = new Map<number, number>();
  // Global invoice index across all contractors — drives showcase's
  // round-robin so REJECTED / VOID actually appear (per-contractor `i`
  // resets every iteration, capping showcase at indices 0–6 and silently
  // dropping the last two states).
  let globalInvoiceIdx = 0;

  // Pre-built invoice rows + their per-line rows; approval-flow params are
  // captured here so the deferred (commit 7) approval pass can run after the
  // batched invoice + line inserts complete.
  type ApprovalParams = {
    invoiceId: string;
    approvalStatus: SeededInvoice['approvalStatus'];
    timeline: ReturnType<typeof buildInvoiceTimeline>;
    total: number;
    invNumber: string;
  };
  const invoiceRows: Prisma.InvoiceCreateManyInput[] = [];
  const lineRows: Prisma.InvoiceLineCreateManyInput[] = [];
  const approvalParams: ApprovalParams[] = [];

  for (const contractor of contractors) {
    const count = ctx.fakers.org.number.int({
      min: ctx.org.invoicesPerContractor.min,
      max: ctx.org.invoicesPerContractor.max,
    });
    for (let i = 0; i < count; i += 1) {
      const showcaseEntry = ctx.org.showcase
        ? INVOICE_LIFECYCLE_DISTRIBUTION[globalInvoiceIdx % INVOICE_LIFECYCLE_DISTRIBUTION.length]
        : undefined;
      globalInvoiceIdx += 1;
      const lifecycle: InvoiceLifecycle = showcaseEntry
        ? showcaseEntry[0]
        : weightedPick(ctx.fakers.org, INVOICE_LIFECYCLE_DISTRIBUTION);

      // Issue date never precedes the contractor's hire date. The org's
      // foundedAt acts as a hard lower bound so charts don't show invoices
      // before the org existed.
      const issue = dateBetween(ctx.fakers.org, ctx.foundedAt, new Date());
      // dueDate now respects the contractor's payment terms.
      const due = new Date(issue.getTime() + contractor.paymentTermsDays * 86_400_000);
      const timeline = buildInvoiceTimeline(issue, lifecycle, ctx.fakers.org);

      // Build LINES first, then derive header amounts from them. The previous
      // implementation drew subtotal independently which made invoice detail
      // pages show line totals that didn't match the header.
      const lineCount = ctx.fakers.org.number.int({ min: 1, max: 4 });
      const lines = Array.from({ length: lineCount }, (_, idx) => {
        const qty = ctx.fakers.org.number.int({ min: 1, max: 40 });
        const unitPriceMinor = ctx.fakers.org.number.int({ min: 50, max: 500 }) * 100;
        const netAmountMinor = qty * unitPriceMinor;
        const lineVatMinor = Math.round((netAmountMinor * vatPercent) / 100);
        return {
          id: newId(),
          organizationId: ctx.organizationId,
          // invoiceId is patched in below once the invoice id is allocated.
          lineNumber: idx + 1,
          description: ctx.fakers.org.commerce.productDescription().slice(0, 200),
          quantity: qty.toString(),
          unit: 'hour',
          unitPriceMinor,
          netAmountMinor,
          vatRate: `${vatPercent}.00`,
          vatAmountMinor: lineVatMinor,
          grossAmountMinor: netAmountMinor + lineVatMinor,
        };
      });
      const subtotal = lines.reduce((acc, l) => acc + l.netAmountMinor, 0);
      const vat = lines.reduce((acc, l) => acc + l.vatAmountMinor, 0);
      const total = subtotal + vat;

      const approvalStatus: SeededInvoice['approvalStatus'] =
        lifecycle === 'RECEIVED' || lifecycle === 'UNDER_REVIEW'
          ? 'NOT_STARTED'
          : lifecycle === 'APPROVAL_PENDING'
            ? 'PENDING'
            : lifecycle === 'REJECTED'
              ? 'REJECTED'
              : lifecycle === 'VOID'
                ? 'CANCELLED'
                : 'APPROVED';

      const paymentStatus: SeededInvoice['paymentStatus'] =
        lifecycle === 'PAID'
          ? 'PAID'
          : lifecycle === 'PARTIALLY_PAID'
            ? 'PARTIALLY_PAID'
            : lifecycle === 'READY_FOR_PAYMENT'
              ? 'READY'
              : lifecycle === 'APPROVED'
                ? 'READY'
                : 'NOT_READY';

      // Outstanding balance is total minus what's already been paid. For
      // PARTIALLY_PAID we mark a half payment as already applied; for PAID
      // the full amount is settled and amountToPay drops to 0; for everything
      // else amountToPay equals total.
      const partialPaidMinor = paymentStatus === 'PARTIALLY_PAID' ? Math.round(total / 2) : 0;
      const amountToPayMinor = paymentStatus === 'PAID' ? 0 : total - partialPaidMinor;

      const issueYear = issue.getUTCFullYear();
      const seqForYear = (counterByYear.get(issueYear) ?? 0) + 1;
      counterByYear.set(issueYear, seqForYear);
      const invNumber = `INV-${issueYear}-${seqForYear.toString().padStart(4, '0')}`;
      const invoiceId = randomUUID();
      invoiceRows.push({
        id: invoiceId,
        organizationId: ctx.organizationId,
        contractorId: contractor.id,
        contractId: contractByContractor.get(contractor.id) ?? null,
        billingProfileId: contractor.defaultBillingProfileId,
        invoiceNumber: invNumber,
        source: ctx.fakers.org.helpers.arrayElement([
          'MANUAL_UPLOAD',
          'EMAIL_INTAKE',
          'API',
          'PORTAL',
        ]),
        issueDate: dateOnly(issue),
        dueDate: dateOnly(due),
        currency: contractor.currency,
        subtotalMinor: subtotal,
        vatRate: `${vatPercent}.00`,
        vatAmountMinor: vat,
        totalMinor: total,
        amountToPayMinor,
        status: lifecycle,
        approvalStatus,
        paymentStatus,
        receivedAt: timeline.receivedAt,
        reviewedAt: timeline.reviewedAt,
        approvedAt: timeline.approvedAt,
        readyForPaymentAt: timeline.readyForPaymentAt,
        paidAt: timeline.paidAt,
        rejectedAt: timeline.rejectedAt,
        rejectionReason:
          lifecycle === 'REJECTED'
            ? ctx.fakers.org.helpers.arrayElement([
                'Amount mismatch with PO',
                'Missing supporting timesheet',
                'Contractor outside approved vendor list',
                'Wrong VAT treatment — should be reverse-charge',
                'Duplicate of an earlier submission',
              ])
            : null,
        sellerName: contractor.legalName,
        sellerTaxId: makeTaxId(ctx.profile.countryCode, ctx.fakers.org),
        notes: ctx.fakers.org.lorem.sentence(),
        duplicateCheckHash: tokenHex(32), // unique enough
        createdAt: timeline.receivedAt,
      });

      // Patch invoiceId onto pre-built lines, push into the wave-level array.
      for (const l of lines) {
        lineRows.push({ ...l, invoiceId });
      }

      approvalParams.push({ invoiceId, approvalStatus, timeline, total, invNumber });

      invoices.push({
        id: invoiceId,
        contractorId: contractor.id,
        invoiceNumber: invNumber,
        status: lifecycle,
        approvalStatus,
        paymentStatus,
        totalMinor: total,
        amountToPayMinor,
        partialPaidMinor,
        currency: contractor.currency,
        issueDate: dateOnly(issue),
        dueDate: dateOnly(due),
        approvedAt: timeline.approvedAt,
        paidAt: timeline.paidAt,
        receivedAt: timeline.receivedAt,
      });
      refs.push({
        type: 'INVOICE',
        id: invoiceId,
        name: invNumber,
        createdAt: timeline.receivedAt,
      });
    }
  }

  // Wave: parent invoices then their lines.
  // Invoice is a wide table (~30 storage cols) so chunk at 500.
  for (let i = 0; i < invoiceRows.length; i += 500) {
    await prisma.invoice.createMany({
      data: invoiceRows.slice(i, i + 500),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < lineRows.length; i += 1000) {
    await prisma.invoiceLine.createMany({
      data: lineRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // Approval chain — pre-compute flow + step ids so ApprovalFlow,
  // ApprovalStep, and ApprovalDecision can each batch in their own wave.
  const fallbackApprover = ctx.users[0];
  const secondaryApprover = ctx.users[1];
  const flowRows: Prisma.ApprovalFlowCreateManyInput[] = [];
  const stepRows: Prisma.ApprovalStepCreateManyInput[] = [];
  const decisionRows: Prisma.ApprovalDecisionCreateManyInput[] = [];
  for (const params of approvalParams) {
    const { invoiceId: createdId, approvalStatus, timeline, total, invNumber } = params;
    if (
      approvalStatus === 'NOT_STARTED' ||
      approvalChainConfigId === null ||
      fallbackApprover === undefined ||
      secondaryApprover === undefined
    ) {
      continue;
    }
    // Anchor approval-flow timestamps to the invoice timeline so the
    // approval row can never claim it completed before the invoice was
    // received.
    const flowStartedAt = timeline.reviewedAt ?? timeline.receivedAt;
    const flowCompletedAt =
      approvalStatus === 'APPROVED'
        ? timeline.approvedAt
        : approvalStatus === 'REJECTED'
          ? timeline.rejectedAt
          : null;
    const flowId = randomUUID();
    flowRows.push({
      id: flowId,
      organizationId: ctx.organizationId,
      resourceType: 'INVOICE',
      resourceId: createdId,
      chainConfigId: approvalChainConfigId,
      status: approvalStatus,
      // PENDING flows are on step 1 (manager review). Terminal states
      // (APPROVED / REJECTED / CANCELLED) leave currentStepOrder null —
      // the prior hard-coded `2` was wrong for both 1-step and 3-step
      // chains.
      currentStepOrder: approvalStatus === 'PENDING' ? 1 : null,
      startedAt: flowStartedAt,
      completedAt: flowCompletedAt,
      cancelledAt: approvalStatus === 'CANCELLED' ? timeline.reviewedAt : null,
      createdByUserId: ctx.ownerUserId,
    });

    const approver1 = ctx.users.find(u => u.role === 'team_manager') ?? secondaryApprover;
    const approver2 =
      ctx.users.find(u => u.role === 'finance_admin') ?? ctx.users[2] ?? fallbackApprover;
    const approver3 =
      ctx.users.find(u => u.role === 'admin') ??
      ctx.users.find(u => u.role === 'owner') ??
      fallbackApprover;
    // Amount-tiered approval chains so high-value invoices visibly flow
    // through more approvers. Threshold uses minor units against EUR
    // equivalents (we don't FX-convert in the seed — the bands are
    // approximate, not policy).
    const allStepDefs: Array<{
      order: number;
      name: string;
      approver: SeededUser;
      role: 'team_manager' | 'finance_admin' | 'admin';
    }> = [
      { order: 1, name: 'Manager review', approver: approver1, role: 'team_manager' },
      { order: 2, name: 'Finance sign-off', approver: approver2, role: 'finance_admin' },
      { order: 3, name: 'Executive approval', approver: approver3, role: 'admin' },
    ];
    const stepCount = total < 50_000 ? 1 : total < 500_000 ? 2 : 3;
    const stepDefs = allStepDefs.slice(0, stepCount);

    for (const stepDef of stepDefs) {
      const stepStatus =
        approvalStatus === 'PENDING'
          ? stepDef.order === 1
            ? 'PENDING'
            : 'NOT_STARTED'
          : approvalStatus === 'REJECTED'
            ? stepDef.order === 1
              ? 'REJECTED'
              : 'NOT_STARTED'
            : approvalStatus === 'CANCELLED'
              ? 'CANCELLED'
              : 'APPROVED';
      const stepDecision =
        stepStatus === 'APPROVED' ? 'APPROVE' : stepStatus === 'REJECTED' ? 'REJECT' : null;

      const stepActedAt = stepDecision === null ? null : (flowCompletedAt ?? timeline.reviewedAt);
      // SLA deadline: for completed steps, deadline lands near actedAt
      // (some steps just made the SLA, some breached it slightly). For
      // pending steps it's a future date the approver still has time to
      // hit. Previously every step had a 5-day-future deadline regardless
      // of whether the decision was already 6 months old.
      const slaDeadline =
        stepActedAt === null
          ? futureDate(ctx.fakers.org, 5)
          : new Date(
              stepActedAt.getTime() + ctx.fakers.org.number.int({ min: -1, max: 3 }) * 86_400_000,
            );
      // Step note (initial review) and decision rationale are different
      // texts in real life — the step describes what the reviewer
      // checked, the decision captures the call.
      const stepNote =
        stepDecision === null
          ? null
          : ctx.fakers.org.helpers.arrayElement([
              'Cross-checked against PO',
              'Verified against timesheet',
              'Confirmed VAT treatment',
              'Reviewed contract scope and rate',
            ]);
      const decisionComment =
        stepDecision === 'APPROVE'
          ? ctx.fakers.org.helpers.arrayElement([
              `Approved ${invNumber} — matches PO`,
              `Looks good, signing off ${invNumber}`,
              `${invNumber} approved per contract`,
              `Numbers reconcile, approving ${invNumber}`,
            ])
          : stepDecision === 'REJECT'
            ? `Rejecting ${invNumber} — ${ctx.fakers.org.helpers.arrayElement(['amount above quote', 'missing timesheet', 'wrong VAT treatment'])}`
            : null;
      const stepId = randomUUID();
      stepRows.push({
        id: stepId,
        organizationId: ctx.organizationId,
        approvalFlowId: flowId,
        stepOrder: stepDef.order,
        name: stepDef.name,
        approverUserId: stepDef.approver.id,
        approverRole: stepDef.role,
        status: stepStatus,
        required: true,
        slaDeadline,
        actedAt: stepActedAt,
        decision: stepDecision,
        comment: stepNote,
        createdAt: flowStartedAt,
      });

      if (stepDecision !== null) {
        decisionRows.push({
          organizationId: ctx.organizationId,
          approvalStepId: stepId,
          actorUserId: stepDef.approver.id,
          decision: stepDecision,
          comment: decisionComment,
          createdAt: stepActedAt ?? flowStartedAt,
        });
      }
    }
  }

  // Wave inserts: parent ApprovalFlow → child ApprovalStep → grandchild ApprovalDecision.
  for (let i = 0; i < flowRows.length; i += 1000) {
    await prisma.approvalFlow.createMany({
      data: flowRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < stepRows.length; i += 1000) {
    await prisma.approvalStep.createMany({
      data: stepRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < decisionRows.length; i += 1000) {
    await prisma.approvalDecision.createMany({
      data: decisionRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  return invoices;
}

// ---------------------------------------------------------------------------
// Payment runs
// ---------------------------------------------------------------------------

async function seedPaymentRuns(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
  refs: EntityRef[],
): Promise<void> {
  // PARTIALLY_PAID invoices are modelled as having had their first
  // instalment settled by a manual / bank-statement entry BEFORE this run
  // (a separate event). Seeded unconditionally — paymentRunsPerOrg=0 would
  // otherwise leave "partial" invoices with no payment trail at all.
  const invoicePaymentRows: Prisma.InvoicePaymentCreateManyInput[] = [];
  for (const inv of invoices) {
    if (inv.paymentStatus === 'PARTIALLY_PAID') {
      const partialPaidAt = pastDateAfter(ctx.fakers.org, 120, ctx.foundedAt);
      invoicePaymentRows.push({
        organizationId: ctx.organizationId,
        invoiceId: inv.id,
        amountMinor: inv.partialPaidMinor,
        paidAt: partialPaidAt,
        sourceKind: 'BANK_STATEMENT',
        notes: `Standalone partial payment ref REF-${tokenHex(4).toUpperCase()}`,
        createdAt: partialPaidAt,
      });
    }
  }

  const flushInvoicePayments = async (): Promise<void> => {
    for (let i = 0; i < invoicePaymentRows.length; i += 1000) {
      await prisma.invoicePayment.createMany({
        data: invoicePaymentRows.slice(i, i + 1000),
        skipDuplicates: true,
      });
    }
  };

  if (ctx.org.paymentRunsPerOrg === 0) {
    await flushInvoicePayments();
    return;
  }
  // Payment runs only batch READY (outstanding) and PAID (settled). Partial
  // is settled out-of-band above.
  const payable = invoices.filter(i => i.paymentStatus === 'READY' || i.paymentStatus === 'PAID');
  if (payable.length === 0) return;

  const finance = ctx.users.find(u => u.role === 'finance_admin') ?? ctx.users[0] ?? null;
  if (!finance) return;

  // Real payment runs are SINGLE-currency — bank export files (SEPA XML,
  // BACS, etc.) accept exactly one currency per submission. Group payable
  // invoices by currency and distribute the run quota with a HARD cap so the
  // total never exceeds `paymentRunsPerOrg`.
  const byCurrency = new Map<string, SeededInvoice[]>();
  for (const inv of payable) {
    const list = byCurrency.get(inv.currency) ?? [];
    list.push(inv);
    byCurrency.set(inv.currency, list);
  }

  // Floor + remainder distribution so the sum equals exactly
  // `paymentRunsPerOrg` (the previous Math.round + Math.max(1) combination
  // could overshoot by 1–2 runs).
  const totalRuns = ctx.org.paymentRunsPerOrg;
  const currencies = [...byCurrency.entries()];
  const baseQuotas: number[] = currencies.map(([, invs]) =>
    Math.floor((invs.length / payable.length) * totalRuns),
  );
  let allocated = baseQuotas.reduce((acc, n) => acc + n, 0);
  // Anyone with payable invoices gets at least 1 run (if quota allows).
  for (let idx = 0; idx < baseQuotas.length && allocated < totalRuns; idx += 1) {
    if (baseQuotas[idx] === 0) {
      baseQuotas[idx] = 1;
      allocated += 1;
    }
  }
  // Distribute leftover runs to currencies with the most invoices first.
  const remainderOrder = currencies
    .map((entry, idx) => ({ idx, count: entry[1].length }))
    .sort((a, b) => b.count - a.count);
  let r = 0;
  while (allocated < totalRuns && remainderOrder.length > 0) {
    const target = remainderOrder[r % remainderOrder.length];
    if (target !== undefined) baseQuotas[target.idx] = (baseQuotas[target.idx] ?? 0) + 1;
    allocated += 1;
    r += 1;
  }

  // Build run + item + export rows in memory, then wave-insert per model so
  // the Neon round-trip count drops from O(items) to O(items / 1000).
  const runRows: Prisma.PaymentRunCreateManyInput[] = [];
  const runItemRows: Prisma.PaymentRunItemCreateManyInput[] = [];
  const exportRows: Prisma.PaymentExportCreateManyInput[] = [];
  // updateMany targets accumulated per-status so the IN_RUN flip happens in a
  // single round-trip at the end of the function instead of per-run.
  const inRunInvoiceIds: string[] = [];

  let runOrdinal = 0;
  for (let cIdx = 0; cIdx < currencies.length; cIdx += 1) {
    const entry = currencies[cIdx];
    if (entry === undefined) continue;
    const [currency, currencyInvoices] = entry;
    const runsForThisCurrency = baseQuotas[cIdx] ?? 0;
    if (runsForThisCurrency === 0) continue;
    const perRun = Math.max(1, Math.ceil(currencyInvoices.length / runsForThisCurrency));
    const chunks: SeededInvoice[][] = [];
    for (let j = 0; j < currencyInvoices.length; j += perRun) {
      chunks.push(currencyInvoices.slice(j, j + perRun));
    }

    for (const slice of chunks) {
      runOrdinal += 1;
      const allPaid = slice.every(i => i.paymentStatus === 'PAID');
      const status = allPaid
        ? 'COMPLETED'
        : ctx.fakers.org.helpers.arrayElement(['DRAFT', 'LOCKED', 'EXPORTED']);
      const totalMinor = slice.reduce(
        (acc, i) => acc + (i.paymentStatus === 'PAID' ? i.totalMinor : i.amountToPayMinor),
        0,
      );

      // Anchor the run timeline on the items' actual payment moments so the
      // run can never claim it exported AFTER items were marked paid. For
      // PAID slices, exportedAt = earliest paid − 1 day (clamped to
      // foundedAt), completedAt = latest paid + 0–2 days.
      const paidMoments = slice
        .map(i => i.paidAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      const earliestPaid = paidMoments[0];
      const latestPaid = paidMoments[paidMoments.length - 1];
      const foundedMs = ctx.foundedAt.getTime();
      const exportedAt =
        status === 'EXPORTED' || status === 'COMPLETED'
          ? earliestPaid
            ? new Date(Math.max(foundedMs, earliestPaid.getTime() - 86_400_000))
            : pastDateAfter(ctx.fakers.org, 60, ctx.foundedAt)
          : null;
      const completedAt =
        status === 'COMPLETED' && latestPaid
          ? advanceCapped(latestPaid, ctx.fakers.org.number.int({ min: 0, max: 2 }))
          : null;

      const runCreatedAt = exportedAt
        ? new Date(Math.max(foundedMs, exportedAt.getTime() - 86_400_000))
        : pastDateAfter(ctx.fakers.org, 14, ctx.foundedAt);

      const runId = randomUUID();
      runRows.push({
        id: runId,
        organizationId: ctx.organizationId,
        // runOrdinal is monotonic across all currencies within this org-seed
        // call, so {orgKey, currency, ordinal} is already unique under the
        // [organizationId, runNumber] constraint.
        runNumber: `PR-${ctx.org.key.slice(0, 4).toUpperCase()}-${currency}-${runOrdinal.toString().padStart(3, '0')}`,
        name: `${ctx.fakers.org.date.month()} ${currency} run ${runOrdinal}`,
        status,
        currency,
        createdByUserId: finance.id,
        approvedByUserId: status === 'COMPLETED' || status === 'EXPORTED' ? finance.id : null,
        totalMinor,
        invoiceCount: slice.length,
        exportFormat:
          status === 'DRAFT'
            ? null
            : currency === 'EUR'
              ? 'SEPA_XML'
              : currency === 'GBP'
                ? 'BACS_STD18'
                : 'SWIFT_XML',
        exportedAt,
        completedAt,
        createdAt: runCreatedAt,
      });

      refs.push({
        type: 'PAYMENT_RUN',
        id: runId,
        name: `Run ${runOrdinal} (${currency})`,
        createdAt: runCreatedAt,
      });

      for (const inv of slice) {
        // ONE shared payment reference for the whole event chain.
        const paymentReference = `REF-${tokenHex(4).toUpperCase()}`;
        const itemStatus =
          inv.paymentStatus === 'PAID'
            ? 'PAID'
            : status === 'EXPORTED' || status === 'COMPLETED'
              ? 'EXPORTED'
              : 'PENDING';
        // PAID invoices always carry timeline.paidAt (built in seedInvoices);
        // no need for a `?? completedAt ?? exportedAt` fallback.
        const paymentMoment = inv.paymentStatus === 'PAID' ? inv.paidAt : null;

        const runItemId = randomUUID();
        runItemRows.push({
          id: runItemId,
          organizationId: ctx.organizationId,
          paymentRunId: runId,
          invoiceId: inv.id,
          contractorId: inv.contractorId,
          amountMinor: inv.paymentStatus === 'PAID' ? inv.totalMinor : inv.amountToPayMinor,
          currency: inv.currency,
          status: itemStatus,
          paymentReference: itemStatus === 'PAID' ? paymentReference : null,
          markedPaidAt: itemStatus === 'PAID' ? paymentMoment : null,
          createdAt: runCreatedAt,
        });

        // InvoicePayment row links back via FK so the "Payments" tab on the
        // invoice can trace the source. PARTIALLY_PAID was queued at top of fn.
        if (inv.paymentStatus === 'PAID' && paymentMoment) {
          invoicePaymentRows.push({
            organizationId: ctx.organizationId,
            invoiceId: inv.id,
            amountMinor: inv.totalMinor,
            paidAt: paymentMoment,
            sourceKind: 'PAYMENT_RUN',
            sourcePaymentRunItemId: runItemId,
            notes: `Settled via ${paymentReference}`,
            createdAt: paymentMoment,
          });
        }
      }

      // Once a run is LOCKED or EXPORTED, the underlying READY invoices are
      // committed to that run — Invoice.paymentStatus must flip to IN_RUN so
      // the invoice list and the run page agree. (Without this, a READY
      // invoice could appear in an EXPORTED run while still labelled "ready
      // for payment" everywhere else.)
      if (status === 'LOCKED' || status === 'EXPORTED') {
        for (const inv of slice) {
          if (inv.paymentStatus === 'READY') {
            inRunInvoiceIds.push(inv.id);
            inv.paymentStatus = 'IN_RUN';
          }
        }
      }

      // L3: a PaymentExport row for COMPLETED / EXPORTED runs so the
      // Settings → Exports page isn't always empty.
      if ((status === 'COMPLETED' || status === 'EXPORTED') && exportedAt) {
        exportRows.push({
          organizationId: ctx.organizationId,
          paymentRunId: runId,
          format: currency === 'EUR' ? 'SEPA_XML' : currency === 'GBP' ? 'BACS_STD18' : 'SWIFT_XML',
          status: ctx.fakers.org.helpers.arrayElement(['GENERATED', 'DOWNLOADED']),
          generatedByUserId: finance.id,
          generatedAt: exportedAt,
          downloadedAt: status === 'COMPLETED' ? completedAt : null,
        });
      }
    }
  }

  // Wave inserts: PaymentRun → PaymentRunItem → InvoicePayment → PaymentExport.
  // Invoice.paymentStatus IN_RUN flip runs as a single updateMany at the end.
  for (let i = 0; i < runRows.length; i += 1000) {
    await prisma.paymentRun.createMany({
      data: runRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < runItemRows.length; i += 1000) {
    await prisma.paymentRunItem.createMany({
      data: runItemRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  await flushInvoicePayments();
  for (let i = 0; i < exportRows.length; i += 1000) {
    await prisma.paymentExport.createMany({
      data: exportRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  if (inRunInvoiceIds.length > 0) {
    await prisma.invoice.updateMany({
      where: { id: { in: inRunInvoiceIds } },
      data: { paymentStatus: 'IN_RUN' },
    });
  }
}

// ---------------------------------------------------------------------------
// Reminders (rules + instances)
// ---------------------------------------------------------------------------

async function seedReminders(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
  refs: readonly EntityRef[],
): Promise<void> {
  if (ctx.org.reminderRules === 0) return;

  // Each rule pairs a trigger with the entity-relative offset that resolves
  // to a concrete `scheduledFor`. Rules are seeded in order so a profile of
  // 1 reminderRule gets only the most common one (invoice due-soon).
  const ruleConfigs = [
    {
      name: 'Invoice due in 3 days',
      entityType: 'INVOICE' as const,
      triggerType: 'BEFORE_DUE_DATE' as const,
      offsetDays: 3,
      channel: 'EMAIL' as const,
      recipientMode: 'FINANCE_TEAM' as const,
    },
    {
      name: 'Invoice overdue (7 days)',
      entityType: 'INVOICE' as const,
      triggerType: 'AFTER_DUE_DATE' as const,
      offsetDays: 7,
      channel: 'IN_APP' as const,
      recipientMode: 'ENTITY_OWNER' as const,
    },
    {
      name: 'Contract expiring in 30 days',
      entityType: 'CONTRACT' as const,
      triggerType: 'BEFORE_CONTRACT_END' as const,
      offsetDays: 30,
      channel: 'SLACK' as const,
      recipientMode: 'ASSIGNEE' as const,
    },
    {
      name: 'Invoice due (on-day)',
      entityType: 'INVOICE' as const,
      triggerType: 'ON_DUE_DATE' as const,
      offsetDays: 0,
      channel: 'EMAIL' as const,
      recipientMode: 'ROLE' as const,
    },
  ].slice(0, ctx.org.reminderRules);

  type RuleConfig = (typeof ruleConfigs)[number];
  const seededRules: Array<{ id: string; cfg: RuleConfig }> = [];
  const ruleRows: Prisma.ReminderRuleCreateManyInput[] = [];
  for (const cfg of ruleConfigs) {
    const id = randomUUID();
    ruleRows.push({
      id,
      organizationId: ctx.organizationId,
      name: cfg.name,
      entityType: cfg.entityType,
      triggerType: cfg.triggerType,
      offsetDays: cfg.offsetDays,
      channel: cfg.channel,
      recipientMode: cfg.recipientMode,
      active: true,
    });
    seededRules.push({ id, cfg });
  }
  for (let i = 0; i < ruleRows.length; i += 1000) {
    await prisma.reminderRule.createMany({
      data: ruleRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // ---------- Generate instances ----------
  // The previous implementation rolled `scheduledFor` from `pastDate(30)` /
  // `futureDate(14)` independently of the rule's offsetDays — so a "Due in
  // 3 days" reminder could fire 30 days before due. Now the schedule comes
  // straight from the rule applied to the entity's anchor date.

  const openInvoices = invoices.filter(
    i => i.status !== 'PAID' && i.status !== 'VOID' && i.status !== 'REJECTED',
  );
  const contractRefs = refs.filter(r => r.type === 'CONTRACT');

  type Instance = {
    id: string;
    organizationId: string;
    reminderRuleId: string;
    entityType: 'INVOICE' | 'CONTRACT';
    entityId: string;
    scheduledFor: Date;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
    sentAt: Date | null;
  };
  const instances: Instance[] = [];

  /**
   * Status by where `scheduledFor` falls relative to now. CANCELLED is
   * intentionally ONLY in the future bucket: openInvoices is filtered to
   * exclude PAID/VOID/REJECTED, so a "cancelled reminder on a still-open
   * invoice" in the past is a contradiction (cancellations usually fire
   * when the invoice gets paid first).
   */
  const pickStatus = (scheduledFor: Date): Instance['status'] => {
    if (scheduledFor.getTime() > Date.now()) {
      return weightedPick<Instance['status']>(ctx.fakers.org, [
        ['PENDING', 8],
        ['CANCELLED', 1],
      ]);
    }
    return weightedPick<Instance['status']>(ctx.fakers.org, [
      ['SENT', 9],
      ['FAILED', 1],
    ]);
  };

  // Reminder schedules clamped at foundedAt — for very young orgs a rule
  // with offsetDays=30 anchored on a near-foundedAt invoice could otherwise
  // schedule a reminder before the org existed.
  const clampToOrgLifespan = (d: Date): Date =>
    new Date(Math.max(d.getTime(), ctx.foundedAt.getTime()));

  /** Real cron fires within minutes/hours of the schedule, not on the exact
   *  same instant. 1min – 4h jitter for SENT instances. */
  const sentAtFor = (scheduledFor: Date): Date =>
    new Date(
      scheduledFor.getTime() + ctx.fakers.org.number.int({ min: 60_000, max: 4 * 3_600_000 }),
    );

  for (const { id: ruleId, cfg } of seededRules) {
    if (cfg.entityType === 'INVOICE') {
      // Cap at 200 instances per rule so the table stays bounded on huge.
      for (const inv of openInvoices.slice(0, Math.min(200, openInvoices.length))) {
        const offsetMs = (cfg.offsetDays ?? 0) * 86_400_000;
        const baseMs = inv.dueDate.getTime();
        const scheduledFor = clampToOrgLifespan(
          new Date(
            cfg.triggerType === 'BEFORE_DUE_DATE'
              ? baseMs - offsetMs
              : cfg.triggerType === 'AFTER_DUE_DATE'
                ? baseMs + offsetMs
                : baseMs,
          ),
        );
        const status = pickStatus(scheduledFor);
        instances.push({
          id: newId(),
          organizationId: ctx.organizationId,
          reminderRuleId: ruleId,
          entityType: 'INVOICE',
          entityId: inv.id,
          scheduledFor,
          status,
          sentAt: status === 'SENT' ? sentAtFor(scheduledFor) : null,
        });
      }
    } else if (cfg.entityType === 'CONTRACT') {
      // Synthesise a future contract-end date per ref (~6mo–18mo out)
      // since `EntityRef` doesn't carry the contract end date itself.
      for (const ref of contractRefs.slice(0, Math.min(50, contractRefs.length))) {
        const contractEnd = new Date(
          Date.now() + ctx.fakers.org.number.int({ min: 30, max: 540 }) * 86_400_000,
        );
        const scheduledFor = clampToOrgLifespan(
          new Date(contractEnd.getTime() - (cfg.offsetDays ?? 0) * 86_400_000),
        );
        const status = pickStatus(scheduledFor);
        instances.push({
          id: newId(),
          organizationId: ctx.organizationId,
          reminderRuleId: ruleId,
          entityType: 'CONTRACT',
          entityId: ref.id,
          scheduledFor,
          status,
          sentAt: status === 'SENT' ? sentAtFor(scheduledFor) : null,
        });
      }
    }
  }

  if (instances.length > 0) {
    for (let i = 0; i < instances.length; i += 5_000) {
      await prisma.reminderInstance.createMany({ data: instances.slice(i, i + 5_000) });
    }
  }
}

// ---------------------------------------------------------------------------
// Notifications + preferences
// ---------------------------------------------------------------------------

const NOTIFICATION_TYPES_FOR_SEED: readonly string[] = [
  'APPROVAL_REQUEST',
  'APPROVAL_DECISION',
  'INVOICE_RECEIVED',
  'TASK_ASSIGNED',
  'TASK_OVERDUE',
  'CONTRACT_EXPIRING',
  'EQUIPMENT_RETURN_REQUESTED',
  'EQUIPMENT_RETURN_APPROVED',
  'EQUIPMENT_RETURN_REJECTED',
  'PAYMENT_FAILED',
  'PAYMENT_ACTION_REQUIRED',
  'SHIPMENT_STATUS_CHANGE',
];

/**
 * Synthetic actor for system-driven notifications. Real cron / system events
 * don't have a User actor — using one of the recipients pollutes message
 * bodies ("Anna assigned you a task" where Anna is the recipient).
 */
const SYSTEM_ACTOR: SeededUser = {
  id: 'system',
  name: 'System',
  email: 'system@seed.local',
  role: 'system',
};

async function seedNotifications(
  prisma: PrismaClient,
  ctx: OrgSeed,
  refs: readonly EntityRef[],
): Promise<void> {
  if (ctx.org.notificationsPerUser === 0) return;

  // Per-user preference for the most common types
  const prefs: Array<{
    organizationId: string;
    userId: string;
    notificationType: string;
    channelEmail: boolean;
    channelInApp: boolean;
    channelSlack: boolean;
    channelTeams: boolean;
    digestMode: boolean;
  }> = [];
  for (const u of ctx.users) {
    for (const t of NOTIFICATION_TYPES_FOR_SEED.slice(0, 6)) {
      prefs.push({
        organizationId: ctx.organizationId,
        userId: u.id,
        notificationType: t,
        channelEmail: true,
        channelInApp: true,
        channelSlack: ctx.fakers.org.datatype.boolean({ probability: 0.3 }),
        channelTeams: false,
        digestMode: false,
      });
    }
  }
  if (prefs.length > 0) {
    await prisma.userNotificationPreference.createMany({ data: prefs });
  }

  // Notification.entityType uses the EntityType enum from contract.prisma —
  // narrower than EntityRefType (no PAYMENT_RUN substitution issue here).
  type NotificationEntity = 'INVOICE' | 'CONTRACTOR' | 'CONTRACT' | 'EQUIPMENT' | 'PAYMENT_RUN';
  const rows: Array<{
    id: string;
    organizationId: string;
    userId: string;
    channel: 'IN_APP' | 'EMAIL' | 'SLACK' | 'TEAMS';
    type: string;
    title: string;
    body: string;
    entityType: NotificationEntity | null;
    entityId: string | null;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'READ';
    sentAt: Date | null;
    readAt: Date | null;
    dedupKey: string;
    createdAt: Date;
  }> = [];

  // Match notification types to entity types so templated bodies always
  // reference an entity that fits (e.g. EQUIPMENT_RETURN_REQUESTED only fires
  // against EQUIPMENT refs). Picking a type without a matching ref falls
  // through to a generic INVOICE_RECEIVED on the most recent invoice ref.
  const refsByType = new Map<EntityRefType, EntityRef[]>();
  for (const r of refs) {
    const list = refsByType.get(r.type) ?? [];
    list.push(r);
    refsByType.set(r.type, list);
  }
  const pickRefOfType = (type: EntityRefType): EntityRef | null => {
    const list = refsByType.get(type);
    if (list === undefined || list.length === 0) return null;
    return ctx.fakers.org.helpers.arrayElement(list);
  };

  /** Returns the entity ref appropriate for this notification type, or null. */
  const refForNotificationType = (type: string): EntityRef | null => {
    if (type.startsWith('EQUIPMENT_')) return pickRefOfType('EQUIPMENT');
    if (type === 'CONTRACT_EXPIRING') return pickRefOfType('CONTRACT');
    if (
      type.startsWith('INVOICE_') ||
      type === 'APPROVAL_REQUEST' ||
      type === 'APPROVAL_DECISION' ||
      type.startsWith('PAYMENT_')
    ) {
      return pickRefOfType('INVOICE');
    }
    if (type === 'SHIPMENT_STATUS_CHANGE') return pickRefOfType('EQUIPMENT');
    return refs.length > 0 ? ctx.fakers.org.helpers.arrayElement(refs) : null;
  };

  /** Builds a (title, body) pair that references the entity by name. */
  const renderNotification = (
    type: string,
    ref: EntityRef | null,
    actor: SeededUser,
  ): { title: string; body: string } => {
    const fallback = {
      title: type.replace(/_/g, ' ').toLowerCase(),
      body: ctx.fakers.org.lorem.sentence(),
    };
    if (ref === null) return fallback;
    switch (type) {
      case 'INVOICE_RECEIVED':
        return {
          title: `New invoice ${ref.name}`,
          body: `${ref.name} arrived from a contractor and is awaiting review.`,
        };
      case 'APPROVAL_REQUEST':
        return {
          title: `Approval needed: ${ref.name}`,
          body: `${actor.name} has requested your approval on ${ref.name}.`,
        };
      case 'APPROVAL_DECISION':
        return {
          title: `Decision on ${ref.name}`,
          body: `${actor.name} has signed off on ${ref.name}.`,
        };
      case 'PAYMENT_FAILED':
        return {
          title: `Payment failed for ${ref.name}`,
          body: `Bank export for ${ref.name} returned an error — review and retry.`,
        };
      case 'PAYMENT_ACTION_REQUIRED':
        return {
          title: `Action required: ${ref.name}`,
          body: `${ref.name} is held pending bank confirmation.`,
        };
      case 'CONTRACT_EXPIRING':
        return {
          title: `Contract expiring: ${ref.name}`,
          body: `${ref.name} ends in 30 days. Schedule the renewal conversation.`,
        };
      case 'TASK_ASSIGNED':
        return {
          title: `New task assigned`,
          body: `${actor.name} assigned you a workflow task related to ${ref.name}.`,
        };
      case 'TASK_OVERDUE':
        return {
          title: `Overdue task on ${ref.name}`,
          body: `A workflow task on ${ref.name} is past its due date.`,
        };
      case 'EQUIPMENT_RETURN_REQUESTED':
        return {
          title: `Return requested: ${ref.name}`,
          body: `A return request was filed for ${ref.name}.`,
        };
      case 'EQUIPMENT_RETURN_APPROVED':
        return {
          title: `Return approved: ${ref.name}`,
          body: `Return for ${ref.name} approved by ${actor.name}.`,
        };
      case 'EQUIPMENT_RETURN_REJECTED':
        return {
          title: `Return rejected: ${ref.name}`,
          body: `Return for ${ref.name} was rejected — check the reason in the request.`,
        };
      case 'SHIPMENT_STATUS_CHANGE':
        return {
          title: `Shipment update: ${ref.name}`,
          body: `Carrier reported a status change for ${ref.name}.`,
        };
      default:
        return fallback;
    }
  };

  for (const u of ctx.users) {
    for (let i = 0; i < ctx.org.notificationsPerUser; i += 1) {
      const status = weightedPick<'PENDING' | 'SENT' | 'FAILED' | 'READ'>(ctx.fakers.org, [
        ['PENDING', 1],
        ['SENT', 4],
        ['READ', 4],
        ['FAILED', 1],
      ]);
      const type =
        NOTIFICATION_TYPES_FOR_SEED[
          ctx.fakers.org.number.int({
            min: 0,
            max: NOTIFICATION_TYPES_FOR_SEED.length - 1,
          })
        ] ?? 'INVOICE_RECEIVED';
      const ref = refForNotificationType(type);
      // Pick an actor appropriate to the notification type:
      //  - System-driven events use a synthetic SYSTEM_ACTOR — using one of
      //    the recipients made INVOICE_RECEIVED look like a user sent it.
      //  - User-driven events pick a user OTHER than the recipient — Anna
      //    can't request her own approval. Falls back to the recipient when
      //    there's only one user (solo profile).
      const isSystemEvent =
        type === 'INVOICE_RECEIVED' ||
        type.startsWith('PAYMENT_') ||
        type === 'TASK_OVERDUE' ||
        type === 'CONTRACT_EXPIRING' ||
        type === 'SHIPMENT_STATUS_CHANGE';
      const candidateActors = ctx.users.filter(usr => usr.id !== u.id);
      const actor = isSystemEvent
        ? SYSTEM_ACTOR
        : candidateActors.length > 0
          ? ctx.fakers.org.helpers.arrayElement(candidateActors)
          : u;
      const rendered = renderNotification(type, ref, actor);
      // Anchor the notification timeline so it never pre-dates the org and
      // sentAt/readAt always come AFTER createdAt.
      const createdAt = pastDateAfter(ctx.fakers.org, 90, ctx.foundedAt);
      const sentAt =
        status === 'PENDING'
          ? null
          : new Date(
              createdAt.getTime() + ctx.fakers.org.number.int({ min: 0, max: 6 * 3_600_000 }), // 0–6h after create
            );
      const readAt =
        status === 'READ' && sentAt
          ? new Date(
              sentAt.getTime() + ctx.fakers.org.number.int({ min: 60_000, max: 7 * 86_400_000 }), // 1min–7d after sent
            )
          : null;
      rows.push({
        id: newId(),
        organizationId: ctx.organizationId,
        userId: u.id,
        channel: ctx.fakers.org.helpers.arrayElement(['IN_APP', 'EMAIL', 'SLACK']),
        type,
        title: rendered.title,
        body: rendered.body,
        entityType: ref?.type ?? null,
        entityId: ref?.id ?? null,
        status,
        sentAt,
        readAt,
        dedupKey: `${u.id}:${type}:${i}:${tokenHex(4)}`,
        createdAt,
      });
    }
  }
  if (rows.length > 0) {
    // Chunk to 5_000 per createMany (Prisma postgres handles ~65k params, lots of headroom)
    for (let i = 0; i < rows.length; i += 5_000) {
      await prisma.notification.createMany({ data: rows.slice(i, i + 5_000) });
    }
  }
}

// ---------------------------------------------------------------------------
// Outbox events
// ---------------------------------------------------------------------------

const OUTBOX_EVENT_TYPES: readonly string[] = [
  'invoice.received',
  'invoice.approved',
  'invoice.paid',
  'approval.requested',
  'approval.decided',
  'shipment.status_changed',
  'webhook.dispatch',
  'reminder.queue',
];

/** Builds a payload that mirrors the shape produced by the real handlers in
 *  `packages/api/src/services/outbox/handlers.ts` (entity snapshot + IDs). */
function makeOutboxPayload(
  eventType: string,
  ref: EntityRef | null,
  faker: Faker,
  organizationId: string,
): unknown {
  const base = {
    eventType,
    organizationId,
    occurredAt: new Date().toISOString(),
  };
  if (ref === null) return { ...base };
  switch (eventType) {
    case 'invoice.received':
    case 'invoice.approved':
    case 'invoice.paid':
      return {
        ...base,
        invoiceId: ref.id,
        invoiceNumber: ref.name,
        contractorRef: { displayName: faker.company.name() },
      };
    case 'approval.requested':
    case 'approval.decided':
      return {
        ...base,
        flowId: newId(),
        resourceType: ref.type,
        resourceId: ref.id,
        currentStepOrder: faker.number.int({ min: 1, max: 3 }),
      };
    case 'shipment.status_changed':
      return {
        ...base,
        shipmentId: newId(),
        equipmentRef: ref.type === 'EQUIPMENT' ? { id: ref.id, name: ref.name } : null,
        oldStatus: 'PICKED_UP',
        newStatus: 'IN_TRANSIT',
      };
    case 'webhook.dispatch':
      return {
        ...base,
        targetUrl: 'https://example.invalid/webhook',
        deliveryAttempt: 1,
      };
    case 'reminder.queue':
      return {
        ...base,
        ruleName: 'Invoice due in 3 days',
        entityRef: { type: ref.type, id: ref.id },
      };
    default:
      return base;
  }
}

async function seedOutbox(
  prisma: PrismaClient,
  ctx: OrgSeed,
  refs: readonly EntityRef[],
): Promise<void> {
  if (ctx.org.outboxEventsPerOrg === 0) return;
  const rows = Array.from({ length: ctx.org.outboxEventsPerOrg }, (_, i) => {
    const status = weightedPick<'PENDING' | 'DISPATCHED' | 'FAILED'>(ctx.fakers.org, [
      ['PENDING', 2],
      ['DISPATCHED', 7],
      ['FAILED', 1],
    ]);
    const eventType =
      OUTBOX_EVENT_TYPES[
        ctx.fakers.org.number.int({
          min: 0,
          max: OUTBOX_EVENT_TYPES.length - 1,
        })
      ] ?? 'webhook.dispatch';
    const ref = refs.length > 0 ? ctx.fakers.org.helpers.arrayElement(refs) : null;
    // Outbox event must land within the org's lifespan.
    const created = pastDateAfter(ctx.fakers.org, 90, ctx.foundedAt);
    return {
      id: newId(),
      organizationId: ctx.organizationId,
      eventType,
      aggregateType: eventType.startsWith('invoice')
        ? 'Invoice'
        : eventType.startsWith('approval')
          ? 'ApprovalFlow'
          : eventType.startsWith('shipment')
            ? 'Shipment'
            : 'Misc',
      aggregateId: ref?.id ?? tokenHex(8),
      payloadJson: makeOutboxPayload(eventType, ref, ctx.fakers.org, ctx.organizationId) as object,
      dedupKey: `outbox:${ctx.org.key}:${i}:${tokenHex(4)}`,
      status,
      attempts: status === 'FAILED' ? 10 : status === 'DISPATCHED' ? 1 : 0,
      nextAttemptAt: status === 'PENDING' ? futureDate(ctx.fakers.org, 1) : created,
      lastError:
        status === 'FAILED'
          ? ctx.fakers.org.helpers.arrayElement([
              'HTTP 503 from downstream',
              'connect ETIMEDOUT after 30s',
              'invalid signature on response',
              'rate limit exceeded',
            ])
          : null,
      dispatchedAt: status === 'DISPATCHED' ? created : null,
      failedAt: status === 'FAILED' ? created : null,
      createdAt: created,
    };
  });
  for (let i = 0; i < rows.length; i += 5_000) {
    await prisma.outboxEvent.createMany({ data: rows.slice(i, i + 5_000) });
  }
}

// ---------------------------------------------------------------------------
// Webhook deliveries
// ---------------------------------------------------------------------------

const WEBHOOK_PROVIDERS: ReadonlyArray<
  'RESEND' | 'SLACK' | 'JIRA' | 'LINEAR' | 'DOCUSIGN' | 'KSEF' | 'PEPPOL' | 'ZATCA'
> = ['RESEND', 'SLACK', 'JIRA', 'LINEAR', 'DOCUSIGN', 'KSEF', 'PEPPOL', 'ZATCA'];

/** Provider-specific event names + payload shapes. Real webhook payloads
 *  vary wildly per provider; these mimic the broad shape so "View payload"
 *  panels show recognisable data instead of `{seed: true}`. */
function makeWebhookEvent(provider: string, faker: Faker): { eventType: string; payload: object } {
  const id = `evt_${tokenHex(6)}`;
  switch (provider) {
    case 'SLACK':
      return {
        eventType: 'event_callback',
        payload: {
          token: tokenHex(8),
          team_id: `T${faker.string.alphanumeric({ length: 9, casing: 'upper' })}`,
          api_app_id: `A${faker.string.alphanumeric({ length: 9, casing: 'upper' })}`,
          event: {
            type: faker.helpers.arrayElement(['message', 'app_mention', 'reaction_added']),
            channel: `C${faker.string.alphanumeric({ length: 9, casing: 'upper' })}`,
            ts: `${Math.floor(Date.now() / 1000)}.000100`,
          },
          event_id: `Ev${faker.string.alphanumeric({ length: 9, casing: 'upper' })}`,
        },
      };
    case 'JIRA':
      return {
        eventType: 'jira:issue_updated',
        payload: {
          webhookEvent: 'jira:issue_updated',
          issue: {
            key: `${faker.string.alpha({ length: 4, casing: 'upper' })}-${faker.number.int({ min: 1, max: 9999 })}`,
            fields: {
              summary: faker.lorem.sentence(),
              status: { name: faker.helpers.arrayElement(['To Do', 'In Progress', 'Done']) },
            },
          },
        },
      };
    case 'LINEAR':
      return {
        eventType: 'Issue.update',
        payload: {
          action: 'update',
          type: 'Issue',
          data: {
            id: newId(),
            identifier: `LIN-${faker.number.int({ min: 1, max: 999 })}`,
            title: faker.lorem.sentence(),
            state: { name: 'In Progress' },
          },
        },
      };
    case 'DOCUSIGN':
      return {
        eventType: 'envelope-completed',
        payload: {
          envelopeId: newId(),
          status: 'completed',
          recipients: { signers: [{ email: faker.internet.email(), status: 'completed' }] },
        },
      };
    case 'RESEND':
      return {
        eventType: 'email.delivered',
        payload: {
          type: 'email.delivered',
          data: {
            email_id: id,
            from: 'noreply@example.invalid',
            to: [faker.internet.email()],
            subject: faker.lorem.sentence(),
          },
        },
      };
    case 'KSEF':
      return {
        eventType: 'ksef.invoice.received',
        payload: {
          referenceNumber: faker.string.alphanumeric({ length: 20, casing: 'upper' }),
          ksefNumber: `${faker.number.int({ min: 1, max: 9_999_999_999 })}/${new Date().getFullYear()}`,
          status: 'ACCEPTED',
        },
      };
    case 'PEPPOL':
      return {
        eventType: 'peppol.message.delivered',
        payload: {
          messageId: id,
          documentTypeId:
            'busdox-docid-qns::urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
          receiverParticipant: faker.string.numeric({ length: 13 }),
          deliveryStatus: 'OK',
        },
      };
    case 'ZATCA':
      return {
        eventType: 'zatca.clearance.success',
        payload: {
          uuid: newId(),
          invoiceHash: tokenHex(32),
          clearanceStatus: 'CLEARED',
          warningMessages: [],
        },
      };
    default:
      return { eventType: `${provider.toLowerCase()}.event`, payload: { id } };
  }
}

async function seedWebhookDeliveries(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  if (ctx.org.webhookDeliveriesPerOrg === 0) return;
  const rows = Array.from({ length: ctx.org.webhookDeliveriesPerOrg }, () => {
    const provider = ctx.fakers.org.helpers.arrayElement(WEBHOOK_PROVIDERS);
    const status = weightedPick<'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED'>(
      ctx.fakers.org,
      [
        ['RECEIVED', 1],
        ['PROCESSING', 1],
        ['PROCESSED', 7],
        ['FAILED', 1],
      ],
    );
    const received = pastDateAfter(ctx.fakers.org, 90, ctx.foundedAt);
    const event = makeWebhookEvent(provider, ctx.fakers.org);
    return {
      id: newId(),
      organizationId: ctx.organizationId,
      provider,
      eventType: event.eventType,
      deliveryStatus: status,
      signatureValid: status !== 'FAILED',
      payloadJson: event.payload,
      receivedAt: received,
      processedAt: status === 'PROCESSED' ? received : null,
      errorMessage:
        status === 'FAILED'
          ? ctx.fakers.org.helpers.arrayElement([
              'signature mismatch',
              'handler threw: TypeError on missing field',
              'downstream returned 502',
            ])
          : null,
      // (provider, providerEventId) is unique — token is per-row
      providerEventId: `${provider.toLowerCase()}-${tokenHex(8)}`,
    };
  });
  for (let i = 0; i < rows.length; i += 2_000) {
    await prisma.webhookDelivery.createMany({ data: rows.slice(i, i + 2_000) });
  }
}

// ---------------------------------------------------------------------------
// Equipment + assignments + shipments + return requests
// ---------------------------------------------------------------------------

const EQUIPMENT_TYPES: ReadonlyArray<
  'LAPTOP' | 'MONITOR' | 'PHONE' | 'HEADSET' | 'KEYBOARD' | 'MOUSE' | 'OTHER'
> = ['LAPTOP', 'MONITOR', 'PHONE', 'HEADSET', 'KEYBOARD', 'MOUSE', 'OTHER'];

async function seedEquipment(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
  refs: EntityRef[],
): Promise<void> {
  if (ctx.org.equipmentPerOrg === 0) return;

  const equipmentRows: Prisma.EquipmentCreateManyInput[] = [];
  const assignmentRows: Prisma.EquipmentAssignmentCreateManyInput[] = [];
  const shipmentRows: Prisma.ShipmentCreateManyInput[] = [];
  const shipmentEventRows: Prisma.ShipmentEventCreateManyInput[] = [];
  const returnRequestRows: Prisma.ReturnRequestCreateManyInput[] = [];

  for (let i = 0; i < ctx.org.equipmentPerOrg; i += 1) {
    const type = ctx.fakers.org.helpers.arrayElement(EQUIPMENT_TYPES);
    const status = weightedPick<
      | 'AVAILABLE'
      | 'ASSIGNED'
      | 'IN_TRANSIT'
      | 'DELIVERED'
      | 'RETURN_REQUESTED'
      | 'RETURN_IN_TRANSIT'
      | 'RETURNED'
      | 'RETIRED'
    >(ctx.fakers.org, [
      ['AVAILABLE', 2],
      ['ASSIGNED', 5],
      ['IN_TRANSIT', 1],
      ['DELIVERED', 1],
      ['RETURN_REQUESTED', 1],
      ['RETURNED', 1],
      ['RETIRED', 1],
    ]);
    const purchaseDate = dateOnly(dateBetween(ctx.fakers.org, ctx.foundedAt, new Date()));
    const equipmentId = randomUUID();
    equipmentRows.push({
      id: equipmentId,
      organizationId: ctx.organizationId,
      name: `${type.toLowerCase()}-${i}`,
      serialNumber: makeEquipmentSerial(type, ctx.fakers.org),
      type,
      status,
      notes: ctx.fakers.org.lorem.sentence(),
      purchaseDate,
      createdAt: purchaseDate,
    });

    refs.push({
      type: 'EQUIPMENT',
      id: equipmentId,
      name: `${type.toLowerCase()}-${i}`,
      createdAt: purchaseDate,
    });

    if (status !== 'AVAILABLE' && status !== 'RETIRED' && contractors.length > 0) {
      const contractor = ctx.fakers.org.helpers.arrayElement(contractors);
      // Equipment must be PURCHASED before it's ASSIGNED. Pick the
      // assignment date in [purchaseDate, now] so a 30-day-old laptop
      // can't have a 200-day-old assignment.
      const assignedAt = dateBetween(ctx.fakers.org, purchaseDate, new Date());
      const unassignedAt =
        status === 'RETURNED'
          ? advanceCapped(assignedAt, ctx.fakers.org.number.int({ min: 14, max: 240 }))
          : null;
      assignmentRows.push({
        organizationId: ctx.organizationId,
        equipmentId,
        contractorId: contractor.id,
        assignedByUserId: ctx.ownerUserId,
        assignedAt,
        unassignedAt,
        unassignedByUserId: unassignedAt ? ctx.ownerUserId : null,
      });

      // Optional outbound shipment for non-AVAILABLE — shipment created
      // around assignment, event lands a few days later (carrier scan).
      if (status === 'IN_TRANSIT' || status === 'DELIVERED') {
        const shipStatus = status === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'DELIVERED';
        const shipmentCreatedAt = assignedAt;
        const eventOccurredAt = advanceCapped(
          shipmentCreatedAt,
          ctx.fakers.org.number.int({ min: 1, max: 5 }),
        );
        const shipmentId = randomUUID();
        shipmentRows.push({
          id: shipmentId,
          organizationId: ctx.organizationId,
          equipmentId,
          direction: 'OUTBOUND',
          carrier: ctx.fakers.org.helpers.arrayElement(['DHL', 'FedEx', 'InPost', 'UPS']),
          trackingNumber: tokenHex(8).toUpperCase(),
          currentStatus: shipStatus,
          createdByUserId: ctx.ownerUserId,
          createdAt: shipmentCreatedAt,
        });
        shipmentEventRows.push({
          organizationId: ctx.organizationId,
          shipmentId,
          status: shipStatus,
          occurredAt: eventOccurredAt,
          createdByUserId: ctx.ownerUserId,
          createdAt: eventOccurredAt,
        });
      }

      // Return request lifecycle — request filed AFTER assignment, approved
      // a few days after that.
      if (status === 'RETURN_REQUESTED' || status === 'RETURNED') {
        const returnStatus =
          status === 'RETURN_REQUESTED' ? 'PENDING_APPROVAL' : 'SHIPMENT_CREATED';
        const returnRequestedAt = advanceCapped(
          assignedAt,
          ctx.fakers.org.number.int({ min: 30, max: 365 }),
        );
        const returnApprovedAt =
          returnStatus === 'PENDING_APPROVAL'
            ? null
            : advanceCapped(returnRequestedAt, ctx.fakers.org.number.int({ min: 1, max: 7 }));
        returnRequestRows.push({
          organizationId: ctx.organizationId,
          contractorId: contractor.id,
          status: returnStatus,
          targetPointName: 'Warehouse',
          targetPointAddress: `${ctx.fakers.org.location.streetAddress()}, ${ctx.fakers.org.location.city()}`,
          approvedByUserId: returnStatus === 'PENDING_APPROVAL' ? null : ctx.ownerUserId,
          approvedAt: returnApprovedAt,
          createdAt: returnRequestedAt,
        });
      }
    }
  }

  // Wave inserts: parent Equipment → child EquipmentAssignment + Shipment +
  // ReturnRequest, then ShipmentEvent referencing Shipment.
  for (let i = 0; i < equipmentRows.length; i += 1000) {
    await prisma.equipment.createMany({
      data: equipmentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < assignmentRows.length; i += 1000) {
    await prisma.equipmentAssignment.createMany({
      data: assignmentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < shipmentRows.length; i += 1000) {
    await prisma.shipment.createMany({
      data: shipmentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < shipmentEventRows.length; i += 1000) {
    await prisma.shipmentEvent.createMany({
      data: shipmentEventRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < returnRequestRows.length; i += 1000) {
    await prisma.returnRequest.createMany({
      data: returnRequestRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

const AUDIT_ACTIONS_BY_TYPE: Readonly<Record<EntityRefType, readonly string[]>> = {
  INVOICE: ['invoice.create', 'invoice.approve', 'invoice.reject', 'invoice.update'],
  CONTRACTOR: ['contractor.create', 'contractor.update', 'contractor.archive'],
  CONTRACT: ['contract.create', 'contract.sign', 'contract.terminate'],
  EQUIPMENT: ['equipment.create', 'equipment.assign', 'equipment.retire'],
  PAYMENT_RUN: ['payment_run.create', 'payment_run.lock', 'payment_run.complete'],
};

/**
 * Returns a (oldValues, newValues) pair appropriate for the action — the
 * "diff" panel of an audit-log row used to be empty because both fields were
 * null. Now you see what actually changed.
 *
 * Typed as `Prisma.InputJsonValue` so `createMany` accepts it directly.
 */
function makeAuditDiff(
  action: string,
  faker: Faker,
): {
  oldValuesJson: Prisma.InputJsonValue | null;
  newValuesJson: Prisma.InputJsonValue | null;
} {
  switch (action) {
    case 'invoice.create':
      return {
        oldValuesJson: null,
        newValuesJson: { status: 'RECEIVED', source: 'EMAIL_INTAKE' },
      };
    case 'invoice.approve':
      return {
        oldValuesJson: { status: 'APPROVAL_PENDING', approvalStatus: 'PENDING' },
        newValuesJson: { status: 'APPROVED', approvalStatus: 'APPROVED' },
      };
    case 'invoice.reject':
      return {
        oldValuesJson: { status: 'APPROVAL_PENDING', approvalStatus: 'PENDING' },
        newValuesJson: { status: 'REJECTED', approvalStatus: 'REJECTED' },
      };
    case 'invoice.update':
      return {
        oldValuesJson: { dueDate: '2026-04-30' },
        newValuesJson: { dueDate: '2026-05-15' },
      };
    case 'contractor.create':
      return {
        oldValuesJson: null,
        newValuesJson: { status: 'ACTIVE', lifecycleStage: 'ONBOARDING' },
      };
    case 'contractor.update': {
      const newPhone = faker.phone.number();
      return {
        oldValuesJson: { phone: faker.phone.number() },
        newValuesJson: { phone: newPhone },
      };
    }
    case 'contractor.archive':
      return {
        oldValuesJson: { status: 'INACTIVE' },
        newValuesJson: { status: 'ARCHIVED', archivedAt: new Date().toISOString() },
      };
    case 'contract.create':
      return {
        oldValuesJson: null,
        newValuesJson: { status: 'DRAFT' },
      };
    case 'contract.sign':
      return {
        oldValuesJson: { status: 'PENDING_SIGNATURE', signedAt: null },
        newValuesJson: { status: 'ACTIVE', signedAt: new Date().toISOString() },
      };
    case 'contract.terminate':
      return {
        oldValuesJson: { status: 'ACTIVE' },
        newValuesJson: { status: 'TERMINATED', terminatedAt: new Date().toISOString() },
      };
    case 'equipment.create':
      return {
        oldValuesJson: null,
        newValuesJson: { status: 'AVAILABLE' },
      };
    case 'equipment.assign':
      return {
        oldValuesJson: { status: 'AVAILABLE' },
        newValuesJson: { status: 'ASSIGNED' },
      };
    case 'equipment.retire':
      return {
        oldValuesJson: { status: 'RETURNED' },
        newValuesJson: { status: 'RETIRED' },
      };
    case 'payment_run.create':
      return {
        oldValuesJson: null,
        newValuesJson: { status: 'DRAFT' },
      };
    case 'payment_run.lock':
      return {
        oldValuesJson: { status: 'DRAFT' },
        newValuesJson: { status: 'LOCKED' },
      };
    case 'payment_run.complete':
      return {
        oldValuesJson: { status: 'EXPORTED' },
        newValuesJson: { status: 'COMPLETED', completedAt: new Date().toISOString() },
      };
    default:
      return { oldValuesJson: null, newValuesJson: null };
  }
}

async function seedAuditLogs(
  prisma: PrismaClient,
  ctx: OrgSeed,
  refs: readonly EntityRef[],
): Promise<void> {
  if (ctx.org.auditLogsPerOrg === 0) return;
  if (refs.length === 0) return;
  const rows = Array.from({ length: ctx.org.auditLogsPerOrg }, () => {
    const ref = ctx.fakers.org.helpers.arrayElement(refs);
    const actions = AUDIT_ACTIONS_BY_TYPE[ref.type];
    const action = ctx.fakers.org.helpers.arrayElement(actions);
    const actor = ctx.fakers.org.helpers.arrayElement(ctx.users);
    const diff = makeAuditDiff(action, ctx.fakers.org);
    return {
      id: newId(),
      organizationId: ctx.organizationId,
      actorType: 'USER' as const,
      actorId: actor.id,
      actorName: actor.name,
      action,
      resourceType: ref.type,
      resourceId: ref.id,
      resourceName: ref.name,
      // Prisma's nullable-JSON columns reject raw `null`; use Prisma.DbNull.
      oldValuesJson: diff.oldValuesJson ?? Prisma.DbNull,
      newValuesJson: diff.newValuesJson ?? Prisma.DbNull,
      ipAddress: '127.0.0.1',
      userAgent: 'seed-dev',
      // Audit log timestamp is bounded by the entity's creation date —
      // previously logs could pre-date the entity ("invoice.create at
      // 2024-01-01" for an invoice created 2025-06-01).
      createdAt: dateBetween(ctx.fakers.org, ref.createdAt, new Date()),
    };
  });
  // AuditLog row sets ~15 columns. 5_000 × 15 ≈ 75k bind parameters, over
  // Postgres' 65535 ceiling — drop the chunk to 4_000 (60k params).
  for (let i = 0; i < rows.length; i += 4_000) {
    await prisma.auditLog.createMany({ data: rows.slice(i, i + 4_000) });
  }
}

// ---------------------------------------------------------------------------
// E-invoice lifecycle (DE/PL only)
// ---------------------------------------------------------------------------

async function seedEInvoiceLifecycle(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
): Promise<void> {
  if (!['DE', 'PL'].includes(ctx.profile.countryCode)) return;
  if (invoices.length === 0) return;

  // Cap to 100 invoices to keep the e-invoice tables manageable on huge profile
  const subset = invoices.slice(0, Math.min(100, invoices.length));
  const lifecycleRows: Prisma.EInvoiceLifecycleCreateManyInput[] = [];
  const eventRows: Prisma.EInvoiceLifecycleEventCreateManyInput[] = [];
  for (const inv of subset) {
    if (inv.status === 'RECEIVED' || inv.status === 'REJECTED' || inv.status === 'VOID') continue;
    const validationStatus = weightedPick<'NOT_VALIDATED' | 'VALID' | 'INVALID' | 'WARNINGS'>(
      ctx.fakers.org,
      [
        ['NOT_VALIDATED', 1],
        ['VALID', 6],
        ['INVALID', 1],
        ['WARNINGS', 2],
      ],
    );
    const transmissionStatus = weightedPick<
      'NOT_SENT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED'
    >(ctx.fakers.org, [
      ['NOT_SENT', 1],
      ['QUEUED', 1],
      ['SENT', 2],
      ['DELIVERED', 5],
      ['FAILED', 1],
    ]);

    // E-invoice timeline is anchored on the invoice's approval moment:
    // GENERATED → VALIDATED → TRANSMITTED → DELIVERY_ACK, each step a
    // small advance over the previous so the lifecycle timeline reads
    // monotonically.
    const generatedAt = inv.approvedAt ?? inv.receivedAt;
    const validatedAt = advanceCapped(generatedAt, ctx.fakers.org.number.int({ min: 0, max: 1 }));
    // QUEUED is "accepted by the relay but not yet handed to the network" —
    // by definition transmittedAt is null. NOT_SENT is the same.
    const transmittedAt =
      transmissionStatus === 'NOT_SENT' || transmissionStatus === 'QUEUED'
        ? null
        : advanceCapped(validatedAt, ctx.fakers.org.number.int({ min: 0, max: 2 }));
    const deliveredAt =
      transmissionStatus === 'DELIVERED' && transmittedAt
        ? advanceCapped(transmittedAt, ctx.fakers.org.number.int({ min: 0, max: 2 }))
        : null;

    const lifecycleId = randomUUID();
    lifecycleRows.push({
      id: lifecycleId,
      organizationId: ctx.organizationId,
      invoiceId: inv.id,
      profileId: ctx.profile.countryCode === 'DE' ? 'xrechnung-de' : 'peppol-eu',
      validationStatus,
      validatedAt: validationStatus === 'NOT_VALIDATED' ? null : validatedAt,
      validationReportSummary:
        validationStatus === 'NOT_VALIDATED'
          ? Prisma.JsonNull
          : { errors: validationStatus === 'INVALID' ? 1 : 0, warnings: 0 },
      transmissionStatus,
      transmittedAt,
      deliveredAt,
      createdAt: generatedAt,
    });

    // Lifecycle events emit in lockstep with the lifecycle row.
    eventRows.push({
      organizationId: ctx.organizationId,
      lifecycleId,
      eventType: 'GENERATED',
      occurredAt: generatedAt,
    });
    if (validationStatus !== 'NOT_VALIDATED') {
      eventRows.push({
        organizationId: ctx.organizationId,
        lifecycleId,
        eventType: 'VALIDATED',
        occurredAt: validatedAt,
      });
    }
    if (transmittedAt) {
      eventRows.push({
        organizationId: ctx.organizationId,
        lifecycleId,
        eventType: 'TRANSMITTED',
        occurredAt: transmittedAt,
      });
    }
    if (deliveredAt) {
      eventRows.push({
        organizationId: ctx.organizationId,
        lifecycleId,
        eventType: 'DELIVERY_ACK',
        occurredAt: deliveredAt,
      });
    }
  }
  for (let i = 0; i < lifecycleRows.length; i += 1000) {
    await prisma.eInvoiceLifecycle.createMany({
      data: lifecycleRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < eventRows.length; i += 1000) {
    await prisma.eInvoiceLifecycleEvent.createMany({
      data: eventRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Portal sessions (live + expired)
// ---------------------------------------------------------------------------

async function seedPortalSessions(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
): Promise<void> {
  if (contractors.length === 0) return;
  // Half the sample are currently logged in (live session); the other half
  // are old expired sessions. Email matches the contractor's own email so
  // the audit panel and contractor profile reconcile.
  const sample = contractors.slice(0, Math.min(5, contractors.length));
  const rows: Prisma.PortalSessionCreateManyInput[] = [];
  for (const [i, c] of sample.entries()) {
    const isLive = i % 2 === 0;
    rows.push({
      token: tokenHex(32),
      contractorId: c.id,
      organizationId: ctx.organizationId,
      email: c.email,
      expiresAt: isLive ? futureDate(ctx.fakers.org, 30) : pastDate(ctx.fakers.org, 30),
      ipAddress: '127.0.0.1',
      userAgent: 'seed-dev portal',
    });
  }
  if (rows.length > 0) {
    await prisma.portalSession.createMany({ data: rows, skipDuplicates: true });
  }
}

// ---------------------------------------------------------------------------
// Integration connections — populates the Settings → Integrations page so it
// isn't empty even on small/showcase profiles.
// ---------------------------------------------------------------------------

const INTEGRATION_PROVIDERS_FOR_SEED: ReadonlyArray<
  'SLACK' | 'GOOGLE_WORKSPACE' | 'JIRA' | 'LINEAR' | 'DOCUSIGN'
> = ['SLACK', 'GOOGLE_WORKSPACE', 'JIRA', 'LINEAR', 'DOCUSIGN'];

async function seedIntegrationConnections(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  if (ctx.org.contractorsPerOrg === 0) return;
  const count = ctx.org.showcase ? INTEGRATION_PROVIDERS_FOR_SEED.length : 2;
  for (let i = 0; i < count; i += 1) {
    const provider = INTEGRATION_PROVIDERS_FOR_SEED[i] ?? 'SLACK';
    // Showcase: cover every IntegrationStatus enum value at least once.
    const status = ctx.org.showcase
      ? (['CONNECTED', 'DISCONNECTED', 'ERROR', 'REAUTH_REQUIRED', 'PENDING_MAPPING'] as const)[
          i % 5
        ]
      : weightedPick<'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'REAUTH_REQUIRED'>(ctx.fakers.org, [
          ['CONNECTED', 6],
          ['REAUTH_REQUIRED', 1],
          ['ERROR', 1],
          ['DISCONNECTED', 2],
        ]);
    // Anchor connectedAt to the org's lifespan, then chain follow-up
    // timestamps to AT-OR-AFTER connectedAt. Previously a fresh connection
    // could show "last synced 5 days ago" while connectedAt was today.
    const connectedAt = pastDateAfter(ctx.fakers.org, 180, ctx.foundedAt);
    const lastSyncAt =
      status === 'CONNECTED' ? pastDateAfter(ctx.fakers.org, 7, connectedAt) : null;
    const lastErrorAt = status === 'ERROR' ? pastDateAfter(ctx.fakers.org, 30, connectedAt) : null;
    await prisma.integrationConnection.create({
      data: {
        organizationId: ctx.organizationId,
        provider,
        status,
        displayName: `${provider} (seed)`,
        configJson: { seeded: true },
        // credentialsRef points at a secret-store key. In-memory MemoryStore
        // is the local-dev fallback (see packages/secrets) so a fake ref is
        // OK — no actual secret is fetched.
        credentialsRef: `seed:${ctx.org.key}:${provider}:${tokenHex(4)}`,
        connectedByUserId: ctx.ownerUserId,
        connectedAt,
        lastSyncAt,
        lastSuccessAt: lastSyncAt,
        lastErrorAt,
        lastErrorMessage: status === 'ERROR' ? 'simulated upstream 500 (seed)' : null,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Documents + InvoiceFiles — gives a subset of invoices an "attachment".
// ---------------------------------------------------------------------------

async function seedInvoiceDocuments(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
): Promise<void> {
  if (invoices.length === 0) return;
  // Cap the number of attachments — 10 on showcase, 1 in 5 invoices on small,
  // skip on huge (the UI doesn't need 10k document rows for testing).
  const cap = ctx.org.showcase ? 10 : Math.min(20, Math.ceil(invoices.length / 5));
  const subset = invoices.slice(0, cap);

  const documentRows: Prisma.DocumentCreateManyInput[] = [];
  const invoiceFileRows: Prisma.InvoiceFileCreateManyInput[] = [];
  for (const inv of subset) {
    const documentId = newId();
    // Document was uploaded around when the invoice was received. A few
    // hours of jitter so list views show realistic timestamps.
    const uploadedAt = new Date(
      inv.receivedAt.getTime() + ctx.fakers.org.number.int({ min: 0, max: 4 * 3_600_000 }),
    );
    documentRows.push({
      id: documentId,
      organizationId: ctx.organizationId,
      // No actual blob in object storage — storageKey points at a fake path.
      // The UI's download route will 404 against R2, which is acceptable in
      // dev (use the document metadata view instead).
      storageKey: `seed/${ctx.org.key}/${documentId}.pdf`,
      originalFileName: `invoice-${tokenHex(2)}.pdf`,
      mimeType: 'application/pdf',
      fileSizeBytes: BigInt(ctx.fakers.org.number.int({ min: 50_000, max: 5_000_000 })),
      checksumSha256: tokenHex(32),
      documentType: 'INVOICE',
      status: 'ACTIVE',
      visibility: 'PRIVATE',
      uploadedByUserId: ctx.ownerUserId,
      source: 'USER_UPLOAD',
      virusScanStatus: 'CLEAN',
      createdAt: uploadedAt,
    });
    invoiceFileRows.push({
      organizationId: ctx.organizationId,
      invoiceId: inv.id,
      documentId,
      role: 'SOURCE_ORIGINAL',
      createdAt: uploadedAt,
    });
  }
  for (let i = 0; i < documentRows.length; i += 1000) {
    await prisma.document.createMany({
      data: documentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < invoiceFileRows.length; i += 1000) {
    await prisma.invoiceFile.createMany({
      data: invoiceFileRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Workflow role + task templates — minimal inline seeds (the production
// `OFFBOARDING_TEMPLATE_SEEDS` lives in `@contractor-ops/offboarding-templates`
// which depends on this package; importing it here would cycle).
// ---------------------------------------------------------------------------

interface MiniRoleSeed {
  role: string;
  displayNameEn: string;
  displayNamePl: string;
  displayNameDe: string;
  tasks: ReadonlyArray<{ titleEn: string; descriptionEn: string; dueDayOffset: number }>;
}

// Canonical hardcoded WorkflowTemplate set — covers every WorkflowTemplateType
// enum value (ONBOARDING, OFFBOARDING, DOCUMENT_COLLECTION, COMPLIANCE_REVIEW)
// plus two CUSTOM workflows so the templates list is materially populated and
// `WorkflowRun` seeding has real templates to reference.
type WorkflowTemplateTypeKey =
  | 'ONBOARDING'
  | 'OFFBOARDING'
  | 'DOCUMENT_COLLECTION'
  | 'COMPLIANCE_REVIEW'
  | 'CUSTOM';
type WorkflowTaskTypeKey =
  | 'DOCUMENT_COLLECTION'
  | 'APPROVAL'
  | 'ACCESS_GRANT'
  | 'ACCESS_REVOKE'
  | 'FINANCE_SETUP'
  | 'EQUIPMENT'
  | 'KNOWLEDGE_TRANSFER'
  | 'MEETING'
  | 'MANUAL'
  | 'NOTIFICATION'
  | 'IP_VERIFICATION'
  | 'CONTRACT_HEALTH_CHECK';
type AssigneeModeKey =
  | 'FIXED_USER'
  | 'ROLE_BASED'
  | 'CONTRACTOR_OWNER'
  | 'CONTRACT_OWNER'
  | 'PROJECT_MANAGER';
type WorkflowUserRoleKey =
  | 'admin'
  | 'finance_admin'
  | 'ops_manager'
  | 'team_manager'
  | 'legal_compliance_viewer'
  | 'it_admin'
  | 'external_accountant'
  | 'readonly';
type EntityTypeKey = 'CONTRACTOR' | 'CONTRACT';

interface SeedTaskDef {
  title: string;
  description: string;
  taskType: WorkflowTaskTypeKey;
  assigneeMode: AssigneeModeKey;
  assigneeRole?: WorkflowUserRoleKey;
  required: boolean;
  dueOffsetDays: number;
  /** 0-based index into the same template's `tasks` array. */
  dependsOnIndex?: number;
}

interface WorkflowTemplateSeed {
  type: WorkflowTemplateTypeKey;
  name: string;
  description: string;
  appliesToEntityType: EntityTypeKey;
  tasks: readonly SeedTaskDef[];
}

const WORKFLOW_TEMPLATE_SEEDS: readonly WorkflowTemplateSeed[] = [
  {
    type: 'ONBOARDING',
    name: 'Standard Onboarding',
    description: 'Default onboarding workflow for new contractors.',
    appliesToEntityType: 'CONTRACTOR',
    tasks: [
      {
        title: 'Collect signed master agreement',
        description: 'Upload the executed master service agreement.',
        taskType: 'DOCUMENT_COLLECTION',
        assigneeMode: 'CONTRACTOR_OWNER',
        required: true,
        dueOffsetDays: 1,
      },
      {
        title: 'Verify tax identification',
        description: 'Validate VAT / tax ID against authority registry.',
        taskType: 'DOCUMENT_COLLECTION',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'finance_admin',
        required: true,
        dueOffsetDays: 2,
        dependsOnIndex: 0,
      },
      {
        title: 'Provision SaaS access',
        description: 'Grant access to Slack, Notion, GitHub.',
        taskType: 'ACCESS_GRANT',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'it_admin',
        required: true,
        dueOffsetDays: 3,
      },
      {
        title: 'Equipment shipment',
        description: 'Ship laptop + peripherals to contractor.',
        taskType: 'EQUIPMENT',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'ops_manager',
        required: false,
        dueOffsetDays: 5,
      },
      {
        title: 'Welcome 1:1',
        description: 'Schedule 30-min welcome with manager.',
        taskType: 'MEETING',
        assigneeMode: 'CONTRACTOR_OWNER',
        required: false,
        dueOffsetDays: 5,
      },
      {
        title: 'Send welcome notification',
        description: 'Trigger welcome email + Slack DM.',
        taskType: 'NOTIFICATION',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'team_manager',
        required: true,
        dueOffsetDays: 5,
      },
      {
        title: 'Initial finance setup',
        description: 'Configure billing profile + payment terms.',
        taskType: 'FINANCE_SETUP',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'finance_admin',
        required: true,
        dueOffsetDays: 7,
      },
    ],
  },
  {
    type: 'OFFBOARDING',
    name: 'Standard Offboarding',
    description: 'Wind-down workflow at end of engagement.',
    appliesToEntityType: 'CONTRACTOR',
    tasks: [
      {
        title: 'Knowledge transfer brief',
        description: 'Document ongoing initiatives + handover doc.',
        taskType: 'KNOWLEDGE_TRANSFER',
        assigneeMode: 'CONTRACTOR_OWNER',
        required: true,
        dueOffsetDays: 1,
      },
      {
        title: 'Submit final invoice',
        description: 'Closing invoice including unbilled time.',
        taskType: 'DOCUMENT_COLLECTION',
        assigneeMode: 'CONTRACTOR_OWNER',
        required: true,
        dueOffsetDays: 3,
        dependsOnIndex: 0,
      },
      {
        title: 'IP verification',
        description: 'Confirm no IP retained off-platform.',
        taskType: 'IP_VERIFICATION',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'legal_compliance_viewer',
        required: true,
        dueOffsetDays: 5,
      },
      {
        title: 'Equipment return',
        description: 'Initiate return shipment for company equipment.',
        taskType: 'EQUIPMENT',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'ops_manager',
        required: true,
        dueOffsetDays: 7,
      },
      {
        title: 'Revoke SaaS access',
        description: 'Disable Slack, GitHub, Notion accounts.',
        taskType: 'ACCESS_REVOKE',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'it_admin',
        required: true,
        dueOffsetDays: 10,
      },
      {
        title: 'Final retro',
        description: 'Manager 1:1 + lessons learned writeup.',
        taskType: 'MEETING',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'team_manager',
        required: false,
        dueOffsetDays: 12,
      },
    ],
  },
  {
    type: 'DOCUMENT_COLLECTION',
    name: 'Document Collection',
    description: 'Periodic compliance documents refresh.',
    appliesToEntityType: 'CONTRACTOR',
    tasks: [
      {
        title: 'Upload latest insurance',
        description: 'Professional liability insurance certificate.',
        taskType: 'DOCUMENT_COLLECTION',
        assigneeMode: 'CONTRACTOR_OWNER',
        required: true,
        dueOffsetDays: 7,
      },
      {
        title: 'Upload tax certificate',
        description: 'Annual tax-residency certificate.',
        taskType: 'DOCUMENT_COLLECTION',
        assigneeMode: 'CONTRACTOR_OWNER',
        required: true,
        dueOffsetDays: 14,
      },
      {
        title: 'Compliance reviewer approval',
        description: 'Confirm uploaded documents pass review.',
        taskType: 'APPROVAL',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'legal_compliance_viewer',
        required: true,
        dueOffsetDays: 21,
        dependsOnIndex: 1,
      },
      {
        title: 'Notify contractor of completion',
        description: 'Send confirmation email.',
        taskType: 'NOTIFICATION',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'team_manager',
        required: true,
        dueOffsetDays: 22,
        dependsOnIndex: 2,
      },
      {
        title: 'Archive prior versions',
        description: 'Move superseded files to archive.',
        taskType: 'MANUAL',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'ops_manager',
        required: false,
        dueOffsetDays: 30,
      },
    ],
  },
  {
    type: 'COMPLIANCE_REVIEW',
    name: 'Compliance Review',
    description: 'Quarterly compliance audit per contractor.',
    appliesToEntityType: 'CONTRACTOR',
    tasks: [
      {
        title: 'Pull contractor file',
        description: 'Gather contracts, invoices, certifications.',
        taskType: 'DOCUMENT_COLLECTION',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'legal_compliance_viewer',
        required: true,
        dueOffsetDays: 1,
      },
      {
        title: 'Risk classification check',
        description: 'Re-run classification against current criteria.',
        taskType: 'APPROVAL',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'legal_compliance_viewer',
        required: true,
        dueOffsetDays: 5,
        dependsOnIndex: 0,
      },
      {
        title: 'Economic-dependency review',
        description: 'Validate exposure thresholds.',
        taskType: 'APPROVAL',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'finance_admin',
        required: true,
        dueOffsetDays: 7,
      },
      {
        title: 'Reviewer sign-off',
        description: 'Compliance lead approval.',
        taskType: 'APPROVAL',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'admin',
        required: true,
        dueOffsetDays: 10,
        dependsOnIndex: 2,
      },
      {
        title: 'Archive review packet',
        description: 'Store review packet for audit trail.',
        taskType: 'MANUAL',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'ops_manager',
        required: false,
        dueOffsetDays: 14,
      },
    ],
  },
  {
    type: 'CUSTOM',
    name: 'Contract Renewal',
    description: 'Workflow for renewing an expiring contract.',
    appliesToEntityType: 'CONTRACT',
    tasks: [
      {
        title: 'Notify contract owner of renewal window',
        description: 'Send 60-day pre-expiry notification.',
        taskType: 'NOTIFICATION',
        assigneeMode: 'CONTRACT_OWNER',
        required: true,
        dueOffsetDays: 1,
      },
      {
        title: 'Health check on current contract',
        description: 'Surface SLA misses + economic-dependency risk.',
        taskType: 'CONTRACT_HEALTH_CHECK',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'finance_admin',
        required: true,
        dueOffsetDays: 3,
      },
      {
        title: 'Negotiate revised terms',
        description: 'Iterate scope + rate with contractor.',
        taskType: 'MEETING',
        assigneeMode: 'CONTRACT_OWNER',
        required: true,
        dueOffsetDays: 14,
        dependsOnIndex: 1,
      },
      {
        title: 'Legal sign-off on amendment',
        description: 'Compliance approves amendment language.',
        taskType: 'APPROVAL',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'legal_compliance_viewer',
        required: true,
        dueOffsetDays: 21,
        dependsOnIndex: 2,
      },
      {
        title: 'Counter-signed amendment uploaded',
        description: 'Final executed addendum on file.',
        taskType: 'DOCUMENT_COLLECTION',
        assigneeMode: 'CONTRACT_OWNER',
        required: true,
        dueOffsetDays: 28,
      },
    ],
  },
  {
    type: 'CUSTOM',
    name: 'Project Engagement Kickoff',
    description: 'Project-side kickoff for newly assigned contractor.',
    appliesToEntityType: 'CONTRACTOR',
    tasks: [
      {
        title: 'Project access provisioning',
        description: 'Grant project repo + tracker access.',
        taskType: 'ACCESS_GRANT',
        assigneeMode: 'PROJECT_MANAGER',
        required: true,
        dueOffsetDays: 1,
      },
      {
        title: 'Stakeholder intro session',
        description: 'Introduce contractor to core stakeholders.',
        taskType: 'MEETING',
        assigneeMode: 'PROJECT_MANAGER',
        required: true,
        dueOffsetDays: 3,
        dependsOnIndex: 0,
      },
      {
        title: 'Project-context document pack',
        description: 'Share architecture + product brief.',
        taskType: 'DOCUMENT_COLLECTION',
        assigneeMode: 'PROJECT_MANAGER',
        required: false,
        dueOffsetDays: 5,
      },
      {
        title: 'First-week check-in',
        description: 'Confirm onboarding momentum.',
        taskType: 'MEETING',
        assigneeMode: 'PROJECT_MANAGER',
        required: true,
        dueOffsetDays: 7,
        dependsOnIndex: 1,
      },
      {
        title: 'Delivery cadence agreement',
        description: 'Confirm sprint / standup cadence.',
        taskType: 'APPROVAL',
        assigneeMode: 'PROJECT_MANAGER',
        required: false,
        dueOffsetDays: 10,
      },
    ],
  },
];

const WORKFLOW_ROLE_SEEDS: readonly MiniRoleSeed[] = [
  {
    role: 'software_engineer',
    displayNameEn: 'Software Engineer',
    displayNamePl: 'Inżynier oprogramowania',
    displayNameDe: 'Softwareentwickler',
    tasks: [
      {
        titleEn: 'Hand over runbooks',
        descriptionEn: 'Document deployments + on-call',
        dueDayOffset: 1,
      },
      {
        titleEn: 'Close open PRs',
        descriptionEn: 'Merge or hand off pending PRs',
        dueDayOffset: 3,
      },
      {
        titleEn: 'Architecture brief',
        descriptionEn: 'Whiteboard system overview',
        dueDayOffset: 5,
      },
      {
        titleEn: 'Known issues list',
        descriptionEn: 'Outstanding bugs + workarounds',
        dueDayOffset: 5,
      },
      { titleEn: 'Access revocation', descriptionEn: 'Remove from prod systems', dueDayOffset: 10 },
      { titleEn: 'Final retro', descriptionEn: 'Manager 1:1 + lessons learned', dueDayOffset: 12 },
    ],
  },
  {
    role: 'designer',
    displayNameEn: 'Designer',
    displayNamePl: 'Projektant',
    displayNameDe: 'Designer',
    tasks: [
      { titleEn: 'Source files handoff', descriptionEn: 'Figma libs + assets', dueDayOffset: 2 },
      {
        titleEn: 'Brand guidelines update',
        descriptionEn: 'Capture in-flight changes',
        dueDayOffset: 4,
      },
      {
        titleEn: 'Component library audit',
        descriptionEn: 'Mark deprecated tokens',
        dueDayOffset: 6,
      },
      { titleEn: 'Stakeholder intro', descriptionEn: 'Introduce successor', dueDayOffset: 8 },
      { titleEn: 'Access revocation', descriptionEn: 'Remove Figma access', dueDayOffset: 10 },
      {
        titleEn: 'Portfolio sign-off',
        descriptionEn: 'Approve for portfolio use',
        dueDayOffset: 12,
      },
    ],
  },
  {
    role: 'project_manager',
    displayNameEn: 'Project Manager',
    displayNamePl: 'Kierownik projektu',
    displayNameDe: 'Projektmanager',
    tasks: [
      {
        titleEn: 'Roadmap handoff',
        descriptionEn: 'Active + upcoming initiatives',
        dueDayOffset: 1,
      },
      { titleEn: 'Stakeholder map', descriptionEn: 'Key contacts + cadence', dueDayOffset: 3 },
      {
        titleEn: 'Risk register',
        descriptionEn: 'Outstanding risks + mitigations',
        dueDayOffset: 5,
      },
      { titleEn: 'Vendor contracts', descriptionEn: 'Renewal dates + owners', dueDayOffset: 7 },
      {
        titleEn: 'Tool ownership transfer',
        descriptionEn: 'Linear / Jira admin handoff',
        dueDayOffset: 9,
      },
      {
        titleEn: 'Final exec brief',
        descriptionEn: 'Status report to leadership',
        dueDayOffset: 12,
      },
    ],
  },
  {
    role: 'generic_consultant',
    displayNameEn: 'Generic Consultant',
    displayNamePl: 'Konsultant ogólny',
    displayNameDe: 'Allgemeiner Berater',
    tasks: [
      { titleEn: 'Deliverable index', descriptionEn: 'List artefacts produced', dueDayOffset: 1 },
      { titleEn: 'Contact directory', descriptionEn: 'Stakeholders + vendors', dueDayOffset: 3 },
      { titleEn: 'Knowledge base', descriptionEn: 'Wiki / docs handover', dueDayOffset: 5 },
      { titleEn: 'Final invoice', descriptionEn: 'Submit closing invoice', dueDayOffset: 8 },
      { titleEn: 'Access revocation', descriptionEn: 'Remove from systems', dueDayOffset: 10 },
      {
        titleEn: 'Reference statement',
        descriptionEn: 'Confirm client reference',
        dueDayOffset: 12,
      },
    ],
  },
];

async function seedWorkflowTemplates(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  if (ctx.org.contractorsPerOrg === 0) return;

  // -------------------------------------------------------------------
  // WorkflowRoleTemplate / WorkflowRoleTaskTemplate (Phase 74 D-04 path)
  // -------------------------------------------------------------------
  const roleRows: Prisma.WorkflowRoleTemplateCreateManyInput[] = [];
  const roleTaskRows: Prisma.WorkflowRoleTaskTemplateCreateManyInput[] = [];
  for (const seed of WORKFLOW_ROLE_SEEDS) {
    const roleId = randomUUID();
    roleRows.push({
      id: roleId,
      organizationId: ctx.organizationId,
      role: seed.role,
      displayNameEn: seed.displayNameEn,
      displayNamePl: seed.displayNamePl,
      displayNameDe: seed.displayNameDe,
      isSeed: true,
      // Templates are typically materialised at org boot — anchor to
      // foundedAt so a 2-year-old org doesn't show templates "created
      // today".
      createdAt: ctx.foundedAt,
    });
    for (const [idx, t] of seed.tasks.entries()) {
      roleTaskRows.push({
        organizationId: ctx.organizationId,
        workflowRoleTemplateId: roleId,
        sortOrder: idx,
        titleEn: t.titleEn,
        descriptionEn: t.descriptionEn,
        dueDayOffset: t.dueDayOffset,
        createdAt: ctx.foundedAt,
      });
    }
  }
  for (let i = 0; i < roleRows.length; i += 1000) {
    await prisma.workflowRoleTemplate.createMany({
      data: roleRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < roleTaskRows.length; i += 1000) {
    await prisma.workflowRoleTaskTemplate.createMany({
      data: roleTaskRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------
  // WorkflowTemplate / WorkflowTaskTemplate (modern workflow runner path —
  // these rows are what `seedWorkflowRuns` references, and what the
  // Workflow Templates UI list reads).
  // -------------------------------------------------------------------
  // Single-pass insert: pre-compute task ids so the dependsOnTaskTemplateId
  // backfill happens inline (no follow-up update).
  const templateRows: Prisma.WorkflowTemplateCreateManyInput[] = [];
  const taskTemplateRows: Prisma.WorkflowTaskTemplateCreateManyInput[] = [];
  for (const seed of WORKFLOW_TEMPLATE_SEEDS) {
    const templateId = randomUUID();
    templateRows.push({
      id: templateId,
      organizationId: ctx.organizationId,
      name: seed.name,
      type: seed.type,
      description: seed.description,
      version: 1,
      status: 'ACTIVE',
      appliesToEntityType: seed.appliesToEntityType,
      createdByUserId: ctx.ownerUserId,
      createdAt: ctx.foundedAt,
    });
    const taskIdsBySortOrder: string[] = seed.tasks.map(() => randomUUID());
    for (const [idx, taskDef] of seed.tasks.entries()) {
      const taskId = taskIdsBySortOrder[idx] as string;
      const dependsOnIndex = taskDef.dependsOnIndex;
      const dependsOnId =
        dependsOnIndex !== undefined && dependsOnIndex !== idx
          ? (taskIdsBySortOrder[dependsOnIndex] ?? null)
          : null;
      taskTemplateRows.push({
        id: taskId,
        organizationId: ctx.organizationId,
        workflowTemplateId: templateId,
        title: taskDef.title,
        description: taskDef.description,
        taskType: taskDef.taskType,
        sortOrder: idx,
        required: taskDef.required,
        assigneeMode: taskDef.assigneeMode,
        assigneeRole: taskDef.assigneeRole ?? null,
        dueOffsetDays: taskDef.dueOffsetDays,
        dependsOnTaskTemplateId: dependsOnId,
        createdAt: ctx.foundedAt,
      });
    }
  }
  for (let i = 0; i < templateRows.length; i += 1000) {
    await prisma.workflowTemplate.createMany({
      data: templateRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < taskTemplateRows.length; i += 1000) {
    await prisma.workflowTaskTemplate.createMany({
      data: taskTemplateRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Subscription — Settings → Billing page wants a row.
// ---------------------------------------------------------------------------

async function seedSubscription(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  // Showcase cycles through tiers/statuses; everyone else gets a healthy
  // ACTIVE PRO so the billing page renders. The QA-walk default org is a
  // showcase template but must NOT roll PAST_DUE / CANCELED — those states
  // overlay the dashboard with a banner / soft-block modal and obscure
  // every other widget for screenshot capture. PAST_DUE / CANCELED states
  // belong to dedicated walk routes, not the default target.
  const isQaDefault = ctx.org.key === 'qa-default-org';
  const tier = ctx.org.showcase
    ? ctx.fakers.org.helpers.arrayElement(['STARTER', 'PRO', 'ENTERPRISE'] as const)
    : 'PRO';
  const status = isQaDefault
    ? 'ACTIVE'
    : ctx.org.showcase
      ? ctx.fakers.org.helpers.arrayElement(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'] as const)
      : 'ACTIVE';
  // For ACTIVE / TRIALING / PAST_DUE the period must end in the future. For
  // CANCELED we leave the period ended in the recent past. periodStart
  // clamps to foundedAt so a 5-day-old org doesn't claim a 25-day-old
  // subscription period.
  const periodStart = pastDateAfter(ctx.fakers.org, 25, ctx.foundedAt);
  const periodEnd =
    status === 'CANCELED'
      ? new Date(Date.now() - ctx.fakers.org.number.int({ min: 1, max: 5 }) * 86_400_000)
      : new Date(Date.now() + ctx.fakers.org.number.int({ min: 5, max: 30 }) * 86_400_000);
  await prisma.subscription.create({
    data: {
      organizationId: ctx.organizationId,
      stripeCustomerId: `cus_${tokenHex(8)}`,
      stripeSubscriptionId: `sub_${tokenHex(8)}`,
      tier,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      // Stripe convention at trial start: trialEnd === currentPeriodEnd.
      // Drifting them apart (independent rolls) reads weird in the billing UI.
      trialEnd: status === 'TRIALING' ? periodEnd : null,
      seatCount: Math.max(1, ctx.users.length),
      // Stripe semantics: `cancelAtPeriodEnd=true` means "scheduled to
      // cancel at the end of the current period". Only ACTIVE rows can
      // have it true (~10% — typical churn signal). Already-CANCELED has
      // it false (it's done, not scheduled).
      cancelAtPeriodEnd:
        status === 'ACTIVE' && ctx.fakers.org.datatype.boolean({ probability: 0.1 }),
      createdAt: ctx.foundedAt,
    },
  });

  // OCR credit ledger — one initial allocation row per ACTIVE-ish
  // subscription so the credits view isn't empty.
  if (status === 'ACTIVE' || status === 'TRIALING') {
    const creditsByTier: Record<typeof tier, number> = {
      STARTER: 100,
      PRO: 500,
      ENTERPRISE: 2_500,
    };
    await prisma.ocrCreditLedger.create({
      data: {
        organizationId: ctx.organizationId,
        credits: creditsByTier[tier],
        reason: 'subscription_period_grant',
        periodStart,
        periodEnd,
        createdAt: periodStart,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Courier configs — Settings → Couriers page wants a row per active carrier.
// ---------------------------------------------------------------------------

async function seedCourierConfigs(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  if (ctx.org.equipmentPerOrg === 0) return;
  // Region-appropriate carriers — InPost is PL-only, the others are common
  // across EU; for ME we use Aramex.
  const carriers =
    ctx.org.region === 'ME'
      ? (['Aramex', 'DHL'] as const)
      : ctx.profile.countryCode === 'PL'
        ? (['InPost', 'DHL'] as const)
        : (['DHL', 'UPS'] as const);
  for (const carrier of carriers) {
    await prisma.courierConfig.create({
      data: {
        organizationId: ctx.organizationId,
        carrier,
        configJson: { seeded: true, accountId: tokenHex(4) },
        createdAt: ctx.foundedAt,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Comments — small, showcase-only. The Comments table sits on top of any
// EntityType, so we drop a couple onto invoices to demonstrate threads.
// ---------------------------------------------------------------------------

async function seedComments(
  prisma: PrismaClient,
  ctx: OrgSeed,
  refs: readonly EntityRef[],
): Promise<void> {
  if (!ctx.org.showcase) return;
  const invoiceRefs = refs.filter(r => r.type === 'INVOICE').slice(0, 8);
  if (invoiceRefs.length === 0) return;
  const commentRows: Prisma.CommentCreateManyInput[] = [];
  for (const ref of invoiceRefs) {
    const commentCount = ctx.fakers.org.number.int({ min: 1, max: 3 });
    for (let i = 0; i < commentCount; i += 1) {
      const author = ctx.fakers.org.helpers.arrayElement(ctx.users);
      // Comments anchored to the invoice's lifetime so old invoices show
      // appropriately old comment threads (not "just now").
      const commentedAt = dateBetween(ctx.fakers.org, ref.createdAt, new Date());
      commentRows.push({
        organizationId: ctx.organizationId,
        entityType: 'INVOICE',
        entityId: ref.id,
        authorUserId: author.id,
        body: ctx.fakers.org.lorem.sentence(),
        createdAt: commentedAt,
      });
    }
  }
  for (let i = 0; i < commentRows.length; i += 1000) {
    await prisma.comment.createMany({
      data: commentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Workflow runs — concrete executions of workflow templates for contractors.
// ---------------------------------------------------------------------------

async function seedWorkflowRuns(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
): Promise<void> {
  if (contractors.length === 0) return;

  // Restrict to contractor-scoped templates — a CONTRACT-scoped template
  // can't legally back a CONTRACTOR-entity run.
  const templates = await prisma.workflowTemplate.findMany({
    where: { organizationId: ctx.organizationId, appliesToEntityType: 'CONTRACTOR' },
    select: { id: true },
  });
  if (templates.length === 0) return;

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86_400_000);

  const taskTypes = [
    'APPROVAL',
    'DOCUMENT_COLLECTION',
    'ACCESS_GRANT',
    'NOTIFICATION',
    'MANUAL',
    'EQUIPMENT',
    'KNOWLEDGE_TRANSFER',
  ] as const;

  const taskTitles = [
    'Collect signed NDA',
    'Verify tax information',
    'Set up payroll account',
    'Send welcome notification',
    'Assign equipment',
    'Schedule onboarding call',
    'Review compliance docs',
  ];

  type WorkflowTaskStatusKey =
    | 'TODO'
    | 'IN_PROGRESS'
    | 'DONE'
    | 'BLOCKED'
    | 'SKIPPED'
    | 'CANCELLED'
    | 'OVERDUE';

  const runRows: Prisma.WorkflowRunCreateManyInput[] = [];
  const taskRows: Prisma.WorkflowTaskRunCreateManyInput[] = [];
  const commentRows: Prisma.WorkflowCommentCreateManyInput[] = [];
  const documentRows: Prisma.DocumentCreateManyInput[] = [];
  const attachmentRows: Prisma.WorkflowAttachmentCreateManyInput[] = [];

  for (const contractor of contractors) {
    if (!ctx.fakers.org.datatype.boolean({ probability: 0.3 })) continue;

    const template = ctx.fakers.org.helpers.arrayElement(templates);
    const startedAt = dateBetween(ctx.fakers.org, sixMonthsAgo, now);
    const startedBy = ctx.fakers.org.helpers.arrayElement(ctx.users);
    const runStatus = ctx.fakers.org.helpers.arrayElement([
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ] as const);

    const completedAt =
      runStatus === 'COMPLETED'
        ? advanceCapped(startedAt, ctx.fakers.org.number.int({ min: 1, max: 14 }))
        : null;
    const cancelledAt =
      runStatus === 'CANCELLED'
        ? advanceCapped(startedAt, ctx.fakers.org.number.int({ min: 1, max: 7 }))
        : null;
    const progressPercent =
      runStatus === 'COMPLETED'
        ? 100
        : runStatus === 'CANCELLED'
          ? ctx.fakers.org.number.int({ min: 10, max: 60 })
          : ctx.fakers.org.number.int({ min: 20, max: 80 });

    const runId = randomUUID();
    runRows.push({
      id: runId,
      organizationId: ctx.organizationId,
      workflowTemplateId: template.id,
      entityType: 'CONTRACTOR',
      entityId: contractor.id,
      contractorId: contractor.id,
      status: runStatus,
      startedByUserId: startedBy.id,
      startedAt,
      dueAt: advanceCapped(startedAt, ctx.fakers.org.number.int({ min: 7, max: 30 })),
      completedAt,
      cancelledAt,
      cancelReason: cancelledAt ? ctx.fakers.org.lorem.sentence() : null,
      progressPercent,
      createdAt: startedAt,
    });

    const taskCount = ctx.fakers.org.number.int({ min: 3, max: 5 });
    const localTaskIds: string[] = [];
    for (let i = 0; i < taskCount; i += 1) {
      const taskType = ctx.fakers.org.helpers.arrayElement(taskTypes);
      const title = ctx.fakers.org.helpers.arrayElement(taskTitles);
      const assignee = ctx.fakers.org.helpers.arrayElement(ctx.users);

      let taskStatus: WorkflowTaskStatusKey;
      if (runStatus === 'COMPLETED') {
        taskStatus = ctx.fakers.org.helpers.arrayElement([
          'DONE',
          'DONE',
          'DONE',
          'SKIPPED',
        ] as const);
      } else if (runStatus === 'CANCELLED') {
        taskStatus = ctx.fakers.org.helpers.arrayElement(['DONE', 'CANCELLED', 'TODO'] as const);
      } else {
        taskStatus =
          i < taskCount / 2
            ? ctx.fakers.org.helpers.arrayElement(['DONE', 'IN_PROGRESS'] as const)
            : ctx.fakers.org.helpers.arrayElement(['TODO', 'TODO', 'BLOCKED'] as const);
      }

      const taskStartedAt =
        taskStatus !== 'TODO' && taskStatus !== 'BLOCKED' ? advanceCapped(startedAt, i) : null;
      const taskCompletedAt =
        taskStatus === 'DONE' || taskStatus === 'SKIPPED'
          ? advanceCapped(startedAt, i + ctx.fakers.org.number.int({ min: 1, max: 3 }))
          : null;
      const taskCompletedBy = taskCompletedAt
        ? ctx.fakers.org.helpers.arrayElement(ctx.users).id
        : null;

      const taskId = randomUUID();
      localTaskIds.push(taskId);
      taskRows.push({
        id: taskId,
        organizationId: ctx.organizationId,
        workflowRunId: runId,
        title,
        taskType,
        status: taskStatus,
        required: ctx.fakers.org.datatype.boolean({ probability: 0.8 }),
        assigneeUserId: assignee.id,
        dueAt: advanceCapped(startedAt, (i + 1) * 3),
        startedAt: taskStartedAt,
        completedAt: taskCompletedAt,
        completedByUserId: taskCompletedBy,
        createdAt: startedAt,
      });
    }

    // -------------------------------------------------------------------
    // WorkflowComment + WorkflowAttachment per facts.md step 4 — picks a
    // deterministic subset of runs so the detail-page timeline isn't empty.
    // showcase always seeds; otherwise ~40% of runs get a timeline.
    // -------------------------------------------------------------------
    const seedTimeline = ctx.org.showcase
      ? true
      : ctx.fakers.org.datatype.boolean({ probability: 0.4 });
    if (!seedTimeline || localTaskIds.length === 0) continue;

    const commentTaskCount = Math.min(
      localTaskIds.length,
      ctx.fakers.org.number.int({ min: 1, max: 2 }),
    );
    const commentTaskIds = ctx.fakers.org.helpers
      .shuffle([...localTaskIds])
      .slice(0, commentTaskCount);
    for (const taskId of commentTaskIds) {
      const numComments = ctx.fakers.org.number.int({ min: 1, max: 3 });
      for (let i = 0; i < numComments; i += 1) {
        const author = ctx.fakers.org.helpers.arrayElement(ctx.users);
        commentRows.push({
          organizationId: ctx.organizationId,
          workflowRunId: runId,
          workflowTaskRunId: taskId,
          authorUserId: author.id,
          body: ctx.fakers.org.lorem.sentence(),
          createdAt: advanceCapped(startedAt, i),
        });
      }
    }

    const attachmentTaskCount = ctx.fakers.org.number.int({ min: 0, max: 2 });
    if (attachmentTaskCount === 0) continue;
    const attachmentTaskIds = ctx.fakers.org.helpers
      .shuffle([...localTaskIds])
      .slice(0, attachmentTaskCount);
    for (const taskId of attachmentTaskIds) {
      const fileBytes = ctx.fakers.org.number.int({ min: 1024, max: 256 * 1024 });
      const fileBaseName = ctx.fakers.org.system.fileName({ extensionCount: 0 });
      const documentId = randomUUID();
      documentRows.push({
        id: documentId,
        organizationId: ctx.organizationId,
        storageKey: `seed/workflow/${runId}/${tokenHex(6)}.pdf`,
        originalFileName: `${fileBaseName}.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: BigInt(fileBytes),
        checksumSha256: tokenHex(32),
        documentType: 'OTHER',
        status: 'ACTIVE',
        visibility: 'PRIVATE',
        uploadedByUserId: ctx.ownerUserId,
        source: 'USER_UPLOAD',
        virusScanStatus: 'CLEAN',
        createdAt: startedAt,
      });
      attachmentRows.push({
        organizationId: ctx.organizationId,
        workflowRunId: runId,
        workflowTaskRunId: taskId,
        documentId,
        createdAt: startedAt,
      });
    }
  }

  // Wave inserts: WorkflowRun → WorkflowTaskRun → WorkflowComment →
  // Document → WorkflowAttachment (attachment depends on both task + doc).
  for (let i = 0; i < runRows.length; i += 1000) {
    await prisma.workflowRun.createMany({
      data: runRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < taskRows.length; i += 1000) {
    await prisma.workflowTaskRun.createMany({
      data: taskRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < commentRows.length; i += 1000) {
    await prisma.workflowComment.createMany({
      data: commentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < documentRows.length; i += 1000) {
    await prisma.document.createMany({
      data: documentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < attachmentRows.length; i += 1000) {
    await prisma.workflowAttachment.createMany({
      data: attachmentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Classification — IR35 / Schein-Selbständigkeit assessments + supporting
// documents + amber-verdict escalation events. Sets up the data prerequisites
// for tax-compliance (SdsApproval, ReassessmentTrigger).
// ---------------------------------------------------------------------------

const CLASSIFICATION_RULE_SET_VERSION = '2025.04';
const CLASSIFICATION_POLICY_VERSION = '2025.04';
const SDS_APPROVAL_STATEMENT_SNAPSHOT =
  'I, the engager, confirm that this Status Determination Statement reflects ' +
  "reasonable care taken to determine the worker's employment status under IR35.";

async function seedClassification(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
): Promise<void> {
  if (contractors.length === 0) return;

  // ContractorAssignment is the FK target for assessments. Not every
  // contractor has one (only those with a team / project / cost-centre), so
  // restrict to that set.
  const assignments = await prisma.contractorAssignment.findMany({
    where: {
      organizationId: ctx.organizationId,
      contractorId: { in: contractors.map(c => c.id) },
    },
    select: { id: true, contractorId: true },
  });
  if (assignments.length === 0) return;

  // Showcase: every assignment gets an assessment so escalation + SDS UI
  // surfaces are guaranteed populated. Other profiles: sample ~25%.
  const subset = ctx.org.showcase
    ? assignments
    : assignments.filter(() => ctx.fakers.org.datatype.boolean({ probability: 0.25 }));
  if (subset.length === 0) return;

  const verdicts = ['IR35_OUTSIDE', 'IR35_INSIDE', 'IR35_INDETERMINATE'] as const;
  const escalationKinds = ['AMBER_VERDICT_AUTO', 'GET_EXPERT_HELP_CLICK', 'MANUAL_FLAG'] as const;

  const assessmentRows: Prisma.ClassificationAssessmentCreateManyInput[] = [];
  const documentRows: Prisma.ClassificationDocumentCreateManyInput[] = [];
  const escalationRows: Prisma.ClassificationEscalationEventCreateManyInput[] = [];
  const approvalRows: Prisma.SdsApprovalCreateManyInput[] = [];
  for (const [i, a] of subset.entries()) {
    const completedAtBase = pastDateAfter(ctx.fakers.org, 270, ctx.foundedAt);
    const isCompleted = ctx.org.showcase || ctx.fakers.org.datatype.boolean({ probability: 0.7 });
    const verdict = verdicts[i % verdicts.length] as (typeof verdicts)[number];
    const completedAt = isCompleted ? completedAtBase : null;

    const assessmentId = randomUUID();
    assessmentRows.push({
      id: assessmentId,
      organizationId: ctx.organizationId,
      contractorAssignmentId: a.id,
      countryCode: ctx.profile.countryCode,
      ruleSetVersion: CLASSIFICATION_RULE_SET_VERSION,
      policyRuleSetVersion: CLASSIFICATION_POLICY_VERSION,
      status: isCompleted ? 'completed' : 'draft',
      questionsSnapshot: isCompleted
        ? { questions: ['SUBSTITUTION', 'CONTROL', 'MUTUALITY', 'EQUIPMENT', 'FINANCIAL_RISK'] }
        : Prisma.JsonNull,
      answers: { SUBSTITUTION: 'YES', CONTROL: 'NO', MUTUALITY: 'NO' },
      outcome: isCompleted
        ? {
            verdict,
            score: ctx.fakers.org.number.float({ min: 0.3, max: 0.95, fractionDigits: 2 }),
          }
        : Prisma.JsonNull,
      completedAt,
      disclaimerAcknowledgedAt: completedAt,
      immutableAfter: completedAt ? new Date(completedAt.getTime() + 30 * 86_400_000) : null,
      createdAt: completedAtBase,
    });

    if (!isCompleted) continue;

    // 1–3 supporting documents per completed assessment.
    const docKinds = ['SDS', 'DRV_DEFENSE_BUNDLE', 'DRV_DECISION_LETTER'] as const;
    const docCount = ctx.org.showcase
      ? docKinds.length
      : ctx.fakers.org.number.int({ min: 1, max: 2 });
    for (let d = 0; d < docCount; d += 1) {
      const kind = docKinds[d] as (typeof docKinds)[number];
      const byteSize = ctx.fakers.org.number.int({ min: 8 * 1024, max: 1024 * 1024 });
      documentRows.push({
        organizationId: ctx.organizationId,
        classificationAssessmentId: assessmentId,
        kind,
        pdfKey: `seed/classification/${assessmentId}/${kind.toLowerCase()}.pdf`,
        sha256Hash: tokenHex(32),
        byteSize,
        rendererVersion: '1.0.0-seed',
        ruleSetVersion: CLASSIFICATION_RULE_SET_VERSION,
        generatedAt: completedAtBase,
        generatedByUserId: ctx.ownerUserId,
        createdAt: completedAtBase,
      });
    }

    // Escalation event for amber verdicts (and a handful of explicit clicks
    // in showcase) so the escalation log isn't empty.
    if (verdict === 'IR35_INDETERMINATE' || (ctx.org.showcase && i < 2)) {
      const triggerKind = escalationKinds[
        i % escalationKinds.length
      ] as (typeof escalationKinds)[number];
      escalationRows.push({
        organizationId: ctx.organizationId,
        userId: ctx.ownerUserId,
        contractorId: a.contractorId,
        assessmentId,
        verdict,
        triggerKind,
        referralTarget:
          triggerKind === 'GET_EXPERT_HELP_CLICK' ? 'https://example.com/expert' : 'INTERNAL_PAGE',
        ipAddress: '127.0.0.1',
        userAgent: 'seed-dev',
        createdAt: completedAtBase,
      });
    }

    // SdsApproval — one per completed assessment (unique). Only create for a
    // subset so the approval queue shows pending+approved variety.
    const seedApproval = ctx.org.showcase
      ? i % 2 === 0
      : ctx.fakers.org.datatype.boolean({ probability: 0.5 });
    if (seedApproval) {
      approvalRows.push({
        organizationId: ctx.organizationId,
        assessmentId,
        approvedByUserId: ctx.ownerUserId,
        approvedAt: advanceCapped(completedAtBase, ctx.fakers.org.number.int({ min: 1, max: 7 })),
        clientName: `${ctx.fakers.ascii.company.name()} Ltd.`,
        approvalStatementSnapshot: SDS_APPROVAL_STATEMENT_SNAPSHOT,
        createdAt: completedAtBase,
      });
    }
  }

  // Wave inserts: parent assessment → children referencing assessment id.
  for (let i = 0; i < assessmentRows.length; i += 1000) {
    await prisma.classificationAssessment.createMany({
      data: assessmentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < documentRows.length; i += 1000) {
    await prisma.classificationDocument.createMany({
      data: documentRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < escalationRows.length; i += 1000) {
    await prisma.classificationEscalationEvent.createMany({
      data: escalationRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < approvalRows.length; i += 1000) {
    await prisma.sdsApproval.createMany({
      data: approvalRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Invoice extensions — Skonto (early-payment discount), late-payment interest
// claims, match results, and intake-request precursors.
// ---------------------------------------------------------------------------

async function seedSkonto(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
): Promise<void> {
  if (invoices.length === 0) return;

  // SkontoTerm.invoiceId is @unique — one term per invoice. Pre-compute the
  // term id so snapshots and applications can reference it without a
  // follow-up findUnique.
  const termByInvoice = new Map<string, { id: string; discountPercent: string }>();
  const termRows: Prisma.SkontoTermCreateManyInput[] = [];
  for (const inv of invoices) {
    const discountPct = ctx.fakers.org.helpers.arrayElement(['1.00', '2.00', '3.00']);
    const discountPeriodDays = ctx.fakers.org.helpers.arrayElement([7, 10, 14]);
    const netPeriodDays = ctx.fakers.org.helpers.arrayElement([30, 45, 60]);
    const id = randomUUID();
    termRows.push({
      id,
      organizationId: ctx.organizationId,
      invoiceId: inv.id,
      discountPercent: discountPct,
      discountPeriodDays,
      netPeriodDays,
      createdAt: inv.receivedAt,
    });
    termByInvoice.set(inv.id, { id, discountPercent: discountPct });
  }
  for (let i = 0; i < termRows.length; i += 1000) {
    await prisma.skontoTerm.createMany({
      data: termRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // Snapshots — only for paid invoices (effectivePaymentDate references the
  // actual payment moment).
  const paidInvoices = invoices.filter(i => i.status === 'PAID' && i.paidAt);
  const snapshotSubset = ctx.org.showcase
    ? paidInvoices
    : paidInvoices.filter((_, i) => i % 2 === 0).slice(0, 5);
  const snapshotRows: Prisma.SkontoSnapshotCreateManyInput[] = [];
  // Bulk-load paymentRunItems for the snapshot subset so SkontoApplication
  // can attach via paymentRunItemId without a per-row findFirst.
  const subsetIds = snapshotSubset.map(i => i.id);
  const paymentItems =
    subsetIds.length === 0
      ? []
      : await prisma.paymentRunItem.findMany({
          where: { organizationId: ctx.organizationId, invoiceId: { in: subsetIds } },
          select: { id: true, invoiceId: true },
        });
  const paymentItemByInvoice = new Map<string, string>();
  for (const item of paymentItems) {
    if (!paymentItemByInvoice.has(item.invoiceId)) {
      paymentItemByInvoice.set(item.invoiceId, item.id);
    }
  }
  const applicationRows: Prisma.SkontoApplicationCreateManyInput[] = [];
  for (const inv of snapshotSubset) {
    if (!inv.paidAt) continue;
    const term = termByInvoice.get(inv.id);
    if (!term) continue;
    const eligible = ctx.org.showcase
      ? ((snapshotSubset.indexOf(inv) % 2 === 0) as boolean)
      : ctx.fakers.org.datatype.boolean({ probability: 0.7 });
    const eligibility = eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
    const discountPctNum = Number.parseFloat(term.discountPercent.toString());
    const discountAppliedMinor = eligible ? Math.round((inv.totalMinor * discountPctNum) / 100) : 0;
    snapshotRows.push({
      organizationId: ctx.organizationId,
      invoiceId: inv.id,
      skontoTermId: term.id,
      eligibilityAtPayment: eligibility,
      discountAppliedMinor,
      effectivePaymentDate: dateOnly(inv.paidAt),
      createdAt: inv.paidAt,
    });

    // SkontoApplication — paymentRunItemId @unique; skipDuplicates handles
    // re-seed and prevents collisions when multiple snapshots target the
    // same run item.
    if (!eligible) continue;
    const paymentItemId = paymentItemByInvoice.get(inv.id);
    if (!paymentItemId) continue;
    applicationRows.push({
      organizationId: ctx.organizationId,
      paymentRunItemId: paymentItemId,
      skontoTermId: term.id,
      discountPercentApplied: term.discountPercent,
      discountAmountMinor: discountAppliedMinor,
      createdAt: inv.paidAt,
    });
  }
  for (let i = 0; i < snapshotRows.length; i += 1000) {
    await prisma.skontoSnapshot.createMany({
      data: snapshotRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < applicationRows.length; i += 1000) {
    await prisma.skontoApplication.createMany({
      data: applicationRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

async function seedInvoiceInterest(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
): Promise<void> {
  if (invoices.length === 0) return;

  // Overdue = past due date, not yet PAID/VOID/REJECTED.
  const now = Date.now();
  const overdue = invoices.filter(
    i =>
      i.dueDate.getTime() < now &&
      i.status !== 'PAID' &&
      i.status !== 'VOID' &&
      i.status !== 'REJECTED',
  );
  if (overdue.length === 0) return;

  const claimSubset = ctx.org.showcase ? overdue.slice(0, 6) : overdue.slice(0, 3);
  const claimRows: Prisma.InvoiceInterestClaimCreateManyInput[] = [];
  const compensationRows: Prisma.InvoiceInterestCompensationCreateManyInput[] = [];
  const waiverRows: Prisma.InvoiceInterestWaiverCreateManyInput[] = [];
  for (const [i, inv] of claimSubset.entries()) {
    const daysOverdue = Math.max(1, Math.floor((now - inv.dueDate.getTime()) / 86_400_000));
    // Statutory interest rate (placeholder: BoE base 5.25 + 8 = 13.25). Decimal(5,2).
    const ratePct = '13.25';
    const interestMinor = Math.round((inv.totalMinor * 13.25 * daysOverdue) / (100 * 365));
    // Compensation tier per UK Late Payment Act: £40 / £70 / £100 by debt size.
    const compMinor =
      inv.totalMinor < 100_000 ? 4_000 : inv.totalMinor < 1_000_000 ? 7_000 : 10_000;

    claimRows.push({
      organizationId: ctx.organizationId,
      invoiceId: inv.id,
      claimedByUserId: ctx.ownerUserId,
      claimedAt: pastDateAfter(ctx.fakers.org, 14, inv.dueDate),
      snapshotInterestMinor: interestMinor,
      snapshotCompensationMinor: compMinor,
      snapshotRateUsed: ratePct,
      snapshotDaysOverdue: daysOverdue,
      pdfStatus: i % 3 === 0 ? 'READY' : 'PENDING_RENDER',
      pdfKey: i % 3 === 0 ? `seed/interest-claim/${inv.id}.pdf` : null,
      pdfReadyAt: i % 3 === 0 ? pastDateAfter(ctx.fakers.org, 1, inv.dueDate) : null,
    });

    // Compensation row — invoiceId @unique; skipDuplicates handles re-seed.
    if (i < 3) {
      compensationRows.push({
        organizationId: ctx.organizationId,
        invoiceId: inv.id,
        tierMinor: compMinor,
        invoiceTotalAtOverdueMinor: inv.totalMinor,
        firstOverdueDate: dateOnly(inv.dueDate),
      });
    }

    // Waiver — every other claim gets one (mix of waived + active).
    if (i % 2 === 0) {
      waiverRows.push({
        organizationId: ctx.organizationId,
        invoiceId: inv.id,
        waiveType: ctx.fakers.org.helpers.arrayElement([
          'STATUTORY_INTEREST',
          'COMPENSATION',
          'BOTH',
        ] as const),
        reason: 'Goodwill gesture (seeded)',
        waivedByUserId: ctx.ownerUserId,
        waivedAt: pastDateAfter(ctx.fakers.org, 7, inv.dueDate),
      });
    }
  }
  for (let i = 0; i < claimRows.length; i += 1000) {
    await prisma.invoiceInterestClaim.createMany({
      data: claimRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < compensationRows.length; i += 1000) {
    await prisma.invoiceInterestCompensation.createMany({
      data: compensationRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < waiverRows.length; i += 1000) {
    await prisma.invoiceInterestWaiver.createMany({
      data: waiverRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

async function seedInvoiceMatchAndIntake(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
): Promise<void> {
  if (invoices.length === 0) return;

  // -------------------------------------------------------------------
  // InvoiceMatchResult — sample with mixed statuses spanning every enum.
  // -------------------------------------------------------------------
  const matchStatuses = [
    'MATCHED',
    'PARTIAL',
    'UNMATCHED',
    'DISCREPANCY',
    'MANUALLY_CONFIRMED',
  ] as const;
  const matchedBys = ['RULE_ENGINE', 'OCR_EXTRACTION', 'MANUAL', 'INTEGRATION'] as const;
  const matchSubset = ctx.org.showcase
    ? invoices.slice(0, Math.min(invoices.length, 10))
    : invoices.filter((_, i) => i % 4 === 0).slice(0, 6);
  const matchRows: Prisma.InvoiceMatchResultCreateManyInput[] = [];
  for (const [i, inv] of matchSubset.entries()) {
    const status = matchStatuses[i % matchStatuses.length] as (typeof matchStatuses)[number];
    const matchedBy = matchedBys[i % matchedBys.length] as (typeof matchedBys)[number];
    const score =
      status === 'UNMATCHED'
        ? null
        : ctx.fakers.org.helpers.arrayElement(['65.00', '80.00', '92.50', '99.00']);
    const expectedAmount = status === 'UNMATCHED' ? null : Math.round(inv.totalMinor * 0.95);
    const delta = expectedAmount === null ? null : inv.totalMinor - expectedAmount;
    matchRows.push({
      organizationId: ctx.organizationId,
      invoiceId: inv.id,
      matchedContractorId: status === 'UNMATCHED' ? null : inv.contractorId,
      matchScore: score,
      expectedAmountMinor: expectedAmount,
      expectedCurrency: status === 'UNMATCHED' ? null : inv.currency,
      amountDeltaMinor: delta,
      amountDeltaPercent:
        delta === null || expectedAmount === null || expectedAmount === 0
          ? null
          : ((delta / expectedAmount) * 100).toFixed(4),
      matchedBy,
      status,
      explanationJson: { reason: status, source: 'seed' },
      createdAt: inv.receivedAt,
      createdByUserId: matchedBy === 'MANUAL' ? ctx.ownerUserId : null,
    });
  }
  for (let i = 0; i < matchRows.length; i += 1000) {
    await prisma.invoiceMatchResult.createMany({
      data: matchRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------
  // InvoiceIntakeRequest — historical intake history (uploaded XML/PDF
  // that became real invoices). One per sampled invoice.
  // -------------------------------------------------------------------
  const intakeSubset = ctx.org.showcase
    ? invoices.slice(0, Math.min(invoices.length, 6))
    : invoices.filter((_, i) => i % 5 === 0).slice(0, 4);
  const intakeStatuses = ['PARSED', 'NEEDS_REVIEW', 'MATCHED', 'CONVERTED', 'REJECTED'] as const;
  const intakeProfiles = ['XRECHNUNG', 'COMFORT', 'EXTENDED'] as const;
  // Track convertedInvoiceIds locally so the @unique constraint isn't
  // collided within the loop; skipDuplicates: true handles cross-run reseed.
  const seenConvertedIds = new Set<string>();
  const intakeRows: Prisma.InvoiceIntakeRequestCreateManyInput[] = [];
  for (const [i, inv] of intakeSubset.entries()) {
    const sourceKind = i % 2 === 0 ? 'UPLOAD_XML' : 'UPLOAD_PDF';
    const status = intakeStatuses[i % intakeStatuses.length] as (typeof intakeStatuses)[number];
    const profile = intakeProfiles[i % intakeProfiles.length] as (typeof intakeProfiles)[number];
    // convertedInvoiceId @unique — only set when status=CONVERTED.
    const convertedId = status === 'CONVERTED' ? inv.id : null;
    if (convertedId) {
      if (seenConvertedIds.has(convertedId)) continue;
      seenConvertedIds.add(convertedId);
    }
    intakeRows.push({
      organizationId: ctx.organizationId,
      uploadedByUserId: ctx.ownerUserId,
      sourceKind,
      rawFileKey: `seed/intake/${inv.id}/${tokenHex(4)}.${sourceKind === 'UPLOAD_XML' ? 'xml' : 'pdf'}`,
      rawFileSha256: tokenHex(32),
      rawFileMime: sourceKind === 'UPLOAD_XML' ? 'application/xml' : 'application/pdf',
      rawFileSizeBytes: ctx.fakers.org.number.int({ min: 4 * 1024, max: 256 * 1024 }),
      profileLevel: profile,
      parsedInvoiceJson: {
        seeded: true,
        invoiceNumber: inv.invoiceNumber,
        totalMinor: inv.totalMinor,
      },
      extractedSupplierName: ctx.fakers.org.company.name(),
      extractedInvoiceNumber: inv.invoiceNumber,
      extractedInvoiceDate: inv.issueDate,
      extractedTotalMinor: BigInt(inv.totalMinor),
      extractedCurrency: inv.currency,
      matchedContractorId: status === 'PARSED' ? null : inv.contractorId,
      convertedInvoiceId: convertedId,
      status,
      validationStatus: status === 'REJECTED' ? 'INVALID' : 'VALID',
      createdAt: inv.receivedAt,
    });
  }
  for (let i = 0; i < intakeRows.length; i += 1000) {
    await prisma.invoiceIntakeRequest.createMany({
      data: intakeRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// E-invoicing — Peppol (EU), LeitwegId (DE B2G), ZATCA (SA). Each runs only
// for the matching region; showcase orgs in the wrong region produce zero
// rows for these tables (mitigated by spreading multi-org showcase coverage
// in `--profile=all`).
// ---------------------------------------------------------------------------

async function seedPeppol(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
  contractors: readonly SeededContractor[],
): Promise<void> {
  if (ctx.org.region !== 'EU' || invoices.length === 0) return;

  const orgScheme = '0192'; // ISO 6523 — Norwegian org-number scheme used by Storecove demos
  const orgValue = ctx.fakers.org.string.numeric({ length: 13 });
  const orgParticipantId = randomUUID();
  const orgParticipant = {
    id: orgParticipantId,
    schemeId: orgScheme,
    identifierValue: orgValue,
  };

  // Subset of contractors get their own Peppol identifiers (e.g. corporate
  // sellers within the network).
  const contractorParticipants: Array<{ id: string; schemeId: string; identifierValue: string }> =
    [];
  const contractorSubset = ctx.org.showcase
    ? contractors.slice(0, Math.min(contractors.length, 5))
    : contractors.filter((_, i) => i % 6 === 0).slice(0, 3);
  const participantRows: Prisma.PeppolParticipantCreateManyInput[] = [
    {
      id: orgParticipantId,
      organizationId: ctx.organizationId,
      participantId: `${orgScheme}:${orgValue}`,
      schemeId: orgScheme,
      identifierValue: orgValue,
      aspProvider: 'storecove',
      aspRegistrationId: `asp-${tokenHex(6)}`,
      status: 'ACTIVE',
      registeredAt: pastDateAfter(ctx.fakers.org, 365, ctx.foundedAt),
      supportsXRechnungCii: true,
      lastCapabilityCheckAt: pastDate(ctx.fakers.org, 7),
      createdAt: ctx.foundedAt,
    },
  ];
  for (const c of contractorSubset) {
    const value = ctx.fakers.org.string.numeric({ length: 13 });
    const id = randomUUID();
    participantRows.push({
      id,
      organizationId: ctx.organizationId,
      participantId: `${orgScheme}:${value}`,
      schemeId: orgScheme,
      identifierValue: value,
      aspProvider: 'storecove',
      status: 'REGISTERED',
      registeredAt: pastDateAfter(ctx.fakers.org, 180, ctx.foundedAt),
      supportsXRechnungCii: ctx.fakers.org.datatype.boolean({ probability: 0.6 }),
      createdAt: pastDateAfter(ctx.fakers.org, 180, ctx.foundedAt),
    });
    contractorParticipants.push({ id, schemeId: orgScheme, identifierValue: value });
    void c; // contractor reference is documentary only — the FK is on Organization
  }
  for (let i = 0; i < participantRows.length; i += 1000) {
    await prisma.peppolParticipant.createMany({
      data: participantRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // Capability cache rows — one per receiving participant (skipDuplicates on
  // the composite unique to keep reseeds idempotent).
  const cacheTargets = [orgParticipant, ...contractorParticipants];
  await prisma.peppolCapabilityCache.createMany({
    data: cacheTargets.map(p => ({
      organizationId: ctx.organizationId,
      schemeId: p.schemeId,
      value: p.identifierValue,
      documentTypes: ['urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'],
      cachedAt: pastDate(ctx.fakers.org, 7),
      expiresAt: futureDate(ctx.fakers.org, 30),
    })),
    skipDuplicates: true,
  });

  // PeppolTransmission per EU invoice subset, mixed status.
  const transmissionStatuses = [
    'PENDING',
    'TRANSMITTED',
    'DELIVERED',
    'FAILED',
    'REJECTED',
  ] as const;
  const txSubset = ctx.org.showcase
    ? invoices.slice(0, Math.min(invoices.length, transmissionStatuses.length * 2))
    : invoices.filter((_, i) => i % 4 === 0).slice(0, 4);
  const transmissionRows: Prisma.PeppolTransmissionCreateManyInput[] = [];
  for (const [i, inv] of txSubset.entries()) {
    const status = transmissionStatuses[
      i % transmissionStatuses.length
    ] as (typeof transmissionStatuses)[number];
    const transmittedAt =
      status === 'PENDING' ? null : pastDateAfter(ctx.fakers.org, 7, inv.receivedAt);
    const deliveredAt =
      status === 'DELIVERED' && transmittedAt ? advanceCapped(transmittedAt, 1) : null;
    const target = cacheTargets[i % cacheTargets.length];
    if (!target) continue;
    transmissionRows.push({
      organizationId: ctx.organizationId,
      peppolParticipantId: target.id,
      invoiceId: inv.id,
      direction: 'OUTBOUND',
      aspTransmissionId: `tx-${tokenHex(6)}`,
      documentTypeId: 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
      status,
      xmlPayload: null,
      errorMessage: status === 'FAILED' ? 'simulated upstream 500 (seed)' : null,
      transmittedAt,
      deliveredAt,
      createdAt: inv.receivedAt,
    });
  }
  for (let i = 0; i < transmissionRows.length; i += 1000) {
    await prisma.peppolTransmission.createMany({
      data: transmissionRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // LeitwegId — DE B2G. Attach to the first 1–3 contractors in DE orgs.
  if (ctx.profile.countryCode === 'DE') {
    const leitwegSubset = ctx.org.showcase
      ? contractors.slice(0, Math.min(contractors.length, 3))
      : contractors.slice(0, 1);
    const leitwegRows: Prisma.LeitwegIdCreateManyInput[] = [];
    for (const [i, c] of leitwegSubset.entries()) {
      // Leitweg-ID structure: GG-fff-XYZ (Gemeindeschlüssel + Feinadressierung)
      const value = `04011000-${ctx.fakers.org.string.numeric({ length: 5 })}-${(40 + i)
        .toString()
        .padStart(2, '0')}`;
      leitwegRows.push({
        organizationId: ctx.organizationId,
        value,
        description: 'Federal procurement office (seed)',
        contractorId: c.id,
        isDefaultForContractor: true,
        validFrom: pastDateAfter(ctx.fakers.org, 90, ctx.foundedAt),
        validTo: null,
        notes: 'Auto-seeded for DE B2G demo',
        createdAt: ctx.foundedAt,
      });
    }
    for (let i = 0; i < leitwegRows.length; i += 1000) {
      await prisma.leitwegId.createMany({
        data: leitwegRows.slice(i, i + 1000),
        skipDuplicates: true,
      });
    }
  }
}

async function seedZatca(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
): Promise<void> {
  // ZATCA is SA-only in production. Showcase ME orgs are typically AE OR SA;
  // gate on country to avoid muddying the AE dashboard.
  if (ctx.profile.countryCode !== 'SA' || invoices.length === 0) return;

  const subset = ctx.org.showcase
    ? invoices.slice(0, Math.min(invoices.length, 6))
    : invoices.slice(0, 4);
  const zatcaStatuses = [
    'PENDING',
    'SUBMITTED',
    'CLEARED',
    'REPORTED',
    'REJECTED',
    'WARNING',
  ] as const;
  let previousHash = '0'.repeat(64);
  const chainRows: Prisma.ZatcaInvoiceChainCreateManyInput[] = [];
  for (const [i, inv] of subset.entries()) {
    const status = zatcaStatuses[i % zatcaStatuses.length] as (typeof zatcaStatuses)[number];
    const invoiceHash = tokenHex(32); // 64 hex chars
    chainRows.push({
      organizationId: ctx.organizationId,
      icv: i + 1,
      invoiceId: inv.id,
      invoiceHash,
      previousHash,
      zatcaUuid: randomUUID(),
      zatcaStatus: status,
      zatcaResponse: { seeded: true, status },
      submittedAt: status === 'PENDING' ? null : pastDateAfter(ctx.fakers.org, 7, inv.receivedAt),
      clearedAt:
        status === 'CLEARED' || status === 'REPORTED'
          ? pastDateAfter(ctx.fakers.org, 6, inv.receivedAt)
          : null,
      reportedAt: status === 'REPORTED' ? pastDateAfter(ctx.fakers.org, 5, inv.receivedAt) : null,
      rejectedAt: status === 'REJECTED' ? pastDateAfter(ctx.fakers.org, 5, inv.receivedAt) : null,
      rejectionReason: status === 'REJECTED' ? 'Schema validation failed (seed)' : null,
      createdAt: inv.receivedAt,
    });
    previousHash = invoiceHash;
  }
  for (let i = 0; i < chainRows.length; i += 1000) {
    await prisma.zatcaInvoiceChain.createMany({
      data: chainRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// ExchangeRate — 90-day daily history per (base, target) currency pair across
// every currency we touch. Multi-tenant table is global (no organizationId)
// so reseeds rely on `(date, base, target)` uniqueness via `skipDuplicates`.
// ---------------------------------------------------------------------------

// Stable midpoints (rate of EUR per 1 unit of EUR is 1.0; for non-EUR base
// rows we'd flip these). Keep within plausible 2026 ranges so the FX UI
// doesn't show absurd swings.
const EUR_MIDPOINTS: Readonly<Record<string, number>> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  PLN: 4.32,
  AED: 3.97,
  SAR: 4.05,
  CHF: 0.95,
};

async function seedExchangeRates(
  prisma: PrismaClient,
  ctx: OrgSeed,
  invoices: readonly SeededInvoice[],
  contractors: readonly SeededContractor[],
): Promise<void> {
  // Gather every currency in play this run, pinned with EUR + the org default.
  const currencySet = new Set<string>(['EUR', ctx.profile.defaultCurrency]);
  for (const inv of invoices) currencySet.add(inv.currency);
  for (const c of contractors) currencySet.add(c.currency);
  // Drop unknown codes (no midpoint defined → would produce garbage rates).
  const targets = [...currencySet].filter(c => EUR_MIDPOINTS[c] !== undefined && c !== 'EUR');
  if (targets.length === 0) return;

  const todayUtcStartOfDay = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();

  // 90-day window ending today, inclusive.
  const rows: Array<{
    date: Date;
    base: string;
    target: string;
    rate: string;
    source: string;
  }> = [];
  for (let dayOffset = 0; dayOffset < 90; dayOffset += 1) {
    const date = new Date(todayUtcStartOfDay.getTime() - dayOffset * 86_400_000);
    for (const target of targets) {
      const midpoint = EUR_MIDPOINTS[target];
      if (midpoint === undefined) continue;
      // ±1.5% drift around midpoint, deterministic via per-org faker.
      const drift = ctx.fakers.org.number.float({ min: -0.015, max: 0.015 });
      const rate = midpoint * (1 + drift);
      rows.push({
        date,
        base: 'EUR',
        target,
        rate: rate.toFixed(8),
        source: 'ECB',
      });
    }
  }

  // Idempotent — composite-unique on (date, base, target). Multi-org reseeds
  // are no-ops for already-present rows.
  await prisma.exchangeRate.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

// ---------------------------------------------------------------------------
// Consent + privacy — PrivacyNotice (per jurisdiction), ConsentRecord +
// ConsentEvent (per user), ContractorNotificationPreference + ChangeRequest.
// ---------------------------------------------------------------------------

async function seedConsentAndPrivacy(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
): Promise<void> {
  // PrivacyNotice — composite-unique (organizationId, jurisdiction, version).
  // Seed one per language we ship (en + the org's local language).
  const jurisdictions = new Set([ctx.profile.countryCode]);
  if (ctx.org.showcase) {
    // Showcase shows the multi-language privacy-notices admin tab.
    for (const extra of ['EN', 'DE', 'PL']) jurisdictions.add(extra);
  }
  for (const j of jurisdictions) {
    await prisma.privacyNotice.upsert({
      where: {
        organizationId_jurisdiction_version: {
          organizationId: ctx.organizationId,
          jurisdiction: j,
          version: 1,
        },
      },
      create: {
        organizationId: ctx.organizationId,
        jurisdiction: j,
        version: 1,
        contentJson: {
          seeded: true,
          jurisdiction: j,
          headline: 'Privacy notice (seed)',
        },
        effectiveFrom: ctx.foundedAt,
      },
      update: {},
    });
  }

  // ConsentRecord + ConsentEvent — per user.
  const consentPurposes = [
    'CONTRACTOR_DATA_PROCESSING',
    'INVOICE_PAYMENT_PROCESSING',
    'COMMUNICATION_NOTIFICATIONS',
  ] as const;
  for (const u of ctx.users) {
    const grantedAt = pastDateAfter(ctx.fakers.org, 365, ctx.foundedAt);
    const purpose = ctx.fakers.org.helpers.arrayElement(consentPurposes);
    await prisma.consentRecord.create({
      data: {
        organizationId: ctx.organizationId,
        userId: u.id,
        purpose,
        granted: true,
        version: 1,
        grantedAt,
        ipAddress: '127.0.0.1',
        userAgent: 'seed-dev',
        createdAt: grantedAt,
      },
    });
    // 1 in 4 users revokes a separate purpose to show withdrawn variety.
    if (ctx.org.showcase || ctx.fakers.org.datatype.boolean({ probability: 0.25 })) {
      const altPurpose = ctx.fakers.org.helpers.arrayElement(consentPurposes);
      await prisma.consentRecord.create({
        data: {
          organizationId: ctx.organizationId,
          userId: u.id,
          purpose: altPurpose,
          granted: false,
          version: 1,
          grantedAt: null,
          revokedAt: pastDate(ctx.fakers.org, 30),
          ipAddress: '127.0.0.1',
          userAgent: 'seed-dev',
          createdAt: pastDate(ctx.fakers.org, 30),
        },
      });
    }

    // ConsentEvent — TOS acceptance.
    await prisma.consentEvent.create({
      data: {
        organizationId: ctx.organizationId,
        userId: u.id,
        scope: 'TOS',
        version: '2026.1.0',
        acceptedAt: grantedAt,
        ipAddress: '127.0.0.1',
        userAgent: 'seed-dev',
        createdAt: grantedAt,
      },
    });
  }

  // ContractorNotificationPreference — one per (contractor, category) pair.
  // skipDuplicates: true on the unique (contractorId, category) constraint
  // replaces the prior per-row findUnique guard.
  const categories = ['INVOICE_UPDATES', 'PAYMENT_CONFIRMATIONS', 'CONTRACT_CHANGES'];
  const prefRows: Prisma.ContractorNotificationPreferenceCreateManyInput[] = [];
  for (const c of contractors) {
    for (const category of categories) {
      prefRows.push({
        organizationId: ctx.organizationId,
        contractorId: c.id,
        category,
        emailEnabled: ctx.fakers.org.datatype.boolean({ probability: 0.85 }),
        createdAt: ctx.foundedAt,
      });
    }
  }
  for (let i = 0; i < prefRows.length; i += 1000) {
    await prisma.contractorNotificationPreference.createMany({
      data: prefRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // ContractorChangeRequest — small subset spanning every status.
  const changeStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
  const changeSubset = ctx.org.showcase
    ? contractors.slice(0, Math.min(contractors.length, changeStatuses.length))
    : contractors.filter((_, i) => i % 8 === 0).slice(0, 2);
  const changeRows: Prisma.ContractorChangeRequestCreateManyInput[] = [];
  for (const [i, c] of changeSubset.entries()) {
    const status = changeStatuses[i % changeStatuses.length] as (typeof changeStatuses)[number];
    const reviewedAt =
      status === 'PENDING' ? null : pastDateAfter(ctx.fakers.org, 30, ctx.foundedAt);
    changeRows.push({
      organizationId: ctx.organizationId,
      contractorId: c.id,
      status,
      requestedChanges: { phone: ctx.fakers.org.phone.number() },
      previousValues: { phone: ctx.fakers.org.phone.number() },
      reviewedById: status === 'PENDING' ? null : ctx.ownerUserId,
      reviewedAt,
      reviewComment: status === 'REJECTED' ? 'Verification incomplete' : null,
      createdAt: pastDateAfter(ctx.fakers.org, 30, ctx.foundedAt),
    });
  }
  if (changeRows.length > 0) {
    await prisma.contractorChangeRequest.createMany({
      data: changeRows,
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// OrganizationApiKey — Settings → API keys page wants ACTIVE + REVOKED rows.
// ---------------------------------------------------------------------------

async function seedApiKeys(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  // Active key
  await prisma.organizationApiKey.create({
    data: {
      organizationId: ctx.organizationId,
      name: 'Default API key',
      prefix: `seed_${tokenHex(3)}`.slice(0, 12),
      hash: tokenHex(32),
      scopes: ['contractors.read', 'invoices.read'],
      createdByUserId: ctx.ownerUserId,
      lastUsedAt: pastDate(ctx.fakers.org, 7),
      createdAt: pastDateAfter(ctx.fakers.org, 90, ctx.foundedAt),
    },
  });

  // Revoked key (different prefix to avoid any accidental dedup).
  await prisma.organizationApiKey.create({
    data: {
      organizationId: ctx.organizationId,
      name: 'Legacy CI key',
      prefix: `seed_${tokenHex(3)}`.slice(0, 12),
      hash: tokenHex(32),
      scopes: ['invoices.read'],
      createdByUserId: ctx.ownerUserId,
      lastUsedAt: pastDateAfter(ctx.fakers.org, 60, ctx.foundedAt),
      revokedAt: pastDateAfter(ctx.fakers.org, 30, ctx.foundedAt),
      createdAt: pastDateAfter(ctx.fakers.org, 180, ctx.foundedAt),
    },
  });
}

// ---------------------------------------------------------------------------
// UserPinnedView — pinned-tabs widget on the side nav.
// ---------------------------------------------------------------------------

async function seedPinnedViews(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  const candidates = [
    { kind: 'invoices', key: 'overdue' },
    { kind: 'contractors', key: 'high-risk' },
    { kind: 'workflows', key: 'in-progress' },
  ];
  for (const u of ctx.users) {
    const subset = ctx.org.showcase ? candidates : candidates.slice(0, 1);
    for (const view of subset) {
      const existing = await prisma.userPinnedView.findUnique({
        where: { userId_kind_key: { userId: u.id, kind: view.kind, key: view.key } },
      });
      if (existing) continue;
      await prisma.userPinnedView.create({
        data: { userId: u.id, kind: view.kind, key: view.key },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Cron / observability markers — StripeEvent (global), GovApiAuditLog,
// IntegrationSyncLog, NotificationCronDedup (global), CronScanState (global).
// ---------------------------------------------------------------------------

async function seedCronAndObservability(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  // StripeEvent — global table. createMany with stripeEventId @unique
  // skipDuplicates so multi-org reseeds are no-ops.
  await prisma.stripeEvent.createMany({
    data: [
      {
        stripeEventId: `evt_seed_${ctx.org.key}_invoice_paid`,
        eventType: 'invoice.paid',
        payloadJson: { seeded: true, org: ctx.org.key },
        processedAt: pastDate(ctx.fakers.org, 7),
      },
      {
        stripeEventId: `evt_seed_${ctx.org.key}_subscription_updated`,
        eventType: 'customer.subscription.updated',
        payloadJson: { seeded: true, org: ctx.org.key },
        processedAt: pastDate(ctx.fakers.org, 14),
      },
    ],
    skipDuplicates: true,
  });

  // GovApiAuditLog — a few request samples per gov-API integration.
  const govApis = ['ZATCA', 'PEPPOL', 'HMRC_VAT', 'VIES'];
  for (const api of govApis) {
    await prisma.govApiAuditLog.create({
      data: {
        organizationId: ctx.organizationId,
        apiName: api,
        endpoint: `/v1/${api.toLowerCase()}/health`,
        method: 'GET',
        requestBodyHash: tokenHex(32),
        responseStatus: 200,
        responseTimeMs: ctx.fakers.org.number.int({ min: 50, max: 1500 }),
        createdAt: pastDate(ctx.fakers.org, 30),
      },
    });
  }

  // IntegrationSyncLog — needs an IntegrationConnection row.
  const conn = await prisma.integrationConnection.findFirst({
    where: { organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (conn) {
    const startedAt = pastDateAfter(ctx.fakers.org, 7, ctx.foundedAt);
    await prisma.integrationSyncLog.create({
      data: {
        organizationId: ctx.organizationId,
        integrationConnectionId: conn.id,
        direction: 'OUTBOUND',
        syncType: 'FULL_SYNC',
        status: 'SUCCESS',
        startedAt,
        completedAt: advanceCapped(startedAt, 0),
      },
    });
  }

  // NotificationCronDedup — global; key by org so reseeds don't conflict.
  await prisma.notificationCronDedup.createMany({
    data: [
      { dedupeKey: `seed:${ctx.org.key}:reminder-T-30:invoice-1`.slice(0, 512) },
      { dedupeKey: `seed:${ctx.org.key}:reminder-T-7:invoice-2`.slice(0, 512) },
    ],
    skipDuplicates: true,
  });

  // CronScanState — singleton-per-name. Seed two cursor rows.
  for (const name of ['economic-dependency-scan', 'reassessment-trigger-scan']) {
    await prisma.cronScanState.upsert({
      where: { name },
      create: { name, lastScanCompletedAt: pastDate(ctx.fakers.org, 1) },
      update: {},
    });
  }
}

// ---------------------------------------------------------------------------
// Auth-surface display rows — Session, Account, Verification, OAuthChallenge,
// PortalMagicToken. UI-DISPLAY ONLY. These rows do NOT enable login bypass:
// Better Auth signs cookies with BETTER_AUTH_SECRET, so seeded Session rows
// have no corresponding browser cookie. Users still authenticate via the
// seeded password printed in the final summary line.
// ---------------------------------------------------------------------------

async function seedAuthSurface(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
): Promise<void> {
  // Session + Account + Verification — per active user.
  const sessionRows: Prisma.SessionCreateManyInput[] = [];
  const accountRows: Prisma.AccountCreateManyInput[] = [];
  const verificationRows: Prisma.VerificationCreateManyInput[] = [];
  for (const u of ctx.users) {
    sessionRows.push({
      token: `seed-only-${tokenHex(24)}`,
      userId: u.id,
      expiresAt: futureDate(ctx.fakers.org, 30),
      ipAddress: '127.0.0.1',
      userAgent: 'seed-dev (UI display only — not a real session)',
      activeOrganizationId: ctx.organizationId,
      createdAt: pastDateAfter(ctx.fakers.org, 7, ctx.foundedAt),
    });
    // Linked OAuth-style account row alongside the existing credential
    // account from `seedUsersForOrg` so the "Linked accounts" UI shows two.
    accountRows.push({
      accountId: `seed-google-${u.email}`,
      providerId: 'google',
      userId: u.id,
      accessToken: `seed-only-${tokenHex(16)}`,
      scope: 'email profile',
      accessTokenExpiresAt: futureDate(ctx.fakers.org, 30),
      createdAt: pastDateAfter(ctx.fakers.org, 90, ctx.foundedAt),
    });
    verificationRows.push({
      identifier: u.email,
      value: tokenHex(16),
      expiresAt: futureDate(ctx.fakers.org, 1),
      createdAt: pastDate(ctx.fakers.org, 1),
    });
  }
  for (let i = 0; i < sessionRows.length; i += 1000) {
    await prisma.session.createMany({
      data: sessionRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < accountRows.length; i += 1000) {
    await prisma.account.createMany({
      data: accountRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < verificationRows.length; i += 1000) {
    await prisma.verification.createMany({
      data: verificationRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // OAuthChallenge — 1 active + 1 expired (consumed). Owned by the org owner
  // since OAuthChallenge.userId is required.
  await prisma.oAuthChallenge.createMany({
    data: [
      {
        provider: 'google',
        organizationId: ctx.organizationId,
        userId: ctx.ownerUserId,
        stateHash: tokenHex(32),
        pkceVerifier: tokenHex(43),
        redirectUri: 'https://app.example.com/api/oauth/google/callback',
        expiresAt: futureDate(ctx.fakers.org, 1),
      },
      {
        provider: 'linear',
        organizationId: ctx.organizationId,
        userId: ctx.ownerUserId,
        stateHash: tokenHex(32),
        pkceVerifier: tokenHex(43),
        redirectUri: 'https://app.example.com/api/oauth/linear/callback',
        expiresAt: pastDate(ctx.fakers.org, 1),
        consumedAt: pastDate(ctx.fakers.org, 1),
      },
    ],
    skipDuplicates: true,
  });

  // PortalMagicToken — 1 unused, 1 redeemed, 1 expired. Use real contractor
  // emails when available so the UI shows familiar identities.
  const sample = contractors.slice(0, 3);
  const tokenStates: Array<{ usedAt: Date | null; expiresAt: Date }> = [
    { usedAt: null, expiresAt: futureDate(ctx.fakers.org, 1) },
    {
      usedAt: pastDate(ctx.fakers.org, 1),
      expiresAt: futureDate(ctx.fakers.org, 7),
    },
    { usedAt: null, expiresAt: pastDate(ctx.fakers.org, 1) },
  ];
  const magicTokenRows: Prisma.PortalMagicTokenCreateManyInput[] = [];
  for (let i = 0; i < tokenStates.length; i += 1) {
    const state = tokenStates[i];
    if (!state) continue;
    const contractor = sample[i];
    const email = contractor?.email ?? `magic-${i}-${ctx.org.key}@seed.local`;
    magicTokenRows.push({
      email,
      token: `seed-magic-${tokenHex(24)}`,
      expiresAt: state.expiresAt,
      usedAt: state.usedAt,
    });
  }
  if (magicTokenRows.length > 0) {
    await prisma.portalMagicToken.createMany({
      data: magicTokenRows,
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// OCR extraction history + PendingUpload precursors — gives Settings → OCR
// History a real list with realistic JSON payloads + status variety.
// ---------------------------------------------------------------------------

async function seedOcr(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  // Pull a sample of InvoiceFile rows so OcrExtraction.documentId resolves.
  const invoiceFiles = await prisma.invoiceFile.findMany({
    where: { organizationId: ctx.organizationId },
    select: { id: true, documentId: true, invoiceId: true },
    take: ctx.org.showcase ? 8 : 4,
  });
  if (invoiceFiles.length === 0) return;

  const ocrStatuses = ['PENDING', 'PROCESSING', 'EXTRACTED', 'PARTIAL', 'FAILED'] as const;
  const ocrProviders = ['CLAUDE', 'GOOGLE_DOCUMENT_AI', 'AZURE_FORM_RECOGNIZER'] as const;

  for (const [i, f] of invoiceFiles.entries()) {
    const status = ocrStatuses[i % ocrStatuses.length] as (typeof ocrStatuses)[number];
    const provider = ocrProviders[i % ocrProviders.length] as (typeof ocrProviders)[number];
    const completedAt =
      status === 'EXTRACTED' || status === 'PARTIAL'
        ? pastDateAfter(ctx.fakers.org, 30, ctx.foundedAt)
        : null;

    await prisma.ocrExtraction.create({
      data: {
        organizationId: ctx.organizationId,
        invoiceId: f.invoiceId,
        documentId: f.documentId,
        provider,
        status,
        resultJson:
          status === 'PENDING' || status === 'PROCESSING'
            ? Prisma.JsonNull
            : {
                supplierName: ctx.fakers.org.company.name(),
                invoiceNumber: `INV-${tokenHex(3).toUpperCase()}`,
                totalMinor: ctx.fakers.org.number.int({ min: 10_000, max: 500_000 }),
                currency: ctx.profile.defaultCurrency,
                lineItems: Array.from(
                  { length: ctx.fakers.org.number.int({ min: 1, max: 4 }) },
                  () => ({
                    description: ctx.fakers.org.commerce.productName(),
                    quantity: ctx.fakers.org.number.int({ min: 1, max: 5 }),
                    unitPriceMinor: ctx.fakers.org.number.int({ min: 1_000, max: 50_000 }),
                  }),
                ),
              },
        overallConfidence: status === 'EXTRACTED' ? '95.50' : status === 'PARTIAL' ? '67.25' : null,
        pageCount: status === 'PENDING' ? null : ctx.fakers.org.number.int({ min: 1, max: 4 }),
        processingTimeMs:
          status === 'PENDING' ? null : ctx.fakers.org.number.int({ min: 800, max: 8_500 }),
        errorMessage: status === 'FAILED' ? 'Provider returned 5xx (seeded)' : null,
        retryCount: status === 'FAILED' ? ctx.fakers.org.number.int({ min: 1, max: 3 }) : 0,
        createdAt: pastDateAfter(ctx.fakers.org, 30, ctx.foundedAt),
        completedAt,
      },
    });

    // PendingUpload precursor — only for half the rows so the Pending Upload
    // page shows both consumed and active rows. documentId @unique so ensure
    // we don't collide with an existing one.
    if (i % 2 !== 0) continue;
    const existing = await prisma.pendingUpload.findUnique({
      where: { documentId: f.documentId },
      select: { id: true },
    });
    if (existing) continue;
    const consumed = i % 4 === 0;
    await prisma.pendingUpload.create({
      data: {
        organizationId: ctx.organizationId,
        documentId: f.documentId,
        storageKey: `seed/uploads/${f.documentId}.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytesMax: 10 * 1024 * 1024,
        purpose: 'PORTAL_INVOICE_SUBMIT',
        createdByUserId: ctx.ownerUserId,
        expiresAt: futureDate(ctx.fakers.org, 7),
        consumedAt: consumed ? pastDateAfter(ctx.fakers.org, 7, ctx.foundedAt) : null,
        createdAt: pastDateAfter(ctx.fakers.org, 14, ctx.foundedAt),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// eSign envelopes + recipients + events — DocuSign-flavoured demo data so
// the contracts envelope timeline UI shows a real flow per status.
// ---------------------------------------------------------------------------

async function seedEsign(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractByContractor: ReadonlyMap<string, string>,
  contractors: readonly SeededContractor[],
): Promise<void> {
  if (contractByContractor.size === 0) return;

  // SigningEnvelope.integrationConnectionId is required — find an existing
  // DOCUSIGN connection (created by `seedIntegrationConnections` only when
  // showcase) or create one inline so envelopes always have a parent.
  let docusignConnection = await prisma.integrationConnection.findFirst({
    where: { organizationId: ctx.organizationId, provider: 'DOCUSIGN' },
    select: { id: true },
  });
  if (!docusignConnection) {
    docusignConnection = await prisma.integrationConnection.create({
      data: {
        organizationId: ctx.organizationId,
        provider: 'DOCUSIGN',
        status: 'CONNECTED',
        displayName: 'DocuSign (seed)',
        configJson: { seeded: true },
        credentialsRef: `seed:${ctx.org.key}:DOCUSIGN:${tokenHex(4)}`,
        connectedByUserId: ctx.ownerUserId,
        connectedAt: pastDateAfter(ctx.fakers.org, 180, ctx.foundedAt),
      },
      select: { id: true },
    });
  }

  // Pair each contract with its contractor for recipient details.
  const pairs = [...contractByContractor.entries()].map(([contractorId, contractId]) => ({
    contractorId,
    contractId,
    contractor: contractors.find(c => c.id === contractorId),
  }));
  const eligible = pairs.filter(p => p.contractor !== undefined);
  if (eligible.length === 0) return;

  const subset = ctx.org.showcase
    ? eligible.slice(0, Math.min(eligible.length, 6))
    : eligible.filter((_, i) => i % 3 === 0).slice(0, 4);
  const envelopeStatuses = ['CREATED', 'SENT', 'COMPLETED', 'DECLINED', 'VOIDED'] as const;

  const envelopeRows: Prisma.SigningEnvelopeCreateManyInput[] = [];
  const recipientRows: Prisma.SigningRecipientCreateManyInput[] = [];
  const eventRows: Prisma.SigningEventCreateManyInput[] = [];
  for (const [i, pair] of subset.entries()) {
    const contractor = pair.contractor;
    if (!contractor) continue;
    const status = envelopeStatuses[
      i % envelopeStatuses.length
    ] as (typeof envelopeStatuses)[number];
    const sentAt = status === 'CREATED' ? null : pastDateAfter(ctx.fakers.org, 60, ctx.foundedAt);
    const completedAt = status === 'COMPLETED' && sentAt ? advanceCapped(sentAt, 3) : null;
    const voidedAt = status === 'VOIDED' && sentAt ? advanceCapped(sentAt, 5) : null;

    const envelopeId = randomUUID();
    envelopeRows.push({
      id: envelopeId,
      organizationId: ctx.organizationId,
      integrationConnectionId: docusignConnection.id,
      provider: 'DOCUSIGN',
      externalEnvelopeId: `env-${tokenHex(8)}`,
      contractId: pair.contractId,
      status,
      message: 'Please sign the attached agreement (seed)',
      expiresAt: futureDate(ctx.fakers.org, 30),
      reminderIntervalDays: 3,
      sentByUserId: ctx.ownerUserId,
      sentAt,
      completedAt,
      voidedAt,
      voidReason: voidedAt ? 'Engagement cancelled (seed)' : null,
      createdAt: sentAt ?? pastDateAfter(ctx.fakers.org, 60, ctx.foundedAt),
    });

    // 2 recipients: the contractor (signer) + a counter-signer (org owner).
    recipientRows.push({
      signingEnvelopeId: envelopeId,
      externalRecipientId: `rcp-${tokenHex(6)}`,
      name: contractor.legalName,
      email: contractor.email,
      role: 'SIGNER',
      routingOrder: 1,
      status:
        status === 'COMPLETED'
          ? 'SIGNED'
          : status === 'DECLINED'
            ? 'DECLINED'
            : status === 'CREATED'
              ? 'PENDING'
              : 'DELIVERED',
      signedAt: status === 'COMPLETED' ? completedAt : null,
      declinedAt: status === 'DECLINED' && sentAt ? advanceCapped(sentAt, 1) : null,
      declineReason: status === 'DECLINED' ? 'Terms unacceptable (seed)' : null,
      viewedAt: sentAt ? advanceCapped(sentAt, 1) : null,
    });
    recipientRows.push({
      signingEnvelopeId: envelopeId,
      externalRecipientId: `rcp-${tokenHex(6)}`,
      name: 'Engager Counter-Signer',
      email: `${ctx.org.key}-countersigner@seed.local`,
      role: 'COUNTERSIGNER',
      routingOrder: 2,
      status: status === 'COMPLETED' ? 'SIGNED' : 'PENDING',
      signedAt: status === 'COMPLETED' ? completedAt : null,
      viewedAt: sentAt ?? null,
    });

    // 2–4 events spanning the lifecycle.
    const events: Array<{
      type:
        | 'ENVELOPE_CREATED'
        | 'ENVELOPE_SENT'
        | 'RECIPIENT_VIEWED'
        | 'RECIPIENT_SIGNED'
        | 'RECIPIENT_DECLINED'
        | 'ENVELOPE_COMPLETED'
        | 'ENVELOPE_VOIDED';
      at: Date;
      description: string;
    }> = [
      {
        type: 'ENVELOPE_CREATED',
        at: sentAt ?? pastDateAfter(ctx.fakers.org, 60, ctx.foundedAt),
        description: 'Envelope created (seed)',
      },
    ];
    if (sentAt)
      events.push({
        type: 'ENVELOPE_SENT',
        at: sentAt,
        description: 'Envelope sent to recipients',
      });
    if (sentAt)
      events.push({
        type: 'RECIPIENT_VIEWED',
        at: advanceCapped(sentAt, 1),
        description: 'Signer viewed envelope',
      });
    if (status === 'COMPLETED' && completedAt) {
      events.push({
        type: 'RECIPIENT_SIGNED',
        at: completedAt,
        description: 'All recipients signed',
      });
      events.push({
        type: 'ENVELOPE_COMPLETED',
        at: completedAt,
        description: 'Envelope completed',
      });
    }
    if (status === 'DECLINED' && sentAt) {
      events.push({
        type: 'RECIPIENT_DECLINED',
        at: advanceCapped(sentAt, 1),
        description: 'Signer declined',
      });
    }
    if (status === 'VOIDED' && voidedAt) {
      events.push({ type: 'ENVELOPE_VOIDED', at: voidedAt, description: 'Voided by sender' });
    }
    for (const e of events) {
      eventRows.push({
        organizationId: ctx.organizationId,
        signingEnvelopeId: envelopeId,
        eventType: e.type,
        actorName: contractor.legalName,
        actorEmail: contractor.email,
        description: e.description,
        providerEventId: `evt-${tokenHex(8)}`,
        occurredAt: e.at,
      });
    }
  }

  // Wave: parent SigningEnvelope → child SigningRecipient + SigningEvent.
  for (let i = 0; i < envelopeRows.length; i += 1000) {
    await prisma.signingEnvelope.createMany({
      data: envelopeRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < recipientRows.length; i += 1000) {
    await prisma.signingRecipient.createMany({
      data: recipientRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < eventRows.length; i += 1000) {
    await prisma.signingEvent.createMany({
      data: eventRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Tax / legal compliance — Statusfeststellungsverfahren (DE), IR35 chain (UK),
// SDS approval, TaxIdValidation, EconomicDependencyAlertState,
// ReassessmentTrigger, WhtCertificate. Showcase intentionally spreads rows
// across jurisdictions so every dashboard widget renders non-empty even
// though a single org normally only has one residency.
// ---------------------------------------------------------------------------

async function seedTaxCompliance(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
): Promise<void> {
  if (contractors.length === 0) return;

  const assignments = await prisma.contractorAssignment.findMany({
    where: {
      organizationId: ctx.organizationId,
      contractorId: { in: contractors.map(c => c.id) },
    },
    select: { id: true, contractorId: true },
  });
  if (assignments.length === 0) return;
  const assignmentByContractor = new Map<string, string>();
  for (const a of assignments) assignmentByContractor.set(a.contractorId, a.id);

  const eligible = contractors.filter(c => assignmentByContractor.has(c.id));
  if (eligible.length === 0) return;

  const orgCountry = ctx.profile.countryCode;
  const showcase = ctx.org.showcase;

  // -------------------------------------------------------------------
  // Statusfeststellungsverfahren — DE only in real life; showcase forces
  // a tranche so the DRV dashboard renders in any-country showcase orgs.
  // -------------------------------------------------------------------
  const statusEligible = showcase
    ? eligible.slice(0, Math.max(1, Math.floor(eligible.length / 3)))
    : orgCountry === 'DE'
      ? eligible.filter((_, i) => i % 4 === 0).slice(0, 5)
      : [];
  const statusOutcomes = ['PENDING', 'SELBSTANDIG', 'ABHANGIG', 'WITHDRAWN'] as const;
  const statusRows: Prisma.StatusfeststellungsverfahrenCreateManyInput[] = [];
  for (const [i, c] of statusEligible.entries()) {
    const assignmentId = assignmentByContractor.get(c.id);
    if (!assignmentId) continue;
    const outcome = statusOutcomes[i % statusOutcomes.length] as (typeof statusOutcomes)[number];
    const filedAt = pastDateAfter(ctx.fakers.org, 540, ctx.foundedAt);
    const validFromDate = outcome === 'PENDING' ? null : advanceCapped(filedAt, 30);
    const validToDate = outcome === 'PENDING' ? null : futureDate(ctx.fakers.org, 365);
    statusRows.push({
      organizationId: ctx.organizationId,
      contractorAssignmentId: assignmentId,
      filedAt: dateOnly(filedAt),
      drvReference: `DRV-${tokenHex(4).toUpperCase()}`,
      outcome,
      validFrom: validFromDate ? dateOnly(validFromDate) : null,
      validTo: validToDate ? dateOnly(validToDate) : null,
      notes: ctx.fakers.org.lorem.sentence(),
      createdAt: filedAt,
    });
  }
  for (let i = 0; i < statusRows.length; i += 1000) {
    await prisma.statusfeststellungsverfahren.createMany({
      data: statusRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------
  // IR35 chain participants + other-client attestation — UK/GB.
  // -------------------------------------------------------------------
  const ir35Eligible = showcase
    ? eligible.slice(
        Math.floor(eligible.length / 3),
        Math.max(1, Math.floor((2 * eligible.length) / 3)),
      )
    : orgCountry === 'GB'
      ? eligible.filter((_, i) => i % 4 === 0).slice(0, 5)
      : [];
  const ir35Roles = ['CLIENT', 'AGENCY', 'PSC', 'WORKER'] as const;
  const chainRows: Prisma.Ir35ChainParticipantCreateManyInput[] = [];
  const attestationRows: Prisma.Ir35OtherClientAttestationCreateManyInput[] = [];
  for (const c of ir35Eligible) {
    const assignmentId = assignmentByContractor.get(c.id);
    if (!assignmentId) continue;
    for (const [orderIndex, role] of ir35Roles.entries()) {
      const sdsDeliveredAt =
        role === 'CLIENT' ? null : pastDateAfter(ctx.fakers.org, 90, ctx.foundedAt);
      chainRows.push({
        organizationId: ctx.organizationId,
        contractorAssignmentId: assignmentId,
        role,
        orderIndex,
        displayName: role === 'WORKER' ? c.legalName : ctx.fakers.org.company.name(),
        contactEmail: role === 'WORKER' ? c.email : ctx.fakers.ascii.internet.email(),
        sdsDeliveredAt,
        sdsAcknowledgedAt: sdsDeliveredAt
          ? advanceCapped(sdsDeliveredAt, ctx.fakers.org.number.int({ min: 1, max: 7 }))
          : null,
        createdAt: sdsDeliveredAt ?? pastDateAfter(ctx.fakers.org, 60, ctx.foundedAt),
      });
    }
    // OtherClientAttestation has @unique on contractorAssignmentId;
    // skipDuplicates: true on the createMany covers re-seed collisions.
    const signedAt = pastDateAfter(ctx.fakers.org, 60, ctx.foundedAt);
    attestationRows.push({
      organizationId: ctx.organizationId,
      contractorAssignmentId: assignmentId,
      statementText: ctx.fakers.org.lorem.paragraph(),
      signedName: c.legalName,
      signedAt,
      createdAt: signedAt,
    });
  }
  for (let i = 0; i < chainRows.length; i += 1000) {
    await prisma.ir35ChainParticipant.createMany({
      data: chainRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < attestationRows.length; i += 1000) {
    await prisma.ir35OtherClientAttestation.createMany({
      data: attestationRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------
  // TaxIdValidation — audit-trail rows in mixed states. Only TaxIdType
  // values supported by the schema enum (GB_VAT, DE_USTIDNR).
  // -------------------------------------------------------------------
  const taxValEligible = eligible.filter((_, i) => i % 3 === 0).slice(0, 8);
  const taxValStatuses = ['valid', 'invalid', 'stale', 'unavailable'] as const;
  const taxIdType = orgCountry === 'GB' ? 'GB_VAT' : 'DE_USTIDNR';
  const taxValRows: Prisma.TaxIdValidationCreateManyInput[] = [];
  for (const [i, c] of taxValEligible.entries()) {
    const status = taxValStatuses[i % taxValStatuses.length] as (typeof taxValStatuses)[number];
    const requestedAt = pastDateAfter(ctx.fakers.org, 180, ctx.foundedAt);
    const taxIdValue = makeVatId(orgCountry, ctx.fakers.org).slice(0, 20);
    taxValRows.push({
      organizationId: ctx.organizationId,
      contractorId: c.id,
      taxIdType,
      taxIdValue,
      apiProvider: orgCountry === 'GB' ? 'HMRC' : 'VIES',
      requestedAt,
      validFrom:
        status === 'valid' ? dateBetween(ctx.fakers.org, ctx.foundedAt, requestedAt) : null,
      validTo: status === 'valid' ? futureDate(ctx.fakers.org, 365) : null,
      confirmationRef: status === 'valid' ? `CONF-${tokenHex(6).toUpperCase()}` : null,
      responseStatus: status,
      responseBody: { seeded: true, status },
      errorMessage: status === 'unavailable' ? 'upstream timeout (seeded)' : null,
    });
  }
  for (let i = 0; i < taxValRows.length; i += 1000) {
    await prisma.taxIdValidation.createMany({
      data: taxValRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------
  // EconomicDependencyAlertState — unique per assignment so we have to
  // skip-on-conflict.
  // -------------------------------------------------------------------
  const ecoEligible = eligible.filter((_, i) => i % 5 === 0).slice(0, 6);
  const ecoBands = ['safe', 'warning', 'critical'] as const;
  // Schema says Decimal(5,4) — 4 fractional digits, ≤1 (share).
  const lastBillingShareByBand: Record<(typeof ecoBands)[number], string> = {
    safe: '0.4500',
    warning: '0.7200',
    critical: '0.8500',
  };
  // Track assignmentIds locally to avoid colliding the @unique constraint
  // within the loop; skipDuplicates: true covers cross-run reseed.
  const ecoSeen = new Set<string>();
  const ecoRows: Prisma.EconomicDependencyAlertStateCreateManyInput[] = [];
  for (const [i, c] of ecoEligible.entries()) {
    const assignmentId = assignmentByContractor.get(c.id);
    if (!assignmentId || ecoSeen.has(assignmentId)) continue;
    ecoSeen.add(assignmentId);
    const band = ecoBands[i % ecoBands.length] as (typeof ecoBands)[number];
    ecoRows.push({
      organizationId: ctx.organizationId,
      contractorAssignmentId: assignmentId,
      currentBand: band,
      lastBillingShare: lastBillingShareByBand[band],
      lastScannedAt: pastDate(ctx.fakers.org, 1),
      lastCrossedAt: band === 'safe' ? null : pastDate(ctx.fakers.org, 30),
    });
  }
  for (let i = 0; i < ecoRows.length; i += 1000) {
    await prisma.economicDependencyAlertState.createMany({
      data: ecoRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------
  // ReassessmentTrigger — needs ClassificationAssessment rows; harmless
  // no-op when classification produced none.
  // -------------------------------------------------------------------
  const completedAssessments = await prisma.classificationAssessment.findMany({
    where: { organizationId: ctx.organizationId, status: 'completed' },
    select: { id: true, contractorAssignmentId: true },
    take: showcase ? 6 : 3,
  });
  const triggerStatuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as const;
  const triggerRows: Prisma.ReassessmentTriggerCreateManyInput[] = [];
  for (const [i, a] of completedAssessments.entries()) {
    const status = triggerStatuses[i % triggerStatuses.length] as (typeof triggerStatuses)[number];
    const triggeredAt = pastDate(ctx.fakers.org, 60);
    triggerRows.push({
      organizationId: ctx.organizationId,
      contractorAssignmentId: a.contractorAssignmentId,
      priorAssessmentId: a.id,
      triggeredAt,
      triggerReasons: {
        reasons: ['MATERIAL_CHANGE_RATE', 'MATERIAL_CHANGE_SCOPE'],
        source: 'seed',
      },
      status,
      acknowledgedByUserId: status === 'OPEN' ? null : ctx.ownerUserId,
      acknowledgedAt:
        status === 'OPEN'
          ? null
          : advanceCapped(triggeredAt, ctx.fakers.org.number.int({ min: 1, max: 5 })),
      resolvedAt:
        status === 'RESOLVED'
          ? advanceCapped(triggeredAt, ctx.fakers.org.number.int({ min: 6, max: 14 }))
          : null,
      dismissedByUserId: status === 'DISMISSED' ? ctx.ownerUserId : null,
      dismissedAt:
        status === 'DISMISSED'
          ? advanceCapped(triggeredAt, ctx.fakers.org.number.int({ min: 6, max: 14 }))
          : null,
      dismissedReason: status === 'DISMISSED' ? 'False positive (seeded)' : null,
      createdAt: triggeredAt,
    });
  }
  for (let i = 0; i < triggerRows.length; i += 1000) {
    await prisma.reassessmentTrigger.createMany({
      data: triggerRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------
  // WhtCertificate — needs PaymentRunItem (FK). Sample a handful.
  // -------------------------------------------------------------------
  const paymentItems = await prisma.paymentRunItem.findMany({
    where: { organizationId: ctx.organizationId },
    select: {
      id: true,
      contractorId: true,
      amountMinor: true,
      currency: true,
    },
    take: showcase ? 5 : 3,
  });
  const whtRows: Prisma.WhtCertificateCreateManyInput[] = [];
  for (const item of paymentItems) {
    const c = contractors.find(co => co.id === item.contractorId);
    if (!c) continue;
    const ratePct = ctx.fakers.org.helpers.arrayElement(['5.00', '10.00', '15.00']);
    const rateNum = Number.parseFloat(ratePct);
    const whtAmt = Math.round((item.amountMinor * rateNum) / 100);
    const certNumber = `WHT-${ctx.org.key}-${tokenHex(4).toUpperCase()}`;
    whtRows.push({
      organizationId: ctx.organizationId,
      paymentRunItemId: item.id,
      certificateNumber: certNumber,
      grossAmountMinor: item.amountMinor,
      whtRate: ratePct,
      whtAmountMinor: whtAmt,
      netAmountMinor: item.amountMinor - whtAmt,
      currency: item.currency,
      contractorName: c.legalName,
      contractorTaxId: makeTaxId(orgCountry, ctx.fakers.org),
      contractorCountry: orgCountry,
      treatyApplied: ctx.fakers.org.datatype.boolean({ probability: 0.3 }),
      treatyReference: null,
      paymentDate: dateOnly(pastDate(ctx.fakers.org, 30)),
      generatedByUserId: ctx.ownerUserId,
    });
  }
  for (let i = 0; i < whtRows.length; i += 1000) {
    await prisma.whtCertificate.createMany({
      data: whtRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Timesheets — weekly time-tracking sheets with individual time entries.
// ---------------------------------------------------------------------------

async function seedTimesheets(
  prisma: PrismaClient,
  ctx: OrgSeed,
  contractors: readonly SeededContractor[],
  contractByContractor: ReadonlyMap<string, string>,
): Promise<void> {
  if (contractors.length === 0) return;

  const now = new Date();

  const toMonday = (d: Date): Date => {
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const m = new Date(d);
    m.setUTCDate(m.getUTCDate() + diff);
    m.setUTCHours(0, 0, 0, 0);
    return m;
  };

  const weekDescriptions = [
    'Backend API implementation',
    'Frontend dashboard work',
    'Code review and refactoring',
    'Bug fixes and testing',
    'Architecture planning',
    'Documentation and specs',
    'DevOps and CI/CD setup',
    'Feature development',
  ];

  for (const contractor of contractors) {
    const contractId = contractByContractor.get(contractor.id);
    if (!contractId) continue;

    const weekCount = ctx.fakers.org.number.int({ min: 4, max: 8 });
    const currentMonday = toMonday(now);

    for (let w = 0; w < weekCount; w += 1) {
      const weekStart = new Date(currentMonday);
      weekStart.setUTCDate(weekStart.getUTCDate() - w * 7);

      let status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
      if (w === 0) {
        status = 'DRAFT';
      } else if (w === 1) {
        status = 'SUBMITTED';
      } else if (ctx.fakers.org.datatype.boolean({ probability: 0.15 })) {
        status = 'REJECTED';
      } else {
        status = 'APPROVED';
      }

      const submittedAt =
        status === 'DRAFT'
          ? null
          : advanceCapped(weekStart, ctx.fakers.org.number.int({ min: 4, max: 6 }));
      const reviewedAt =
        status === 'APPROVED' || status === 'REJECTED'
          ? advanceCapped(weekStart, ctx.fakers.org.number.int({ min: 5, max: 7 }))
          : null;
      const reviewer = reviewedAt ? ctx.fakers.org.helpers.arrayElement(ctx.users) : null;

      const sheet = await prisma.timesheet.create({
        data: {
          organizationId: ctx.organizationId,
          contractorId: contractor.id,
          weekStartDate: dateOnly(weekStart),
          status,
          totalMinutes: 0,
          submittedAt,
          reviewedAt,
          reviewedByUserId: reviewer?.id ?? null,
          rejectionReason: status === 'REJECTED' ? ctx.fakers.org.lorem.sentence() : null,
          createdAt: weekStart,
        },
        select: { id: true },
      });

      const entryCount = ctx.fakers.org.number.int({ min: 3, max: 5 });
      const usedDays = new Set<number>();
      const entries: Prisma.TimeEntryCreateManyInput[] = [];

      let totalMinutes = 0;
      for (let e = 0; e < entryCount; e += 1) {
        let dayOffset: number;
        do {
          dayOffset = ctx.fakers.org.number.int({ min: 0, max: 4 });
        } while (usedDays.has(dayOffset));
        usedDays.add(dayOffset);

        const entryDate = new Date(weekStart);
        entryDate.setUTCDate(entryDate.getUTCDate() + dayOffset);

        const minutes = ctx.fakers.org.number.int({ min: 120, max: 480 });
        totalMinutes += minutes;

        entries.push({
          organizationId: ctx.organizationId,
          timesheetId: sheet.id,
          contractorId: contractor.id,
          contractId,
          entryDate: dateOnly(entryDate),
          minutes,
          description: ctx.fakers.org.helpers.arrayElement(weekDescriptions),
          source: 'MANUAL',
          createdAt: weekStart,
        });
      }

      await prisma.timeEntry.createMany({ data: entries });
      await prisma.timesheet.update({
        where: { id: sheet.id },
        data: { totalMinutes },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Per-org orchestration
// ---------------------------------------------------------------------------

interface SeedSummary {
  region: 'EU' | 'ME';
  orgKey: string;
  organizationId: string;
  organizationName: string;
  countryCode: string;
  /** Per-user logins. The shared password lives on the runSeed-level `password`. */
  users: SeededUser[];
  contractors: number;
  invoices: number;
}

/**
 * Conditionally execute a seed section based on the resolved omit set, then
 * always tick the reporter so the progress bar advances regardless of skip
 * (keeps the bar at 100% in `--omit` runs). Returns the seeder's value or the
 * caller-supplied fallback when the section is omitted.
 */
async function gateSection<T>(
  omitted: ReadonlySet<SectionKey>,
  key: SectionKey,
  orgKey: string,
  fallback: T,
  fn: () => Promise<T>,
): Promise<T> {
  const result = omitted.has(key) ? fallback : await fn();
  reporter.tick(orgKey, key);
  return result;
}

async function seedOrg(
  prisma: PrismaClient,
  org: OrgVolume,
  passwordHash: string,
  baseSeed: number,
  orgIndex: number,
  omitted: ReadonlySet<SectionKey>,
): Promise<SeedSummary> {
  // Determine the org's country/locale/currency profile
  const profileFaker = new Faker({ locale: [en] });
  profileFaker.seed(baseSeed + orgIndex * 13);
  const profile = pickRegionProfile(org.region, profileFaker);
  const fakers = makeFakers(org.region, profile.countryCode, baseSeed + orgIndex * 17);

  log.info(
    {
      region: org.region,
      orgKey: org.key,
      users: org.usersPerOrg,
      contractors: org.contractorsPerOrg,
    },
    'seeding org',
  );

  const users = await seedUsersForOrg(prisma, org.key, fakers.org, org.usersPerOrg, passwordHash);

  const orgCore = await seedOrganizationCore(prisma, org, profile, users, fakers);

  const ctx: OrgSeed = {
    org,
    profile,
    users,
    ownerUserId: orgCore.ownerUserId,
    fakers,
    organizationId: orgCore.organizationId,
    foundedAt: orgCore.foundedAt,
  };

  // Refs accumulate as each layer creates real rows; later layers (audit,
  // notifications) sample from this list so their resourceId / entityId
  // columns point at entities that actually exist.
  const refs: EntityRef[] = [];

  const contractors = await gateSection(
    omitted,
    'contractors',
    org.key,
    [] as readonly SeededContractor[],
    () =>
      seedContractors(
        prisma,
        ctx,
        orgCore.teamIds,
        orgCore.projectIds,
        orgCore.costCenterIds,
        refs,
      ),
  );

  const contractByContractor = await gateSection(
    omitted,
    'contracts',
    org.key,
    new Map<string, string>() as ReadonlyMap<string, string>,
    () => seedContracts(prisma, ctx, contractors, refs),
  );

  // ApprovalChainConfig has no public section key — it's an implicit
  // dependency of `seedInvoices`. Always create when not all of {contractors,
  // invoices} are omitted, so the invoice seeder can wire approvals.
  const approvalChainConfigId = omitted.has('invoices')
    ? null
    : await seedApprovalChainConfig(prisma, ctx);

  const invoices = await gateSection(
    omitted,
    'invoices',
    org.key,
    [] as SeededInvoice[],
    async () => {
      const seeded = await seedInvoices(
        prisma,
        ctx,
        contractors,
        contractByContractor,
        approvalChainConfigId,
        refs,
      );
      // Match results + intake history bundle into the invoices section (no
      // separate omit key) — they're invoice metadata, not standalone
      // surfaces.
      await seedInvoiceMatchAndIntake(prisma, ctx, seeded);
      return seeded;
    },
  );

  // Equipment is seeded BEFORE payment runs / reminders so its refs are
  // available for downstream seeders that sample real entities.
  await gateSection(omitted, 'equipment', org.key, undefined, () =>
    seedEquipment(prisma, ctx, contractors, refs),
  );
  await gateSection(omitted, 'payment-runs', org.key, undefined, () =>
    seedPaymentRuns(prisma, ctx, invoices, refs),
  );
  // Skonto sits after payment-runs because SkontoApplication FK targets a
  // PaymentRunItem.
  await gateSection(omitted, 'skonto', org.key, undefined, () => seedSkonto(prisma, ctx, invoices));
  await gateSection(omitted, 'interest', org.key, undefined, () =>
    seedInvoiceInterest(prisma, ctx, invoices),
  );
  await gateSection(omitted, 'peppol', org.key, undefined, () =>
    seedPeppol(prisma, ctx, invoices, contractors),
  );
  await gateSection(omitted, 'zatca', org.key, undefined, () => seedZatca(prisma, ctx, invoices));
  await gateSection(omitted, 'reminders', org.key, undefined, () =>
    seedReminders(prisma, ctx, invoices, refs),
  );
  await gateSection(omitted, 'notifications', org.key, undefined, () =>
    seedNotifications(prisma, ctx, refs),
  );
  await gateSection(omitted, 'outbox', org.key, undefined, () => seedOutbox(prisma, ctx, refs));
  await gateSection(omitted, 'webhook-deliveries', org.key, undefined, () =>
    seedWebhookDeliveries(prisma, ctx),
  );
  await gateSection(omitted, 'audit-logs', org.key, undefined, () =>
    seedAuditLogs(prisma, ctx, refs),
  );
  await gateSection(omitted, 'e-invoice-lifecycle', org.key, undefined, () =>
    seedEInvoiceLifecycle(prisma, ctx, invoices),
  );
  await gateSection(omitted, 'portal-sessions', org.key, undefined, () =>
    seedPortalSessions(prisma, ctx, contractors),
  );
  await gateSection(omitted, 'integration-connections', org.key, undefined, () =>
    seedIntegrationConnections(prisma, ctx),
  );
  // eSign sits after integration-connections so the DOCUSIGN connection
  // exists for SigningEnvelope.integrationConnectionId.
  await gateSection(omitted, 'esign', org.key, undefined, () =>
    seedEsign(prisma, ctx, contractByContractor, contractors),
  );
  await gateSection(omitted, 'invoice-documents', org.key, undefined, () =>
    seedInvoiceDocuments(prisma, ctx, invoices),
  );
  // OCR runs after invoice-documents because OcrExtraction.documentId points
  // at Document rows materialised by `seedInvoiceDocuments`.
  await gateSection(omitted, 'ocr', org.key, undefined, () => seedOcr(prisma, ctx));
  await gateSection(omitted, 'exchange-rates', org.key, undefined, () =>
    seedExchangeRates(prisma, ctx, invoices, contractors),
  );
  await gateSection(omitted, 'consent', org.key, undefined, () =>
    seedConsentAndPrivacy(prisma, ctx, contractors),
  );
  await gateSection(omitted, 'api-keys', org.key, undefined, () => seedApiKeys(prisma, ctx));
  await gateSection(omitted, 'pinned-views', org.key, undefined, () =>
    seedPinnedViews(prisma, ctx),
  );
  await gateSection(omitted, 'cron-state', org.key, undefined, () =>
    seedCronAndObservability(prisma, ctx),
  );
  await gateSection(omitted, 'auth-surface', org.key, undefined, () =>
    seedAuthSurface(prisma, ctx, contractors),
  );
  await gateSection(omitted, 'workflow-templates', org.key, undefined, () =>
    seedWorkflowTemplates(prisma, ctx),
  );
  await gateSection(omitted, 'subscription', org.key, undefined, () =>
    seedSubscription(prisma, ctx),
  );
  await gateSection(omitted, 'courier-configs', org.key, undefined, () =>
    seedCourierConfigs(prisma, ctx),
  );
  await gateSection(omitted, 'comments', org.key, undefined, () => seedComments(prisma, ctx, refs));
  await gateSection(omitted, 'classification', org.key, undefined, () =>
    seedClassification(prisma, ctx, contractors),
  );
  await gateSection(omitted, 'tax-compliance', org.key, undefined, () =>
    seedTaxCompliance(prisma, ctx, contractors),
  );
  await gateSection(omitted, 'workflow-runs', org.key, undefined, () =>
    seedWorkflowRuns(prisma, ctx, contractors),
  );
  await gateSection(omitted, 'timesheets', org.key, undefined, () =>
    seedTimesheets(prisma, ctx, contractors, contractByContractor),
  );

  return {
    region: org.region,
    orgKey: org.key,
    organizationId: orgCore.organizationId,
    organizationName: orgCore.organizationName,
    countryCode: profile.countryCode,
    users,
    contractors: contractors.length,
    invoices: invoices.length,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Print compact tabular summaries of seeded orgs + per-user logins so the
 * person clicking through the app has copy-pasteable credentials and IDs.
 * Written directly to stdout (not via pino) so the box-drawing characters
 * survive JSON serialisation.
 */
/**
 * Each section's primary "headline" table. Used by the end-of-run section
 * counts table — one count per section is enough to confirm the section
 * fired without spamming the user with 30 tables.
 */
const SECTION_COUNT_TABLES: ReadonlyArray<{ section: SectionKey; table: string }> = [
  { section: 'contractors', table: 'Contractor' },
  { section: 'contracts', table: 'Contract' },
  { section: 'invoices', table: 'Invoice' },
  { section: 'equipment', table: 'Equipment' },
  { section: 'payment-runs', table: 'PaymentRunItem' },
  { section: 'reminders', table: 'ReminderInstance' },
  { section: 'notifications', table: 'Notification' },
  { section: 'outbox', table: 'OutboxEvent' },
  { section: 'webhook-deliveries', table: 'WebhookDelivery' },
  { section: 'audit-logs', table: 'AuditLog' },
  { section: 'e-invoice-lifecycle', table: 'EInvoiceLifecycle' },
  { section: 'portal-sessions', table: 'PortalSession' },
  { section: 'integration-connections', table: 'IntegrationConnection' },
  { section: 'invoice-documents', table: 'InvoiceFile' },
  { section: 'workflow-templates', table: 'WorkflowTemplate' },
  { section: 'subscription', table: 'Subscription' },
  { section: 'courier-configs', table: 'CourierConfig' },
  { section: 'comments', table: 'Comment' },
  { section: 'workflow-runs', table: 'WorkflowRun' },
  { section: 'timesheets', table: 'Timesheet' },
  { section: 'tax-compliance', table: 'Statusfeststellungsverfahren' },
  { section: 'classification', table: 'ClassificationAssessment' },
  { section: 'skonto', table: 'SkontoTerm' },
  { section: 'interest', table: 'InvoiceInterestClaim' },
  { section: 'peppol', table: 'PeppolTransmission' },
  { section: 'zatca', table: 'ZatcaInvoiceChain' },
  { section: 'esign', table: 'SigningEnvelope' },
  { section: 'ocr', table: 'OcrExtraction' },
  { section: 'exchange-rates', table: 'ExchangeRate' },
  { section: 'consent', table: 'ConsentRecord' },
  { section: 'api-keys', table: 'OrganizationApiKey' },
  { section: 'pinned-views', table: 'UserPinnedView' },
  { section: 'cron-state', table: 'CronScanState' },
  { section: 'auth-surface', table: 'Session' },
];

/**
 * Fetch row counts for every section's headline table across every region's
 * client and sum them. Missing tables (42P01 on a fresh schema) are reported
 * as `0` rather than crashing the summary.
 */
async function fetchSectionCounts(
  clients: ReadonlyMap<'EU' | 'ME', PrismaClient>,
): Promise<Map<SectionKey, number>> {
  const totals = new Map<SectionKey, number>();
  for (const { section, table } of SECTION_COUNT_TABLES) {
    let total = 0;
    for (const client of clients.values()) {
      try {
        const rows = await client.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*)::bigint AS count FROM "${table}"`,
        );
        total += Number(rows[0]?.count ?? 0);
      } catch {
        /* table missing on a freshly-pushed schema; treat as 0 */
      }
    }
    totals.set(section, total);
  }
  return totals;
}

function printSectionCountsTable(
  totals: ReadonlyMap<SectionKey, number>,
  omitted: ReadonlySet<SectionKey>,
): void {
  const table = new CliTable3({
    head: ['Section', 'Rows', 'Status'],
    style: { head: ['cyan'], border: ['gray'] },
  });
  for (const { section } of SECTION_COUNT_TABLES) {
    const count = totals.get(section) ?? 0;
    const status = omitted.has(section) ? 'omitted' : count > 0 ? 'ok' : 'empty';
    table.push([section, count.toLocaleString('en-US'), status]);
  }
  process.stdout.write('Section row counts (sum across regions):\n');
  process.stdout.write(`${table.toString()}\n\n`);
}

function printSummaryTables(summaries: readonly SeedSummary[], password: string): void {
  if (summaries.length === 0) return;

  const orgTable = new CliTable3({
    head: ['Region', 'Key', 'Country', 'Organization', 'ID'],
    style: { head: ['cyan'], border: ['gray'] },
    wordWrap: true,
  });
  for (const s of summaries) {
    orgTable.push([s.region, s.orgKey, s.countryCode, s.organizationName, s.organizationId]);
  }

  const loginTable = new CliTable3({
    head: ['Org Key', 'Email', 'Role', 'Name', 'User ID'],
    style: { head: ['cyan'], border: ['gray'] },
    wordWrap: true,
  });
  for (const s of summaries) {
    for (const u of s.users) {
      loginTable.push([s.orgKey, u.email, u.role, u.name, u.id]);
    }
  }

  process.stdout.write('\n');
  process.stdout.write('Seeded organizations:\n');
  process.stdout.write(`${orgTable.toString()}\n`);
  process.stdout.write('\n');
  process.stdout.write(`Logins (shared password: ${password}):\n`);
  process.stdout.write(`${loginTable.toString()}\n`);
  process.stdout.write('\n');
  process.stdout.write(
    `Tip: every seeded user shares the same password. Override via SEED_PASSWORD env var.\n\n`,
  );
}

async function runSeed(flags: CliFlags): Promise<void> {
  ensureSafeEnvironment(flags);

  // Resolve --omit transitive closure up-front so the user sees exactly which
  // sections will run (and why others were skipped) BEFORE the wipe begins.
  const omitResolution = expandOmittedSections(flags.omit);

  const orgsPlanned = applyOverrides(buildOrgs(flags.profile, flags.regions), flags);
  if (orgsPlanned.length === 0) {
    log.warn('no orgs to seed (profile/regions/orgs overrides cancelled all)');
    return;
  }

  // Activate the bottom-anchored progress bar and re-pipe pino through
  // MultiBar.log() so log lines scroll above the bar instead of fighting it
  // for the last terminal row.
  let barReporter: BarReporter | null = null;
  if (flags.progress) {
    barReporter = new BarReporter();
    reporter = barReporter;
    log = createSeedPrettyLogger(barReporter.asLogSink());
    reporter.start(orgsPlanned.length * PHASES_PER_ORG);
  }

  // Print the resolved omit summary in both modes. In --progress mode it goes
  // through MultiBar.log() so it lands above the bar; otherwise straight to
  // stdout (the bar isn't active yet).
  printOmitSummary(flags.omit, omitResolution, line => {
    if (barReporter) {
      barReporter.logRaw(line);
    } else {
      process.stdout.write(line);
    }
  });

  const password = process.env.SEED_PASSWORD ?? 'Test1234!';
  const passwordHash = await hashPassword(password);

  // Build a region → URL → client map
  const regionUrls = new Map<'EU' | 'ME', string>();
  for (const r of flags.regions) {
    const explicit = process.env[`DATABASE_URL_${r}`];
    const fallback = r === 'EU' ? process.env.DATABASE_URL : undefined;
    const url = explicit ?? fallback;
    if (!url) {
      log.warn({ region: r, envVar: `DATABASE_URL_${r}` }, 'env var missing — skipping region');
      continue;
    }
    ensureSafeDbUrl(url, r);
    regionUrls.set(r, url);
  }
  if (regionUrls.size === 0) {
    throw new Error('no DB URLs configured for the requested regions');
  }

  const clients = new Map<'EU' | 'ME', PrismaClient>();
  for (const [region, url] of regionUrls) {
    clients.set(region, createPrismaClientForUrl(url));
  }

  if (flags.append) {
    log.info(
      { regions: [...regionUrls.keys()] },
      'append mode — skipping tenant wipe; new rows will sit alongside existing data',
    );
  } else {
    log.warn({ regions: [...regionUrls.keys()] }, 'wipe phase starting (--confirm)');
    for (const [region, client] of clients) {
      await wipeAllTenantData(client, region, omitResolution.resolved);
    }
  }

  const summaries: SeedSummary[] = [];
  let orgIndex = 0;
  for (const org of orgsPlanned) {
    const client = clients.get(org.region);
    if (!client) {
      log.warn({ region: org.region, orgKey: org.key }, 'no client for region — skipping org');
      orgIndex += 1;
      continue;
    }
    const summary = await seedOrg(
      client,
      org,
      passwordHash,
      flags.seed,
      orgIndex,
      omitResolution.resolved,
    );
    summaries.push(summary);
    orgIndex += 1;
  }

  reporter.stop();
  // After the bar is gone, restore the default stdout-pretty logger so the
  // final recap lands on a normal line (instead of trying to go through the
  // now-stopped MultiBar sink).
  if (flags.progress) {
    log = createSeedPrettyLogger(process.stdout);
  }

  // Final summary line
  const totals = summaries.reduce(
    (acc, s) => ({
      users: acc.users + s.users.length,
      contractors: acc.contractors + s.contractors,
      invoices: acc.invoices + s.invoices,
    }),
    { users: 0, contractors: 0, invoices: 0 },
  );
  log.info(
    {
      profile: flags.profile,
      regions: [...regionUrls.keys()],
      orgs: summaries.length,
      ...totals,
    },
    'seed completed',
  );

  // Tabular dump of useful test data — printed directly to stdout (not via
  // pino) so the ASCII box drawing isn't escaped into JSON.
  printSummaryTables(summaries, password);

  // Per-section row counts so a developer can spot a section that fired but
  // produced 0 rows at a glance.
  const sectionTotals = await fetchSectionCounts(clients);
  printSectionCountsTable(sectionTotals, omitResolution.resolved);

  // QA walk-and-fix fixtures — only when the `qa` profile is active. Looks
  // up qa-default-org by metadata across all configured regions, then writes
  // a deterministic admin / accountant / portal-contractor identity into
  // that org plus a QA_* marker block in repo-root .env.
  if (flags.profile === 'qa') {
    let seeded = false;
    for (const client of clients.values()) {
      const result = await seedQaFixtureUsers(client, log);
      if (result) {
        seeded = true;
        break;
      }
    }
    if (!seeded) {
      log.warn('qa fixtures: no qa-default-org found in any configured region — skipping');
    }
  }

  for (const client of clients.values()) {
    await client.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// CLI definition (citty) — auto-generated --help, type-safe args
// ---------------------------------------------------------------------------

const PROFILE_NAMES = [
  'empty',
  'solo',
  'small',
  'medium',
  'huge',
  'showcase',
  'all',
  'qa',
] as const satisfies readonly ProfileName[];

function parseNonNegInt(raw: string | undefined, flag: string): number | undefined {
  if (!raw) return;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`flag --${flag} must be a non-negative integer (got "${raw}")`);
  }
  return n;
}

const cli = defineCommand({
  meta: {
    name: 'seed-dev',
    version: '0.1.0',
    description: 'Comprehensive dev/test data seed. NOT FOR PRODUCTION.',
  },
  args: {
    profile: {
      type: 'enum',
      description: 'Volume tier',
      options: [...PROFILE_NAMES],
      default: 'small',
    },
    regions: {
      type: 'string',
      description: 'Comma-separated regions: EU,ME',
      default: 'EU',
    },
    seed: {
      type: 'string',
      description: 'Faker seed (deterministic)',
      default: '42',
    },
    confirm: {
      type: 'boolean',
      description: 'REQUIRED (or pass --append). Wipes tenant data first.',
      default: false,
    },
    append: {
      type: 'boolean',
      description:
        'Skip wipe and seed on top of existing data. Each run creates fresh orgs (no slug collisions). Implies no destruction.',
      default: false,
    },
    progress: {
      type: 'boolean',
      description:
        'Bottom-anchored progress bar (logs scroll above). Pass --no-progress to stream phase log lines instead.',
      default: true,
    },
    orgs: {
      type: 'string',
      description: 'Override profile org count (range 1–8 across profiles)',
    },
    'users-per-org': {
      type: 'string',
      description: 'Override users per org (range 1–30 across profiles)',
    },
    'contractors-per-org': {
      type: 'string',
      description: 'Override contractors per org (range 0–1000 across profiles)',
    },
    'invoices-per-contractor': {
      type: 'string',
      description: 'Override invoices per contractor (sets both min and max)',
    },
    omit: {
      type: 'string',
      description:
        'Skip listed sections (comma-separated). Transitive children are skipped automatically. ' +
        'Example: --omit=workflow-runs,esign. Valid keys: ' +
        [...SECTION_KEYS].sort().join(', ') +
        '. Dependency edges (parent → child): ' +
        Object.entries(SECTION_DEPENDENCIES)
          .filter(([, parents]) => parents.length > 0)
          .map(([child, parents]) => `${parents.join('+')} → ${child}`)
          .join('; '),
      default: '',
    },
  },
  async run({ args }) {
    const regions = args.regions
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((r: string) => {
        if (r !== 'EU' && r !== 'ME') {
          throw new Error(`unknown region "${r}". Allowed: EU, ME`);
        }
        return r;
      }) as ReadonlyArray<'EU' | 'ME'>;

    // Parse + validate --omit BEFORE constructing flags so an unknown key
    // aborts the run synchronously (no DB connection opened, no wipe started).
    const omit = parseOmitFlag(args.omit);

    const flags: CliFlags = {
      profile: args.profile,
      regions,
      seed: parseNonNegInt(args.seed, 'seed') ?? 42,
      confirm: args.confirm,
      append: args.append,
      progress: args.progress,
      help: false,
      orgs: parseNonNegInt(args.orgs, 'orgs'),
      usersPerOrg: parseNonNegInt(args['users-per-org'], 'users-per-org'),
      contractorsPerOrg: parseNonNegInt(args['contractors-per-org'], 'contractors-per-org'),
      invoicesPerContractor: parseNonNegInt(
        args['invoices-per-contractor'],
        'invoices-per-contractor',
      ),
      omit,
    };

    try {
      await runSeed(flags);
    } catch (err) {
      // Ensure the bar is cleaned up so the error message lands on a fresh
      // line. Reset the logger to default so the failure message bypasses the
      // (now-stopped) bar stream.
      try {
        reporter.stop();
      } catch {
        /* ignore secondary cleanup failure */
      }
      log = createSeedPrettyLogger(process.stdout);
      log.error(
        {
          err: err instanceof Error ? err.message : err,
          stack: (err as Error).stack,
        },
        'seed failed',
      );
      process.exit(1);
    }
  },
});

const isCli = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  runMain(cli);
}
