/**
 * `useClassificationExpertHelp` — derives the adviser-directory jurisdiction
 * from the org-scoped `contractor.getCountryFieldsConfig` query.
 *
 * Covers:
 *   - loading: query pending → isPending=true, GB fallback in place
 *   - empty: query returns no countryCode → falls back to GB / isDE=false
 *   - success DE: countryCode='DE' → isDE=true, jurisdiction='DE'
 *   - success GB: countryCode='GB' → isDE=false, jurisdiction='GB'
 *   - error: query rejects → isPending settles, GB fallback
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useClassificationExpertHelp } from '../use-classification-expert-help.js';

const trpcProxy = createTRPCProxy();

beforeEach(() => {
  setTRPCMock({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useClassificationExpertHelp', () => {
  it('reports isPending=true with GB defaults while the org config loads', () => {
    setTRPCMock({
      'contractor.getCountryFieldsConfig': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useClassificationExpertHelp());
    expect(result.current.isPending).toBe(true);
    expect(result.current.isDE).toBe(false);
    expect(result.current.jurisdiction).toBe('GB');
  });

  it('falls back to GB / isDE=false when the org config has no countryCode (empty)', async () => {
    setTRPCMock({ 'contractor.getCountryFieldsConfig': () => ({}) });
    const { result } = renderHookWithProviders(() => useClassificationExpertHelp());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isDE).toBe(false);
    expect(result.current.jurisdiction).toBe('GB');
  });

  it('flips to DE when the org countryCode is DE (success)', async () => {
    setTRPCMock({
      'contractor.getCountryFieldsConfig': () => ({ countryCode: 'DE' }),
    });
    const { result } = renderHookWithProviders(() => useClassificationExpertHelp());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isDE).toBe(true);
    expect(result.current.jurisdiction).toBe('DE');
  });

  it('keeps GB jurisdiction for GB orgs (success)', async () => {
    setTRPCMock({
      'contractor.getCountryFieldsConfig': () => ({ countryCode: 'GB' }),
    });
    const { result } = renderHookWithProviders(() => useClassificationExpertHelp());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isDE).toBe(false);
    expect(result.current.jurisdiction).toBe('GB');
  });

  it('settles to GB defaults when the query rejects (error)', async () => {
    setTRPCMock({
      'contractor.getCountryFieldsConfig': () => {
        throw new Error('config unavailable');
      },
    });
    const { result } = renderHookWithProviders(() => useClassificationExpertHelp());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isDE).toBe(false);
    expect(result.current.jurisdiction).toBe('GB');
  });
});
