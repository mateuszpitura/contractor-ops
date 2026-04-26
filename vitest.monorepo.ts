/**
 * Single source of truth for Vitest workspace project `name` and `sequence.groupOrder`
 * when running `vitest` / `vitest run --coverage` from the repo root.
 *
 * - `name` → `vitest run --project <name>` and VS Code Vitest extension filters
 * - `groupOrder` → lower values run earlier (stable ordering across packages)
 */
export const vitestProject = {
  web: { name: 'web', groupOrder: 0 },
  api: { name: 'api', groupOrder: 1 },
  auth: { name: 'auth', groupOrder: 2 },
  db: { name: 'db', groupOrder: 3 },
  integrations: { name: 'integrations', groupOrder: 4 },
  logger: { name: 'logger', groupOrder: 5 },
  validators: { name: 'validators', groupOrder: 6 },
  einvoice: { name: 'einvoice', groupOrder: 7 },
  govApi: { name: 'gov-api', groupOrder: 8 },
  testUtils: { name: 'test-utils', groupOrder: 9 },
  classification: { name: 'classification', groupOrder: 10 },
  secrets: { name: 'secrets', groupOrder: 11 },
  publicApi: { name: 'public-api', groupOrder: 12 },
} as const;
