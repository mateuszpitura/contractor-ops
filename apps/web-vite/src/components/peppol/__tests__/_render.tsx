/**
 * Per-domain mount helper for web-vite Peppol component tests — mirror of
 * sibling helpers under `consent/__tests__/_render.tsx`. Kept per-domain
 * so each `__tests__` folder stays self-contained and the include glob
 * picks up only `.test.{ts,tsx}` files.
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

import { setupTestI18n } from '../../../test-utils/setup-test-i18n.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

export function findByAltText(root: ParentNode, alt: string): HTMLImageElement | null {
  return root.querySelector<HTMLImageElement>(`img[alt="${alt}"]`);
}
