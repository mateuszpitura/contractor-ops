'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { posthog } from '@/lib/posthog';

interface VariantSlotProps<Key extends string> {
  experimentKey: string;
  /**
   * Map from variant key → React subtree. Must include the variant named
   * by `fallback` so the slot has something to render before the flag
   * resolves.
   */
  variants: Record<Key, ReactNode>;
  fallback: Key;
  /**
   * Optional callback fired once the assigned variant is known. Useful
   * for forwarding the choice up to a server-side capture call.
   */
  onAssigned?: (variant: Key) => void;
}

/**
 * Renders one of N children based on a PostHog feature-flag value, then
 * fires `$feature_flag_called` so PostHog can correlate downstream
 * events (button clicks, signups) with the assigned variant.
 *
 * Sticky per `distinct_id` (PostHog default) — the same visitor sees
 * the same variant across reloads + navigations.
 *
 * Anti-flash strategy: `posthog.onFeatureFlags` resolves once the SDK
 * has fetched flag definitions; until then we render `fallback`. The
 * fallback should match the control / current copy so a brief
 * unassigned render is indistinguishable from the regular page.
 */
export function VariantSlot<Key extends string>({
  experimentKey,
  variants,
  fallback,
  onAssigned,
}: VariantSlotProps<Key>) {
  const [variant, setVariant] = useState<Key>(fallback);

  const variantKeys = useMemo(() => Object.keys(variants) as Key[], [variants]);

  useEffect(() => {
    if (!posthog.__loaded) {
      onAssigned?.(fallback);
      return;
    }

    const apply = () => {
      const raw = posthog.getFeatureFlag(experimentKey);
      const value = typeof raw === 'string' ? raw : raw ? String(raw) : fallback;
      const chosen = (variantKeys.includes(value as Key) ? value : fallback) as Key;
      setVariant(chosen);
      onAssigned?.(chosen);
      // PostHog's $feature_flag_called event de-dupes per session, so it
      // is safe to call on every re-render.
      posthog.capture('$feature_flag_called', {
        $feature_flag: experimentKey,
        $feature_flag_response: chosen,
      });
    };

    if (typeof posthog.onFeatureFlags === 'function') {
      const unsubscribe = posthog.onFeatureFlags(apply);
      return typeof unsubscribe === 'function' ? unsubscribe : undefined;
    }
    apply();
    return;
  }, [experimentKey, fallback, onAssigned, variantKeys]);

  return <>{variants[variant] ?? variants[fallback]}</>;
}
