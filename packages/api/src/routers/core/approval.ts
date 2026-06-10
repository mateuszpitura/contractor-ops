/**
 * Approval router — combines chain config, queue/actions, and submission/audit.
 *
 * Sub-routers:
 * - approval-chain.ts — chain CRUD (admin settings)
 * - approval-queue.ts — pending list, actionable count, approve/reject/delegate/bulk
 * - approval-submit.ts — submit for approval, audit trail, compliance resume
 *
 * Shared helpers live in approval-shared.ts; Prisma payload types in approval-types.ts.
 */
import { mergeRouters } from '../../init';
import { approvalChainRouter } from './approval-chain';
import { approvalQueueRouter } from './approval-queue';
import { approvalSubmitRouter } from './approval-submit';

export const approvalRouter = mergeRouters(
  approvalChainRouter,
  approvalQueueRouter,
  approvalSubmitRouter,
);
