// Phase 70 D-13 — Zod schema for IntegrationConnection.scopeCapabilities JSONB.
// Used at every READ boundary that consumes the column to validate the shape
// before branching on capabilities. Plan 70-09 ships this schema; Phase 76
// imports it in the OAuth callback handler.

import { z } from 'zod';

export const providerIdSchema = z.enum(['google', 'slack', 'entra', 'okta', 'github']);

export const capabilityEnumSchema = z.enum([
  'directory.read',
  'directory.write',
  'user.deprovision',
  'user.suspend',
  'group.read',
  'group.write',
  'audit.read',
]);

export const scopeCapabilitiesSchema = z.object({
  provider: providerIdSchema,
  scopes: z.array(z.string()),
  capabilities: z.array(capabilityEnumSchema),
  grantedAt: z.string().datetime(),
});

export type ScopeCapabilitiesParsed = z.infer<typeof scopeCapabilitiesSchema>;
