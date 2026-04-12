import { render, screen, setup } from '@/test/test-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../dropdown-menu';

function renderDropdown({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  return setup(
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            Profile
            <DropdownMenuShortcut>P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe('DropdownMenu', () => {
  it('renders the trigger', () => {
    renderDropdown();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('does not show content when closed', () => {
    renderDropdown();
    expect(screen.queryByText('My Account')).not.toBeInTheDocument();
  });

  it('shows content when defaultOpen', () => {
    renderDropdown({ defaultOpen: true });
    expect(screen.getByText('My Account')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('trigger has aria-haspopup attribute', () => {
    renderDropdown();
    const trigger = screen.getByText('Actions');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('DropdownMenuLabel sets data-slot and merges className', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuLabel className="lbl-custom">Label</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const label = document.querySelector("[data-slot='dropdown-menu-label']");
    expect(label?.className).toContain('lbl-custom');
  });

  it('DropdownMenuLabel supports inset', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuLabel inset>Inset Label</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const label = document.querySelector("[data-slot='dropdown-menu-label']");
    expect(label).toHaveAttribute('data-inset', 'true');
  });

  it('DropdownMenuItem sets variant data attribute', () => {
    renderDropdown({ defaultOpen: true });
    const deleteItem = screen.getByText('Delete').closest("[data-slot='dropdown-menu-item']");
    expect(deleteItem).toHaveAttribute('data-variant', 'destructive');
  });

  it('DropdownMenuShortcut sets data-slot', () => {
    renderDropdown({ defaultOpen: true });
    const shortcut = screen.getByText('P').closest("[data-slot='dropdown-menu-shortcut']");
    expect(shortcut).toBeInTheDocument();
  });

  it('DropdownMenuSeparator sets data-slot', () => {
    renderDropdown({ defaultOpen: true });
    const separator = document.querySelector("[data-slot='dropdown-menu-separator']");
    expect(separator).toBeInTheDocument();
  });

  it('DropdownMenuContent merges custom className', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent className="my-menu">
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const content = document.querySelector("[data-slot='dropdown-menu-content']");
    expect(content?.className).toContain('my-menu');
  });
});
