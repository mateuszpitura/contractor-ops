/**
 * Step 10 port of apps/web/src/components/shared/__tests__/animate-in.test.tsx.
 *
 * AnimateIn is the spring-based fade-up wrapper used across every list and
 * dashboard surface — kept presentational on the web-vite side. Tests cover
 * child rendering, default `min-w-0` clamp, and custom className merging.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { AnimateIn } from '../animate-in.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AnimateIn (web-vite)', () => {
  it('renders children', async () => {
    await mount(<AnimateIn>Hello</AnimateIn>);
    expect(findByText(document.body, 'Hello')).not.toBeNull();
  });

  it('applies default className with min-w-0', async () => {
    const { container } = await mount(<AnimateIn>Content</AnimateIn>);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className ?? '').toContain('min-w-0');
  });

  it('merges custom className alongside the default', async () => {
    const { container } = await mount(<AnimateIn className="extra-class">Content</AnimateIn>);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className ?? '').toContain('min-w-0');
    expect(wrapper?.className ?? '').toContain('extra-class');
  });

  it('renders multiple complex children', async () => {
    await mount(
      <AnimateIn>
        <span data-testid="child-a">A</span>
        <span data-testid="child-b">B</span>
      </AnimateIn>,
    );
    expect(document.body.querySelector('[data-testid="child-a"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="child-b"]')).not.toBeNull();
  });
});
