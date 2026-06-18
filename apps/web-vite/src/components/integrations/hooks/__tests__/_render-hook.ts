/**
 * Integrations-domain re-export of the shared hook harness.
 *
 * Pattern (mirrors `portal/__tests__/render-portal-hook.tsx`):
 *
 *   vi.mock('../../../../providers/trpc-provider.js', () => {
 *     const { createTRPCProxy } = require('../../../../test-utils/render-hook.js');
 *     const trpc = createTRPCProxy();
 *     return { useTRPC: () => trpc };
 *   });
 *
 *   setTRPCMock({ 'jira.connectionStatus': () => ({ status: 'CONNECTED' }) });
 */

export type { TRPCHandler, TRPCMock } from '../../../../test-utils/render-hook.js';
// biome-ignore lint/performance/noBarrelFile: test render helper
export {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
