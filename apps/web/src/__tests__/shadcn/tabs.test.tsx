import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  tabsListVariants,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { render, screen, setup } from '@/test/test-utils';

function renderTabs({ defaultValue = 'tab1' }: { defaultValue?: string } = {}) {
  return setup(
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3" disabled>
          Tab 3
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
      <TabsContent value="tab3">Content 3</TabsContent>
    </Tabs>,
  );
}

describe('Tabs', () => {
  it('renders all tab triggers', () => {
    renderTabs();
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();
  });

  it('renders active tab content by default', () => {
    renderTabs();
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('switches content on tab click', async () => {
    const { user } = renderTabs();
    await user.click(screen.getByText('Tab 2'));
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('sets data-slot on tabs container', () => {
    renderTabs();
    const tabs = document.querySelector("[data-slot='tabs']");
    expect(tabs).toBeInTheDocument();
  });

  it('sets data-slot on tabs list', () => {
    renderTabs();
    const list = document.querySelector("[data-slot='tabs-list']");
    expect(list).toBeInTheDocument();
  });

  it('sets data-slot on tab trigger', () => {
    renderTabs();
    const trigger = document.querySelector("[data-slot='tabs-trigger']");
    expect(trigger).toBeInTheDocument();
  });

  it('sets data-slot on tab content', () => {
    renderTabs();
    const content = document.querySelector("[data-slot='tabs-content']");
    expect(content).toBeInTheDocument();
  });

  it('Tabs merges custom className', () => {
    render(
      <Tabs defaultValue="a" className="custom-tabs">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A content</TabsContent>
      </Tabs>,
    );
    const tabs = document.querySelector("[data-slot='tabs']");
    expect(tabs?.className).toContain('custom-tabs');
  });

  it('TabsList emits data-variant=default', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A content</TabsContent>
      </Tabs>,
    );
    const list = document.querySelector("[data-slot='tabs-list']");
    expect(list).toHaveAttribute('data-variant', 'default');
  });

  it('TabsTrigger supports disabled', () => {
    renderTabs();
    const tab3 = screen.getByText('Tab 3');
    expect(tab3).toHaveAttribute('aria-disabled', 'true');
  });

  it('sets data-orientation on tabs', () => {
    render(
      <Tabs defaultValue="a" orientation="vertical">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content</TabsContent>
      </Tabs>,
    );
    const tabs = document.querySelector("[data-slot='tabs']");
    expect(tabs).toHaveAttribute('data-orientation', 'vertical');
  });

  it('exports tabsListVariants', () => {
    expect(typeof tabsListVariants).toBe('function');
    const classes = tabsListVariants({ variant: 'default' });
    expect(classes).toContain('bg-muted/50');
  });
});
