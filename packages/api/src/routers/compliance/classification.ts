// ---------------------------------------------------------------------------
// Classification tRPC router — Phase 58, Plan 03
// ---------------------------------------------------------------------------
//
// Single server-side gateway between the wizard UI (Plan 04) + outcome pages
// (Plan 05) and the classification engine / storage model (Plans 01+02).
//
// Security contract:
// - Every procedure chains through `tenantProcedure` — the Prisma tenant
//   extension auto-scopes all reads/writes by organizationId. A cross-org
//   leak would therefore need a bug in the extension itself, not in this
//   router.
// - `submit` and `acknowledgeDisclaimer` additionally chain
//   `requirePermission({ contractor: ['update'] })` (ASVS V4 — T-58-09).
// - `saveAnswer` wraps an Upstash/in-memory sliding-window rate limit at
//   120 calls / minute / assessmentId (ASVS V13 — T-58-13 / Pitfall 10).
// - Scoring NEVER crosses the client boundary: `submit` calls
//   `profile.scoreAssessment(...)`, which wraps the server-only
//   `scoreIr35` / `scoreSchein` functions. We never import from
//   `@contractor-ops/classification/profiles/*/scoring.ts` here.
// - Every outcome read/write is re-validated via `outcomeSchema.parse`
//   (defence-in-depth for the discriminated union — Pitfall 12).
// - On resume, `getDraft` compares the persisted `ruleSetVersion` against
//   the currently registered profile's version → PRECONDITION_FAILED on
//   drift (Pitfall 7 / T-58-16).

import type { Outcome } from '@contractor-ops/classification';
import {
  buildQuestionsSnapshot,
  getAnswerSchemaForType,
  getProfileForCountry,
  outcomeSchema,
} from '@contractor-ops/classification';
import type { EngagementContext, Jurisdiction } from '@contractor-ops/compliance-policy';
import { POLICY_RULE_SET_VERSION } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { SDS_APPROVAL_STATEMENT_EN } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { SDS_APPROVAL_ALREADY_EXISTS } from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { classificationSaveAnswerRateLimit } from '../../middleware/classification-rate-limit';
import { adminProcedure, requirePermission } from '../../middleware/rbac';
import { classificationProcedure } from '../../middleware/require-classification-flag';
import { writeAuditLog } from '../../services/audit-writer';
import {
  extractOutcomeKind,
  materialiseFromPolicy,
  supersedeAndMaterialise,
} from '../../services/compliance-supersession';

// ---------------------------------------------------------------------------
// Phase 71 — country code → policy registry Jurisdiction enum mapping
// ---------------------------------------------------------------------------
// ClassificationAssessment.countryCode is ISO-3166-1 alpha-2 (GB, DE, PL, SA, AE).
// The compliance-policy registry uses domain Jurisdiction labels ('UK', 'DE', 'PL',
// 'KSA', 'UAE'). Jurisdictions outside the registry (FR, NL, ES, etc.) return null
// so the supersession branch is skipped — no rows materialised, no rows touched.

const COUNTRY_TO_JURISDICTION: Record<string, Jurisdiction> = {
  GB: 'UK',
  DE: 'DE',
  PL: 'PL',
  SA: 'KSA',
  AE: 'UAE',
};

