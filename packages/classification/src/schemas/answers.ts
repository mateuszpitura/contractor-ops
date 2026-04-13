// ---------------------------------------------------------------------------
// Per-answer-type Zod Schemas — boundary validation for the tRPC router
// ---------------------------------------------------------------------------

import { z } from 'zod';

import type { AnswerType } from '../types/rule-set.js';

export const yesNoAnswerSchema = z.enum(['yes', 'no']);

export const likert5AnswerSchema = z.number().int().min(1).max(5);

export const score03AnswerSchema = z.object({
  rawScore: z.number().int().min(0).max(3),
  isNotApplicable: z.boolean().optional(),
});

/** Billing ratio — integer percentage (0..100) of revenue from the main client. */
export const billingRatioSchema = z.number().int().min(0).max(100);

export const rationaleSchema = z.string().max(1000);

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
