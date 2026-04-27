import { render, screen, setup } from '@/test/test-utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '../sidebar';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

function renderSidebar({ defaultOpen = true }: { defaultOpen?: boolean } = {}) {
  return setup(
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar>
        <SidebarHeader>
          <span>Logo</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>Dashboard</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    Settings
                    <SidebarMenuBadge>3</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <span>Footer</span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
        <main>Main content</main>
      </SidebarInset>
    </SidebarProvider>,
  );
}

describe('SidebarProvider', () => {
  it('renders children', () => {
    renderSidebar();
    expect(screen.getByText('Main content')).toBeInTheDocument();
  });

  it('sets data-slot on wrapper', () => {
    renderSidebar();
    const wrapper = document.querySelector("[data-slot='sidebar-wrapper']");
    expect(wrapper).toBeInTheDocument();
  });

  it('renders wrapper with the group/sidebar-wrapper class for Tailwind var targeting', () => {
    renderSidebar();
    const wrapper = document.querySelector("[data-slot='sidebar-wrapper']") as HTMLElement;
    expect(wrapper.className).toContain('group/sidebar-wrapper');
  });
});

describe('Sidebar', () => {
  it('renders sidebar content', () => {
    renderSidebar();
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('sets data-slot on sidebar', () => {
    renderSidebar();
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).toBeInTheDocument();
  });

  it('sets data-state to expanded when open', () => {
    renderSidebar({ defaultOpen: true });
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
  });

  it('sets data-state to collapsed when closed', () => {
    renderSidebar({ defaultOpen: false });
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  });

  it('renders non-collapsible sidebar without state', () => {
    render(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <span>Static sidebar</span>
        </Sidebar>
      </SidebarProvider>,
    );
    expect(screen.getByText('Static sidebar')).toBeInTheDocument();
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).not.toHaveAttribute('data-state');
  });
});

describe('SidebarHeader', () => {
  it('sets data-slot', () => {
    renderSidebar();
    const header = document.querySelector("[data-slot='sidebar-header']");
    expect(header).toBeInTheDocument();
  });
});

describe('SidebarFooter', () => {
  it('sets data-slot', () => {
    renderSidebar();
    const footer = document.querySelector("[data-slot='sidebar-footer']");
    expect(footer).toBeInTheDocument();
  });
});

describe('SidebarContent', () => {
  it('sets data-slot', () => {
    renderSidebar();
    const content = document.querySelector("[data-slot='sidebar-content']");
    expect(content).toBeInTheDocument();
  });
});

describe('SidebarGroup', () => {
  it('sets data-slot', () => {
    renderSidebar();
    const group = document.querySelector("[data-slot='sidebar-group']");
    expect(group).toBeInTheDocument();
  });
});

describe('SidebarGroupLabel', () => {
  it('renders label text', () => {
    renderSidebar();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });
});

describe('SidebarMenu', () => {
  it('sets data-slot', () => {
    renderSidebar();
    const menu = document.querySelector("[data-slot='sidebar-menu']");
    expect(menu).toBeInTheDocument();
  });
});

describe('SidebarMenuItem', () => {
  it('sets data-slot', () => {
    renderSidebar();
    const items = document.querySelectorAll("[data-slot='sidebar-menu-item']");
    expect(items.length).toBe(2);
  });
});

describe('SidebarMenuButton', () => {
  it('renders button text', () => {
    renderSidebar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});

describe('SidebarMenuBadge', () => {
  it('renders badge content', () => {
    renderSidebar();
    expect(screen.getByText('3')).toBeInTheDocument();
    const badge = document.querySelector("[data-slot='sidebar-menu-badge']");
    expect(badge).toBeInTheDocument();
  });
});

describe('SidebarSeparator', () => {
  it('sets data-slot', () => {
    renderSidebar();
    const sep = document.querySelector("[data-slot='sidebar-separator']");
    expect(sep).toBeInTheDocument();
  });
});

describe('SidebarInset', () => {
  it('sets data-slot on main element', () => {
    renderSidebar();
    const inset = document.querySelector("[data-slot='sidebar-inset']");
    expect(inset).toBeInTheDocument();
    expect(inset?.tagName).toBe('MAIN');
  });
});

describe('SidebarTrigger', () => {
  it('renders toggle button with sr-only text', () => {
    renderSidebar();
    expect(screen.getByText('Toggle sidebar')).toBeInTheDocument();
  });

  it('sets data-slot on trigger', () => {
    renderSidebar();
    const trigger = document.querySelector("[data-slot='sidebar-trigger']");
    expect(trigger).toBeInTheDocument();
  });
});

describe('SidebarMenuSkeleton', () => {
  it('renders skeleton with data-slot', () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    const skeleton = document.querySelector("[data-slot='sidebar-menu-skeleton']");
    expect(skeleton).toBeInTheDocument();
  });

  it('renders icon skeleton when showIcon is true', () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    const iconSkeleton = document.querySelector("[data-sidebar='menu-skeleton-icon']");
    expect(iconSkeleton).toBeInTheDocument();
  });
});

