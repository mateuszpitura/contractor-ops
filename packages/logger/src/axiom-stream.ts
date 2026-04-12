import { Writable } from "node:stream";
import { Axiom } from "@axiomhq/js";

/**
 * Pino-compatible writable stream that sends logs to Axiom.
 *
 * Uses the Axiom JS SDK with automatic batching (flushes every 1s or 1000 events).
 * Runs synchronously in the same thread — no worker threads, safe for Next.js webpack.
 */
export function createAxiomStream(opts: { dataset: string; token: string }): Writable {
  const axiom = new Axiom({ token: opts.token });
  const dataset = opts.dataset;

  const stream = new Writable({
    objectMode: true,
    write(chunk: Buffer | string, _encoding, callback) {
      try {
        const line = typeof chunk === "string" ? chunk : chunk.toString();
        const parsed = JSON.parse(line);
        axiom.ingest(dataset, [parsed]);
        callback();
      } catch {
        // Don't crash the app if Axiom ingestion fails.
        callback();
      }
    },
    final(callback) {
      axiom.flush().then(
        () => callback(),
        () => callback(),
      );
    },
  });

  // Flush on process exit to avoid losing buffered events.
  // Use once() instead of on() to prevent listener accumulation when
  // createAxiomStream is called multiple times (e.g. hot reloads).
  const flush = () => {
    axiom.flush().catch(() => {});
  };
  process.once("beforeExit", flush);
  process.once("SIGTERM", flush);

  return stream;
}
