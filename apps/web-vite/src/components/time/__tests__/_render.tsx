/**
 * Minimal render helper for web-vite component tests.
 *
 * Step 10 ports legacy `@testing-library/react`-based tests, but
 * apps/web-vite does not (yet) carry @testing-library as a dependency.
 * This file provides a tiny `mount(jsx)` based directly on
 * `react-dom/client` + React's built-in `act`, plus DOM/event helpers
 * sufficient for the ported assertions. Kept inside `__tests__/` so it
 * is **not** picked up by vitest's `*.test.{ts,tsx}` include glob.
 */

import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

import { setupTestI18n } from '../../../test-utils/setup-test-i18n.js';

// Shared user-event instance — `delay: null` keeps interactions synchronous
// inside vitest's jsdom worker and avoids hanging on fake-timer tests.
const user = userEvent.setup({ delay: null });

export { user as userEvent };

// React 19's `act` requires the host to opt in via this global so it
// drains effects deterministically inside vitest's jsdom worker.
// biome-ignore lint/suspicious/noExplicitAny: globalThis property flag
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLElement;
  root: Root;
  unmount: () => void;
}

export async function mount(ui: ReactElement): Promise<Mounted> {
  await setupTestI18n();
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    root,
    unmount: () => {
      void act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export async function rerender(mounted: Mounted, ui: ReactElement): Promise<void> {
  await act(async () => {
    mounted.root.render(ui);
  });
}

export function findByText(root: ParentNode, text: string | RegExp): HTMLElement | null {
  const all = root.querySelectorAll<HTMLElement>('*');
  for (const el of Array.from(all)) {
    // Only check leaf-ish elements to avoid matching parent text-content unions.
    const hasChildEls = Array.from(el.childNodes).some(n => n.nodeType === 1);
    if (hasChildEls) continue;
    const txt = (el.textContent ?? '').trim();
    if (text instanceof RegExp ? text.test(txt) : txt === text) return el;
  }
  // Fallback: containment match (parent nodes with mixed children).
  for (const el of Array.from(all)) {
    const txt = (el.textContent ?? '').trim();
    if (text instanceof RegExp ? text.test(txt) : txt.includes(text)) return el;
  }
  return null;
}

export function findAllByText(root: ParentNode, text: string | RegExp): HTMLElement[] {
  const matches: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const all = root.querySelectorAll<HTMLElement>('*');
  for (const el of Array.from(all)) {
    const hasChildEls = Array.from(el.childNodes).some(n => n.nodeType === 1);
    if (hasChildEls) continue;
    const txt = (el.textContent ?? '').trim();
    if (text instanceof RegExp ? text.test(txt) : txt === text) {
      if (!seen.has(el)) {
        matches.push(el);
        seen.add(el);
      }
    }
  }
  return matches;
}

/** Find the nearest button containing the given text (label or descendant). */
export function findButton(root: ParentNode, text: string | RegExp): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  for (const btn of buttons) {
    const txt = (btn.textContent ?? '').trim();
    if (text instanceof RegExp ? text.test(txt) : txt.includes(text)) return btn;
  }
  return null;
}

/** Toggle a checkbox / radix role=checkbox control (alias for {@link click}). */
export async function toggleCheckbox(el: Element): Promise<void> {
  await click(el);
}

export async function click(el: Element): Promise<void> {
  // Delegates to @testing-library/user-event so radix-ui primitives
  // (Checkbox, Popover, Tooltip) receive the full pointerdown→pointerup→click
  // sequence + focus management they require for state changes.
  await act(async () => {
    await user.click(el as Element);
  });
}

export async function type(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  await act(async () => {
    el.focus();
    await user.type(el, value);
  });
}
