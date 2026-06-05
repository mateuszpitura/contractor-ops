/**
 * The web-vite BreadcrumbProvider exposes a positional setter shape:
 * `setOverride(segment, label)`.
 *
 * `useBreadcrumbOverride` is exercised via a full `mount` instead of
 * `renderHook`: the provider's `value` is rebuilt when `overrides` change,
 * so a hook-only setup that calls `setOverride` via the effect would loop
 * inside `renderHook`'s rerender machinery. Mounting once and reading
 * `getCtx().overrides` post-effect avoids that.
 */

import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import {
  BreadcrumbProvider,
  useBreadcrumbContext,
  useBreadcrumbOverride,
} from '../breadcrumb-context.js';
import { mount } from './_render.js';

describe('BreadcrumbProvider (web-vite)', () => {
  it('provides default empty overrides', () => {
    const { result } = renderHook(() => useBreadcrumbContext(), {
      wrapper: BreadcrumbProvider,
    });
    expect(result.current.overrides.size).toBe(0);
  });

  it('allows setting an override (segment, label)', () => {
    const { result } = renderHook(() => useBreadcrumbContext(), {
      wrapper: BreadcrumbProvider,
    });
    act(() => {
      result.current.setOverride('abc123', 'Acme Corp');
    });
    expect(result.current.overrides.get('abc123')?.label).toBe('Acme Corp');
  });

  it('clears an override', () => {
    const { result } = renderHook(() => useBreadcrumbContext(), {
      wrapper: BreadcrumbProvider,
    });
    act(() => {
      result.current.setOverride('seg1', 'Initial');
    });
    expect(result.current.overrides.get('seg1')?.label).toBe('Initial');
    act(() => {
      result.current.clearOverride('seg1');
    });
    expect(result.current.overrides.has('seg1')).toBe(false);
  });

  it('returns null-object defaults when used outside a provider', () => {
    const { result } = renderHook(() => useBreadcrumbContext());
    expect(result.current.overrides.size).toBe(0);
    act(() => {
      result.current.setOverride('x', 'y');
    });
    expect(result.current.overrides.size).toBe(0);
  });
});

describe('useBreadcrumbOverride (web-vite)', () => {
  function CaptureCtx({ onCtx }: { onCtx: (size: number) => void }) {
    const ctx = useBreadcrumbContext();
    useEffect(() => {
      onCtx(ctx.overrides.size);
    });
    return null;
  }

  function HookHost({
    segment,
    label,
    children,
  }: {
    segment: string | undefined;
    label: string | null;
    children?: ReactNode;
  }) {
    useBreadcrumbOverride(segment, label);
    return <>{children}</>;
  }

  it('does not set override when segment is undefined', async () => {
    let lastSize = -1;
    const captureSize = (size: number) => {
      lastSize = size;
    };
    await mount(
      <BreadcrumbProvider>
        <HookHost segment={undefined} label="Label" />
        <CaptureCtx onCtx={captureSize} />
      </BreadcrumbProvider>,
    );
    expect(lastSize).toBe(0);
  });

  it('does not set override when label is null', async () => {
    let lastSize = -1;
    const captureSize = (size: number) => {
      lastSize = size;
    };
    await mount(
      <BreadcrumbProvider>
        <HookHost segment="seg" label={null} />
        <CaptureCtx onCtx={captureSize} />
      </BreadcrumbProvider>,
    );
    expect(lastSize).toBe(0);
  });
});
