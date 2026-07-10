// ---------------------------------------------------------------------------
// Per-answer-type Zod Schemas — boundary validation for the tRPC router
// ---------------------------------------------------------------------------
//
// Persisted answers use the AnswerValue envelope from types/assessment.ts:
//   yes-no | likert-5 | billing-ratio | rationale → { value: T }
//   score-0-3 → { rawScore, isNotApplicable? }
//
// Schemas accept either the canonical envelope or the bare primitive the wizard
// sends for non-billing types, then normalise to the envelope before persistence.

import { z } from 'zod';

import type { AnswerValue } from '../types/assessment.js';
import type { AnswerType, RuleSetQuestion } from '../types/rule-set.js';

export const yesNoValueSchema = z.enum(['yes', 'no']);

export const likert5ValueSchema = z.number().int().min(1).max(5);

/** Billing ratio — integer percentage (0..100) of revenue from the main client. */
export const billingRatioValueSchema = z.number().int().min(0).max(100);

export const rationaleValueSchema = z.string().max(1000);

export const score03AnswerSchema = z.object({
  rawScore: z.number().int().min(0).max(3),
  isNotApplicable: z.boolean().optional(),
});

/** Wrap a primitive payload in the canonical `{ value }` envelope. */
function valueEnvelope<T extends z.ZodTypeAny>(valueSchema: T) {
  const wrapped = z.object({ value: valueSchema });
  return z.union([wrapped, valueSchema]).transform((input): { value: z.infer<T> } => {
    if (typeof input === 'object' && input !== null && !Array.isArray(input) && 'value' in input) {
      return input as { value: z.infer<T> };
    }
    return { value: input as z.infer<T> };
  });
}

export const yesNoAnswerSchema = valueEnvelope(yesNoValueSchema);
export const likert5AnswerSchema = valueEnvelope(likert5ValueSchema);
export const billingRatioSchema = valueEnvelope(billingRatioValueSchema);
export const rationaleSchema = valueEnvelope(rationaleValueSchema);

/**
 * Lookup helper for the tRPC router — pick the correct Zod schema from the
 * question's answer-type discriminator before validating the incoming answer.
 */
export function getAnswerSchemaForType(answerType: AnswerType): z.ZodTypeAny {
  switch (answerType) {
    case 'yes-no':
      return yesNoAnswerSchema;
    case 'likert-5':
      return likert5AnswerSchema;
    case 'score-0-3':
      return score03AnswerSchema;
    case 'billing-ratio':
      return billingRatioSchema;
    case 'rationale':
      return rationaleSchema;
    default: {
      const exhaustive: never = answerType;
      throw new Error(`Unknown answer type: ${String(exhaustive)}`);
    }
  }
}

/**
 * Normalise persisted answers to the engine contract before scoring.
 * Accepts legacy bare primitives written before envelope persistence landed.
 */
export function normalizeAnswerMap(
  questions: readonly RuleSetQuestion[],
  answers: Record<string, unknown>,
): Record<string, AnswerValue> {
  const questionById = new Map(questions.map(q => [q.id, q]));
  const normalized: Record<string, AnswerValue> = {};

  for (const [questionId, raw] of Object.entries(answers)) {
    const question = questionById.get(questionId);
    if (!question) {
      normalized[questionId] = raw as AnswerValue;
      continue;
    }
    normalized[questionId] = getAnswerSchemaForType(question.answerType).parse(raw) as AnswerValue;
  }

  return normalized;
}
