/**
 * One-time migration: move encrypted credentials from DB to secret store.
 *
 * Usage:
 *   npx tsx scripts/migrate-secrets-to-store.ts           # dry-run (default)
 *   npx tsx scripts/migrate-secrets-to-store.ts --execute  # actually migrate
 *
 * Requirements:
 *   - Old per-provider encryption keys must be present in env
 *     (e.g., SLACK_ENCRYPTION_KEY, JIRA_ENCRYPTION_KEY, etc.)
 *   - Secret store must be configured (e.g., INFISICAL_CLIENT_ID, etc.)
 *     or the script will use MemoryStore (only useful for testing the script).
 *
 * The script:
 *   1. Reads all IntegrationConnection records with legacy-format credentialsRef
 *   2. Decrypts each using the old AES-256-GCM per-provider key
 *   3. Stores the plaintext blob in the secret store
 *   4. Updates credentialsRef in DB to the new secret path
 *   5. Verifies the round-trip by reading back from the store
 */

import { createDecipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DRY_RUN = !process.argv.includes('--execute');
const LEGACY_FORMAT_RE = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

// ---------------------------------------------------------------------------
// Legacy decryption (copied from old credential-service.ts)
// ---------------------------------------------------------------------------

function getLegacyKey(providerSlug: string): Buffer {
  const envVar = `${providerSlug.toUpperCase()}_ENCRYPTION_KEY`;
  const key = process.env[envVar];
  if (!key) {
    throw new Error(`Missing env var: ${envVar}`);
  }
  return Buffer.from(key, 'hex');
}

function legacyDecrypt(encrypted: string, providerSlug: string): unknown {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':') as [string, string, string];
  const key = getLegacyKey(providerSlug);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ConnectionRecord {
  id: string;
  organizationId: string;
  provider: string;
  credentialsRef: string | null;
}

/**
 * Migrate a single connection's credentials to the secret store.
 * Returns 'migrated' | 'skipped' | 'failed'.
 */
async function migrateConnection(
  conn: ConnectionRecord,
  store: {
    get(path: string): Promise<string | null>;
    set(path: string, value: string): Promise<void>;
  },
  prisma: PrismaClient,
): Promise<'migrated' | 'skipped' | 'failed'> {
  const slug = conn.provider.toLowerCase();
  const ref = conn.credentialsRef;

  if (!(ref && LEGACY_FORMAT_RE.test(ref))) {
    return 'skipped';
  }

  const blob = legacyDecrypt(ref, slug);
  const path = `${conn.organizationId}/${slug}`;

  if (DRY_RUN) {
    return 'migrated';
  }

  await store.set(path, JSON.stringify(blob));

  const readBack = await store.get(path);
  if (!readBack) {
    throw new Error(`Verification failed: could not read back ${path}`);
  }
  const parsed = JSON.parse(readBack);
  if (JSON.stringify(parsed) !== JSON.stringify(blob)) {
    throw new Error(`Verification failed: round-trip mismatch for ${path}`);
  }

  await prisma.integrationConnection.update({
    where: { id: conn.id },
    data: { credentialsRef: path },
  });
  return 'migrated';
}

async function main() {
  const { getSecretStore } = await import('@contractor-ops/secrets');
  const store = getSecretStore();

  const prisma = new PrismaClient();

  try {
    const connections = await prisma.integrationConnection.findMany({
      select: {
        id: true,
        organizationId: true,
        provider: true,
        credentialsRef: true,
      },
    });

    for (const conn of connections) {
      try {
        await migrateConnection(conn, store, prisma);
      } catch (err) {
        const slug = conn.provider.toLowerCase();
        console.error(
          `  [FAIL] ${conn.id} (${slug}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
