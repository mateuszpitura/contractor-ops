import { vi } from 'vitest';

vi.unmock('@/components/ui/scroll-area');

import { render } from '@/test/test-utils';
import { ScrollArea } from '../scroll-area';

describe('ScrollArea', () => {
  it('renders children', () => {
    const { getByText } = render(
      <ScrollArea>
        <p>Scrollable content</p>
      </ScrollArea>,
    );
    expect(getByText('Scrollable content')).toBeInTheDocument();
  });

  it('sets data-slot on root', () => {
    render(
      <ScrollArea>
        <p>Content</p>
      </ScrollArea>,
    );
    const root = document.querySelector("[data-slot='scroll-area']");
    expect(root).toBeInTheDocument();
  });

  it('sets data-slot on viewport', () => {
    render(
      <ScrollArea>
        <p>Content</p>
      </ScrollArea>,
    );
    const viewport = document.querySelector("[data-slot='scroll-area-viewport']");
    expect(viewport).toBeInTheDocument();
  });

  it('merges custom className on root', () => {
    render(
      <ScrollArea className="my-scroll">
        <p>Content</p>
      </ScrollArea>,
    );
    const root = document.querySelector("[data-slot='scroll-area']");
    expect(root?.className).toContain('my-scroll');
  });
});
