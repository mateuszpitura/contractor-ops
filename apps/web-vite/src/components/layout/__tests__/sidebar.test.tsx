/**
 * The web-vite AppSidebar composes three container components
 * (OrgSwitcherContainer, NavItemsContainer, UserMenuContainer) that each
 * pull tRPC + Better Auth + Sidebar context. We mock the containers to
 * keep this test focused on the shell composition — container behaviour
 * is covered by their own tests.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../org-switcher-container.js', () => ({
  OrgSwitcherContainer: () => <div data-testid="org-switcher">OrgSwitcher</div>,
}));

vi.mock('../nav-items-container.js', () => ({
  NavItemsContainer: () => <div data-testid="nav-items">NavItems</div>,
}));

vi.mock('../user-menu-container.js', () => ({
  UserMenuContainer: () => <div data-testid="user-menu">UserMenu</div>,
}));

vi.mock('@contractor-ops/ui/components/shadcn/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <nav data-testid="sidebar">{children}</nav>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  SidebarRail: () => null,
}));

import { AppSidebar } from '../sidebar.js';
import { mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AppSidebar (web-vite)', () => {
  it('renders sidebar with all three composed container slots', async () => {
    const { container } = await mount(<AppSidebar />);
    expect(container.querySelector('[data-testid="sidebar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="org-switcher"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-items"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="user-menu"]')).not.toBeNull();
  });
});