function mapCountryCodeToJurisdiction(countryCode: string): Jurisdiction | null {
  return COUNTRY_TO_JURISDICTION[countryCode] ?? null;
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const cuid = z.string().min(1);

const createDraftInput = z.object({
  contractorAssignmentId: cuid,
});

const recreateDraftAfterDriftInput = z.object({
  contractorAssignmentId: cuid,
  staleDraftId: cuid,
});

// Phase 71 D-13..D-16 — admin-triggered compliance drift recompute. Bulk-capable.
const recreateComplianceAssessmentInput = z.object({
  contractorIds: z.array(cuid).min(1).max(500),
  reason: z.enum(['policy_version_bump', 'classification_outcome_change', 'admin_correction']),
});

type RecreateComplianceAssessmentResultEntry =
  | {
      contractorId: string;
      noop: true;
      reason: 'no_completed_assessment' | 'already_current';
    }
  | {
      contractorId: string;
      noop: false;
      policyRuleSetVersionBefore: string | null;
      waivedCount: number;
      insertedCount: number;
      carriedForwardCount: number;
    }
  | {
      contractorId: string;
      noop: false;
      error: string;
    };

const getDraftInput = z.object({
  contractorAssignmentId: cuid,
});

const saveAnswerInput = z.object({
  assessmentId: cuid,
  questionId: z.string().min(1).max(100),
  // Answer payload is re-validated against the per-question Zod schema
  // derived from profile.buildAssessment().questions — so this is just the
  // transport shape.
  answer: z.unknown(),
  expectedUpdatedAt: z.date().optional(),
});

const submitInput = z.object({
  assessmentId: cuid,
});

const acknowledgeDisclaimerInput = z.object({
  assessmentId: cuid,
});

const getLatestInput = z.object({
  contractorAssignmentId: cuid,
});

const getByIdInput = z.object({
  assessmentId: cuid,
});

const listByContractorInput = z.object({
  contractorId: cuid,
});

// Phase 64 — new input schemas
const logger = createLogger({ service: 'classification-router' });

const logEscalationInput = z.object({
  assessmentId: cuid,
  triggerKind: z.enum(['AMBER_VERDICT_AUTO', 'GET_EXPERT_HELP_CLICK', 'MANUAL_FLAG']),
  referralTarget: z.string().min(1).max(500),
  verdict: z.enum([
    'IR35_OUTSIDE',
    'IR35_INSIDE',
    'IR35_INDETERMINATE',
    'SCHEIN_SELFEMPLOYED',
    'SCHEIN_EMPLOYED',
    'SCHEIN_UNCLEAR',
  ]),
  contractorId: cuid.optional(),
});

const approveSdsInput = z.object({
  assessmentId: cuid,
  clientName: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Gated procedures — write ops require contractor:update (T-58-09)
// ---------------------------------------------------------------------------

const contractorUpdateProcedure = classificationProcedure.use(
  requirePermission({ contractor: ['update'] }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal shape of the assignment lookup used by the router — kept narrow so
 * we never leak unrelated Contractor fields into the classification engine.
 */
type AssignmentLookup = {
  id: string;
  contractorId: string;
  contractor: { countryCode: string };
};

/**
 * Resolve the country profile for a contractor assignment. Returns the
 * profile or throws a typed TRPCError suitable for the wizard UI.
 * Throws NOT_FOUND (never revealing assignment existence) if the assignment
 * is not visible to the caller's org.
 */
async function resolveAssignmentAndProfile(
  db: {
    contractorAssignment: {
      findFirst: (args: {
        where: { id: string };
        select: {
          id: true;
          contractorId: true;
          contractor: { select: { countryCode: true } };
        };
      }) => Promise<AssignmentLookup | null>;
    };
  },
  contractorAssignmentId: string,
) {
  const assignment = await findOrThrow(
    () =>
      db.contractorAssignment.findFirst({
        where: { id: contractorAssignmentId },
        select: { id: true, contractorId: true, contractor: { select: { countryCode: true } } },
      }),
    'errors.contractor.notFound',
  );

  try {
    const profile = getProfileForCountry(assignment.contractor.countryCode);
    return { assignment, profile };
  } catch (err) {
    throw new TRPCError({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message:
        err instanceof Error
          ? err.message
          : `No classification profile for country: ${assignment.contractor.countryCode}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const classificationRouter = router({
  // -------------------------------------------------------------------------
  // createDraft — idempotent per-engagement pre-flight.
  //
  // If a draft already exists for this engagement, returns that draft
  // rather than creating a duplicate (D-04 append-only invariant +
  // single-draft-per-engagement app-layer guard).
  // -------------------------------------------------------------------------
  createDraft: classificationProcedure.input(createDraftInput).mutation(async ({ ctx, input }) => {
    const { assignment, profile } = await resolveAssignmentAndProfile(
      ctx.db,
      input.contractorAssignmentId,
    );

    const existing = await ctx.db.classificationAssessment.findFirst({
      where: {
        contractorAssignmentId: assignment.id,
        status: 'draft',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return existing;

    return ctx.db.classificationAssessment.create({
      data: {
        organizationId: ctx.organizationId,
        contractorAssignmentId: assignment.id,
        countryCode: profile.country,
        ruleSetVersion: profile.ruleSetVersion,
        status: 'draft',
        answers: {},
      },
    });
  }),

  // -------------------------------------------------------------------------
  // recreateDraftAfterDrift — compensating action when rule-set drift blocks
  // a resume (Plan 04 wizard UI; UI-SPEC §Error states).
  //
  // Marks the stale draft as `superseded` and creates a fresh draft against
  // the currently-registered rule-set version. The old draft row is
  // preserved (never deleted) so audit history stays intact.
  //
  // Contract:
  //  - CONFLICT if staleDraftId is not actually a draft or not owned by the
  //    caller's organization.
  //  - PRECONDITION_FAILED if staleDraftId's ruleSetVersion still matches
  //    the current profile version — clients only call this when they've
  //    already seen a drift error.
  // -------------------------------------------------------------------------
  recreateDraftAfterDrift: classificationProcedure
    .input(recreateDraftAfterDriftInput)
    .mutation(async ({ ctx, input }) => {
      const { assignment, profile } = await resolveAssignmentAndProfile(
        ctx.db,
        input.contractorAssignmentId,
      );

      const stale = await ctx.db.classificationAssessment.findFirst({
        where: { id: input.staleDraftId },
      });

      if (!stale || stale.contractorAssignmentId !== assignment.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (stale.status !== 'draft') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Only draft assessments can be recreated after drift.',
        });
      }
      if (stale.ruleSetVersion === profile.ruleSetVersion) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Draft already matches the current rule-set version — no drift to recover from.',
        });
      }

      // Create a new draft against the current rule-set version. The stale
      // draft is NOT mutated (D-04 append-only); `getDraft` orders by
      // createdAt DESC so the fresh draft naturally wins on next resume.
      // Historical drift drafts remain queryable via listByContractor for
      // audit purposes.
      return ctx.db.classificationAssessment.create({
        data: {
          organizationId: ctx.organizationId,
          contractorAssignmentId: assignment.id,
          countryCode: profile.country,
          ruleSetVersion: profile.ruleSetVersion,
          status: 'draft',
          answers: {},
        },
      });
    }),

  // -------------------------------------------------------------------------
  // recreateComplianceAssessment — admin-triggered drift recompute (D-13..D-16).
  //
  // Architectural twin: recreateDraftAfterDrift (above). Same transactional
  // shape, same idempotency guard, same audit-log pattern. Differs in scope:
  // operates on ContractorComplianceItem rows (not the assessment itself).
  //
  // Trigger points (D-13):
  //   - Per-contractor "Recompute compliance" button on profile (single ID)
  //   - Bulk action on contractors-list selection (N IDs)
  // Both call this same mutation. NO org-wide "everyone" button (blast radius).
  //
  // Idempotency (D-16): when reason='policy_version_bump' AND the contractor's
  // latest assessment already references the current registry version, returns
  // noop:true. Mirrors recreateDraftAfterDrift's PRECONDITION_FAILED check, but
  // returns gracefully instead of throwing — bulk runs need to skip already-
  // current contractors without aborting.
  //
  // Audit (D-15): exactly ONE AuditLog row per invocation (NOT per affected
  // row). metadataJson carries the per-contractor delta list.
  // -------------------------------------------------------------------------
  recreateComplianceAssessment: adminProcedure
    .input(recreateComplianceAssessmentInput)
    .mutation(async ({ ctx, input }) => {
      const results: RecreateComplianceAssessmentResultEntry[] = [];

      for (const contractorId of input.contractorIds) {
        try {
          const result = await ctx.db.$transaction(async tx => {
            // 1. Load latest completed assessment with contractor + assignment context.
            const latest = await tx.classificationAssessment.findFirst({
              where: {
                contractorAssignment: {
                  contractorId,
                  organizationId: ctx.organizationId, // tenant guard (T-71-05-06)
                },
                status: 'completed',
              },
              orderBy: { completedAt: 'desc' },
              include: {
                contractorAssignment: {
                  select: {
                    id: true,
                    contractorId: true,
                    contractor: { select: { countryCode: true } },
                  },
                },
              },
            });

            if (!latest) {
              return {
                contractorId,
                noop: true as const,
                reason: 'no_completed_assessment' as const,
              };
            }

            // 2. Idempotency precondition (D-16). Only applies for policy_version_bump.
            //    For classification_outcome_change and admin_correction, always recompute.
            if (
              input.reason === 'policy_version_bump' &&
              latest.policyRuleSetVersion === POLICY_RULE_SET_VERSION
            ) {
              return {
                contractorId,
                noop: true as const,
                reason: 'already_current' as const,
              };
            }

            const policyRuleSetVersionBefore = latest.policyRuleSetVersion;

            const jurisdiction = mapCountryCodeToJurisdiction(latest.countryCode);
            if (jurisdiction === null) {
              // Country outside the registry's jurisdiction set — treat as no-op
              return {
                contractorId,
                noop: true as const,
                reason: 'no_completed_assessment' as const,
              };
            }

            // 3. Build engagement context (mirrors submit's pattern).
            const engagement: EngagementContext = {
              jurisdiction,
              outcome: extractOutcomeKind(latest.outcome),
              sector: null, // see Plan 71-04 discovery — sector column absent today
              contractorNationality: latest.contractorAssignment.contractor?.countryCode ?? null,
              requiresRegulatedEquipment: false,
            };

            // 4. Map input reason → supersede reason enum.
            const supersedeReason:
              | 'classification_outcome_change'
              | 'superseded_by_policy_version'
              | 'admin_correction' =
              input.reason === 'policy_version_bump'
                ? 'superseded_by_policy_version'
                : input.reason === 'classification_outcome_change'
                  ? 'classification_outcome_change'
                  : 'admin_correction';

            // 5. Run the supersession (reuses Plan 71-04's helper).
            const supersedeResult = await supersedeAndMaterialise(tx, {
              organizationId: ctx.organizationId,
              contractorId,
              contractId: null, // not bound to a specific contract for recompute
              engagement,
              reason: supersedeReason,
            });

            // 6. Snapshot current registry version onto the latest assessment.
            await tx.classificationAssessment.update({
              where: { id: latest.id },
              data: { policyRuleSetVersion: POLICY_RULE_SET_VERSION },
            });

            return {
              contractorId,
              noop: false as const,
              policyRuleSetVersionBefore,
              waivedCount: supersedeResult.waivedCount,
              insertedCount: supersedeResult.insertedCount,
              carriedForwardCount: supersedeResult.carriedForwardCount,
            };
          });
          results.push(result);
        } catch (err) {
          // Per-contractor failure does NOT abort the bulk — record + continue (T-71-05-04).
          results.push({
            contractorId,
            noop: false,
            error: err instanceof Error ? err.message : 'unknown error',
          });
        }
      }

      // 7. Single AuditLog row per invocation (D-15).
      await writeAuditLog({
        tx: ctx.db,
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'compliance.recompute',
        resourceType: 'CONTRACTOR',
        resourceId: input.contractorIds.length === 1 ? (input.contractorIds[0] as string) : 'BULK',
        metadata: {
          reason: input.reason,
          contractorIds: input.contractorIds,
          policyRuleSetVersionAfter: POLICY_RULE_SET_VERSION,
          results,
        },
      });

      return { results };
    }),

  // -------------------------------------------------------------------------
  // getDraft — fetch the current draft for an engagement.
  //
  // Throws PRECONDITION_FAILED if the persisted ruleSetVersion no longer
  // matches the currently-registered profile (T-58-16 / Pitfall 7). The UI
  // surfaces this as "start a new assessment".
  // -------------------------------------------------------------------------
  getDraft: classificationProcedure.input(getDraftInput).query(async ({ ctx, input }) => {
    const { assignment, profile } = await resolveAssignmentAndProfile(
      ctx.db,
      input.contractorAssignmentId,
    );

    const draft = await ctx.db.classificationAssessment.findFirst({
      where: {
        contractorAssignmentId: assignment.id,
        status: 'draft',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!draft) return null;

    if (draft.ruleSetVersion !== profile.ruleSetVersion) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Rule-set drift: draft was started against ${draft.ruleSetVersion} but current profile is ${profile.ruleSetVersion}. Start a new assessment.`,
      });
    }

    return draft;
  }),

  // -------------------------------------------------------------------------
  // saveAnswer — incremental autosave during the wizard.
  //
  // Security:
  //  - Rate-limited 120/min per assessmentId (T-58-13).
  //  - Only writeable while status='draft' (T-58-10).
  //  - Optimistic concurrency via expectedUpdatedAt (T-58-17 / Pitfall 10).
  //  - Answer payload is Zod-validated against the question's answerType
  //    before any write (T-58-10 / ASVS V5).
  // -------------------------------------------------------------------------
  saveAnswer: classificationProcedure
    .input(saveAnswerInput)
    .use(classificationSaveAnswerRateLimit)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.classificationAssessment.findFirst({
        where: { id: input.assessmentId },
      });

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (row.status !== 'draft') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Assessment is not a draft; answers are frozen after submit.',
        });
      }

      // Resolve the profile via the assignment (not via row.countryCode
      // directly — defence in depth: the profile is the canonical source
      // of questions).
      const profile = getProfileForCountry(row.countryCode);
      const shell = profile.buildAssessment(row.contractorAssignmentId);
      const question = shell.questions.find(q => q.id === input.questionId);

      if (!question) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown questionId: ${input.questionId} (rule-set ${profile.ruleSetVersion}).`,
        });
      }

      const answerSchema = getAnswerSchemaForType(question.answerType);
      const parsed = answerSchema.safeParse(input.answer);
      if (!parsed.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Answer payload does not match ${question.answerType} schema: ${parsed.error.message}`,
        });
      }

      // Optimistic concurrency — reject stale writes before merging.
      if (input.expectedUpdatedAt && row.updatedAt.getTime() > input.expectedUpdatedAt.getTime()) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'Assessment was updated by another tab; reload to pick up the latest answers before saving again.',
        });
      }

      const mergedAnswers: Record<string, unknown> = {
        ...((row.answers as Record<string, unknown>) ?? {}),
        [input.questionId]: parsed.data,
      };

      return ctx.db.classificationAssessment.update({
        where: { id: row.id },
        data: { answers: mergedAnswers as Prisma.InputJsonValue },
      });
    }),

  // -------------------------------------------------------------------------
  // submit — close the draft, compute the outcome, freeze the snapshot.
  //
  // All scoring is server-side (T-58-11 / Pitfall 2). The computed outcome
  // is parsed through `outcomeSchema` before persistence — defence in depth
  // for Pitfall 12 (discriminated-union validation).
  // -------------------------------------------------------------------------
  submit: contractorUpdateProcedure.input(submitInput).mutation(async ({ ctx, input }) => {
    // Phase 71 D-10 — entire body wrapped in $transaction. Atomicity guarantees
    // the assessment update + the row materialisation/supersession are all-or-nothing.
    // DO NOT extract any logic out of this transaction without re-evaluating
    // supersession atomicity.
    return ctx.db.$transaction(async tx => {
      const row = await tx.classificationAssessment.findFirst({
        where: { id: input.assessmentId },
      });
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (row.status !== 'draft') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Assessment already submitted; assessments are append-only (D-04).',
        });
      }

      const profile = getProfileForCountry(row.countryCode);

      let computed: Outcome;
      try {
        computed = profile.scoreAssessment(
          row.answers as Parameters<typeof profile.scoreAssessment>[0],
        );
      } catch (err) {
        // Engine errors (MissingAnswerError, malformed answers, etc.) surface
        // as a typed BAD_REQUEST so the wizard can highlight the offending
        // questions instead of leaking a stack trace (Pitfall 5).
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            err instanceof Error
              ? `Scoring failed: ${err.message}`
              : 'Scoring failed: unknown engine error.',
        });
      }

      // Validate the computed outcome before persistence.
      const validatedOutcome = outcomeSchema.parse(computed);

      const shell = profile.buildAssessment(row.contractorAssignmentId);
      const snapshot = buildQuestionsSnapshot(profile, {
        profileId: profile.profileId,
        ruleSetVersion: profile.ruleSetVersion,
        countryCode: profile.country,
        questions: shell.questions,
      });

      const now = new Date();

      // Phase 71 D-10 — find prior completed assessment for outcome-change detection.
      const prior = await tx.classificationAssessment.findFirst({
        where: {
          contractorAssignmentId: row.contractorAssignmentId,
          status: 'completed',
        },
        orderBy: { completedAt: 'desc' },
      });

      const updated = await tx.classificationAssessment.update({
        where: { id: row.id },
        data: {
          status: 'completed',
          outcome: validatedOutcome,
          questionsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          completedAt: now,
          // Literal `immutableAfter: new Date` — D-04 append-only marker.
          immutableAfter: new Date(now),
          // Phase 71 D-03 — snapshot policy rule set version onto every completed assessment.
          policyRuleSetVersion: POLICY_RULE_SET_VERSION,
        },
      });

      // Phase 71 D-10 — supersession-on-outcome-change OR first-classification materialisation.
      // EngagementContext.sector is null today (ContractorAssignment has no sector column);
      // de.eight_b_estg@v1 predicate returns false for null sector → conservative.
      const jurisdiction = mapCountryCodeToJurisdiction(row.countryCode);
      if (jurisdiction !== null) {
        const assignment = await tx.contractorAssignment.findFirst({
          where: { id: row.contractorAssignmentId },
          select: {
            id: true,
            contractorId: true,
            contractor: { select: { countryCode: true } },
          },
        });
        if (assignment) {
          const engagement: EngagementContext = {
            jurisdiction,
            outcome: extractOutcomeKind(validatedOutcome),
            sector: null,
            // Contractor.countryCode is the closest proxy to nationality today;
            // when contractorNationality lands on Contractor in a future phase,
            // swap this read.
            contractorNationality: assignment.contractor?.countryCode ?? null,
            requiresRegulatedEquipment: false,
          };
          if (!prior) {
            // First classification — materialise from policy.
            await materialiseFromPolicy(tx, {
              organizationId: row.organizationId,
              contractorId: assignment.contractorId,
              contractId: null,
              engagement,
            });
          } else if (extractOutcomeKind(prior.outcome) !== extractOutcomeKind(validatedOutcome)) {
            // Outcome kind changed — supersede prior rows and re-materialise.
            await supersedeAndMaterialise(tx, {
              organizationId: row.organizationId,
              contractorId: assignment.contractorId,
              contractId: null,
              engagement,
              reason: 'classification_outcome_change',
            });
          }
          // else: same outcome kind — no row churn (D-10 atomicity preserved by skipping).
        }
      }

      // Phase 60 · CLASS-08 — auto-resolve any OPEN/ACKNOWLEDGED reassessment
      // triggers on this engagement once a fresh GB IR35 assessment has been
      // submitted. Tenant-scoped client keeps cross-org rows untouched.
      if (row.countryCode === 'GB') {
        await tx.reassessmentTrigger.updateMany({
          where: {
            contractorAssignmentId: row.contractorAssignmentId,
            status: { in: ['OPEN', 'ACKNOWLEDGED'] },
          },
          data: { status: 'RESOLVED', resolvedAt: now },
        });
      }

      return updated;
    });
  }),

  // -------------------------------------------------------------------------
  // acknowledgeDisclaimer — idempotent disclaimer acknowledgement.
  //
  // Only operates on completed rows; draft rows throw CONFLICT so the UI
  // cannot short-circuit the wizard.
  // -------------------------------------------------------------------------
  acknowledgeDisclaimer: contractorUpdateProcedure
    .input(acknowledgeDisclaimerInput)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.classificationAssessment.findFirst({
        where: { id: input.assessmentId },
      });
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (row.status !== 'completed') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Only completed assessments can be acknowledged.',
        });
      }

      return ctx.db.classificationAssessment.update({
        where: { id: row.id },
        data: { disclaimerAcknowledgedAt: new Date() },
      });
    }),

  // -------------------------------------------------------------------------
  // getLatest — most recent completed assessment for a given engagement.
  // -------------------------------------------------------------------------
  getLatest: classificationProcedure.input(getLatestInput).query(async ({ ctx, input }) => {
    const row = await ctx.db.classificationAssessment.findFirst({
      where: {
        contractorAssignmentId: input.contractorAssignmentId,
        status: 'completed',
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!row) return null;

    // Defence-in-depth: re-parse outcome on read so a malformed/forged JSON
    // never reaches the client (Pitfall 12).
    if (row.outcome !== null && row.outcome !== undefined) {
      outcomeSchema.parse(row.outcome);
    }
    return row;
  }),

  // -------------------------------------------------------------------------
  // getById — fetch a specific assessment by id (tenant-scoped).
  //
  // Plan 05 outcome route uses this to render the exact assessment the user
  // was redirected to after submit. Returns null (not NOT_FOUND) when the
  // assessment is not visible to the caller's org — mirrors getLatest so the
  // outcome page can surface the same "not found" UX without leaking
  // cross-tenant existence (V7).
  // -------------------------------------------------------------------------
  getById: classificationProcedure.input(getByIdInput).query(async ({ ctx, input }) => {
    const row = await ctx.db.classificationAssessment.findFirst({
      where: { id: input.assessmentId },
    });

    if (!row) return null;

    // Defence-in-depth: re-parse outcome on read so a malformed/forged JSON
    // never reaches the client (Pitfall 12). Drafts have null outcome — skip.
    //
    // safeParse, not parse: legacy / dev-seeded rows can carry an older
    // outcome shape (pre-discriminated-union schema). Throwing 500 on a
    // read makes the entire detail page unreachable. Log + redact instead
    // so the UI still renders the metadata and the malformed outcome
    // surfaces to the user as "outcome unavailable" rather than a crash.
    if (row.outcome !== null && row.outcome !== undefined) {
      const parsed = outcomeSchema.safeParse(row.outcome);
      if (!parsed.success) {
        logger.warn(
          {
            assessmentId: input.assessmentId,
            zodIssues: parsed.error.issues,
          },
          'classification.getById: outcome failed schema validation; redacting before return',
        );
        return { ...row, outcome: null };
      }
    }
    return row;
  }),

  // -------------------------------------------------------------------------
  // listByContractor — full history across all engagements of a contractor.
  //
  // Ordered draft-first, then completedAt DESC. We order in JS because
  // Prisma's enum ordering on `status` is alphabetical (`completed` sorts
  // before `draft`), which is the opposite of what the wizard wants.
  // -------------------------------------------------------------------------
  listByContractor: classificationProcedure
    .input(listByContractorInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.classificationAssessment.findMany({
        where: {
          contractorAssignment: { contractorId: input.contractorId },
        },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      });

      const drafts = rows.filter((r: { status: string }) => r.status === 'draft');
      const completed = rows.filter((r: { status: string }) => r.status === 'completed');
      return [...drafts, ...completed];
    }),

  // ---------------------------------------------------------------------------
  // Phase 64 · LEGAL-03/04 — logEscalation (D-19)
  // ---------------------------------------------------------------------------

  /**
   * Log a classification advisory escalation event.
   * Fired automatically on amber/indeterminate verdict render (AMBER_VERDICT_AUTO)
   * and on "Get Expert Help" CTA click (GET_EXPERT_HELP_CLICK).
   * Append-only — no update or delete.
   */
  logEscalation: classificationProcedure
    .input(logEscalationInput)
    .mutation(async ({ ctx, input }) => {
      const assessment = await findOrThrow(
        () =>
          ctx.db.classificationAssessment.findFirst({
            where: { id: input.assessmentId },
            select: { id: true },
          }),
        'Assessment not found',
      );

      const headers = (ctx as { req?: { headers?: { get?: (k: string) => string | null } } }).req
        ?.headers;
      const ipAddress =
        headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ??
        headers?.get?.('x-real-ip') ??
        null;
      const userAgent = headers?.get?.('user-agent') ?? null;

      const event = await ctx.db.classificationEscalationEvent.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.user?.id ?? '',
          assessmentId: input.assessmentId,
          contractorId: input.contractorId ?? null,
          verdict: input.verdict,
          triggerKind: input.triggerKind,
          referralTarget: input.referralTarget,
          ipAddress,
          userAgent,
        },
        select: { id: true },
      });

      return { eventId: event.id };
    }),

  // ---------------------------------------------------------------------------
  // Phase 64 · LEGAL-05 — approveSds (D-22)
  // ---------------------------------------------------------------------------

  /**
   * Record in-app SDS approval gate.
   * Creates an SdsApproval row — required before generateSds can proceed.
   * Snapshots SDS_APPROVAL_STATEMENT_EN at approval time.
   * Throws CONFLICT if approval already exists for this assessment.
   */
  approveSds: classificationProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(approveSdsInput)
    .mutation(async ({ ctx, input }) => {
      const assessment = await findOrThrow(
        () =>
          ctx.db.classificationAssessment.findFirst({
            where: { id: input.assessmentId, status: 'completed' },
            select: { id: true, countryCode: true },
          }),
        'Completed assessment not found',
      );
      if (assessment.countryCode !== 'GB') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'SDS approval is only required for IR35 (GB) assessments',
        });
      }

      try {
        const approval = await ctx.db.sdsApproval.create({
          data: {
            organizationId: ctx.organizationId,
            assessmentId: input.assessmentId,
            approvedByUserId: ctx.user?.id ?? '',
            approvedAt: new Date(),
            clientName: input.clientName,
            approvalStatementSnapshot: SDS_APPROVAL_STATEMENT_EN, // Snapshot at approval time (D-21)
          },
          select: { id: true },
        });
        return { approvalId: approval.id };
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          throw new TRPCError({ code: 'CONFLICT', message: SDS_APPROVAL_ALREADY_EXISTS });
        }
        throw err;
      }
    }),
});
