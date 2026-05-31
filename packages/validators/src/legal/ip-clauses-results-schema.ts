// Phase 75 D-06 — Zod schema for ContractHealthCheckRun.resultsJson and the
// denormalised Contract.complianceFlagsJson mirror. Versioned at top level
// (`version: 1`) for forward migrations.

import { z } from 'zod';

export const PHRASE_ID_REGEX = /^(uk|de|pl|us|ksa|uae)\.[a-z_]+@v\d+$/;

export const citedClauseSchema = z.object({
  phraseId: z.string().regex(PHRASE_ID_REGEX),
  jurisdiction: z.enum(['UK', 'DE', 'PL', 'KSA', 'UAE', 'US']),
  citedText: z.string().min(1),
  confidence: z.number().min(0).max(1),
  regexMatched: z.boolean(),
  regexMatchSpan: z
    .object({
      startChar: z.number().int().nonnegative(),
      endChar: z.number().int().nonnegative(),
    })
    .refine(span => span.startChar <= span.endChar, {
      message: 'startChar must be less than or equal to endChar',
    })
    .optional(),
});

export const evaluatedAgainstSchema = z.object({
  jurisdiction: z.string(),
  phraseLibraryVersion: z.string(),
});

export const crossJurisdictionMismatchSchema = z.object({
  foundJurisdiction: z.string(),
  expectedJurisdiction: z.string(),
});

export const ipAssignmentInnerSchema = z.object({
  verdict: z.enum(['LIKELY_PRESENT', 'LIKELY_MISSING', 'MANUAL_REVIEW_REQUIRED']),
  citedClauses: z.array(citedClauseSchema),
  evaluatedAgainst: z.array(evaluatedAgainstSchema),
  crossJurisdictionMismatch: crossJurisdictionMismatchSchema.optional(),
  pendingPhrasesCited: z.array(z.string().regex(PHRASE_ID_REGEX)).optional(),
  // Verbatim model output — preserved as-is (D-06). z.record keeps every key.
  rawModelToolUseInput: z.record(z.string(), z.unknown()),
  runId: z.string().min(1),
  runStartedAt: z.iso.datetime(),
  runCompletedAt: z.iso.datetime(),
});

export const ipAssignmentResultsSchema = z
  .object({
    version: z.literal(1),
    ipAssignment: ipAssignmentInnerSchema,
  })
  .strict();

export type IpAssignmentResults = z.infer<typeof ipAssignmentResultsSchema>;
