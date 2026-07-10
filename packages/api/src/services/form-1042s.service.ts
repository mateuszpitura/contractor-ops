import type { Prisma } from '@contractor-ops/db';

import { clear, complete, reserve } from '../lib/idempotency';
import { writeAuditLog } from './audit-writer';
import type {
  ApplyTreatyInput,
  ApplyTreatyOverride,
  TreatyDecision,
  TreatyRateSource,
} from './treaty-rate.service';
import { applyTreaty, resolveTreatyDecision } from './treaty-rate.service';

// ---------------------------------------------------------------------------
// Form 1042-S year-end generation engine (foreign-recipient reporting).
//
// The 1042-S mirrors the 1099-NEC engine structure with the reporting
// differences that separate the chapter-3 foreign-withholding regime from the
// domestic 1099 regime:
//
//   - Routing is driven by the W-form on file, NEVER by nationality: a W-8BEN /
//     W-8BEN-E recipient is a 1042-S; a W-9 recipient is a 1099-NEC and is
//     skipped here. Reading the form-on-file avoids the trap of classifying a
//     recipient by passport when a US-person election or a foreign entity flips
//     the actual obligation.
//   - Box 2 gross income is reported for every foreign recipient (there is no
//     de-minimis threshold — unlike the 1099 box-1 gate). Box 3b is the chapter-3
//     withholding rate, resolved behind a §875(d) gate: the reduced treaty rate
//     applies ONLY when the recipient's W-8 chain is complete; an incomplete or
//     missing W-8 forces the 30% statutory rate rather than silently granting a
//     treaty benefit the recipient has not substantiated.
//   - REPORTED-ONLY: this engine never mutates a payout. Applying the chapter-3
//     deduction to a payment is a separate rail (a later phase). The 1042-S here
//     captures the figures as reported.
//
// A CORRECTED 1042-S supersedes rather than mutates: the prior ACTIVE row flips
// to SUPERSEDED and a new ACTIVE row is inserted inside one transaction. A filed
// row is never updated in place.
//
// PII boundary: the immutable snapshot keeps the recipient foreign TIN (FTIN) as
// last-4 only — a full FTIN never enters the snapshot, a log, or the recipient
// PDF rendered from it. The snapshot sanitizer strips any forged full-identifier
// key.
// ---------------------------------------------------------------------------

const USD = 'USD';

/** Statutory US chapter-3 withholding rate (percent) when no treaty claim survives the §875(d) gate. */
const STATUTORY_RATE = 30;

/** Idempotency TTL for a generated batch — long enough to dedupe a retry storm. */
const BATCH_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * The 1042-S income/status/exemption codes and the resolved chapter-3 rate are
 * deterministic arithmetic over published treaty data, not legal advice — they
 * ship adviser-verify annotated for jurisdiction sign-off before production
 * filing with the IRS.
 */
const ADVISER_VERIFY_NOTE =
  'Computed 1042-S figures require jurisdiction-specific tax-adviser verification before production filing.';

// ---------------------------------------------------------------------------
// Form-on-file routing (never nationality)
// ---------------------------------------------------------------------------

export type UsTaxFormType = 'W9' | 'W8BEN' | 'W8BENE';
export type YearEndFormKind = '1042-S' | '1099-NEC';

/**
 * Route a recipient to the correct year-end form from the W-form on file. A
 * W-8BEN / W-8BEN-E foreign recipient is a 1042-S; a W-9 US-person recipient is
 * a 1099-NEC. Routing reads the submitted form, never the recipient's passport /
 * nationality — a foreign national who has filed a valid W-9 (a US-person
 * election) is a 1099-NEC recipient, and a US national with a foreign entity on
 * a W-8BEN-E is a 1042-S recipient.
 */
export function routeFormType(formType: UsTaxFormType): YearEndFormKind {
  return formType === 'W9' ? '1099-NEC' : '1042-S';
}

// ---------------------------------------------------------------------------
// Box 2 / Box 3b chapter-3 rate — §875(d) treaty gate
// ---------------------------------------------------------------------------

/**
 * In-memory mirror of the seeded `WithholdingTaxRate` US business-profits rows
 * (Article 7, no US permanent establishment) for the common W-8 residencies.
 * This deterministic snapshot resolves the box-2 / box-3b rate without a
 * database round-trip so the §875(d) gate is unit-testable, exactly mirroring
 * the 1099 sibling's `SEEDED_THRESHOLDS_MINOR` / `getBox1ThresholdMinor` split.
 * The batch / router path injects the live DB-backed `applyTreaty` resolver
 * (the record-of-record), which reads the same rows from the config table.
 */
