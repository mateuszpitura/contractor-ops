/**
 * Web-vite port of apps/web/src/components/settings/__tests__/brand-color-picker.test.tsx.
 *
 * Component is presentational (`value` + `onChange` props); no tRPC harness
 * needed. ICU interpolation is not patched in the default test-utils
 * harness, so we assert on stable surface details — trigger role,
 * inline color style, `popover-trigger` data-slot — rather than the
 * interpolated `Selected color: <hex>` aria-label text.
 *
 * jsdom + base-ui Popover does not portal the swatch grid reliably, so
 * the test does not exercise interactions inside the popover content.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';
import { BrandColorPicker } from '../brand-color-picker';

describe('BrandColorPicker', () => {
  it('renders a popover trigger button for the color swatch', () => {
    render(<BrandColorPicker value="#dc2626" onChange={vi.fn()} />);
    const trigger = screen.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  });

  it('paints the trigger background to match the current value prop', () => {
    render(<BrandColorPicker value="#16a34a" onChange={vi.fn()} />);
    const trigger = screen.getByRole('button');
    expect(trigger.style.backgroundColor).toBe('rgb(22, 163, 74)');
  });

  it('updates the trigger background when the value prop changes', () => {
    const { rerender } = render(<BrandColorPicker value="#dc2626" onChange={vi.fn()} />);
    expect(screen.getByRole('button').style.backgroundColor).toBe('rgb(220, 38, 38)');
    rerender(<BrandColorPicker value="#7c3aed" onChange={vi.fn()} />);
    expect(screen.getByRole('button').style.backgroundColor).toBe('rgb(124, 58, 237)');
  });
});