describe('useSidebar', () => {
  it('throws when used outside SidebarProvider', () => {
    function BadComponent() {
      useSidebar();
      return null;
    }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => render(<BadComponent />)).toThrow(
        'useSidebar must be used within a SidebarProvider.',
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe('Sidebar collapsed state', () => {
  it('renders wrapper regardless of open/closed state', () => {
    renderSidebar({ defaultOpen: false });
    const wrapper = document.querySelector("[data-slot='sidebar-wrapper']") as HTMLElement;
    expect(wrapper).toBeInTheDocument();
  });

  it('sidebar is collapsed when defaultOpen is false', () => {
    renderSidebar({ defaultOpen: false });
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  });

  it('menu items are still in DOM when collapsed', () => {
    renderSidebar({ defaultOpen: false });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});

describe('SidebarTrigger toggle', () => {
  it('clicking trigger toggles sidebar state', async () => {
    const { user } = renderSidebar({ defaultOpen: true });
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    const triggerBtn = screen.getByRole('button', { name: /toggle sidebar/i });
    await user.click(triggerBtn);
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  });

  it('clicking trigger twice returns to expanded', async () => {
    const { user } = renderSidebar({ defaultOpen: true });
    const sidebar = document.querySelector("[data-slot='sidebar']");
    const triggerBtn = screen.getByRole('button', { name: /toggle sidebar/i });
    await user.click(triggerBtn);
    await user.click(triggerBtn);
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
  });
});

describe('SidebarGroupContent', () => {
  it('sets data-slot on group content', () => {
    renderSidebar();
    const content = document.querySelector("[data-slot='sidebar-group-content']");
    expect(content).toBeInTheDocument();
  });
});

describe('SidebarMenuButton variants', () => {
  it('renders menu button with data-slot', () => {
    renderSidebar();
    const buttons = document.querySelectorAll("[data-slot='sidebar-menu-button']");
    expect(buttons.length).toBe(2);
  });
});

describe('SidebarProvider controlled open', () => {
  it('supports controlled open prop', () => {
    const onOpenChange = vi.fn();
    render(
      <SidebarProvider open={true} onOpenChange={onOpenChange}>
        <Sidebar>
          <SidebarContent>
            <span>Content</span>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>,
    );
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
  });

  it('calls onOpenChange when controlled and trigger is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <SidebarProvider open={true} onOpenChange={onOpenChange}>
        <Sidebar>
          <SidebarContent>
            <span>Content</span>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>,
    );
    const triggerBtn = screen.getByRole('button', { name: /toggle sidebar/i });
    await user.click(triggerBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('SidebarRail', () => {
  it('renders rail with toggle sidebar aria label', () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <span>Content</span>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
      </SidebarProvider>,
    );
    const rail = document.querySelector("[data-slot='sidebar-rail']");
    expect(rail).toBeInTheDocument();
    expect(rail).toHaveAttribute('aria-label', 'Toggle sidebar');
  });

  it('toggles sidebar when rail is clicked', async () => {
    const { user } = setup(
      <SidebarProvider defaultOpen={true}>
        <Sidebar>
          <SidebarContent>
            <span>Content</span>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
      </SidebarProvider>,
    );
    const rail = document.querySelector("[data-slot='sidebar-rail']") as HTMLElement;
    await user.click(rail);
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  });
});

describe('SidebarInput', () => {
  it('renders input with data-slot', () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <SidebarInput placeholder="Search..." />
          </SidebarHeader>
        </Sidebar>
      </SidebarProvider>,
    );
    const input = document.querySelector("[data-slot='sidebar-input']");
    expect(input).toBeInTheDocument();
  });
});

describe('SidebarMenuSub', () => {
  it('renders menu sub with data-slot', () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Parent</SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>Child</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    const sub = document.querySelector("[data-slot='sidebar-menu-sub']");
    expect(sub).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });
});

describe('SidebarTrigger onClick passthrough', () => {
  it('calls custom onClick in addition to toggling', async () => {
    const customClick = vi.fn();
    const { user } = setup(
      <SidebarProvider defaultOpen={true}>
        <Sidebar>
          <SidebarContent>
            <span>Content</span>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger onClick={customClick} />
        </SidebarInset>
      </SidebarProvider>,
    );
    const triggerBtn = screen.getByRole('button', { name: /toggle sidebar/i });
    await user.click(triggerBtn);
    expect(customClick).toHaveBeenCalledTimes(1);
    const sidebar = document.querySelector("[data-slot='sidebar']");
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  });
});

describe('Sidebar variants', () => {
  it('renders floating variant with data-variant', () => {
    render(
      <SidebarProvider>
        <Sidebar variant="floating">
          <SidebarContent>
            <span>Float</span>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    const sidebar = document.querySelector("[data-variant='floating']");
    expect(sidebar).toBeInTheDocument();
  });

  it('renders inset variant with data-variant', () => {
    render(
      <SidebarProvider>
        <Sidebar variant="inset">
          <SidebarContent>
            <span>Inset</span>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    const sidebar = document.querySelector("[data-variant='inset']");
    expect(sidebar).toBeInTheDocument();
  });

  it('renders right side with data-side', () => {
    render(
      <SidebarProvider>
        <Sidebar side="right">
          <SidebarContent>
            <span>Right</span>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    const sidebar = document.querySelector("[data-side='right']");
    expect(sidebar).toBeInTheDocument();
  });
});
