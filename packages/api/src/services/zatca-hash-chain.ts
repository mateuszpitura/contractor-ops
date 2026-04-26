// ---------------------------------------------------------------------------
// ZATCA Invoice Hash Chain Service
// ---------------------------------------------------------------------------
// Manages the sequential invoice hash chain per organization.
// Per D-03: Advisory lock ensures sequential processing per org.
// Per ZATCA spec: Each invoice references the hash of the previous invoice.
// First invoice PIH = SHA-256 of literal string "0".
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal Prisma client interface for testability */
export interface PrismaLike {
  $executeRawUnsafe: (query: string, ...args: unknown[]) => Promise<unknown>;
  zatcaInvoiceChain: {
    findFirst: (args: {
      where: Record<string, unknown>;
      orderBy: Record<string, string>;
      select: Record<string, boolean>;
    }) => Promise<{ icv: number; invoiceHash: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

/** Next chain entry for a new invoice */
export interface ChainEntry {
  /** Invoice Counter Value (monotonically increasing per org) */
  icv: number;
  /** Previous Invoice Hash (SHA-256 hex of previous invoice's signed XML) */
  pih: string;
}

/** Data needed to record a new chain entry */
export interface RecordChainData {
  organizationId: string;
  icv: number;
  invoiceId: string;
  invoiceHash: string;
  previousHash: string;
  zatcaUuid: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash of the literal string "0".
 * Used as PIH for the first invoice in an organization's chain.
 */
const GENESIS_PIH = crypto.createHash('sha256').update('0').digest('hex');

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Acquire an advisory lock scoped to the organization.
 *
 * Uses `pg_advisory_xact_lock(hashtext(organizationId))` which is
 * transaction-scoped — automatically released on commit or rollback.
 *
 * Must be called within a Prisma interactive transaction (`$transaction`).
 * T-48-10: Combined with @@unique([orgId, icv]) prevents concurrent/duplicate entries.
 */
export async function acquireChainLock(prisma: PrismaLike, organizationId: string): Promise<void> {
  await prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', organizationId);
}

/**
 * Get the next chain entry (ICV + PIH) for a new invoice.
 *
 * - First invoice: icv=1, pih=SHA-256("0")
 * - Subsequent: icv=lastICV+1, pih=lastInvoiceHash
 *
 * Must be called after acquireChainLock to ensure no concurrent readers.
 */
export async function getNextChainEntry(
  prisma: PrismaLike,
  organizationId: string,
): Promise<ChainEntry> {
  const lastEntry = await prisma.zatcaInvoiceChain.findFirst({
    where: { organizationId },
    orderBy: { icv: 'desc' },
    select: { icv: true, invoiceHash: true },
  });

  if (!lastEntry) {
    return { icv: 1, pih: GENESIS_PIH };
  }

  return {
    icv: lastEntry.icv + 1,
    pih: lastEntry.invoiceHash,
  };
}

/**
 * Record a new chain entry with PENDING status.
 *
 * Creates a ZatcaInvoiceChain record for the invoice.
 * The status will be updated after ZATCA API submission.
 */
export async function recordChainEntry(
  prisma: PrismaLike,
  data: RecordChainData,
): Promise<{ id: string }> {
  return prisma.zatcaInvoiceChain.create({
    data: {
      organizationId: data.organizationId,
      icv: data.icv,
      invoiceId: data.invoiceId,
      invoiceHash: data.invoiceHash,
      previousHash: data.previousHash,
      zatcaUuid: data.zatcaUuid,
      zatcaStatus: 'PENDING',
    },
  });
}