const US_TREATY_SNAPSHOT: Readonly<Record<string, { rate: number; article: string }>> = {
  PL: { rate: 0, article: 'Article 7' },
  DE: { rate: 0, article: 'Article 7' },
  GB: { rate: 0, article: 'Article 7' },
  IE: { rate: 0, article: 'Article 7' },
  NL: { rate: 0, article: 'Article 7' },
};

/** A treaty resolver: given a residency (+ optional override), resolve rate + article. */
export type TreatyResolver = (input: ApplyTreatyInput) => Promise<TreatyDecision>;

/**
 * DB-free treaty resolver over {@link US_TREATY_SNAPSHOT}. Resolves the same
 * decision shape as the live `applyTreaty` (rate + article + source) so the two
 * are interchangeable at the call site; a residency without a seeded treaty row
 * falls to the 30% statutory default.
 */
async function snapshotTreatyResolver(input: ApplyTreatyInput): Promise<TreatyDecision> {
  const row = US_TREATY_SNAPSHOT[input.contractorResidency] ?? null;
  return resolveTreatyDecision({
    autoRate: row ? row.rate : null,
    autoArticle: row ? row.article : null,
    hasTreatyRow: row !== null,
    overrideRate: input.override?.rate,
    overrideArticle: input.override?.article ?? null,
    overrideReason: input.override?.reason,
  });
}

export interface ResolveBox2RateInput {
  /** Recipient residency country (ISO-2), read from the W-8 on file. */
  contractorResidency: string;
  /**
   * Whether the recipient's W-8 chain is complete (a valid, unexpired W-8 with a
   * substantiated treaty claim). The §875(d) gate: only a complete chain may
   * claim the reduced treaty rate; an incomplete chain is 30% statutory.
   */
  w8ChainComplete: boolean;
  /** Resolution date for the temporal treaty window (defaults to now). */
  asOf?: Date;
  /** Manual override — wins over the resolved rate (requires a reason). */
  override?: ApplyTreatyOverride | null;
  /**
   * Treaty resolver. Defaults to the DB-free {@link US_TREATY_SNAPSHOT} resolver
   * so the gate is testable without a live DB; the batch / router path injects
   * the live `applyTreaty` for the record-of-record.
   */
  resolveTreaty?: TreatyResolver;
}

export interface Box2RateDecision {
  /** Chapter-3 withholding rate in whole-number percent (box 3b). */
  rate: number;
  /** Treaty article claimed (box 3b treaty basis); null when statutory. */
  article: string | null;
  source: TreatyRateSource;
  /**
   * True when a valid treaty claim was withheld solely because the W-8 chain was
   * incomplete — the caller escalates for a refreshed W-8 rather than silently
   * over-withholding forever.
   */
  gatedByIncompleteW8: boolean;
}

/**
 * Resolve the box-2 / box-3b chapter-3 rate behind the §875(d) gate. When the
 * recipient's W-8 chain is complete the resolved treaty rate + article apply;
 * when it is incomplete (or missing) the 30% statutory rate is forced and the
 * decision is flagged for escalation — never a silent grant of a treaty benefit
 * the recipient has not substantiated.
 */
export async function resolveBox2Rate(input: ResolveBox2RateInput): Promise<Box2RateDecision> {
  if (!input.w8ChainComplete) {
    return {
      rate: STATUTORY_RATE,
      article: null,
      source: 'statutory_30',
      gatedByIncompleteW8: true,
    };
  }

  const resolver = input.resolveTreaty ?? snapshotTreatyResolver;
  const decision = await resolver({
    contractorResidency: input.contractorResidency,
    asOf: input.asOf,
    override: input.override ?? null,
  });

  return {
    rate: decision.rate,
    article: decision.article,
    source: decision.source,
    gatedByIncompleteW8: false,
  };
}

// ---------------------------------------------------------------------------
// Immutable snapshot (last-4 FTIN only)
// ---------------------------------------------------------------------------

/**
 * Keys never permitted in a 1042-S snapshot payload — full foreign/domestic
 * identifiers. The structured last-4 reference (`recipientFtinLast4`) is not in
 * this set and is retained; a bare full `ftin` / `tin` / `ssn` scalar cannot be
 * vetted and is dropped.
 */
