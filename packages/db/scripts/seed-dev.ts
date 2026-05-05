#!/usr/bin/env tsx
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: this is a seed script */
/**
 * scripts/seed-dev.ts — comprehensive dev/test data seed.
 *
 * NOT FOR PRODUCTION. Refuses to run when NODE_ENV=production or when the
 * resolved DATABASE_URL host falls outside SEED_DEV_ALLOWED_HOST allowlist.
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
 *   - matching approval flows / steps / decisions for non-RECEIVED invoices
 *   - payment runs + items linked to APPROVED / PAID invoices
 *   - reminder rules + instances (PENDING / SENT / FAILED)
 *   - notifications + user notification preferences
 *   - outbox events, webhook deliveries, audit log trails
 *   - equipment, assignments, shipments + events, return requests
 *   - e-invoice lifecycle + events for DE/PL orgs
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
 *
 * ---------------------------------------------------------------------------
 * Sample invocations
 * ---------------------------------------------------------------------------
 *   pnpm db:seed:dev --profile=small --confirm
 *   pnpm db:seed:dev --profile=huge --regions=EU,ME --confirm --seed=123
 *   SEED_PASSWORD=letmein pnpm db:seed:dev --profile=showcase --confirm
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
 *   --confirm                 Required. Wipes tenant data before reseeding.
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
import { fileURLToPath } from 'node:url';
import { createLogger } from '@contractor-ops/logger';
import { ar, de, en, en_GB, Faker, pl } from '@faker-js/faker';
import { hashPassword } from 'better-auth/crypto';
import { config as loadEnv } from 'dotenv';

import { createPrismaClientForUrl } from '../src/client.js';
import type { PrismaClient } from '../src/generated/prisma/client/client.js';
import { Prisma } from '../src/generated/prisma/client/client.js';

// Load .env from the repo root so DATABASE_URL_* / SEED_PASSWORD work without
// the user having to source it manually.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log = createLogger({ service: 'seed-dev' });

// ---------------------------------------------------------------------------
// CLI parsing — minimal built-in to avoid extra deps
// ---------------------------------------------------------------------------

type ProfileName = 'empty' | 'solo' | 'small' | 'medium' | 'huge' | 'showcase' | 'all';

interface CliFlags {
  profile: ProfileName;
  orgs?: number;
  usersPerOrg?: number;
  contractorsPerOrg?: number;
  invoicesPerContractor?: number;
  regions: readonly ('EU' | 'ME')[];
  seed: number;
  confirm: boolean;
  help: boolean;
}

function parseFlags(argv: readonly string[]): CliFlags {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i] ?? '';
    if (!raw.startsWith('--') && raw !== '-h') continue;
    const stripped = raw === '-h' ? '--help' : raw.slice(2);
    if (stripped.includes('=')) {
      const eqIdx = stripped.indexOf('=');
      map.set(stripped.slice(0, eqIdx), stripped.slice(eqIdx + 1));
    } else if (i + 1 < argv.length && !(argv[i + 1] ?? '').startsWith('--')) {
      map.set(stripped, argv[i + 1] ?? '');
      i += 1;
    } else {
      map.set(stripped, 'true');
    }
  }

  const profileRaw = (map.get('profile') ?? 'small') as ProfileName;
  const allowedProfiles: readonly ProfileName[] = [
    'empty',
    'solo',
    'small',
    'medium',
    'huge',
    'showcase',
    'all',
  ];
  if (!allowedProfiles.includes(profileRaw)) {
    throw new Error(`unknown profile "${profileRaw}". Allowed: ${allowedProfiles.join(', ')}`);
  }

  const regionsRaw = (map.get('regions') ?? 'EU')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const regions = regionsRaw.map(r => {
    if (r !== 'EU' && r !== 'ME') {
      throw new Error(`unknown region "${r}". Allowed: EU, ME`);
    }
    return r;
  }) as ReadonlyArray<'EU' | 'ME'>;

  const intOrUndef = (key: string): number | undefined => {
    const v = map.get(key);
    if (v === undefined) return v;
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`flag --${key} must be a non-negative integer (got "${v}")`);
    }
    return n;
  };

  return {
    profile: profileRaw,
    orgs: intOrUndef('orgs'),
    usersPerOrg: intOrUndef('users-per-org'),
    contractorsPerOrg: intOrUndef('contractors-per-org'),
    invoicesPerContractor: intOrUndef('invoices-per-contractor'),
    regions,
    seed: intOrUndef('seed') ?? 42,
    confirm: map.get('confirm') === 'true',
    help: map.get('help') === 'true',
  };
}

function printHelp(): void {
  process.stdout.write(
    [
      'scripts/seed-dev.ts — comprehensive dev/test data seed (NOT FOR PRODUCTION)',
      '',
      'Usage:',
      '  pnpm db:seed:dev --profile=<name> --confirm [other flags]',
      '',
      'Profiles:',
      '  empty | solo | small | medium | huge | showcase | all',
      '',
      'Flags:',
      '  --profile=NAME             default: small',
      '  --orgs=N                   override profile org count',
      '  --users-per-org=N          override users per org',
      '  --contractors-per-org=N    override contractors per org',
      '  --invoices-per-contractor=N override invoices per contractor',
      '  --regions=EU,ME            default: EU',
      '  --seed=N                   faker seed, default 42 (deterministic)',
      '  --confirm                  REQUIRED. Wipes tenant data first.',
      '  --help, -h                 this message',
      '',
      'Env:',
      '  DATABASE_URL_EU / DATABASE_URL_ME  per-region URLs',
      '  DATABASE_URL                       fallback when EU URL is unset',
      '  SEED_PASSWORD                      default: Test1234!',
      '  SEED_DEV_ALLOWED_HOST              extra regex of allowed hostnames',
      '',
    ].join('\n'),
  );
}

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
  if (!flags.confirm) {
    throw new Error('refusing to seed: pass --confirm to acknowledge data wipe');
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
const WIPE_TABLES_IN_ORDER: readonly string[] = [
  // Audit / outbox / webhook / notification noise first
  '"AuditLog"',
  '"OutboxEvent"',
  '"WebhookDelivery"',
  '"IntegrationSyncLog"',
  '"ExternalLink"',
  '"IntegrationConnection"',
  '"NotificationCronDedup"',
  '"Notification"',
  '"UserNotificationPreference"',
  '"Comment"',
  '"ReminderInstance"',
  '"ReminderRule"',
  // Approval chain
  '"ApprovalDecision"',
  '"ApprovalStep"',
  '"ApprovalFlow"',
  '"ApprovalChainConfig"',
  // Payments
  '"PaymentExport"',
  '"PaymentRunItem"',
  '"PaymentRun"',
  '"InvoicePayment"',
  // Billing (Subscription + OCR ledger — wiped per org, reseeded per org)
  '"Subscription"',
  '"OcrCreditLedger"',
  // Invoices + e-invoice
  '"EInvoiceLifecycleEvent"',
  '"EInvoiceLifecycle"',
  '"PeppolCapabilityCache"',
  '"InvoiceMatchResult"',
  '"InvoiceFile"',
  '"InvoiceLine"',
  '"Invoice"',
  // Equipment / shipments
  '"ShipmentEvent"',
  '"ReturnRequest"',
  '"Shipment"',
  '"EquipmentAssignment"',
  '"Equipment"',
  '"CourierConfig"',
  // Contracts
  '"ContractRatePeriod"',
  '"ContractAmendment"',
  '"Contract"',
  // Compliance / templates
  '"ContractorComplianceItem"',
  '"ComplianceRequirementTemplate"',
  // Workflow role / task templates (Phase 74) — children before parent
  '"WorkflowRoleTaskTemplate"',
  '"WorkflowRoleTemplate"',
  // Contractor sub-records
  '"ContractorTagLink"',
  '"ContractorTag"',
  '"ContractorAssignment"',
  '"ContractorBillingProfile"',
  '"ContractorContact"',
  '"ContractorChangeRequest"',
  '"ContractorNotificationPreference"',
  '"PortalSession"',
  '"PortalMagicToken"',
  '"PendingUpload"',
  '"Contractor"',
  // Documents (after Contractor — InvoiceFile is wiped earlier; DocumentLink
  // cascades from Document)
  '"DocumentLink"',
  '"Document"',
  // Org structure
  '"CostCenter"',
  '"Project"',
  '"Team"',
  '"Invitation"',
  '"Member"',
  // Auth (after Member, since Member references both User and Organization)
  '"Session"',
  '"Account"',
  '"Verification"',
  '"User"',
  '"Organization"',
];

async function wipeAllTenantData(prisma: PrismaClient, regionLabel: string): Promise<void> {
  log.warn({ region: regionLabel, tables: WIPE_TABLES_IN_ORDER.length }, 'wiping tenant tables');
  // One TRUNCATE per table — safer than CASCADE which would also nuke
  // production reference tables that share FKs (none today, but defensive).
  // Wrap in transaction so a failure rolls back nothing-half-done.
  await prisma.$transaction(async tx => {
    for (const table of WIPE_TABLES_IN_ORDER) {
      try {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      } catch (err) {
        // Table may not exist yet on a freshly-pushed schema; log and continue.
        log.debug(
          { region: regionLabel, table, err: (err as Error).message },
          'skipping wipe (table missing)',
        );
      }
    }
  });
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
  if (ordinal === 0) return 'owner';
  if (ordinal === 1) return 'admin';
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
  for (let i = 0; i < count; i += 1) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const role = pickMemberRole(faker, i);
    // ASCII-safe email: faker locale chars (de/pl/ar) break email-validators
    // downstream. Use lower-ascii of name + a per-org token.
    const asciiFirst = slugify(first) || 'user';
    const asciiLast = slugify(last) || `${i}`;
    const email = `${asciiFirst}.${asciiLast}.${orgKey}@seed.local`;

    const user = await prisma.user.create({
      data: {
        name: `${first} ${last}`,
        email,
        emailVerified: true,
        accounts: {
          create: {
            accountId: email,
            providerId: 'credential', // Better Auth's emailAndPassword provider
            password: passwordHash,
          },
        },
      },
      select: { id: true, email: true, name: true },
    });
    users.push({ id: user.id, email: user.email, name: user.name, role });
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

  // NOTE: We do NOT pre-create a Session row here. Better Auth signs the
  // session cookie with `BETTER_AUTH_SECRET`; a manually-inserted Session has
  // no matching cookie on the browser side, so it can't be used to "skip
  // login". Users authenticate via the seeded password (printed in the final
  // summary log line).

  // Teams (3 per org, none for empty) — created during the org's first 90 days
  const teamIds: string[] = [];
  if (org.contractorsPerOrg > 0) {
    const teamCount = org.showcase ? 4 : Math.min(3, Math.max(1, Math.ceil(users.length / 3)));
    for (let i = 0; i < teamCount; i += 1) {
      const manager = users[Math.min(i, users.length - 1)] as SeededUser;
      const team = await prisma.team.create({
        data: {
          organizationId,
          name: `${fakers.org.commerce.department()} ${i + 1}`,
          code: `T${(i + 1).toString().padStart(2, '0')}`,
          managerUserId: manager.id,
          status: 'ACTIVE',
          createdAt: dateBetween(fakers.org, foundedAt, advanceCapped(foundedAt, 90)),
        },
        select: { id: true },
      });
      teamIds.push(team.id);
    }
  }

  // Projects (2 per team) — start dates anchored to the org's lifespan, not "now − 365"
  const projectIds: string[] = [];
  for (const teamId of teamIds) {
    for (let i = 0; i < 2; i += 1) {
      const start = dateBetween(fakers.org, foundedAt, new Date());
      const end = fakers.org.datatype.boolean() ? futureDate(fakers.org, 365) : null;
      const project = await prisma.project.create({
        data: {
          organizationId,
          teamId,
          name: fakers.org.commerce.productName(),
          code: `P${tokenHex(2).toUpperCase()}`,
          status: 'ACTIVE',
          startDate: dateOnly(start),
          endDate: end ? dateOnly(end) : null,
          budgetMinor: moneyMinor(fakers.org, 5_000, 200_000),
          budgetCurrency: profile.defaultCurrency,
          createdAt: start,
        },
        select: { id: true },
      });
      projectIds.push(project.id);
    }
  }

  // Cost centres
  const costCenterIds: string[] = [];
  if (org.contractorsPerOrg > 0) {
    for (let i = 0; i < Math.min(3, Math.max(1, teamIds.length)); i += 1) {
      const cc = await prisma.costCenter.create({
        data: {
          organizationId,
          name: `Cost Centre ${i + 1}`,
          code: `CC${(i + 1).toString().padStart(3, '0')}-${tokenHex(2)}`,
          status: 'ACTIVE',
          createdAt: dateBetween(fakers.org, foundedAt, advanceCapped(foundedAt, 120)),
        },
        select: { id: true },
      });
      costCenterIds.push(cc.id);
    }
  }

  // Pending invitations — a small splash so the invite-list UI is non-empty
  if (org.contractorsPerOrg > 0) {
    for (let i = 0; i < Math.min(2, users.length); i += 1) {
      await prisma.invitation.create({
        data: {
          organizationId,
          email: `invitee-${i}-${slug}@seed.local`,
          role: 'team_manager',
          status: 'pending',
          expiresAt: futureDate(fakers.org, 14),
          inviterId: owner.id,
          createdAt: pastDate(fakers.org, 7),
        },
      });
    }
  }

  return {
    organizationId,
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
  for (const name of tagPalette) {
    const tag = await prisma.contractorTag.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        color: ctx.fakers.org.color.rgb({ format: 'hex' }),
      },
      select: { id: true },
    });
    tagIds.push(tag.id);
  }

  // Compliance requirement templates — light-touch, drives compliance items
  const complianceTemplateIds: string[] = [];
  const docTypes = ['MASTER_CONTRACT', 'INSURANCE', 'TAX_CERTIFICATE'] as const;
  for (const dt of docTypes) {
    const tpl = await prisma.complianceRequirementTemplate.create({
      data: {
        organizationId: ctx.organizationId,
        name: `${dt} requirement`,
        documentType: dt,
        isRequired: true,
        expires: dt !== 'MASTER_CONTRACT',
        defaultValidityDays: dt === 'MASTER_CONTRACT' ? null : 365,
      },
      select: { id: true },
    });
    complianceTemplateIds.push(tpl.id);
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
    const contractor = await prisma.contractor.create({
      data: {
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
        notes: ctx.fakers.org.lorem.sentence(),
        createdAt: hiredAt,
      },
      select: { id: true },
    });

    // Primary contact
    await prisma.contractorContact.create({
      data: {
        organizationId: ctx.organizationId,
        contractorId: contractor.id,
        fullName: `${ctx.fakers.org.person.firstName()} ${ctx.fakers.org.person.lastName()}`,
        email: `contact.${i}-${slugify(legalName)}@seed.local`,
        phone: ctx.fakers.org.phone.number(),
        roleTitle: ctx.fakers.org.person.jobTitle(),
        isPrimary: true,
        createdAt: hiredAt,
      },
    });

    // Default billing profile — country-formatted bank fields so list views
    // look like real customer data.
    const billing = await prisma.contractorBillingProfile.create({
      data: {
        organizationId: ctx.organizationId,
        contractorId: contractor.id,
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
      },
      select: { id: true },
    });

    // Assignment
    if (team || project || costCenter) {
      await prisma.contractorAssignment.create({
        data: {
          organizationId: ctx.organizationId,
          contractorId: contractor.id,
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
        },
      });
    }

    // 0–2 tag links
    const tagsForThis = ctx.fakers.org.helpers.arrayElements(tagIds, {
      min: 0,
      max: 2,
    });
    for (const tagId of tagsForThis) {
      await prisma.contractorTagLink.create({
        data: { contractorId: contractor.id, tagId },
      });
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
      const dueDate = (() => {
        switch (itemStatus) {
          case 'MISSING':
            return dateOnly(futureDate(ctx.fakers.org, 180));
          case 'PENDING':
            return dateOnly(futureDate(ctx.fakers.org, 14));
          case 'SATISFIED':
            return dateOnly(pastDate(ctx.fakers.org, 365));
          case 'EXPIRED':
            return dateOnly(pastDate(ctx.fakers.org, 730));
        }
      })();
      const expiresAt =
        itemStatus === 'SATISFIED'
          ? dateOnly(futureDate(ctx.fakers.org, 365))
          : itemStatus === 'EXPIRED'
            ? dateOnly(pastDate(ctx.fakers.org, 30))
            : null;
      await prisma.contractorComplianceItem.create({
        data: {
          organizationId: ctx.organizationId,
          contractorId: contractor.id,
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
        },
      });
    }

    contractors.push({
      id: contractor.id,
      legalName,
      email: contractorEmail,
      currency,
      paymentTermsDays,
      ownerUserId: ownerUser.id,
      primaryTeamId: team,
      defaultBillingProfileId: billing.id,
    });
    refs.push({ type: 'CONTRACTOR', id: contractor.id, name: legalName, createdAt: hiredAt });
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
  for (const c of subset) {
    const start = pastDate(ctx.fakers.org, 540);
    // Contracts are negotiated and signed BEFORE they start. Pick a signed
    // date 7–30 days before the start date.
    const signedAt = new Date(
      start.getTime() - ctx.fakers.org.number.int({ min: 7, max: 30 }) * 86_400_000,
    );
    // End date, when set, must be strictly after start.
    const end = ctx.fakers.org.datatype.boolean({ probability: 0.4 })
      ? new Date(start.getTime() + ctx.fakers.org.number.int({ min: 90, max: 730 }) * 86_400_000)
      : null;
    const isSigned = ctx.fakers.org.datatype.boolean({ probability: 0.7 });
    // The same rate value flows into the Contract row AND its single rate
    // period — they used to drift apart from independent draws.
    const rateValueMinor = moneyMinor(ctx.fakers.org, 50, 250);
    const contract = await prisma.contract.create({
      data: {
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
        signedAt: isSigned ? signedAt : null,
        notes: ctx.fakers.org.lorem.sentence(),
        createdAt: signedAt,
      },
      select: { id: true },
    });
    contractByContractor.set(c.id, contract.id);
    refs.push({
      type: 'CONTRACT',
      id: contract.id,
      name: `Contract ${c.legalName}`,
      createdAt: signedAt,
    });

    // 1 rate period — same rate as the contract header.
    await prisma.contractRatePeriod.create({
      data: {
        organizationId: ctx.organizationId,
        contractId: contract.id,
        rateType: 'PER_HOUR',
        rateValueMinor,
        currency: c.currency,
        validFrom: dateOnly(start),
        validTo: end ? dateOnly(end) : null,
        createdAt: signedAt,
      },
    });

    // ~25% have an amendment
    if (ctx.fakers.org.datatype.boolean({ probability: 0.25 })) {
      const amendmentEffective = pastDate(ctx.fakers.org, 90);
      const newRateMinor = Math.round(rateValueMinor * 1.05);
      await prisma.contractAmendment.create({
        data: {
          organizationId: ctx.organizationId,
          contractId: contract.id,
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
        },
      });
    }
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

  for (const contractor of contractors) {
    const count = ctx.fakers.org.number.int({
      min: ctx.org.invoicesPerContractor.min,
      max: ctx.org.invoicesPerContractor.max,
    });
    for (let i = 0; i < count; i += 1) {
      const showcaseEntry = ctx.org.showcase ? INVOICE_LIFECYCLE_DISTRIBUTION[i] : undefined;
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
          // invoiceId is patched in below once the invoice row exists.
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
      const created = await prisma.invoice.create({
        data: {
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
        },
        select: { id: true },
      });

      // Patch invoiceId onto pre-built lines, then bulk-insert.
      await prisma.invoiceLine.createMany({
        data: lines.map(l => ({ ...l, invoiceId: created.id })),
      });

      // Approval flow if status indicates approval has been touched. The
      // length-2 floor lets us pick distinct manager / finance approvers and
      // also lets biome see that ctx.users[0] / ctx.users[1] are defined.
      const fallbackApprover = ctx.users[0];
      const secondaryApprover = ctx.users[1];
      if (
        approvalStatus !== 'NOT_STARTED' &&
        approvalChainConfigId !== null &&
        fallbackApprover !== undefined &&
        secondaryApprover !== undefined
      ) {
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
        const flow = await prisma.approvalFlow.create({
          data: {
            organizationId: ctx.organizationId,
            resourceType: 'INVOICE',
            resourceId: created.id,
            chainConfigId: approvalChainConfigId,
            status: approvalStatus,
            currentStepOrder:
              approvalStatus === 'PENDING' ? 1 : approvalStatus === 'APPROVED' ? 2 : null,
            startedAt: flowStartedAt,
            completedAt: flowCompletedAt,
            cancelledAt: approvalStatus === 'CANCELLED' ? timeline.reviewedAt : null,
            createdByUserId: ctx.ownerUserId,
          },
          select: { id: true },
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

          const stepActedAt =
            stepDecision === null ? null : (flowCompletedAt ?? timeline.reviewedAt);
          // SLA deadline: for completed steps, deadline lands near actedAt
          // (some steps just made the SLA, some breached it slightly). For
          // pending steps it's a future date the approver still has time to
          // hit. Previously every step had a 5-day-future deadline regardless
          // of whether the decision was already 6 months old.
          const slaDeadline =
            stepActedAt === null
              ? futureDate(ctx.fakers.org, 5)
              : new Date(
                  stepActedAt.getTime() +
                    ctx.fakers.org.number.int({ min: -1, max: 3 }) * 86_400_000,
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
          const step = await prisma.approvalStep.create({
            data: {
              organizationId: ctx.organizationId,
              approvalFlowId: flow.id,
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
            },
            select: { id: true },
          });

          if (stepDecision !== null) {
            await prisma.approvalDecision.create({
              data: {
                organizationId: ctx.organizationId,
                approvalStepId: step.id,
                actorUserId: stepDef.approver.id,
                decision: stepDecision,
                comment: decisionComment,
                createdAt: stepActedAt ?? flowStartedAt,
              },
            });
          }
        }
      }

      invoices.push({
        id: created.id,
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
        id: created.id,
        name: invNumber,
        createdAt: timeline.receivedAt,
      });
    }
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
  if (ctx.org.paymentRunsPerOrg === 0) return;
  const payable = invoices.filter(
    i =>
      i.paymentStatus === 'READY' ||
      i.paymentStatus === 'PAID' ||
      i.paymentStatus === 'PARTIALLY_PAID',
  );
  if (payable.length === 0) return;

  const finance = ctx.users.find(u => u.role === 'finance_admin') ?? ctx.users[0] ?? null;
  if (!finance) return;

  // Real payment runs are SINGLE-currency — bank export files (SEPA XML,
  // BACS, etc.) accept exactly one currency per submission. Group payable
  // invoices by currency and split the configured run quota proportionally.
  const byCurrency = new Map<string, SeededInvoice[]>();
  for (const inv of payable) {
    const list = byCurrency.get(inv.currency) ?? [];
    list.push(inv);
    byCurrency.set(inv.currency, list);
  }

  const totalRuns = ctx.org.paymentRunsPerOrg;
  let runOrdinal = 0;
  for (const [currency, currencyInvoices] of byCurrency) {
    // Distribute run quota proportionally; every currency gets at least 1
    // run if it has payable invoices.
    const runsForThisCurrency = Math.max(
      1,
      Math.round((currencyInvoices.length / payable.length) * totalRuns),
    );
    const perRun = Math.max(1, Math.ceil(currencyInvoices.length / runsForThisCurrency));
    const chunks: SeededInvoice[][] = [];
    for (let i = 0; i < currencyInvoices.length; i += perRun) {
      chunks.push(currencyInvoices.slice(i, i + perRun));
    }
    const sliceLimit = chunks.slice(0, runsForThisCurrency);

    for (const slice of sliceLimit) {
      runOrdinal += 1;
      const allPaid = slice.every(i => i.paymentStatus === 'PAID');
      const status = allPaid
        ? 'COMPLETED'
        : ctx.fakers.org.helpers.arrayElement(['DRAFT', 'LOCKED', 'EXPORTED']);
      // Run total = sum of OUTSTANDING balances (not full invoice values),
      // since a payment run pays what's still owed.
      const totalMinor = slice.reduce(
        (acc, i) =>
          acc +
          (i.paymentStatus === 'PAID' ? i.totalMinor : i.amountToPayMinor + i.partialPaidMinor),
        0,
      );

      // Chained timestamps: exportedAt → completedAt (run can't complete
      // before it was exported to the bank).
      const exportedAt =
        status === 'EXPORTED' || status === 'COMPLETED' ? pastDate(ctx.fakers.org, 60) : null;
      const completedAt =
        status === 'COMPLETED' && exportedAt
          ? advanceCapped(exportedAt, ctx.fakers.org.number.int({ min: 1, max: 14 }))
          : null;

      const run = await prisma.paymentRun.create({
        data: {
          organizationId: ctx.organizationId,
          runNumber: `PR-${ctx.org.key.slice(0, 4).toUpperCase()}-${currency}-${runOrdinal}-${tokenHex(2)}`,
          name: `${ctx.fakers.org.date.month()} ${currency} run ${runOrdinal}`,
          status,
          currency,
          createdByUserId: finance.id,
          approvedByUserId: status === 'COMPLETED' || status === 'EXPORTED' ? finance.id : null,
          totalMinor,
          invoiceCount: slice.length,
          // Real export format depends on the currency: SEPA_XML for EUR,
          // BACS_STD18 for GBP, generic XML/SWIFT_XML otherwise.
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
          createdAt: exportedAt
            ? new Date(exportedAt.getTime() - 86_400_000)
            : pastDate(ctx.fakers.org, 14),
        },
        select: { id: true, createdAt: true },
      });

      refs.push({
        type: 'PAYMENT_RUN',
        id: run.id,
        name: `Run ${runOrdinal} (${currency})`,
        createdAt: run.createdAt,
      });

      for (const inv of slice) {
        // ONE shared payment reference for the whole event chain. Real
        // payment systems echo the bank reference everywhere it appears.
        const paymentReference = `REF-${tokenHex(4).toUpperCase()}`;
        const itemStatus =
          inv.paymentStatus === 'PAID'
            ? 'PAID'
            : status === 'EXPORTED' || status === 'COMPLETED'
              ? 'EXPORTED'
              : 'PENDING';
        // Single moment in time for the actual payment. Reuses the invoice
        // timeline's `paidAt` so Invoice / PaymentRunItem / InvoicePayment
        // all agree on when the money moved.
        const paymentMoment =
          inv.paymentStatus === 'PAID'
            ? (inv.paidAt ?? completedAt ?? exportedAt)
            : inv.paymentStatus === 'PARTIALLY_PAID'
              ? new Date(Date.now() - ctx.fakers.org.number.int({ min: 30, max: 120 }) * 86_400_000)
              : null;

        // Run item amount = what THIS run intends to settle. For PAID
        // invoices that's the full total; for PARTIALLY_PAID it's the
        // already-paid half (we model the partial as having flowed through
        // a prior run); for READY it's the outstanding balance.
        const itemAmountMinor =
          inv.paymentStatus === 'PAID'
            ? inv.totalMinor
            : inv.paymentStatus === 'PARTIALLY_PAID'
              ? inv.partialPaidMinor
              : inv.amountToPayMinor;

        await prisma.paymentRunItem.create({
          data: {
            organizationId: ctx.organizationId,
            paymentRunId: run.id,
            invoiceId: inv.id,
            contractorId: inv.contractorId,
            amountMinor: itemAmountMinor,
            currency: inv.currency,
            status: itemStatus,
            paymentReference: itemStatus === 'PAID' ? paymentReference : null,
            markedPaidAt: itemStatus === 'PAID' ? paymentMoment : null,
            createdAt: run.createdAt,
          },
        });

        // InvoicePayment row mirrors the same payment moment + reference.
        if (inv.paymentStatus === 'PAID' && paymentMoment) {
          await prisma.invoicePayment.create({
            data: {
              organizationId: ctx.organizationId,
              invoiceId: inv.id,
              amountMinor: inv.totalMinor,
              paidAt: paymentMoment,
              sourceKind: 'PAYMENT_RUN',
              notes: `Settled via ${paymentReference}`,
              createdAt: paymentMoment,
            },
          });
        } else if (inv.paymentStatus === 'PARTIALLY_PAID' && paymentMoment) {
          await prisma.invoicePayment.create({
            data: {
              organizationId: ctx.organizationId,
              invoiceId: inv.id,
              amountMinor: inv.partialPaidMinor,
              paidAt: paymentMoment,
              sourceKind: 'BANK_STATEMENT',
              notes: `Partial payment ${paymentReference}`,
              createdAt: paymentMoment,
            },
          });
        }
      }

      // L3: a PaymentExport row for COMPLETED / EXPORTED runs so the
      // Settings → Exports page isn't always empty.
      if ((status === 'COMPLETED' || status === 'EXPORTED') && exportedAt) {
        await prisma.paymentExport.create({
          data: {
            organizationId: ctx.organizationId,
            paymentRunId: run.id,
            format:
              currency === 'EUR' ? 'SEPA_XML' : currency === 'GBP' ? 'BACS_STD18' : 'SWIFT_XML',
            status: ctx.fakers.org.helpers.arrayElement(['GENERATED', 'DOWNLOADED']),
            generatedByUserId: finance.id,
            generatedAt: exportedAt,
            downloadedAt: status === 'COMPLETED' ? completedAt : null,
          },
        });
      }
    }
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
  for (const cfg of ruleConfigs) {
    const r = await prisma.reminderRule.create({
      data: {
        organizationId: ctx.organizationId,
        name: cfg.name,
        entityType: cfg.entityType,
        triggerType: cfg.triggerType,
        offsetDays: cfg.offsetDays,
        channel: cfg.channel,
        recipientMode: cfg.recipientMode,
        active: true,
      },
      select: { id: true },
    });
    seededRules.push({ id: r.id, cfg });
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
   * Picks the lifecycle status by where `scheduledFor` falls relative to
   * now: future → PENDING; past → mostly SENT with some FAILED / CANCELLED
   * noise.
   */
  const pickStatus = (scheduledFor: Date): Instance['status'] => {
    if (scheduledFor.getTime() > Date.now()) {
      return weightedPick<Instance['status']>(ctx.fakers.org, [
        ['PENDING', 8],
        ['CANCELLED', 1],
      ]);
    }
    return weightedPick<Instance['status']>(ctx.fakers.org, [
      ['SENT', 8],
      ['FAILED', 1],
      ['CANCELLED', 1],
    ]);
  };

  for (const { id: ruleId, cfg } of seededRules) {
    if (cfg.entityType === 'INVOICE') {
      // Cap at 200 instances per rule so the table stays bounded on huge.
      for (const inv of openInvoices.slice(0, Math.min(200, openInvoices.length))) {
        const offsetMs = (cfg.offsetDays ?? 0) * 86_400_000;
        const baseMs = inv.dueDate.getTime();
        const scheduledFor = new Date(
          cfg.triggerType === 'BEFORE_DUE_DATE'
            ? baseMs - offsetMs
            : cfg.triggerType === 'AFTER_DUE_DATE'
              ? baseMs + offsetMs
              : baseMs,
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
          sentAt: status === 'SENT' ? scheduledFor : null,
        });
      }
    } else if (cfg.entityType === 'CONTRACT') {
      // Synthesise a future contract-end date per ref (~6mo–18mo out)
      // since `EntityRef` doesn't carry the contract end date itself.
      for (const ref of contractRefs.slice(0, Math.min(50, contractRefs.length))) {
        const contractEnd = new Date(
          Date.now() + ctx.fakers.org.number.int({ min: 30, max: 540 }) * 86_400_000,
        );
        const scheduledFor = new Date(contractEnd.getTime() - (cfg.offsetDays ?? 0) * 86_400_000);
        const status = pickStatus(scheduledFor);
        instances.push({
          id: newId(),
          organizationId: ctx.organizationId,
          reminderRuleId: ruleId,
          entityType: 'CONTRACT',
          entityId: ref.id,
          scheduledFor,
          status,
          sentAt: status === 'SENT' ? scheduledFor : null,
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
  'PAYMENT_FAILED',
  'PAYMENT_ACTION_REQUIRED',
  'SHIPMENT_STATUS_CHANGE',
];

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
      const sentAt = status === 'PENDING' ? null : pastDate(ctx.fakers.org, 90);
      const ref = refForNotificationType(type);
      const actor = ctx.fakers.org.helpers.arrayElement(ctx.users);
      const rendered = renderNotification(type, ref, actor);
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
        readAt: status === 'READ' ? pastDate(ctx.fakers.org, 60) : null,
        dedupKey: `${u.id}:${type}:${i}:${tokenHex(4)}`,
        createdAt: pastDate(ctx.fakers.org, 90),
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
function makeOutboxPayload(eventType: string, ref: EntityRef | null, faker: Faker): unknown {
  const base = {
    eventType,
    organizationId: '<seeded>',
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
    const created = pastDate(ctx.fakers.org, 90);
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
      payloadJson: makeOutboxPayload(eventType, ref, ctx.fakers.org) as object,
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
    const received = pastDate(ctx.fakers.org, 90);
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
    const eq = await prisma.equipment.create({
      data: {
        organizationId: ctx.organizationId,
        name: `${type.toLowerCase()}-${i}`,
        serialNumber: makeEquipmentSerial(type, ctx.fakers.org),
        type,
        status,
        notes: ctx.fakers.org.lorem.sentence(),
        purchaseDate,
        createdAt: purchaseDate,
      },
      select: { id: true },
    });

    refs.push({
      type: 'EQUIPMENT',
      id: eq.id,
      name: `${type.toLowerCase()}-${i}`,
      createdAt: purchaseDate,
    });

    if (status !== 'AVAILABLE' && status !== 'RETIRED' && contractors.length > 0) {
      const contractor = ctx.fakers.org.helpers.arrayElement(contractors);
      // Order timestamps so `unassignedAt` (if set) is always strictly after
      // `assignedAt`. The previous independent `pastDate(60)` / `pastDate(365)`
      // pair could place unassign before assign.
      const assignedAt = pastDate(ctx.fakers.org, 365);
      const unassignedAt =
        status === 'RETURNED'
          ? advanceCapped(assignedAt, ctx.fakers.org.number.int({ min: 14, max: 240 }))
          : null;
      await prisma.equipmentAssignment.create({
        data: {
          organizationId: ctx.organizationId,
          equipmentId: eq.id,
          contractorId: contractor.id,
          assignedByUserId: ctx.ownerUserId,
          assignedAt,
          unassignedAt,
          unassignedByUserId: unassignedAt ? ctx.ownerUserId : null,
        },
      });

      // Optional outbound shipment for non-AVAILABLE
      if (status === 'IN_TRANSIT' || status === 'DELIVERED') {
        const shipStatus = status === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'DELIVERED';
        const ship = await prisma.shipment.create({
          data: {
            organizationId: ctx.organizationId,
            equipmentId: eq.id,
            direction: 'OUTBOUND',
            carrier: ctx.fakers.org.helpers.arrayElement(['DHL', 'FedEx', 'InPost', 'UPS']),
            trackingNumber: tokenHex(8).toUpperCase(),
            currentStatus: shipStatus,
            createdByUserId: ctx.ownerUserId,
          },
          select: { id: true },
        });
        await prisma.shipmentEvent.create({
          data: {
            organizationId: ctx.organizationId,
            shipmentId: ship.id,
            status: shipStatus,
            occurredAt: pastDate(ctx.fakers.org, 30),
            createdByUserId: ctx.ownerUserId,
          },
        });
      }

      // Return request lifecycle
      if (status === 'RETURN_REQUESTED' || status === 'RETURNED') {
        const returnStatus =
          status === 'RETURN_REQUESTED' ? 'PENDING_APPROVAL' : 'SHIPMENT_CREATED';
        await prisma.returnRequest.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: contractor.id,
            status: returnStatus,
            targetPointName: 'Warehouse',
            targetPointAddress: `${ctx.fakers.org.location.streetAddress()}, ${ctx.fakers.org.location.city()}`,
            approvedByUserId: returnStatus === 'PENDING_APPROVAL' ? null : ctx.ownerUserId,
            approvedAt: returnStatus === 'PENDING_APPROVAL' ? null : pastDate(ctx.fakers.org, 30),
          },
        });
      }
    }
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
  for (let i = 0; i < rows.length; i += 5_000) {
    await prisma.auditLog.createMany({ data: rows.slice(i, i + 5_000) });
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
    const transmittedAt =
      transmissionStatus === 'NOT_SENT'
        ? null
        : advanceCapped(validatedAt, ctx.fakers.org.number.int({ min: 0, max: 2 }));
    const deliveredAt =
      transmissionStatus === 'DELIVERED' && transmittedAt
        ? advanceCapped(transmittedAt, ctx.fakers.org.number.int({ min: 0, max: 2 }))
        : null;

    const lc = await prisma.eInvoiceLifecycle.create({
      data: {
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
      },
      select: { id: true },
    });

    // Lifecycle events emit in lockstep with the lifecycle row.
    await prisma.eInvoiceLifecycleEvent.create({
      data: {
        organizationId: ctx.organizationId,
        lifecycleId: lc.id,
        eventType: 'GENERATED',
        occurredAt: generatedAt,
      },
    });
    if (validationStatus !== 'NOT_VALIDATED') {
      await prisma.eInvoiceLifecycleEvent.create({
        data: {
          organizationId: ctx.organizationId,
          lifecycleId: lc.id,
          eventType: 'VALIDATED',
          occurredAt: validatedAt,
        },
      });
    }
    if (transmittedAt) {
      await prisma.eInvoiceLifecycleEvent.create({
        data: {
          organizationId: ctx.organizationId,
          lifecycleId: lc.id,
          eventType: 'TRANSMITTED',
          occurredAt: transmittedAt,
        },
      });
    }
    if (deliveredAt) {
      await prisma.eInvoiceLifecycleEvent.create({
        data: {
          organizationId: ctx.organizationId,
          lifecycleId: lc.id,
          eventType: 'DELIVERY_ACK',
          occurredAt: deliveredAt,
        },
      });
    }
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
  for (const [i, c] of sample.entries()) {
    const isLive = i % 2 === 0;
    await prisma.portalSession.create({
      data: {
        token: tokenHex(32),
        contractorId: c.id,
        organizationId: ctx.organizationId,
        email: c.email,
        expiresAt: isLive ? futureDate(ctx.fakers.org, 30) : pastDate(ctx.fakers.org, 30),
        ipAddress: '127.0.0.1',
        userAgent: 'seed-dev portal',
      },
    });
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
        connectedAt: pastDate(ctx.fakers.org, 180),
        lastSyncAt: status === 'CONNECTED' ? pastDate(ctx.fakers.org, 7) : null,
        lastSuccessAt: status === 'CONNECTED' ? pastDate(ctx.fakers.org, 7) : null,
        lastErrorAt: status === 'ERROR' ? pastDate(ctx.fakers.org, 30) : null,
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

  for (const inv of subset) {
    const documentId = newId();
    await prisma.document.create({
      data: {
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
      },
    });
    await prisma.invoiceFile.create({
      data: {
        organizationId: ctx.organizationId,
        invoiceId: inv.id,
        documentId,
        role: 'SOURCE_ORIGINAL',
      },
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
  for (const seed of WORKFLOW_ROLE_SEEDS) {
    const role = await prisma.workflowRoleTemplate.create({
      data: {
        organizationId: ctx.organizationId,
        role: seed.role,
        displayNameEn: seed.displayNameEn,
        displayNamePl: seed.displayNamePl,
        displayNameDe: seed.displayNameDe,
        isSeed: true,
      },
      select: { id: true },
    });
    await prisma.workflowRoleTaskTemplate.createMany({
      data: seed.tasks.map((t, idx) => ({
        organizationId: ctx.organizationId,
        workflowRoleTemplateId: role.id,
        sortOrder: idx,
        titleEn: t.titleEn,
        descriptionEn: t.descriptionEn,
        dueDayOffset: t.dueDayOffset,
      })),
    });
  }
}

// ---------------------------------------------------------------------------
// Subscription — Settings → Billing page wants a row.
// ---------------------------------------------------------------------------

async function seedSubscription(prisma: PrismaClient, ctx: OrgSeed): Promise<void> {
  // Showcase cycles through tiers/statuses; everyone else gets a healthy
  // ACTIVE PRO so the billing page renders.
  const tier = ctx.org.showcase
    ? ctx.fakers.org.helpers.arrayElement(['STARTER', 'PRO', 'ENTERPRISE'] as const)
    : 'PRO';
  const status = ctx.org.showcase
    ? ctx.fakers.org.helpers.arrayElement(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'] as const)
    : 'ACTIVE';
  // For ACTIVE / TRIALING / PAST_DUE the period must end in the future
  // (otherwise the billing page shows a stale "renews on …" line). For
  // CANCELED we leave the period ended in the recent past.
  const periodStart = pastDate(ctx.fakers.org, 25);
  const periodEnd =
    status === 'CANCELED'
      ? new Date(Date.now() - ctx.fakers.org.number.int({ min: 1, max: 5 }) * 86_400_000)
      : new Date(Date.now() + ctx.fakers.org.number.int({ min: 5, max: 30 }) * 86_400_000);
  await prisma.subscription.create({
    data: {
      organizationId: ctx.organizationId,
      // Stripe IDs use cus_/sub_ prefix + alphanumeric. The plain hex token
      // looks more like a real ID than the previous "seed" markers.
      stripeCustomerId: `cus_${tokenHex(8)}`,
      stripeSubscriptionId: `sub_${tokenHex(8)}`,
      tier,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialEnd: status === 'TRIALING' ? futureDate(ctx.fakers.org, 14) : null,
      seatCount: Math.max(1, ctx.users.length),
      cancelAtPeriodEnd: status === 'CANCELED',
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
  for (const ref of invoiceRefs) {
    const commentCount = ctx.fakers.org.number.int({ min: 1, max: 3 });
    for (let i = 0; i < commentCount; i += 1) {
      const author = ctx.fakers.org.helpers.arrayElement(ctx.users);
      await prisma.comment.create({
        data: {
          organizationId: ctx.organizationId,
          entityType: 'INVOICE',
          entityId: ref.id,
          authorUserId: author.id,
          body: ctx.fakers.org.lorem.sentence(),
        },
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
  users: number;
  contractors: number;
  invoices: number;
}

async function seedOrg(
  prisma: PrismaClient,
  org: OrgVolume,
  passwordHash: string,
  baseSeed: number,
  orgIndex: number,
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

  const contractors = await seedContractors(
    prisma,
    ctx,
    orgCore.teamIds,
    orgCore.projectIds,
    orgCore.costCenterIds,
    refs,
  );
  log.debug({ orgKey: org.key, count: contractors.length }, 'contractors seeded');

  const contractByContractor = await seedContracts(prisma, ctx, contractors, refs);
  log.debug({ orgKey: org.key, contracts: contractByContractor.size }, 'contracts seeded');

  const approvalChainConfigId = await seedApprovalChainConfig(prisma, ctx);

  const invoices = await seedInvoices(
    prisma,
    ctx,
    contractors,
    contractByContractor,
    approvalChainConfigId,
    refs,
  );
  log.debug({ orgKey: org.key, invoices: invoices.length }, 'invoices seeded');

  // Equipment is seeded BEFORE payment runs / reminders so its refs are
  // available for downstream seeders that sample real entities.
  await seedEquipment(prisma, ctx, contractors, refs);
  await seedPaymentRuns(prisma, ctx, invoices, refs);
  await seedReminders(prisma, ctx, invoices, refs);
  await seedNotifications(prisma, ctx, refs);
  await seedOutbox(prisma, ctx, refs);
  await seedWebhookDeliveries(prisma, ctx);
  await seedAuditLogs(prisma, ctx, refs);
  await seedEInvoiceLifecycle(prisma, ctx, invoices);
  await seedPortalSessions(prisma, ctx, contractors);
  await seedIntegrationConnections(prisma, ctx);
  await seedInvoiceDocuments(prisma, ctx, invoices);
  await seedWorkflowTemplates(prisma, ctx);
  await seedSubscription(prisma, ctx);
  await seedCourierConfigs(prisma, ctx);
  await seedComments(prisma, ctx, refs);

  return {
    region: org.region,
    orgKey: org.key,
    organizationId: orgCore.organizationId,
    users: users.length,
    contractors: contractors.length,
    invoices: invoices.length,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  ensureSafeEnvironment(flags);

  const orgsPlanned = applyOverrides(buildOrgs(flags.profile, flags.regions), flags);
  if (orgsPlanned.length === 0) {
    log.warn('no orgs to seed (profile/regions/orgs overrides cancelled all)');
    return;
  }

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

  log.warn({ regions: [...regionUrls.keys()] }, 'wipe phase starting (--confirm)');
  for (const [region, client] of clients) {
    await wipeAllTenantData(client, region);
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
    const summary = await seedOrg(client, org, passwordHash, flags.seed, orgIndex);
    summaries.push(summary);
    orgIndex += 1;
  }

  // Final summary line
  const totals = summaries.reduce(
    (acc, s) => ({
      users: acc.users + s.users,
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
      sampleLogin: summaries
        .slice(0, 3)
        .map(s => `${s.orgKey}: any *.${s.orgKey}@seed.local / ${password}`),
    },
    'seed completed',
  );

  for (const client of clients.values()) {
    await client.$disconnect();
  }
}

const isCli = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch(err => {
    log.error(
      {
        err: err instanceof Error ? err.message : err,
        stack: (err as Error).stack,
      },
      'seed failed',
    );
    process.exit(1);
  });
}
