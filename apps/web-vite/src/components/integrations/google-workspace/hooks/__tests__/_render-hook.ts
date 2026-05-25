/**
 * Google-Workspace flavoured re-export of the shared hook harness.
 * Sits one folder deeper than other integrations hooks; the relative
 * path back up to `src/test-utils` adjusts accordingly.
 */

export type { TRPCHandler, TRPCMock } from '../../../../../test-utils/render-hook.js';
export {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../../test-utils/render-hook.js';
