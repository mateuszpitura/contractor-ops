/**
 * EnglishFallbackIndicator is presentational and reads strings via
 * `useTranslations` (i18next-backed compat hook); here we render against the
 * real bundle that `_render.tsx` boots in English.
 *
 * Note: ICU variable interpolation in jsdom-loaded bundles is partially
 * exercised elsewhere in the suite; here we assert on the literal portion
 * of the description so the test is resilient to the formatter init order.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { EnglishFallbackIndicator } from '../english-fallback-indicator.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function findLabelAttr(text: RegExp): HTMLElement | null {
  const all = document.body.querySelectorAll<HTMLElement>('[aria-label]');
  for (const el of Array.from(all)) {
    if (text.test(el.getAttribute('aria-label') ?? '')) return el;
  }
  return null;
}

describe('EnglishFallbackIndicator (web-vite)', () => {
  it('renders the muted (English) suffix', async () => {
    await mount(<EnglishFallbackIndicator targetLocale="pl" />);
    expect(findByText(document.body, /\(English\)/)).not.toBeNull();
  });

  it('exposes a screen-reader description on an [aria-label] container', async () => {
    await mount(<EnglishFallbackIndicator targetLocale="pl" />);
    expect(findLabelAttr(/has not been translated to/i)).not.toBeNull();
  });

  it('mirrors the description on the tooltip trigger for de target locale', async () => {
    await mount(<EnglishFallbackIndicator targetLocale="de" />);
    // Both the wrapper span and the TooltipTrigger button carry the description.
    const labelled = document.body.querySelectorAll('[aria-label*="has not been translated"]');
    expect(labelled.length).toBeGreaterThanOrEqual(2);
  });

  it('renders an Info trigger that is keyboard-focusable (a11y)', async () => {
    const { container } = await mount(<EnglishFallbackIndicator targetLocale="de" />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0].getAttribute('type') ?? 'button').toBe('button');
  });
});