const FORBIDDEN_SNAPSHOT_KEYS = new Set([
  'ftin',
  'fullftin',
  'foreigntin',
  'tin',
  'fulltin',
  'ssn',
  'fullssn',
  'ssnencrypted',
]);

/**
 * Recursively drop any key that would carry a full identifier, mirroring the
 * 1099 sanitizer, so a forged caller payload cannot leak a full FTIN into the
 * record-of-record. A structured `tin`/`ftin` object (e.g. `{ last4 }`) is
 * retained after recursion; a bare scalar is dropped.
 */
function sanitizeSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeSnapshotValue);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if ((lower === 'tin' || lower === 'ftin') && val !== null && typeof val === 'object') {
        out[key] = sanitizeSnapshotValue(val);
        continue;
      }
      if (FORBIDDEN_SNAPSHOT_KEYS.has(lower)) {
        continue;
      }
      out[key] = sanitizeSnapshotValue(val);
    }
    return out;
  }
  return value;
}

export interface BuildForm1042SSnapshotInput {
  taxYear: number;
  payerOrgId: string;
  recipientId: string;
  payerName: string;
  recipientName: string;
  /** Recipient FTIN last-4 ONLY — a full foreign TIN must never reach this builder. */
  recipientFtinLast4: string;
  /** i1042-S income code (Appendix B) — adviser-verify. */
  box1IncomeCode: string;
  /** Box 2 gross income, USD minor units (cents). */
  box2GrossIncomeMinor: number;
  /** Box 3b chapter-3 withholding rate in basis points (1500 = 15.00%). */
  box3bChap3RateBp: number;
  /** Box 7 federal tax withheld, USD minor units. */
  box7FederalTaxWithheldMinor: number;
  /** Treaty article claimed (box 3b basis); null when statutory. */
  treatyArticle: string | null;
  corrected: boolean;
  box3aChap3ExemptionCode?: string | null;
  box4aChap4ExemptionCode?: string | null;
  box4bChap4RateBp?: number | null;
  recipientChap3StatusCode?: string | null;
  recipientChap4StatusCode?: string | null;
  recipientLobCode?: string | null;
  currency?: string;
}

export interface Form1042SSnapshot {
  taxYear: number;
  payerOrgId: string;
  recipientId: string;
  payerName: string;
  recipientName: string;
  recipientFtinLast4: string;
  box1IncomeCode: string;
  box2GrossIncomeMinor: number;
  box3bChap3RateBp: number;
  box7FederalTaxWithheldMinor: number;
  treatyArticle: string | null;
  corrected: boolean;
  box3aChap3ExemptionCode: string | null;
  box4aChap4ExemptionCode: string | null;
  box4bChap4RateBp: number | null;
  recipientChap3StatusCode: string | null;
  recipientChap4StatusCode: string | null;
  recipientLobCode: string | null;
  currency: string;
  adviserVerifyNote: string;
}

/**
 * Build the immutable snapshot that IS the 1042-S record-of-record. The
 * recipient PDF and any downstream IRIS transmit render from this snapshot,
 * never a live recompute, so the document reflects the figures as filed.
 * Defensively sanitized so no full FTIN survives even if a caller leaks one.
 */
export function buildForm1042SSnapshot(input: BuildForm1042SSnapshotInput): Form1042SSnapshot {
  const snapshot: Form1042SSnapshot = {
    taxYear: input.taxYear,
    payerOrgId: input.payerOrgId,
    recipientId: input.recipientId,
    payerName: input.payerName,
    recipientName: input.recipientName,
    recipientFtinLast4: input.recipientFtinLast4,
    box1IncomeCode: input.box1IncomeCode,
    box2GrossIncomeMinor: input.box2GrossIncomeMinor,
    box3bChap3RateBp: input.box3bChap3RateBp,
    box7FederalTaxWithheldMinor: input.box7FederalTaxWithheldMinor,
    treatyArticle: input.treatyArticle,
    corrected: input.corrected,
    box3aChap3ExemptionCode: input.box3aChap3ExemptionCode ?? null,
    box4aChap4ExemptionCode: input.box4aChap4ExemptionCode ?? null,
    box4bChap4RateBp: input.box4bChap4RateBp ?? null,
    recipientChap3StatusCode: input.recipientChap3StatusCode ?? null,
    recipientChap4StatusCode: input.recipientChap4StatusCode ?? null,
    recipientLobCode: input.recipientLobCode ?? null,
    currency: input.currency ?? USD,
    adviserVerifyNote: ADVISER_VERIFY_NOTE,
  };
  return sanitizeSnapshotValue(snapshot) as Form1042SSnapshot;
}

