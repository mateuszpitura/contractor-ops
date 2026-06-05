// Phase 75 — Contract health-check orchestrator.
// Composes: dedup → ClaudeOcrAdapter-style Anthropic call → regex grounding →
// cross-jurisdiction → persist ContractHealthCheckRun → denormalise to
// Contract.complianceFlags* → materialise ContractorComplianceItem
// (LIKELY_MISSING only) → emit audit log.

import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@contractor-ops/db';
import type { ContractHealthToolInput } from '@contractor-ops/integrations';
import { evaluateContractIpAssignment, fetchWithTimeout } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import type { IpAssignmentResults, IpClausePhraseId } from '@contractor-ops/validators';
import {
  ALL_IP_CLAUSES,
  getDisclaimerStatus,
  IP_CLAUSE_PHRASE_LIBRARY_VERSION,
  IP_CLAUSES_BY_JURISDICTION,
} from '@contractor-ops/validators';
import { ZodError } from 'zod';
import { isDemoOrg } from '../../lib/demo.js';
import { writeAuditLog } from '../audit-writer.js';
import { createPresignedDownloadUrl } from '../r2.js';
import { analyzeCrossJurisdiction, resolveContractJurisdiction } from './cross-jurisdiction.js';
import { findExistingSucceededRun } from './dedup.js';
import { materialiseLikelyMissing } from './materialise.js';
import { CONTRACT_HEALTH_MODEL_VER } from './model.js';

const log = createLogger({ service: 'contract-health-run' });

const SIGNOFF_PREFIX = 'legal-signoff.ip_clauses.';

export interface RunHealthCheckArgs {
  db: PrismaClient;
  organizationId: string;
  contractId: string;
  triggeredBy: 'UPLOAD' | 'MANUAL' | 'MODEL_BUMP_BULK';
  triggeredByUserId?: string | null;
  force?: boolean;
}

export interface RunHealthCheckResult {
  runId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'DEDUPED';
  verdict?: ContractHealthToolInput['verdict'];
}

type GroundedClause = ContractHealthToolInput['citedClauses'][number] & {
  regexMatched: boolean;
  regexMatchSpan: { startChar: number; endChar: number } | undefined;
  // phraseId is either a real library key or a synthetic `<jur>.ungrounded@v0`
  // string; the results schema stores it as a regex-validated string so the
  // runtime type is string, not the narrower IpClausePhraseId union.
  phraseId: IpClausePhraseId | string | undefined;
};

