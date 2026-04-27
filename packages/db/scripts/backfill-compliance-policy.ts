#!/usr/bin/env tsx
/**
 * Phase 71 D-08 step 2 — Backfill ContractorComplianceItem.policyRuleId,
 * severity, expiryJurisdictionTz on existing rows.
 *
 * Idempotent: WHERE policyRuleId IS NULL.
 * Per-region: invoke once per regional database URL (DATABASE_URL_EU, DATABASE_URL_ME).
 *
 * Usage:
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-compliance-policy.ts
 *   DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-compliance-policy.ts
 *
 *   # Dry-run (no writes):
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-compliance-policy.ts --dry-run
 *
 * LOCAL-ONLY constraint: there is no hosted multi-region staging today;
 * the developer runs each region from a workstation with the env var
 * exported (DATABASE_URL_EU / DATABASE_URL_ME). Mirrors Phase 70 Plan 09.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EngagementContext, Jurisdiction } from '@contractor-ops/compliance-policy';
import { POLICY_RULE_SET_VERSION, resolvePolicyRules } from '@contractor-ops/compliance-policy';
import { config } from 'dotenv';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

// biome-ignore lint/style/useNamingConvention: standard Node.js __dirname polyfill for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');
config({ path: resolve(ROOT_DIR, '.env') });

// ---------------------------------------------------------------------------
// Types — pure-function signature for tests
// ---------------------------------------------------------------------------

export interface ComplianceItemRow {
  id: string;
  contractorId: string;
  documentType: string;
  status: string;
  policyRuleId: string | null;
}

export interface ContractorContextRow {
  contractorId: string;
  jurisdiction: Jurisdiction;
  outcomeKind: string;
  contractorNationality: string | null;
  // Conservative defaults for pre-existing rows (T-71-07-05):
  sector: string | null;
  requiresRegulatedEquipment: boolean;
}

export interface BackfillUpdate {
  rowId: string;
  policyRuleId: string;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  expiryJurisdictionTz: string;
}

export interface BackfillOptions {
  /** Each contractor's resolved engagement context (one entry per contractor with completed assessment). */
  contractorContexts: readonly ContractorContextRow[];
  /** All compliance items eligible for backfill (status != WAIVED, policyRuleId IS NULL). */
  rows: readonly ComplianceItemRow[];
  dryRun?: boolean;
}

export interface BackfillResult {
  updates: BackfillUpdate[];
  skippedRowsNoMatchingRule: number;
  skippedContractorsNoContext: number;
}

// ---------------------------------------------------------------------------
// Pure backfill function — used by tests with synthetic data
// ---------------------------------------------------------------------------

export function backfillComplianceItems(opts: BackfillOptions): BackfillResult {
  const updates: BackfillUpdate[] = [];
  let skippedRowsNoMatchingRule = 0;

  // Index contexts by contractorId
  const contextByContractor = new Map(opts.contractorContexts.map(c => [c.contractorId, c]));

  // Group rows by contractorId
  const rowsByContractor = new Map<string, ComplianceItemRow[]>();
  for (const r of opts.rows) {
    if (r.policyRuleId !== null) continue; // idempotent guard (T-71-07-04)
    if (r.status === 'WAIVED') continue; // skip historical WAIVED rows
    const arr = rowsByContractor.get(r.contractorId) ?? [];
    arr.push(r);
    rowsByContractor.set(r.contractorId, arr);
  }

  let skippedContractorsNoContext = 0;
  for (const [contractorId, rows] of rowsByContractor) {
    const ctx = contextByContractor.get(contractorId);
    if (!ctx) {
      skippedContractorsNoContext++;
      continue;
    }
    const engagement: EngagementContext = {
      jurisdiction: ctx.jurisdiction,
      outcome: ctx.outcomeKind,
      sector: ctx.sector,
      contractorNationality: ctx.contractorNationality,
      requiresRegulatedEquipment: ctx.requiresRegulatedEquipment,
    };
    const rules = resolvePolicyRules(engagement);
    const ruleByDocType = new Map(rules.map(r => [r.documentType, r]));
    for (const row of rows) {
      const rule = ruleByDocType.get(row.documentType);
      if (!rule) {
        skippedRowsNoMatchingRule++;
        continue;
      }
      updates.push({
        rowId: row.id,
        policyRuleId: rule.policyRuleId,
        severity: rule.severity,
        expiryJurisdictionTz: rule.expiryJurisdictionTz,
      });
    }
  }

  return { updates, skippedRowsNoMatchingRule, skippedContractorsNoContext };
}

// ---------------------------------------------------------------------------
// CLI entry — applies updates against the configured DATABASE_URL
// ---------------------------------------------------------------------------

