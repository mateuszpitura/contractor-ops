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

import { createDecipheriv } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DRY_RUN = !process.argv.includes("--execute");
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
  return Buffer.from(key, "hex");
}

function legacyDecrypt(encrypted: string, providerSlug: string): unknown {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(":") as [string, string, string];
  const key = getLegacyKey(providerSlug);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Credential Migration ${DRY_RUN ? "(DRY RUN)" : "(EXECUTING)"} ===\n`);

  // Dynamically import secret store so env is read at runtime
  const { getSecretStore } = await import("@contractor-ops/secrets");
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

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const conn of connections) {
      const slug = conn.provider.toLowerCase();
      const ref = conn.credentialsRef;

      // Skip if already migrated (not legacy format) or empty
      if (!ref || !LEGACY_FORMAT_RE.test(ref)) {
        skipped++;
        continue;
      }

      try {
        // Step 1: Decrypt with old key
        const blob = legacyDecrypt(ref, slug);
        const path = `${conn.organizationId}/${slug}`;

        if (DRY_RUN) {
          console.log(`  [dry-run] Would migrate ${conn.id} (${slug}) → ${path}`);
          migrated++;
          continue;
        }

        // Step 2: Store in secret store
        await store.set(path, JSON.stringify(blob));

        // Step 3: Verify round-trip
        const readBack = await store.get(path);
        if (!readBack) {
          throw new Error(`Verification failed: could not read back ${path}`);
        }
        const parsed = JSON.parse(readBack);
        if (JSON.stringify(parsed) !== JSON.stringify(blob)) {
          throw new Error(`Verification failed: round-trip mismatch for ${path}`);
        }

        // Step 4: Update DB to new path
        await prisma.integrationConnection.update({
          where: { id: conn.id },
          data: { credentialsRef: path },
        });

        console.log(`  [ok] ${conn.id} (${slug}) → ${path}`);
        migrated++;
      } catch (err) {
        failed++;
        console.error(
          `  [FAIL] ${conn.id} (${slug}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    console.log(`\n--- Summary ---`);
    console.log(`  Total:    ${connections.length}`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped:  ${skipped} (already migrated or empty)`);
    console.log(`  Failed:   ${failed}`);

    if (DRY_RUN) {
      console.log(`\nRe-run with --execute to apply changes.\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