/** Convert a whole-number percent rate to a Decimal-string for the box3bChap3Rate column. */
function rateBpToPercentDecimal(rateBp: number): string {
  return (rateBp / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// CORRECTED = supersede chain
// ---------------------------------------------------------------------------

/**
 * Minimal transactional surface used by `supersedeCorrected1042S` — accepts a
 * Prisma `$transaction` tx (or the tenant-extended client) without coupling to
 * the full delegate type.
 */
export interface Form1042STxClient {
  form1042S: {
    updateMany: (args: {
      where: Prisma.Form1042SWhereInput;
      data: Prisma.Form1042SUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
    create: (args: {
      data: Prisma.Form1042SUncheckedCreateInput;
    }) => Promise<{ id: string; status: string }>;
  };
}

export interface SupersedeCorrected1042SInput {
  organizationId: string;
  payerOrgId: string;
  recipientId: string;
  taxYear: number;
  snapshotJson: Prisma.InputJsonValue;
  box2GrossIncomeMinor: number;
  box7FederalTaxWithheldMinor: number;
  box1IncomeCode?: string | null;
  box3bChap3RateBp?: number | null;
  treatyArticle?: string | null;
  currency?: string;
}

/**
 * Append-only CORRECTED filing within the caller's transaction.
 *
 * (1) Flips every prior ACTIVE row for this (org, payer-org, recipient, tax
 * year) to SUPERSEDED, then (2) inserts the new row as ACTIVE with
 * `corrected: true`. The supersede MUST run before the insert so a recipient
 * never holds two concurrent ACTIVE 1042-S forms for one year. A filed row is
 * never mutated in place — a correction always inserts a new row.
 */
export async function supersedeCorrected1042S(
  tx: Form1042STxClient,
  input: SupersedeCorrected1042SInput,
): Promise<{ id: string; status: string }> {
  const {
    organizationId,
    payerOrgId,
    recipientId,
    taxYear,
    snapshotJson,
    box2GrossIncomeMinor,
    box7FederalTaxWithheldMinor,
    box1IncomeCode = null,
    box3bChap3RateBp = null,
    treatyArticle = null,
    currency = USD,
  } = input;

  await tx.form1042S.updateMany({
    where: { organizationId, payerOrgId, recipientId, taxYear, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED' },
  });

  return tx.form1042S.create({
    data: {
      organizationId,
      payerOrgId,
      recipientId,
      taxYear,
      status: 'ACTIVE',
      corrected: true,
      box1IncomeCode,
      box2GrossIncomeMinor,
      box3bChap3Rate: box3bChap3RateBp === null ? null : rateBpToPercentDecimal(box3bChap3RateBp),
      box7FederalTaxWithheldMinor,
      treatyArticle,
      currency,
      snapshotJson,
    },
  });
}

// ---------------------------------------------------------------------------
// CORRECTED filing (transactional, audited)
// ---------------------------------------------------------------------------

/** Tx surface for `fileCorrection1042S` — supersede + create + audit join one tx. */
export interface FileCorrection1042STxClient extends Form1042STxClient {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
    createMany: (args: {
      data: Prisma.AuditLogUncheckedCreateInput[];
    }) => Promise<{ count: number }>;
  };
}

export interface FileCorrection1042SInput extends SupersedeCorrected1042SInput {
  actorId?: string | null;
  actorType?: 'USER' | 'SYSTEM';
}

/**
 * File a CORRECTED 1042-S inside the caller's transaction: supersede the prior
 * ACTIVE row, insert the new ACTIVE row, and write the correction audit row —
 * all atomic. The filed row is never mutated.
 */
export async function fileCorrection1042S(
  tx: FileCorrection1042STxClient,
  input: FileCorrection1042SInput,
): Promise<{ id: string; status: string }> {
  const created = await supersedeCorrected1042S(tx, input);

  await writeAuditLog({
    tx,
    organizationId: input.organizationId,
    actorType: input.actorType ?? 'USER',
    actorId: input.actorId ?? null,
    action: 'form1042s.correction',
    resourceType: 'ORGANIZATION',
    resourceId: created.id,
    metadata: {
      taxYear: input.taxYear,
      payerOrgId: input.payerOrgId,
      recipientId: input.recipientId,
    },
  });

  return created;
}

// ---------------------------------------------------------------------------
// Idempotency key
// ---------------------------------------------------------------------------

/**
 * Deterministic idempotency key for a batch generation so a retried batch
 * (same org + payer-org + tax year) reuses the prior reservation/result and
 * never double-files.
 */
export function batchIdempotencyKey1042S(input: {
  organizationId: string;
  payerOrgId: string;
  taxYear: number;
}): string {
  return `form1042s:batch:${input.organizationId}:${input.payerOrgId}:${input.taxYear}`;
}

// ---------------------------------------------------------------------------
// Batch generation
// ---------------------------------------------------------------------------

/** One recipient's reporting context for a 1042-S batch run. */
export interface BatchRecipient1042S {
  recipientId: string;
  /** The W-form on file — drives routing (W-9 recipients are skipped). */
  formType: UsTaxFormType;
  payerName: string;
  recipientName: string;
  recipientFtinLast4: string;
  /** Recipient residency (ISO-2), read from the W-8 on file. */
  contractorResidency: string;
  /** Whether the W-8 chain is complete — the §875(d) gate input. */
  w8ChainComplete: boolean;
  /** Box 2 gross US-source income, USD minor units. */
  box2GrossIncomeMinor: number;
  /** Box 7 federal tax withheld already recorded, USD minor units. */
  box7FederalTaxWithheldMinor: number;
  /** i1042-S income code (Appendix B) — adviser-verify. */
  box1IncomeCode: string;
  box3aChap3ExemptionCode?: string | null;
  box4aChap4ExemptionCode?: string | null;
  box4bChap4RateBp?: number | null;
  recipientChap3StatusCode?: string | null;
  recipientChap4StatusCode?: string | null;
  recipientLobCode?: string | null;
  /** Manual treaty-rate override (with reason) — audited by the caller. */
  treatyOverride?: ApplyTreatyOverride | null;
}

export interface GenerateBatch1042SInput {
  organizationId: string;
  payerOrgId: string;
  taxYear: number;
  recipients: readonly BatchRecipient1042S[];
}

export interface GeneratedForm1042S {
  recipientId: string;
  box2GrossIncomeMinor: number;
  box3bChap3RateBp: number;
  treatyArticle: string | null;
  /** True when the treaty rate was withheld because the W-8 chain was incomplete. */
  gatedByIncompleteW8: boolean;
  snapshotJson: Form1042SSnapshot;
}

/**
 * Minimal Prisma create surface for a single ACTIVE 1042-S row — the shape of the
 * `$transaction` tx client the batch inserts through. Kept structural so a real
 * Prisma tx or a test double satisfy it.
 */
export interface Form1042SCreateClient {
  form1042S: {
    create: (args: { data: Prisma.Form1042SUncheckedCreateInput }) => Promise<{ id: string }>;
    updateMany: (args: {
      where: Prisma.Form1042SWhereInput;
      data: Prisma.Form1042SUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
  };
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
    createMany: (args: {
      data: Prisma.AuditLogUncheckedCreateInput[];
    }) => Promise<{ count: number }>;
  };
}

/**
 * Transaction-capable persistence sink injected into `generateBatch1042S`. The
 * whole batch is inserted inside one interactive transaction so a mid-batch throw
 * rolls back every row — a partial year-end filing is never left behind. The real
 * writer is the tenant Prisma client; unit tests pass a rollback-simulating double.
 */
export interface Form1042SPersistClient {
  $transaction: <T>(fn: (tx: Form1042SCreateClient) => Promise<T>) => Promise<T>;
}

export interface GenerateBatch1042SDeps {
  /** Tenant client (reserved for live payment-data reads; unused for pre-aggregated input). */
  db: unknown;
  /**
   * Persistence sink for the generated ACTIVE rows. Injected so the deterministic
   * core is unit-testable with no live database (the real writer is supplied by
   * the schema-applied router / wiring caller). When omitted, rows are computed
   * but not persisted.
   */
  persist?: Form1042SPersistClient;
  /**
   * Treaty resolver injected by the router for the live record-of-record path
   * (`applyTreaty`). Defaults to the live DB-backed resolver; unit tests pass an
   * empty recipient set so the resolver is never invoked.
   */
  resolveTreaty?: TreatyResolver;
  /** Audit identity for the generate action. */
  actorId?: string | null;
  actorType?: 'USER' | 'SYSTEM';
}

export interface GenerateBatch1042SResult {
  /** True when the result was served from a prior idempotent reservation. */
  idempotent: boolean;
  generated: GeneratedForm1042S[];
  /** Recipients routed to 1099-NEC (W-9 on file) — recorded, not filed here. */
  skippedRecipientIds: string[];
  /** Recipients forced to 30% statutory because their W-8 chain was incomplete. */
  escalatedRecipientIds: string[];
}

/**
 * True when `err` is the P2002 unique-constraint violation raised by the
 * `Form1042S_active_key` partial index (at most one ACTIVE return per org /
 * payer-org / recipient / tax year). Detected structurally so the service takes
 * no direct dependency on the Prisma error class. A fresh ACTIVE-row insert can
 * only collide on this index — `id` is a new cuid and `supersededById` is null —
 * so a missing/opaque `meta.target` still resolves to this violation.
 */
function isActive1042SKeyViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || (err as { code?: unknown }).code !== 'P2002') {
    return false;
  }
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  if (typeof target === 'string') {
    return target.includes('Form1042S_active_key') || target.includes('recipientId');
  }
  if (Array.isArray(target)) {
    return target.includes('recipientId');
  }
  return true;
}

/**
 * Generate a tax-year 1042-S batch for one payer-org. For each recipient it
 * routes on the W-form on file (W-9 recipients are skipped — they are 1099-NEC),
 * resolves the box-3b chapter-3 rate behind the §875(d) gate, and builds the
 * immutable snapshot. When a persistence sink is supplied, every ACTIVE row is
 * inserted inside ONE interactive transaction, so a mid-batch throw rolls back
 * the whole batch — a partial year-end filing is never left behind. A re-run that
 * collides with an already-filed batch (P2002 on `Form1042S_active_key`) is
 * treated as an idempotent skip: no duplicate rows, no error. Wrapped in
 * idempotency reserve/complete/clear so a retried batch returns the prior result
 * instead of re-filing. Writes an audit row on generation. REPORTED-ONLY — never
 * mutates a payout.
 */
export async function generateBatch1042S(
  input: GenerateBatch1042SInput,
  deps: GenerateBatch1042SDeps,
): Promise<GenerateBatch1042SResult> {
  const { organizationId, payerOrgId, taxYear, recipients } = input;
  const { persist, resolveTreaty = applyTreaty, actorId = null, actorType = 'USER' } = deps;

  const key = batchIdempotencyKey1042S({ organizationId, payerOrgId, taxYear });
  const hit = await reserve<GenerateBatch1042SResult>(key, BATCH_IDEMPOTENCY_TTL_SECONDS);

  if (hit.kind === 'HIT') {
    return { ...hit.result, idempotent: true };
  }
  if (hit.kind === 'PENDING') {
    // Another worker is mid-flight on this exact batch — refuse to double-file.
    return {
      idempotent: true,
      generated: [],
      skippedRecipientIds: [],
      escalatedRecipientIds: [],
    };
  }

  try {
    const generated: GeneratedForm1042S[] = [];
    const skippedRecipientIds: string[] = [];
    const escalatedRecipientIds: string[] = [];
    const rowsToPersist: Prisma.Form1042SUncheckedCreateInput[] = [];

    for (const recipient of recipients) {
      if (routeFormType(recipient.formType) !== '1042-S') {
        skippedRecipientIds.push(recipient.recipientId);
        continue;
      }

      const box2 = await resolveBox2Rate({
        contractorResidency: recipient.contractorResidency,
        w8ChainComplete: recipient.w8ChainComplete,
        override: recipient.treatyOverride ?? null,
        resolveTreaty,
      });
      if (box2.gatedByIncompleteW8) {
        escalatedRecipientIds.push(recipient.recipientId);
      }

      const box3bChap3RateBp = Math.round(box2.rate * 100);

      const snapshotJson = buildForm1042SSnapshot({
        taxYear,
        payerOrgId,
        recipientId: recipient.recipientId,
        payerName: recipient.payerName,
        recipientName: recipient.recipientName,
        recipientFtinLast4: recipient.recipientFtinLast4,
        box1IncomeCode: recipient.box1IncomeCode,
        box2GrossIncomeMinor: recipient.box2GrossIncomeMinor,
        box3bChap3RateBp,
        box7FederalTaxWithheldMinor: recipient.box7FederalTaxWithheldMinor,
        treatyArticle: box2.article,
        corrected: false,
        box3aChap3ExemptionCode: recipient.box3aChap3ExemptionCode ?? null,
        box4aChap4ExemptionCode: recipient.box4aChap4ExemptionCode ?? null,
        box4bChap4RateBp: recipient.box4bChap4RateBp ?? null,
        recipientChap3StatusCode: recipient.recipientChap3StatusCode ?? null,
        recipientChap4StatusCode: recipient.recipientChap4StatusCode ?? null,
        recipientLobCode: recipient.recipientLobCode ?? null,
      });

      if (persist) {
        rowsToPersist.push({
          organizationId,
          payerOrgId,
          recipientId: recipient.recipientId,
          taxYear,
          status: 'ACTIVE',
          corrected: false,
          box1IncomeCode: recipient.box1IncomeCode,
          box2GrossIncomeMinor: recipient.box2GrossIncomeMinor,
          box3aChap3ExemptionCode: recipient.box3aChap3ExemptionCode ?? null,
          box3bChap3Rate: rateBpToPercentDecimal(box3bChap3RateBp),
          box4aChap4ExemptionCode: recipient.box4aChap4ExemptionCode ?? null,
          box4bChap4Rate:
            recipient.box4bChap4RateBp == null
              ? null
              : rateBpToPercentDecimal(recipient.box4bChap4RateBp),
          box7FederalTaxWithheldMinor: recipient.box7FederalTaxWithheldMinor,
          recipientChap3StatusCode: recipient.recipientChap3StatusCode ?? null,
          recipientChap4StatusCode: recipient.recipientChap4StatusCode ?? null,
          recipientLobCode: recipient.recipientLobCode ?? null,
          treatyArticle: box2.article,
          currency: USD,
          snapshotJson: snapshotJson as unknown as Prisma.InputJsonValue,
        });
      }

      generated.push({
        recipientId: recipient.recipientId,
        box2GrossIncomeMinor: recipient.box2GrossIncomeMinor,
        box3bChap3RateBp,
        treatyArticle: box2.article,
        gatedByIncompleteW8: box2.gatedByIncompleteW8,
        snapshotJson,
      });
    }

    // Persist the whole batch in ONE interactive transaction: a mid-batch throw
    // rolls back every row rather than leaving a partial year-end filing. A P2002
    // on the `Form1042S_active_key` partial index means a prior successful batch
    // already filed these ACTIVE rows — the transaction rolled back, so treat the
    // re-run as an idempotent skip (no duplicate rows, no error) and cache it so
    // later retries short-circuit on the reservation.
    if (persist && rowsToPersist.length > 0) {
      try {
        await persist.$transaction(async tx => {
          for (const data of rowsToPersist) {
            await tx.form1042S.updateMany({
              where: {
                organizationId: data.organizationId,
                payerOrgId: data.payerOrgId,
                recipientId: data.recipientId,
                taxYear: data.taxYear,
                status: 'ACTIVE',
              },
              data: { status: 'SUPERSEDED' },
            });
            await tx.form1042S.create({ data });
          }
          await writeAuditLog({
            tx,
            organizationId,
            actorType,
            actorId,
            action: 'form1042s.generate',
            resourceType: 'ORGANIZATION',
            resourceId: payerOrgId,
            metadata: {
              taxYear,
              generatedCount: generated.length,
              skippedCount: skippedRecipientIds.length,
              escalatedCount: escalatedRecipientIds.length,
            },
          });
        });
      } catch (err) {
        if (isActive1042SKeyViolation(err)) {
          const skipResult: GenerateBatch1042SResult = {
            idempotent: true,
            generated,
            skippedRecipientIds,
            escalatedRecipientIds,
          };
          await complete(key, skipResult, BATCH_IDEMPOTENCY_TTL_SECONDS);
          return skipResult;
        }
        throw err;
      }
    }

    const result: GenerateBatch1042SResult = {
      idempotent: false,
      generated,
      skippedRecipientIds,
      escalatedRecipientIds,
    };
    await complete(key, result, BATCH_IDEMPOTENCY_TTL_SECONDS);
    return result;
  } catch (err) {
    // Release the reservation so the batch can be retried after a failure.
    await clear(key);
    throw err;
  }
}
