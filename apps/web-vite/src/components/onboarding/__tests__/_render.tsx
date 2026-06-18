/**
 * Minimal render helper for web-vite onboarding component tests.
 * Mirror of the sibling helper under `workflows/__tests__/_render.tsx` —
 * kept per-domain so each `__tests__` folder is self-contained and the
 * include glob picks up only `.test.{ts,tsx}` files.
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
      void act(() => {
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

export function findButton(root: ParentNode, text: string | RegExp): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  for (const btn of buttons) {
    const txt = (btn.textContent ?? '').trim();
    if (text instanceof RegExp ? text.test(txt) : txt.includes(text)) return btn;
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