export async function runContractHealthCheck(
  args: RunHealthCheckArgs,
): Promise<RunHealthCheckResult> {
  const { db, organizationId, contractId, triggeredBy, triggeredByUserId, force } = args;

  // Demo read-only — never run the (Anthropic-backed, write-heavy) health check
  // for a demo org. Reached via the QStash callback route (non-tRPC ingress).
  // `DEDUPED` is the existing "no new run was created" outcome — exactly the
  // semantics of a demo skip — so callers need no new status to handle.
  if (isDemoOrg(organizationId)) {
    log.info({ organizationId, contractId }, 'demo org — skipping contract health check');
    return { runId: '', status: 'DEDUPED' };
  }

  // 1. Fetch the contract PDF bytes from R2 (via the primary CONTRACT DocumentLink).
  const { pdfBase64, contentHash } = await fetchContractPdf(db, organizationId, contractId);

  // 2. Idempotency check (D-03).
  const modelVer = CONTRACT_HEALTH_MODEL_VER;
  if (!force) {
    const existing = await findExistingSucceededRun(db, { contractId, contentHash, modelVer });
    if (existing) {
      return { runId: existing.id, status: 'DEDUPED' };
    }
  }

  // 3. Insert PENDING row so the dedup window is closed against concurrent triggers.
  const startedAt = new Date();
  const pending = await db.contractHealthCheckRun.create({
    data: {
      organizationId,
      contractId,
      contentHash,
      modelVer,
      verdict: 'MANUAL_REVIEW_REQUIRED', // placeholder; updated post-LLM
      resultsJson: {},
      status: 'PENDING',
      triggeredBy,
      triggeredByUserId: triggeredByUserId ?? null,
      startedAt,
    },
    select: { id: true },
  });

  try {
    // 4. Resolve jurisdiction (D-15 fallback chain).
    const expectedJurisdiction = await resolveContractJurisdiction(db, contractId);

    // 5. Call Claude via the integrations service (keeps @anthropic-ai/sdk out
    //    of the api package; mirrors ocr-service.extractInvoice).
    const toolInput = await evaluateContractIpAssignment({ pdfBase64, modelId: modelVer });

    // 6. Regex grounding (D-13).
    const groundedClauses: GroundedClause[] = toolInput.citedClauses.map(c => ({
      ...c,
      regexMatched: false,
      regexMatchSpan: undefined,
      phraseId: undefined,
    }));

    for (const cited of groundedClauses) {
      const jurisdictionPhrases = IP_CLAUSES_BY_JURISDICTION[cited.jurisdiction];
      if (!jurisdictionPhrases) continue;
      for (const [phraseId, entry] of Object.entries(jurisdictionPhrases)) {
        const match = entry.regex.exec(cited.citedText);
        if (match) {
          cited.regexMatched = true;
          cited.phraseId = phraseId as IpClausePhraseId;
          cited.regexMatchSpan = { startChar: match.index, endChar: match.index + match[0].length };
          break;
        }
      }
    }

    // 7. Apply D-13 divergence rules.
    let verdict = toolInput.verdict;
    const anyMatch = groundedClauses.some(c => c.regexMatched);
    if (verdict === 'LIKELY_PRESENT' && !anyMatch) {
      verdict = 'MANUAL_REVIEW_REQUIRED'; // divergence rule 1
    }
    if (verdict === 'LIKELY_MISSING' && scanRawTextForStrongMatch(toolInput)) {
      verdict = 'MANUAL_REVIEW_REQUIRED'; // divergence rule 2
    }

    // 8. Cross-jurisdiction mismatch (D-15).
    const cjm = analyzeCrossJurisdiction(
      expectedJurisdiction,
      groundedClauses.map(c => c.jurisdiction),
    );
    if (cjm.mismatch) {
      verdict = 'MANUAL_REVIEW_REQUIRED';
    }

    // 9. PENDING-phrase detection (D-16).
    const pendingPhrasesCited = groundedClauses
      .filter((c): c is typeof c & { phraseId: IpClausePhraseId } => Boolean(c.phraseId))
      .filter(c => isPhrasePending(c.phraseId))
      .map(c => c.phraseId);

    // 10. Compose resultsJson per D-06.
    const completedAt = new Date();
    const resultsJson: IpAssignmentResults = {
      version: 1,
      ipAssignment: {
        verdict,
        citedClauses: groundedClauses.map(c => ({
          phraseId: c.phraseId ?? `${c.jurisdiction.toLowerCase()}.ungrounded@v0`,
          jurisdiction: c.jurisdiction,
          citedText: c.citedText,
          confidence: c.confidence,
          regexMatched: c.regexMatched,
          regexMatchSpan: c.regexMatchSpan,
        })),
        evaluatedAgainst: expectedJurisdiction
          ? [
              {
                jurisdiction: expectedJurisdiction,
                phraseLibraryVersion: IP_CLAUSE_PHRASE_LIBRARY_VERSION,
              },
            ]
          : [],
        crossJurisdictionMismatch:
          cjm.mismatch && cjm.expectedJurisdiction
            ? {
                foundJurisdiction: cjm.foundJurisdictions[0] ?? 'UNKNOWN',
                expectedJurisdiction: cjm.expectedJurisdiction,
              }
            : undefined,
        pendingPhrasesCited: pendingPhrasesCited.length > 0 ? pendingPhrasesCited : undefined,
        rawModelToolUseInput: toolInput as unknown as Record<string, unknown>,
        runId: pending.id,
        runStartedAt: startedAt.toISOString(),
        runCompletedAt: completedAt.toISOString(),
      },
    };

    // 11. Persist + denormalise + materialise + audit, all in one transaction.
    await db.$transaction(async tx => {
      await tx.contractHealthCheckRun.update({
        where: { id: pending.id },
        data: {
          verdict,
          resultsJson: resultsJson as Prisma.InputJsonValue,
          status: 'SUCCEEDED',
          completedAt,
        },
      });

      // Denormalise to Contract columns (D-01).
      await tx.contract.update({
        where: { id: contractId },
        data: {
          latestHealthCheckRunId: pending.id,
          complianceFlagsJson: resultsJson as Prisma.InputJsonValue,
          complianceFlagsCheckedAt: completedAt,
          complianceFlagsModelVer: modelVer,
        },
      });

      // Materialise ContractorComplianceItem on LIKELY_MISSING (D-07).
      if (verdict === 'LIKELY_MISSING' && expectedJurisdiction) {
        const contract = await tx.contract.findUniqueOrThrow({
          where: { id: contractId },
          select: { contractorId: true },
        });
        await materialiseLikelyMissing(tx, {
          organizationId,
          contractorId: contract.contractorId,
          contractId,
          jurisdiction: expectedJurisdiction,
        });
      }

      // Audit log (Phase 71 D-15 single-write).
      await writeAuditLog({
        organizationId,
        actorType: triggeredByUserId ? 'USER' : 'SYSTEM',
        actorId: triggeredByUserId ?? 'system',
        action:
          triggeredBy === 'MANUAL'
            ? 'compliance.ip_clause.manual_rerun'
            : 'compliance.ip_clause.checked',
        resourceType: 'CONTRACT',
        resourceId: contractId,
        newValues: { runId: pending.id, verdict, modelVer },
        tx,
      });
    });

    return { runId: pending.id, status: 'SUCCEEDED', verdict };
  } catch (error) {
    // A ZodError here means the Anthropic tool_use body did not match the
    // expected schema (drifted model response / partial output). This is not
    // an infrastructure failure — the contract still exists and a human
    // reviewer may be able to assess it. Persist MANUAL_REVIEW_REQUIRED so
    // the run is visible and re-runnable, rather than silently FAILED.
    if (error instanceof ZodError) {
      const issuePaths = error.issues.map(i => i.path.join('.')).join(', ');
      log.warn(
        { contractId, runId: pending.id, issues: issuePaths },
        'tool_use body failed schema validation — persisting MANUAL_REVIEW_REQUIRED',
      );
      await db.contractHealthCheckRun.update({
        where: { id: pending.id },
        data: {
          verdict: 'MANUAL_REVIEW_REQUIRED',
          status: 'SUCCEEDED',
          errorMessage: `tool_use schema validation failed: ${issuePaths}`.slice(0, 500),
          completedAt: new Date(),
        },
      });
      return { runId: pending.id, status: 'SUCCEEDED', verdict: 'MANUAL_REVIEW_REQUIRED' };
    }

    // Infrastructure / unexpected error — mark FAILED so the partial unique
    // index does not block re-runs.
    await db.contractHealthCheckRun.update({
      where: { id: pending.id },
      data: {
        status: 'FAILED',
        errorMessage:
          error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        completedAt: new Date(),
      },
    });
    log.error({ err: error, contractId, runId: pending.id }, 'contract health check failed');
    return { runId: pending.id, status: 'FAILED' };
  }
}

