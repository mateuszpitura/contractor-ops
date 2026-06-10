/**
 * Invoice router — merges CRUD, matching, and action sub-routers.
 */

import { mergeRouters } from '../../init';
import { invoiceActionsRouter } from './invoice-actions';
import { invoiceCrudRouter } from './invoice-crud';
import { invoiceMatchingRouter } from './invoice-matching';

export const invoiceRouter = mergeRouters(
  invoiceCrudRouter,
  invoiceMatchingRouter,
  invoiceActionsRouter,
);
