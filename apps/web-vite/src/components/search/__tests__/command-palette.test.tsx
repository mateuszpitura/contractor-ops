/**
 * Step-10 port. The presentational shell takes a pre-built body node
 * (container picks loading/idle/searching variant). We render the shell
 * with each body to exercise the loading and idle branches.
 */

import { describe, expect, it, vi } from 'vitest';
import { navigationItems } from '../../../lib/navigation.js';
import { render, screen } from '../../../test/test-utils.js';
import type { CommandPaletteViewProps } from '../command-palette.js';
import {
  CommandPaletteIdleBody,
  CommandPaletteLoadingBody,
  CommandPaletteView,
} from '../command-palette.js';

function makeProps(over: Partial<CommandPaletteViewProps> = {}): CommandPaletteViewProps {
  return {
    open: true,
    setOpen: vi.fn(),
    query: '',
    onQueryChange: vi.fn(),
    isSearching: false,
    searchResultsCount: 0,
    showAriaLive: false,
    body: (
      <CommandPaletteIdleBody
        recentItems={[]}
        pinnedItems={[]}
        visibleNavItems={navigationItems}
        quickActions={[]}
        onRecentSelect={vi.fn()}
        onPageNavigate={vi.fn()}
        onNavigate={vi.fn()}
      />
    ),
    ...over,
  };
}

describe('CommandPaletteView (web-vite)', () => {
  it('renders the search input when open', () => {
    render(<CommandPaletteView {...makeProps()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders skeleton placeholders when the loading body is supplied', () => {
    const { baseElement } = render(
      <CommandPaletteView {...makeProps({ body: <CommandPaletteLoadingBody /> })} />,
    );
    expect(baseElement.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders nothing visible when open is false', () => {
    const { baseElement } = render(<CommandPaletteView {...makeProps({ open: false })} />);
    expect(baseElement.querySelector('[role="combobox"]')).toBeNull();
  });
});