/**
 * Fetches the contract's primary PDF bytes from R2 and computes the SHA-256
 * content hash. Resolves via the CONTRACT DocumentLink → Document.storageKey →
 * R2 presigned download. Prefers a SIGNED_COPY, falling back to PRIMARY.
 */
async function fetchContractPdf(
  db: PrismaClient,
  organizationId: string,
  contractId: string,
): Promise<{ pdfBase64: string; contentHash: string }> {
  const link = await db.documentLink.findFirst({
    where: { organizationId, entityType: 'CONTRACT', entityId: contractId },
    orderBy: { createdAt: 'desc' },
    select: { document: { select: { storageKey: true } } },
  });
  const storageKey = link?.document?.storageKey;
  if (!storageKey) {
    throw new Error(`No document linked to contract ${contractId} — cannot run health check`);
  }
  const downloadUrl = await createPresignedDownloadUrl(storageKey);
  const res = await fetchWithTimeout(downloadUrl, undefined, { timeoutMs: 30_000, retries: 0 });
  if (!res.ok) {
    throw new Error(`Failed to download contract PDF from R2: ${res.status} ${res.statusText}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    pdfBase64: bytes.toString('base64'),
    contentHash: createHash('sha256').update(bytes).digest('hex'),
  };
}

/**
 * D-13 divergence rule 2 — does the LLM's own cited text contain a strong IP
 * phrase the model overlooked when returning LIKELY_MISSING? Tests the cited
 * text against the full phrase library (any jurisdiction).
 */
function scanRawTextForStrongMatch(toolInput: ContractHealthToolInput): boolean {
  const haystack = toolInput.citedClauses.map(c => c.citedText).join('\n');
  if (!haystack) return false;
  for (const entry of Object.values(ALL_IP_CLAUSES)) {
    if (entry.regex.test(haystack)) return true;
  }
  return false;
}

function isPhrasePending(phraseId: IpClausePhraseId): boolean {
  const entry = getDisclaimerStatus(`${SIGNOFF_PREFIX}${phraseId}`);
  return entry?.status === 'PENDING';
}
