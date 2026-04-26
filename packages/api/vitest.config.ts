import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { vitestProject } from '../../vitest.monorepo';
import { minimalServerEnv } from '../validators/src/minimal-server-env.ts';

// biome-ignore lint/style/useNamingConvention: standard Node.js __dirname polyfill for ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    // Vite/vitest alias resolution matches entries in declaration order with
    // string-prefix semantics. For multi-export packages whose subpaths point
    // to different source files, list the MOST-SPECIFIC subpath aliases FIRST
    // and the bare-package entry LAST. Otherwise the bare-package match
    // concatenates the unmatched suffix onto the file path and produces an
    // ENOTDIR failure (e.g. `einvoice/src/index.ts/zatca/schemas`).
    //
    // See .planning/phases/66-phase-57-completion-verification/66-RESEARCH.md
    // <vitest_alias_diagnosis> for the failure trace this fix repairs.
    alias: [
      {
        find: '@react-email/render',
        replacement: path.join(__dirname, 'src/__tests__/__mocks__/react-email-render.ts'),
      },
      {
        find: 'nodemailer',
        replacement: path.join(__dirname, 'src/__tests__/__mocks__/nodemailer.ts'),
      },
      // Subpath aliases — must come BEFORE the bare-package alias.
      {
        find: '@contractor-ops/einvoice/zatca/schemas',
        replacement: path.join(packagesDir, 'einvoice/src/profiles/zatca/schemas.ts'),
      },
      {
        find: '@contractor-ops/einvoice/zatca/types',
        replacement: path.join(packagesDir, 'einvoice/src/profiles/zatca/types.ts'),
      },
      {
        find: '@contractor-ops/einvoice/compliance',
        replacement: path.join(packagesDir, 'einvoice/src/types/compliance.ts'),
      },
      {
        find: '@contractor-ops/einvoice',
        replacement: path.join(packagesDir, 'einvoice/src/index.ts'),
      },
      {
        find: '@contractor-ops/validators/minimal-server-env',
        replacement: path.join(packagesDir, 'validators/src/minimal-server-env.ts'),
      },
      {
        find: '@contractor-ops/validators',
        replacement: path.join(packagesDir, 'validators/src/index.ts'),
      },
      {
        find: '@contractor-ops/test-utils',
        replacement: path.join(packagesDir, 'test-utils/src/index.ts'),
      },
    ],
  },
  test: {
    name: vitestProject.api.name,
    /** Full server env so `getServerEnv()` succeeds when modules load (stripe-client, billing-constants, …) */
    env: {
      ...minimalServerEnv(),
      STRIPE_SECRET_KEY: 'sk_test_0000000000000000000000000000000000000000000000000000000000000000',
      /** Inner token (slack-client encryptToken) + outer blob (integrations encryptCredentials) */
      SLACK_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 0xab).toString('hex'),
      SLACK_ENCRYPTION_KEY: Buffer.alloc(32, 0xcd).toString('hex'),
    },
    globals: true,
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'src/__tests__/**/*.test.ts',
    ],
    /** Avoid cross-file `vi.mock("@contractor-ops/db")` leakage between workers */
    pool: 'forks',
    sequence: { groupOrder: vitestProject.api.groupOrder },
  },
});
