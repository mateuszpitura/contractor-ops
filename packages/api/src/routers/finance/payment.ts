/**
 * Payment router — composes sub-routers for the payment-run domain.
 *
 * - payment-shared.ts — helpers, types, constants
 * - payment-core.ts — readyForPayment, create, get, list, activityDates, listByContractor
 * - payment-export-router.ts — lockAndExport, getFormatDetection
 * - payment-run-ops.ts — updateItemStatus, markAllPaid, cancel, removeFromRun
 * - payment-import.ts — importStatement, confirmStatementMatches
 * - payment-skonto.ts — applySkontoToItem
 */
import { mergeRouters } from '../../init';
import { paymentCoreRouter } from './payment-core';
import { paymentExportRouter } from './payment-export-router';
import { paymentImportRouter } from './payment-import';
import { paymentRunOpsRouter } from './payment-run-ops';
import { paymentSkontoRouter } from './payment-skonto';

export const paymentRouter = mergeRouters(
  paymentCoreRouter,
  paymentExportRouter,
  paymentRunOpsRouter,
  paymentImportRouter,
  paymentSkontoRouter,
);
