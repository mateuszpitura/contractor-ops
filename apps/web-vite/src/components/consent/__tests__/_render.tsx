/**
 * Minimal render helper for web-vite consent component tests — mirror of
 * the workflows/_render.tsx helper. One per domain so each `__tests__`
 * folder stays self-contained and the include glob picks up only
 * `.test.{ts,tsx}` files.
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

import { setupTestI18n } from '../../../test-utils/setup-test-i18n.js';

// biome-ignore lint/suspicious/noExplicitAny: globalThis flag for React 19 act()
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
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export function findByText(root: ParentNode, text: string | RegExp): HTMLElement | null {
  const all = root.querySelectorAll<HTMLElement>('*');
  for (const el of Array.from(all)) {
    const hasChildEls = Array.from(el.childNodes).some(n => n.nodeType === 1);
    if (hasChildEls) continue;
    const txt = (el.textContent ?? '').trim();
    if (text instanceof RegExp ? text.test(txt) : txt === text) return el;
  }
  for (const el of Array.from(all)) {
    const txt = (el.textContent ?? '').trim();
    if (text instanceof RegExp ? text.test(txt) : txt.includes(text)) return el;
  }
  return null;
}

export function findByRole(root: ParentNode, role: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[role='${role}']`);
}

export function findByAriaLabel(root: ParentNode, label: string | RegExp): HTMLElement | null {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('[aria-label]'));
  for (const el of candidates) {
    const value = el.getAttribute('aria-label') ?? '';
    if (label instanceof RegExp ? label.test(value) : value === label) return el;
  }
  if (typeof label === 'string') {
    for (const el of candidates) {
      const value = el.getAttribute('aria-label') ?? '';
      if (value.includes(label)) return el;
    }
  }
  return null;
}

export async function click(el: Element): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}
