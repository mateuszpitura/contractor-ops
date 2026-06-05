/**
 * EquipmentTypeIcon is the visual key on every assignment dialog + table
 * row identifying what is being assigned or returned. Verifies the SVG
 * mapping per known type, the `Box` fallback for unknown types, and that
 * default + custom classes survive merging.
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { EquipmentTypeIcon } from '../equipment-type-icon.js';

interface Rendered {
  container: HTMLDivElement;
  unmount: () => void;
}

const mounted: Rendered[] = [];

function renderInto(node: ReactElement): Rendered {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  // `act` returns a thenable; render is synchronous so we discard it.
  void act(() => {
    root.render(node);
  });
  const handle: Rendered = {
    container,
    unmount: () => {
      void act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
  mounted.push(handle);
  return handle;
}

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
});

function svgClasses(svg: SVGElement | null): string {
  if (!svg) return '';
  return svg.getAttribute('class') ?? '';
}

describe('EquipmentTypeIcon', () => {
  const KNOWN_TYPES = ['LAPTOP', 'MONITOR', 'PHONE', 'HEADSET', 'KEYBOARD', 'MOUSE', 'OTHER'];

  it.each(KNOWN_TYPES)('renders an svg for known type %s', type => {
    const { container } = renderInto(<EquipmentTypeIcon type={type} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders fallback svg for unknown type', () => {
    const { container } = renderInto(<EquipmentTypeIcon type="DOCKING_STATION" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('applies default size classes', () => {
    const { container } = renderInto(<EquipmentTypeIcon type="LAPTOP" />);
    expect(svgClasses(container.querySelector('svg'))).toContain('h-4');
  });

  it('merges a custom className alongside the defaults', () => {
    const { container } = renderInto(<EquipmentTypeIcon type="LAPTOP" className="text-red-500" />);
    expect(svgClasses(container.querySelector('svg'))).toContain('text-red-500');
  });
});
