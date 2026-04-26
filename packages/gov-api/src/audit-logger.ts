// ---------------------------------------------------------------------------
// Government API Audit Logger
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import type { GovApiAuditEntry } from './types.js';

const log = createLogger({ service: 'gov-api-audit' });

/**
 * Persists government API request/response audit records.
 *
 * Fire-and-forget design: write failures are logged to console but never
 * thrown. Government API operations must not fail because audit logging broke.
 */
export class GovApiAuditLogger {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Write an audit entry to the GovApiAuditLog table.
   * Silently catches and logs write failures.
   */
  async log(entry: GovApiAuditEntry): Promise<void> {
    try {
      await (
        this.prisma as unknown as {
          govApiAuditLog: {
            create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
          };
        }
      ).govApiAuditLog.create({
        data: {
          organizationId: entry.organizationId,
          apiName: entry.apiName,
          endpoint: entry.endpoint,
          method: entry.method,
          requestBodyHash: entry.requestBodyHash,
          responseStatus: entry.responseStatus,
          responseTimeMs: entry.responseTimeMs,
          errorMessage: entry.errorMessage,
        },
      });
    } catch (err) {
      // Fire-and-forget: audit log failure must not break API operations
      log.error({ err }, 'failed to write audit log');
    }
  }
}
