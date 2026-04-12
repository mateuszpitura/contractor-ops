import { beforeEach, describe, expect, it } from 'vitest';
import { clearAdapters, getAdapter, getAllAdapters, registerAdapter } from '../registry.js';
import type { IntegrationProviderAdapter } from '../types/provider.js';

function createMockAdapter(
  slug: string,
  overrides?: Partial<IntegrationProviderAdapter>,
): IntegrationProviderAdapter {
  return {
    slug,
    displayName: `Mock ${slug}`,
    supportsOAuth: false,
    supportsWebhooks: false,
    ...overrides,
  };
}

describe('registry', () => {
  beforeEach(() => {
    clearAdapters();
  });

  it('should register an adapter and retrieve it by slug', () => {
    const adapter = createMockAdapter('test-provider');
    registerAdapter(adapter);

    const retrieved = getAdapter('test-provider');
    expect(retrieved).toBe(adapter);
    expect(retrieved?.slug).toBe('test-provider');
    expect(retrieved?.displayName).toBe('Mock test-provider');
  });

  it('should return undefined for unknown slug', () => {
    const result = getAdapter('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should handle case-insensitive lookup', () => {
    const adapter = createMockAdapter('Slack');
    registerAdapter(adapter);

    expect(getAdapter('slack')).toBe(adapter);
    expect(getAdapter('SLACK')).toBe(adapter);
    expect(getAdapter('Slack')).toBe(adapter);
  });

  it('should return all registered adapters', () => {
    const adapter1 = createMockAdapter('slack');
    const adapter2 = createMockAdapter('resend');

    registerAdapter(adapter1);
    registerAdapter(adapter2);

    const all = getAllAdapters();
    expect(all).toHaveLength(2);
    expect(all).toContain(adapter1);
    expect(all).toContain(adapter2);
  });

  it('should return empty array when no adapters registered', () => {
    expect(getAllAdapters()).toHaveLength(0);
  });

  it('should overwrite adapter when registering same slug', () => {
    const adapter1 = createMockAdapter('slack', { displayName: 'Slack v1' });
    const adapter2 = createMockAdapter('slack', { displayName: 'Slack v2' });

    registerAdapter(adapter1);
    registerAdapter(adapter2);

    const retrieved = getAdapter('slack');
    expect(retrieved?.displayName).toBe('Slack v2');
    expect(getAllAdapters()).toHaveLength(1);
  });
});