const COUNTRY_TO_JURISDICTION: Record<string, Jurisdiction> = {
  GB: 'UK',
  DE: 'DE',
  PL: 'PL',
  SA: 'KSA',
  AE: 'UAE',
};

interface PrismaLike {
  classificationAssessment: {
    findFirst: (args: unknown) => Promise<unknown>;
  };
  contractorComplianceItem: {
    findMany: (args: unknown) => Promise<unknown[]>;
    update: (args: unknown) => Promise<unknown>;
  };
  $transaction: (ops: unknown[]) => Promise<unknown>;
  $disconnect: () => Promise<void>;
}

interface AssessmentLookup {
  countryCode: string;
  outcome: unknown;
  contractorAssignment: { contractor: { countryCode: string } | null } | null;
}

async function loadContractorContexts(
  prisma: PrismaLike,
  contractorIds: string[],
): Promise<ContractorContextRow[]> {
  const contexts: ContractorContextRow[] = [];
  for (const contractorId of contractorIds) {
    const latest = (await prisma.classificationAssessment.findFirst({
      where: { contractorAssignment: { contractorId }, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      include: {
        contractorAssignment: {
          select: { contractor: { select: { countryCode: true } } },
        },
      },
    })) as AssessmentLookup | null;
    if (!latest) continue;
    const jurisdiction = COUNTRY_TO_JURISDICTION[latest.countryCode];
    if (!jurisdiction) continue;
    const outcome = latest.outcome as { kind?: unknown; type?: unknown } | null;
    const outcomeKind =
      typeof outcome?.kind === 'string'
        ? outcome.kind
        : typeof outcome?.type === 'string'
          ? outcome.type
          : '__unknown__';
    contexts.push({
      contractorId,
      jurisdiction,
      outcomeKind,
      contractorNationality: latest.contractorAssignment?.contractor?.countryCode ?? null,
      sector: null, // T-71-07-05 conservative default
      requiresRegulatedEquipment: false,
    });
  }
  return contexts;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log.error('DATABASE_URL is not set — refusing to run');
    process.exit(2);
  }

  log.info(
    {
      dbUrl: dbUrl.replace(/:[^:@/]+@/, ':***@'),
      dryRun,
      policyRuleSetVersion: POLICY_RULE_SET_VERSION,
    },
    'connecting',
  );

  // Lazy import so the test file can load this module without requiring
  // the generated Prisma client (which is only available after db:generate).
  const { PrismaClient } = (await import('@prisma/client')) as {
    PrismaClient: new (opts: { datasources: { db: { url: string } } }) => PrismaLike;
  };
  const prisma: PrismaLike = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    // 1. Load all eligible rows (status != WAIVED, policyRuleId IS NULL)
    const rawRows = (await prisma.contractorComplianceItem.findMany({
      where: { policyRuleId: null, status: { not: 'WAIVED' } },
      select: {
        id: true,
        contractorId: true,
        documentType: true,
        status: true,
        policyRuleId: true,
      },
    })) as Array<{
      id: string;
      contractorId: string;
      documentType: string;
      status: string;
      policyRuleId: string | null;
    }>;
    log.info({ rowCount: rawRows.length }, 'eligible rows loaded');

    // 2. Resolve unique contractorIds; for each, find the latest completed assessment + nationality
    const contractorIds = Array.from(new Set(rawRows.map(r => r.contractorId)));
    const contexts = await loadContractorContexts(prisma, contractorIds);
    log.info(
      { contractorContextCount: contexts.length, contractorRowCount: contractorIds.length },
      'contexts loaded',
    );

    // 3. Compute updates (pure function)
    const { updates, skippedRowsNoMatchingRule, skippedContractorsNoContext } =
      backfillComplianceItems({
        contractorContexts: contexts,
        rows: rawRows,
      });
    log.info(
      { updateCount: updates.length, skippedRowsNoMatchingRule, skippedContractorsNoContext },
      'updates computed',
    );

    if (dryRun) {
      log.info('dry-run — no writes');
      return;
    }

    // 4. Apply updates in a single transaction per region
    try {
      await prisma.$transaction(
        updates.map(u =>
          prisma.contractorComplianceItem.update({
            where: { id: u.rowId },
            data: {
              policyRuleId: u.policyRuleId,
              severity: u.severity,
              expiryJurisdictionTz: u.expiryJurisdictionTz,
            },
          }),
        ),
      );
      log.info({ appliedCount: updates.length }, 'backfill complete');
    } catch (err) {
      log.error({ err }, 'transaction failed — no updates applied');
      process.exit(1);
    }
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
