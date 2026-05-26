import { render, screen, setup } from '../../../__tests__/test-utils.js';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../popover.js';

function renderPopover({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  return setup(
    <Popover defaultOpen={defaultOpen}>
      <PopoverTrigger>Open Popover</PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Popover Title</PopoverTitle>
          <PopoverDescription>Popover desc.</PopoverDescription>
        </PopoverHeader>
        <p>Popover body</p>
      </PopoverContent>
    </Popover>,
  );
}

describe('Popover', () => {
  it('renders the trigger', () => {
    renderPopover();
    expect(screen.getByText('Open Popover')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderPopover();
    expect(screen.queryByText('Popover Title')).not.toBeInTheDocument();
  });

  it('renders content when defaultOpen', () => {
    renderPopover({ defaultOpen: true });
    expect(screen.getByText('Popover Title')).toBeInTheDocument();
    expect(screen.getByText('Popover desc.')).toBeInTheDocument();
    expect(screen.getByText('Popover body')).toBeInTheDocument();
  });

  it('opens popover on trigger click', async () => {
    const { user } = renderPopover();
    await user.click(screen.getByText('Open Popover'));
    expect(screen.getByText('Popover Title')).toBeInTheDocument();
  });

  it('PopoverHeader merges custom className', () => {
    render(
      <Popover defaultOpen>
        <PopoverContent>
          <PopoverHeader className="my-header">
            <PopoverTitle>T</PopoverTitle>
          </PopoverHeader>
        </PopoverContent>
      </Popover>,
    );
    const header = document.querySelector("[data-slot='popover-header']");
    expect(header?.className).toContain('my-header');
  });

  it('PopoverContent merges custom className', () => {
    render(
      <Popover defaultOpen>
        <PopoverContent className="custom-pop">
          <p>Content</p>
        </PopoverContent>
      </Popover>,
    );
    const content = document.querySelector("[data-slot='popover-content']");
    expect(content?.className).toContain('custom-pop');
  });

  it('PopoverTitle sets data-slot', () => {
    renderPopover({ defaultOpen: true });
    const title = screen.getByText('Popover Title').closest("[data-slot='popover-title']");
    expect(title).toBeInTheDocument();
  });

  it('PopoverDescription sets data-slot', () => {
    renderPopover({ defaultOpen: true });
    const desc = screen.getByText('Popover desc.').closest("[data-slot='popover-description']");
    expect(desc).toBeInTheDocument();
  });
});
