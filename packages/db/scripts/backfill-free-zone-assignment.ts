#!/usr/bin/env tsx
/**
 * Phase 79 D-02 — Backfill the freeform UAE `Contractor.countryFields` license
 * values into the structured `FreeZoneAssignment` model.
 *
 * The freeform UAE fields (`tradeLicenseNumber`, `freeZone` bool, `tradeLicenseExpiry`)
 * are migrated to `FreeZoneAssignment` so it becomes the single source of truth that
 * feeds the F1 reminder cascade + payment-block + permitted-activity scope check.
 * The old freeform inputs are hidden in the UI (getCountryFieldsConfig D-02), but
 * the `countryFields` JSONB is NEVER deleted — it is retained for audit / rollback.
 *
 * Idempotent: a FreeZoneAssignment is inserted ONLY for contractors that have a
 * trade-license number AND do not already have an assignment row (the
 * `contractorId @unique` constraint + the not-exists guard make re-runs safe).
 *
 * Zone mapping (documented default rule, D-02):
 *   - `freeZone === true`  → IFZA (a generic free-zone placeholder; the admin
 *                            re-selects the exact zone in the structured form).
 *   - `freeZone` false / absent → MAINLAND (DED-licensed; arms no payment-block gate).
 *
 * Saudi `countryFields` (`freelanceSaLicense`, `commercialRegistration*`) are NOT
 * migrated (D-02) — only UAE free-zone fields move.
 *
 * Multi-region: invoke once per regional database URL. UAE orgs live in the ME
 * database, so the ME apply is the load-bearing one. The apply is a DEFERRED
 * post-deploy step under the LOCAL-ONLY constraint (Phase 70/74/76 precedent).
 *
 * Usage:
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-free-zone-assignment.ts
 *   DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-free-zone-assignment.ts
 *
 *   # Dry-run (no writes):
 *   DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-free-zone-assignment.ts --dry-run
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { config } from 'dotenv';
import pino from 'pino';

// F-OBS-12 — share baseOptions with the rest of the app (PII redact + ISO time).
const log = pino({ ...getBaseLoggerOptions(), name: 'backfill-free-zone-assignment' });

// biome-ignore lint/style/useNamingConvention: standard Node.js __dirname polyfill for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');
config({ path: resolve(ROOT_DIR, '.env') });

/** Generic free-zone placeholder when the freeform flag only says "yes, free zone". */
const DEFAULT_FREE_ZONE_CODE = 'IFZA' as const;
const MAINLAND_ZONE_CODE = 'MAINLAND' as const;

/** The freeform UAE license shape held in `Contractor.countryFields` JSONB (D-02 source). */
export interface UaeCountryFieldsShape {
  tradeLicenseNumber?: string;
  freeZone?: boolean;
  tradeLicenseExpiry?: string;
  freelancePermitNumber?: string;
}

export interface ContractorRow {
  id: string;
  organizationId: string;
  countryCode: string;
  countryFields: unknown | null;
  /** True when a FreeZoneAssignment already exists for this contractor (idempotency guard). */
  hasAssignment: boolean;
}

export interface FreeZoneAssignmentInsert {
  organizationId: string;
  contractorId: string;
  zone: typeof DEFAULT_FREE_ZONE_CODE | typeof MAINLAND_ZONE_CODE;
  licenseNumber: string;
  licenseExpiresAt: Date | null;
}

/**
 * Pure transform: map AE contractors' freeform countryFields into the
 * FreeZoneAssignment rows to insert. Skips contractors that (a) are not AE,
 * (b) have no trade-license number, or (c) already have an assignment row
 * (idempotent). Never deletes or mutates source data.
 */
export function planFreeZoneBackfill(
  contractors: readonly ContractorRow[],
): FreeZoneAssignmentInsert[] {
  const inserts: FreeZoneAssignmentInsert[] = [];
  for (const c of contractors) {
    if (c.countryCode !== 'AE') continue;
    if (c.hasAssignment) continue; // idempotency — never overwrite an existing row.

    const fields = (c.countryFields ?? {}) as UaeCountryFieldsShape;
    const licenseNumber = fields.tradeLicenseNumber?.trim();
    if (!licenseNumber) continue; // nothing structured to migrate.

    inserts.push({
      organizationId: c.organizationId,
      contractorId: c.id,
      zone: fields.freeZone === true ? DEFAULT_FREE_ZONE_CODE : MAINLAND_ZONE_CODE,
      licenseNumber,
      licenseExpiresAt: fields.tradeLicenseExpiry ? new Date(fields.tradeLicenseExpiry) : null,
    });
  }
  return inserts;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log.error('DATABASE_URL is not set — refusing to run');
    process.exit(2);
  }

  log.info({ dbUrl: dbUrl.replace(/:[^:@/]+@/, ':***@'), dryRun }, 'connecting');

  // Lazy-import so the pure `planFreeZoneBackfill` export stays testable without
  // dragging the Prisma runtime into vitest's module graph. Uses the canonical
  // `createPrismaClientForUrl` (modern prisma-client generator) — never the
  // legacy `@prisma/client` default entry, which this repo does not generate.
  const { createPrismaClientForUrl } = await import('../src/client.js');
  const prisma = createPrismaClientForUrl(dbUrl);
  try {
    const candidates = await prisma.contractor.findMany({
      where: { countryCode: 'AE', freeZoneAssignment: { is: null } },
      select: {
        id: true,
        organizationId: true,
        countryCode: true,
        countryFields: true,
      },
    });
    log.info({ count: candidates.length }, 'AE contractors without a free-zone assignment');

    const inserts = planFreeZoneBackfill(
      candidates.map(c => ({
        id: c.id,
        organizationId: c.organizationId,
        countryCode: c.countryCode,
        countryFields: c.countryFields,
        hasAssignment: false,
      })),
    );
    log.info({ count: inserts.length }, 'free-zone assignment rows planned');

    if (dryRun) {
      log.info('dry-run — no writes; countryFields JSONB retained');
      return;
    }

    await prisma.$transaction(
      inserts.map(row =>
        prisma.freeZoneAssignment.create({
          data: {
            organizationId: row.organizationId,
            contractorId: row.contractorId,
            zone: row.zone,
            licenseNumber: row.licenseNumber,
            licenseExpiresAt: row.licenseExpiresAt,
          },
        }),
      ),
    );
    log.info({ count: inserts.length }, 'backfill applied; countryFields JSONB retained');
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    log.error({ err }, 'backfill failed');
    process.exit(1);
  });
}
