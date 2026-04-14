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
]);
export type FlagCategory = z.infer<typeof flagCategorySchema>;

export const flagDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, {
    message: 'Flag key must be lowercase dot-namespaced kebab-case, e.g. "module.legal-approval"',
  }),
  description: z.string().min(1),
  default: z.boolean(),
  category: flagCategorySchema,
  jurisdiction: jurisdictionSchema,
  owner: z.string().min(1),
  sunset: z.string().datetime().optional(),
});
export type FlagDefinition = z.infer<typeof flagDefinitionSchema>;

export const evalContextSchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string(),
  region: z.enum(['EU', 'ME']),
  countryCode: z.string().length(2).optional(),
  tier: z.enum(['STARTER', 'PRO', 'ENTERPRISE']).optional(),
  role: z.string().optional(),
  authMode: z.enum(['session', 'apiKey', 'cron', 'portal']).optional(),
});
export type EvalContext = z.infer<typeof evalContextSchema>;
