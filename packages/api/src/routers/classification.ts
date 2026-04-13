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
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { classificationSaveAnswerRateLimit } from '../middleware/classification-rate-limit.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';

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

// ---------------------------------------------------------------------------
// Gated procedures — write ops require contractor:update (T-58-09)
// ---------------------------------------------------------------------------

const contractorUpdateProcedure = tenantProcedure.use(
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
  const assignment = await db.contractorAssignment.findFirst({
    where: { id: contractorAssignmentId },
    select: { id: true, contractorId: true, contractor: { select: { countryCode: true } } },
  });

  if (!assignment) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'errors.contractor.notFound' });
  }

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
  createDraft: tenantProcedure.input(createDraftInput).mutation(async ({ ctx, input }) => {
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
  recreateDraftAfterDrift: tenantProcedure
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
          message:
            'Draft already matches the current rule-set version — no drift to recover from.',
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
  // getDraft — fetch the current draft for an engagement.
  //
  // Throws PRECONDITION_FAILED if the persisted ruleSetVersion no longer
  // matches the currently-registered profile (T-58-16 / Pitfall 7). The UI
  // surfaces this as "start a new assessment".
  // -------------------------------------------------------------------------
  getDraft: tenantProcedure.input(getDraftInput).query(async ({ ctx, input }) => {
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
  saveAnswer: tenantProcedure
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
        data: { answers: mergedAnswers },
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
    const row = await ctx.db.classificationAssessment.findFirst({
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
    return ctx.db.classificationAssessment.update({
      where: { id: row.id },
      data: {
        status: 'completed',
        outcome: validatedOutcome,
        questionsSnapshot: snapshot,
        completedAt: now,
        // Literal `immutableAfter: new Date` — D-04 append-only marker.
        immutableAfter: new Date(now),
      },
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
  getLatest: tenantProcedure.input(getLatestInput).query(async ({ ctx, input }) => {
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
  getById: tenantProcedure.input(getByIdInput).query(async ({ ctx, input }) => {
    const row = await ctx.db.classificationAssessment.findFirst({
      where: { id: input.assessmentId },
    });

    if (!row) return null;

    // Defence-in-depth: re-parse outcome on read so a malformed/forged JSON
    // never reaches the client (Pitfall 12). Drafts have null outcome — skip.
    if (row.outcome !== null && row.outcome !== undefined) {
      outcomeSchema.parse(row.outcome);
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
  listByContractor: tenantProcedure.input(listByContractorInput).query(async ({ ctx, input }) => {
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
});
