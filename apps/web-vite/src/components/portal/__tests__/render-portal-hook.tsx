/**
 * Portal-flavoured renderHook harness.
 *
 * Wraps the shared `renderHookWithProviders` so portal hooks that call
 * `usePortalTRPC` (and the small set that also call staff `useTRPC` for
 * cross-router queries — e.g. esign / ocr) get a single tRPC proxy that
 * satisfies both surfaces against the same in-test handler map.
 *
 * Each test file does:
 *
 *   vi.mock('../../../../providers/trpc-provider.js', () => {
 *     const { createTRPCProxy } = require('../../../test-utils/render-hook.js');
 *     const trpc = createTRPCProxy();
 *     return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
 *   });
 *
 *   setTRPCMock({ 'portal.listInvoices': () => [...] });
 *
 * Then calls `renderHookWithProviders(() => useMyPortalHook())`.
 */

export type { TRPCHandler, TRPCMock } from '../../../test-utils/render-hook.js';
// biome-ignore lint/performance/noBarrelFile: test render helper
export {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../test-utils/render-hook.js';
