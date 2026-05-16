import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { PinTabButton } from '../pin-tab-button';

describe('PinTabButton', () => {
  it('renders the unpin label and aria-checked when pinned', () => {
    render(
      <PinTabButton
        tabKey="integrations"
        tabLabel="Integrations"
        pinned={true}
        active={false}
        pinAriaLabel="Pin Integrations"
        unpinAriaLabel="Unpin Integrations"
        onToggle={vi.fn()}
      />,
    );

    const button = screen.getByRole('switch', { name: 'Unpin Integrations' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-checked', 'true');
    expect(button).toHaveAttribute('data-pinned', 'true');
  });

  it('renders the pin-to-sidebar label when unpinned but active', () => {
    render(
      <PinTabButton
        tabKey="billing"
        tabLabel="Billing"
        pinned={false}
        active={true}
        pinAriaLabel="Pin Billing"
        unpinAriaLabel="Unpin Billing"
        onToggle={vi.fn()}
      />,
    );

    const button = screen.getByRole('switch', { name: 'Pin Billing' });
    expect(button).toHaveAttribute('aria-checked', 'false');
    expect(button).toHaveAttribute('data-pinned', 'false');
  });

  it('renders nothing when not pinned and not active', () => {
    render(
      <PinTabButton
        tabKey="general"
        tabLabel="General"
        pinned={false}
        active={false}
        pinAriaLabel="Pin General"
        unpinAriaLabel="Unpin General"
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('fires onToggle and stops event propagation when clicked', async () => {
    const handleToggle = vi.fn();
    const wrapperClick = vi.fn();
    const { user } = setup(
      // biome-ignore lint/a11y/useKeyWithClickEvents: test-only wrapper
      <div onClick={wrapperClick} role="presentation">
        <PinTabButton
          tabKey="general"
          tabLabel="General"
          pinned={false}
          active={true}
          pinAriaLabel="Pin General"
          unpinAriaLabel="Unpin General"
          onToggle={handleToggle}
        />
      </div>,
    );

    await user.click(screen.getByRole('switch'));
    expect(handleToggle).toHaveBeenCalledTimes(1);
    expect(wrapperClick).not.toHaveBeenCalled();
  });

  it('does not call onToggle when disabled', async () => {
    const handleToggle = vi.fn();
    const { user } = setup(
      <PinTabButton
        tabKey="general"
        tabLabel="General"
        pinned={true}
        active={false}
        disabled
        pinAriaLabel="Pin General"
        unpinAriaLabel="Unpin General"
        onToggle={handleToggle}
      />,
    );

    await user.click(screen.getByRole('switch'));
    expect(handleToggle).not.toHaveBeenCalled();
  });
});
