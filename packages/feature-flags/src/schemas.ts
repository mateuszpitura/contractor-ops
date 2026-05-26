import { z } from 'zod';

export const jurisdictionSchema = z.enum(['EU', 'ME', 'ANY']);
export type Jurisdiction = z.infer<typeof jurisdictionSchema>;

export const flagCategorySchema = z.enum([
  'module',
  'integration',
  'experiment',
  'kill-switch',
  'ops',
  'ui',
  'billing',
  'payments',
]);
export type FlagCategory = z.infer<typeof flagCategorySchema>;

/**
 * Single source of truth for the regional Unleash partition. Imported by
 * `client.ts` so the hand-typed `Region` literal cannot drift from the
 * runtime-validated `evalContextSchema.region` enum.
 */
export const regionSchema = z.enum(['EU', 'ME']);
export type Region = z.infer<typeof regionSchema>;

export const flagDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, {
    // biome-ignore lint/plugin/no-untranslated-zod-message: developer-facing registry validator; never reaches an end user
    message: 'Flag key must be lowercase dot-namespaced kebab-case, e.g. "module.legal-approval"',
  }),
  description: z.string().min(1),
  default: z.boolean(),
  category: flagCategorySchema,
  jurisdiction: jurisdictionSchema,
  owner: z.string().min(1),
  sunset: z.iso.datetime().optional(),
  /**
   * When true, an evaluator that consults a stub client (Unleash unreachable
   * or unconfigured) short-circuits to `enabled: false` instead of returning
   * the code-declared `default`. Intended for kill-switches whose `default`
   * is `true`: a kill-switch that cannot be killed during an Unleash outage
   * is operationally useless, so opt these flags into "fail killed" mode.
   *
   * Defaults to false (preserve current "fall back to default" semantics).
   */
  killWhenUnknown: z.boolean().optional(),
});
export type FlagDefinition = z.infer<typeof flagDefinitionSchema>;

export const evalContextSchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string(),
  region: regionSchema,
  countryCode: z.string().length(2).optional(),
  tier: z.enum(['STARTER', 'PRO', 'ENTERPRISE']).optional(),
  role: z.string().optional(),
  authMode: z.enum(['session', 'apiKey', 'cron', 'portal']).optional(),
});
export type EvalContext = z.infer<typeof evalContextSchema>;
