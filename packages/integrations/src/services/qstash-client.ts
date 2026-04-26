import { Client } from '@upstash/qstash';

// ---------------------------------------------------------------------------
// QStash Client Singleton
// ---------------------------------------------------------------------------

let client: Client | null = null;

/**
 * Returns a singleton QStash client instance.
 * Requires QSTASH_TOKEN environment variable.
 */
export function getQStashClient(): Client {
  if (!client) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) {
      throw new Error('QSTASH_TOKEN environment variable is not set');
    }
    client = new Client({ token });
  }
  return client;
}

/**
 * Resets the singleton client. Useful for testing.
 */
export function resetQStashClient(): void {
  client = null;
}
