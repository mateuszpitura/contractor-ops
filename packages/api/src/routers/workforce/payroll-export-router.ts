// Payroll export tRPC router — dark behind module.workforce-employees.
//
// listTargets: the registered export targets, each annotated with whether the
//   caller's org may currently use it (per-adapter payroll.* flag).
// export: build the org-scoped, PII-masked feed, gate on the target flag, run
//   the engine, audit, and return the file as base64 (payment-export idiom).
// connectNative: the OAuth entry point for the Gusto/QuickBooks native targets.
//
// The native push endpoint is the deferred live path (EXTERNAL-ENABLEMENT):
// even with a target flag APPROVED, gusto/quickbooks currently resolve to their
// CSV export — the shipping path — until the live push endpoint is wired.

import type { FlagKey } from '@contractor-ops/feature-flags';
import { evaluate } from '@contractor-ops/feature-flags';
import { GustoAdapter, QuickBooksAdapter } from '@contractor-ops/integrations';
import { PayrollExportEngine } from '@contractor-ops/payroll';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  PAYROLL_FEED_CROSS_MARKET,
  PAYROLL_FEED_EMPTY,
  PAYROLL_FEED_MISSING_EMPLOYEES,
  PAYROLL_FEED_WRONG_MARKET,
} from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { sensitiveActionMiddleware } from '../../middleware/sensitive';
import { workforceReadProcedure } from '../../middleware/workforce-procedures';
import { writeAuditLog } from '../../services/audit-writer';
import { buildPayrollFeed } from '../../services/payroll-feed';
import { registerAllPayrollProfiles } from '../../services/register-payroll-profiles';

registerAllPayrollProfiles();
const engine = new PayrollExportEngine();

export const payrollExportInput = z
  .object({
    targetId: z.string().min(1),
    employeeIds: z.array(z.string().min(1)).min(1),
    format: z.enum(['csv', 'xml']).optional(),
  })
  .strict();

/** Throws FORBIDDEN when a per-target payroll.* flag is dark/PENDING. */
export function assertPayrollTargetEnabled(flagKey: string, gate: { enabled: boolean }): void {
  if (!gate.enabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `PAYROLL_TARGET_DISABLED:${flagKey}`,
      cause: { flag: flagKey },
    });
  }
}

function flagRegion(region: string): 'EU' | 'ME' {
  return region === 'ME' ? 'ME' : 'EU';
}

// The profile flagKey is typed `string` at the shared interface; every payroll
// target registers a real, compile-time-known payroll.* FlagKey, so the narrow
// is sound (not an external payload).
function isFlagEnabled(flagKey: string, organizationId: string, region: 'EU' | 'ME'): boolean {
  return evaluate(flagKey as FlagKey, { organizationId, region }).enabled;
}

const payrollReadProcedure = workforceReadProcedure;
const payrollExportProcedure = payrollReadProcedure
  .use(requirePermission({ employeePii: ['read'] }))
  .use(sensitiveActionMiddleware);

const connectNativeInput = z.object({ provider: z.enum(['gusto', 'quickbooks']) }).strict();

export const payrollExportRouter = router({
  listTargets: payrollReadProcedure.query(({ ctx }) => {
    const region = flagRegion(ctx.region);
    return engine.listTargets().map(t => ({
      ...t,
      enabled: isFlagEnabled(t.flagKey, ctx.organizationId, region),
    }));
  }),

  export: payrollExportProcedure.input(payrollExportInput).mutation(async ({ ctx, input }) => {
    const region = flagRegion(ctx.region);

    const target = engine.listTargets().find(t => t.profileId === input.targetId);
    if (!target) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `PAYROLL_TARGET_NOT_FOUND:${input.targetId}`,
      });
    }
    assertPayrollTargetEnabled(target.flagKey, {
      enabled: isFlagEnabled(target.flagKey, ctx.organizationId, region),
    });

    const { feed, missingEmployeeIds, excludedCrossMarketIds } = await buildPayrollFeed(
      ctx.db,
      ctx.organizationId,
      input.employeeIds,
    );

    if (missingEmployeeIds.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: PAYROLL_FEED_MISSING_EMPLOYEES,
        cause: {
          params: { count: missingEmployeeIds.length },
          missingEmployeeIds,
        },
      });
    }

    if (excludedCrossMarketIds.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: PAYROLL_FEED_CROSS_MARKET,
        cause: {
          params: { count: excludedCrossMarketIds.length },
          excludedCrossMarketIds,
          targetCountry: feed.targetCountry,
        },
      });
    }

    if (feed.targetCountry && feed.targetCountry !== target.country) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: PAYROLL_FEED_WRONG_MARKET,
        cause: {
          params: { feedCountry: feed.targetCountry, targetCountry: target.country },
          feedTargetCountry: feed.targetCountry,
          exportTargetCountry: target.country,
        },
      });
    }

    if (feed.employees.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: PAYROLL_FEED_EMPTY,
      });
    }

    const bridgeCtx = {
      evaluateFlag: (flagKey: string) => isFlagEnabled(flagKey, ctx.organizationId, region),
    };
    const result = await engine.generate(
      input.targetId,
      feed,
      input.format ? { ...bridgeCtx, format: input.format } : bridgeCtx,
    );

    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user?.id ?? null,
      action: 'payroll.export',
      resourceType: 'EMPLOYEE',
      resourceId: input.targetId,
      metadata: {
        targetId: input.targetId,
        employeeCount: feed.employees.length,
        format: result.ext,
      },
    });

    return {
      filename: `payroll-${input.targetId}-${feed.generatedAt.slice(0, 10)}.${result.ext}`,
      ext: result.ext,
      mimeType: result.mime,
      fileBase64: result.buffer.toString('base64'),
      warnings: result.warnings ?? [],
    };
  }),

  connectNative: payrollReadProcedure.input(connectNativeInput).query(({ ctx, input }) => {
    const adapter = input.provider === 'gusto' ? new GustoAdapter() : new QuickBooksAdapter();
    const config = adapter.getOAuthConfig();
    return {
      provider: input.provider,
      authorizationUrl: config.authorizationUrl,
      scopes: config.scopes,
      redirectPath: config.redirectPath,
    };
  }),
});
