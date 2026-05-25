/**
 * Ported from apps/web/src/components/consent/__tests__/consent-purpose-toggle.test.tsx.
 *
 * Web-vite ConsentPurposeToggle is fully presentational — translations
 * come from the live i18n compat layer (no provider/mock dance). We
 * exercise the props the consent settings container hands the toggle
 * (purpose, required, granted, onToggle, disabled) and assert the
 * Radix `<Switch>` reflects them via its aria-* contract.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConsentPurposeToggle } from '../consent-purpose-toggle.js';
import { click, findByAriaLabel, findByRole, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const baseProps = {
  purpose: 'CONTRACTOR_DATA_PROCESSING' as const,
  required: true,
  granted: false,
  onToggle: vi.fn(),
};

describe('ConsentPurposeToggle (web-vite)', () => {
  it('renders a switch element', async () => {
    await mount(<ConsentPurposeToggle {...baseProps} />);
    expect(findByRole(document.body, 'switch')).not.toBeNull();
  });

  it('shows the Required badge when the purpose is required', async () => {
    await mount(<ConsentPurposeToggle {...baseProps} required />);
    expect(findByText(document.body, 'Required')).not.toBeNull();
  });

  it('shows the Optional badge when the purpose is not required', async () => {
    await mount(<ConsentPurposeToggle {...baseProps} required={false} />);
    expect(findByText(document.body, 'Optional')).not.toBeNull();
  });

  it('reflects granted=true on the switch via aria-checked', async () => {
    await mount(<ConsentPurposeToggle {...baseProps} granted />);
    const toggle = findByRole(document.body, 'switch');
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
  });

  it('calls onToggle when an optional switch is activated', async () => {
    const onToggle = vi.fn();
    await mount(
      <ConsentPurposeToggle {...baseProps} required={false} granted={false} onToggle={onToggle} />,
    );
    const toggle = findByRole(document.body, 'switch');
    expect(toggle).not.toBeNull();
    await click(toggle as HTMLElement);
    expect(onToggle).toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith('CONTRACTOR_DATA_PROCESSING', true);
  });

  it('disables the switch via the disabled prop', async () => {
    await mount(<ConsentPurposeToggle {...baseProps} disabled />);
    const toggle = findByRole(document.body, 'switch');
    expect(toggle).not.toBeNull();
    // Radix `<Switch>` reflects `disabled` via `data-disabled` on the button.
    expect(toggle?.hasAttribute('disabled') || toggle?.dataset.disabled !== undefined).toBe(true);
  });

  it('renders an aria-label that ends with "consent toggle"', async () => {
    await mount(<ConsentPurposeToggle {...baseProps} />);
    expect(findByAriaLabel(document.body, /consent toggle$/)).not.toBeNull();
  });
});
