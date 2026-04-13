// ---------------------------------------------------------------------------
// Assessment / Outcome Zod Schemas — D-03
// ---------------------------------------------------------------------------
//
// The `outcomeSchema` is a discriminated union on `kind` — adding a new
// country profile requires a new branch here (no-free-lunch safety gate).

import { z } from 'zod';

// --- IR35 -----------------------------------------------------------------

export const ir35AreaVerdictSchema = z.enum([
  'strong-outside',
  'leaning-outside',
  'neutral',
  'leaning-inside',
  'strong-inside',
]);

export const ir35AreaSchema = z.enum([
  'substitution',
  'control',
  'financial-risk',
  'part-and-parcel',
  'moo',
]);

export const ir35AreaResultSchema = z.object({
  area: ir35AreaSchema,
  verdict: ir35AreaVerdictSchema,
  rationaleKey: z.string().optional(),
  caseLawCitations: z.array(z.string()).readonly(),
});

export const ir35VerdictSchema = z.enum(['outside', 'inside', 'indeterminate']);

export const ir35OutcomeSchema = z.object({
  kind: z.literal('IR35'),
  ruleSetVersion: z.string(),
  verdict: ir35VerdictSchema,
  areas: z.array(ir35AreaResultSchema).readonly(),
  computedAt: z.string(),
});

// --- Scheinselbständigkeit -----------------------------------------------

export const scheinCategorySchema = z.enum([
  'integration',
  'entrepreneurial',
  'personal-dep',
  'economic-dep',
]);

export const scheinVerdictSchema = z.enum(['green', 'amber', 'red']);

export const scheinCategoryResultSchema = z.object({
  category: scheinCategorySchema,
  weight: z.number().min(0).max(100),
  rawScore: z.number().min(0).max(3),
  weightedScore: z.number(),
  verdict: scheinVerdictSchema,
  drvReferences: z.array(z.string()).readonly(),
});

export const scheinOutcomeSchema = z.object({
  kind: z.literal('SCHEINSELBSTANDIGKEIT'),
  ruleSetVersion: z.string(),
  verdict: scheinVerdictSchema,
  totalScore: z.number().min(0).max(100),
  categories: z.array(scheinCategoryResultSchema).readonly(),
  computedAt: z.string(),
});

// --- Union ----------------------------------------------------------------

export const outcomeSchema = z.discriminatedUnion('kind', [
  ir35OutcomeSchema,
  scheinOutcomeSchema,
]);

export type OutcomeSchemaType = z.infer<typeof outcomeSchema>;
