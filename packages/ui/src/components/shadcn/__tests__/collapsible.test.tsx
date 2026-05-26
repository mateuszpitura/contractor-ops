import { screen, setup } from '../../../__tests__/test-utils.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible.js';

function renderCollapsible({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  return setup(
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger>Toggle</CollapsibleTrigger>
      <CollapsibleContent>
        <p>Collapsible content here</p>
      </CollapsibleContent>
    </Collapsible>,
  );
}

describe('Collapsible', () => {
  it('renders the trigger', () => {
    renderCollapsible();
    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });

  it('does not show content when closed', () => {
    renderCollapsible();
    // Base UI unmounts collapsed content from the DOM
    expect(screen.queryByText('Collapsible content here')).not.toBeInTheDocument();
  });

  it('shows content when defaultOpen', () => {
    renderCollapsible({ defaultOpen: true });
    expect(screen.getByText('Collapsible content here')).toBeInTheDocument();
    const content = document.querySelector("[data-slot='collapsible-content']");
    expect(content).not.toHaveAttribute('hidden');
  });

  it('toggles content on trigger click', async () => {
    const { user } = renderCollapsible();
    await user.click(screen.getByText('Toggle'));
    expect(screen.getByText('Collapsible content here')).toBeVisible();
  });

  it('sets data-slot on root', () => {
    renderCollapsible();
    const root = document.querySelector("[data-slot='collapsible']");
    expect(root).toBeInTheDocument();
  });

  it('sets data-slot on trigger', () => {
    renderCollapsible();
    const trigger = document.querySelector("[data-slot='collapsible-trigger']");
    expect(trigger).toBeInTheDocument();
  });

  it('sets data-slot on content when open', () => {
    renderCollapsible({ defaultOpen: true });
    const content = document.querySelector("[data-slot='collapsible-content']");
    expect(content).toBeInTheDocument();
  });
});
