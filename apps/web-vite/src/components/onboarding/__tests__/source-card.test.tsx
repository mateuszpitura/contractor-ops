/**
 * SourceCard is presentational — checkbox-role container that toggles via
 * keyboard or onClick when connected, and exposes a Connect button when not.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { SourceCard } from '../source-card.js';
import { click, findButton, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const defaultProps = {
  provider: 'JIRA',
  name: 'Jira',
  icon: <span>JiraIcon</span>,
  connected: true,
  selected: false,
  onToggle: vi.fn(),
  onConnect: vi.fn(),
};

describe('SourceCard (web-vite)', () => {
  it('renders the provider name', async () => {
    await mount(<SourceCard {...defaultProps} />);
    expect(findByText(document.body, 'Jira')).not.toBeNull();
  });

  it('shows the Connected badge when connected', async () => {
    await mount(<SourceCard {...defaultProps} />);
    expect(findByText(document.body, 'Connected')).not.toBeNull();
  });

  it('shows "Not connected" + Connect button when not connected', async () => {
    await mount(<SourceCard {...defaultProps} connected={false} />);
    expect(findByText(document.body, 'Not connected')).not.toBeNull();
    expect(findButton(document.body, 'Connect')).not.toBeNull();
  });

  it('exposes a checkbox role for keyboard accessibility', async () => {
    const { container } = await mount(<SourceCard {...defaultProps} />);
    expect(container.querySelector('[role="checkbox"]')).not.toBeNull();
  });

  it('renders a Switch when connected', async () => {
    const { container } = await mount(<SourceCard {...defaultProps} />);
    expect(container.querySelector('[role="switch"]')).not.toBeNull();
  });

  it('calls onToggle when the card is clicked while connected', async () => {
    const onToggle = vi.fn();
    const { container } = await mount(<SourceCard {...defaultProps} onToggle={onToggle} />);
    const card = container.querySelector('[role="checkbox"]') as HTMLElement;
    await click(card);
    expect(onToggle).toHaveBeenCalled();
  });

  it('calls onConnect when the Connect button is clicked (not connected)', async () => {
    const onConnect = vi.fn();
    await mount(<SourceCard {...defaultProps} connected={false} onConnect={onConnect} />);
    const button = findButton(document.body, 'Connect');
    expect(button).not.toBeNull();
    await click(button as HTMLButtonElement);
    expect(onConnect).toHaveBeenCalled();
  });

  it('applies the selected ring class when selected', async () => {
    const { container } = await mount(<SourceCard {...defaultProps} selected />);
    const card = container.querySelector('[role="checkbox"]') as HTMLElement;
    expect(card.className).toContain('ring-2');
  });
});
