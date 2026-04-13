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
    alias: {
      '@react-email/render': path.join(__dirname, 'src/__tests__/__mocks__/react-email-render.ts'),
      nodemailer: path.join(__dirname, 'src/__tests__/__mocks__/nodemailer.ts'),
      '@contractor-ops/einvoice': path.join(packagesDir, 'einvoice/src/index.ts'),
      '@contractor-ops/validators/minimal-server-env': path.join(
        packagesDir,
        'validators/src/minimal-server-env.ts',
      ),
      '@contractor-ops/validators': path.join(packagesDir, 'validators/src/index.ts'),
      '@contractor-ops/test-utils': path.join(packagesDir, 'test-utils/src/index.ts'),
    },
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
