import { render, screen } from '@/test/test-utils';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../breadcrumb';

function renderBreadcrumb() {
  return render(
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/products">Products</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Current Page</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>,
  );
}

describe('Breadcrumb', () => {
  it('renders as nav with aria-label', () => {
    renderBreadcrumb();
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
  });

  it('renders breadcrumb links', () => {
    renderBreadcrumb();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('renders the current page', async () => {
    renderBreadcrumb();
    const page = screen.getByText('Current Page');
    await expect(page).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveAttribute('aria-disabled', 'true');
  });

  it('sets data-slot on breadcrumb', () => {
    renderBreadcrumb();
    const nav = document.querySelector("[data-slot='breadcrumb']");
    expect(nav).toBeInTheDocument();
  });

  it('sets data-slot on list', () => {
    renderBreadcrumb();
    const list = document.querySelector("[data-slot='breadcrumb-list']");
    expect(list).toBeInTheDocument();
  });

  it('sets data-slot on items', () => {
    renderBreadcrumb();
    const items = document.querySelectorAll("[data-slot='breadcrumb-item']");
    expect(items.length).toBe(3);
  });

  it('separators are marked as presentation and hidden', () => {
    renderBreadcrumb();
    const seps = document.querySelectorAll("[data-slot='breadcrumb-separator']");
    expect(seps.length).toBe(2);
    for (const sep of seps) {
      expect(sep).toHaveAttribute('role', 'presentation');
      expect(sep).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('BreadcrumbSeparator renders custom children', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('BreadcrumbEllipsis renders with sr-only text', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByText('More')).toBeInTheDocument();
    const ellipsis = document.querySelector("[data-slot='breadcrumb-ellipsis']");
    expect(ellipsis).toHaveAttribute('aria-hidden', 'true');
  });

  it('BreadcrumbPage sets data-slot', () => {
    renderBreadcrumb();
    const page = document.querySelector("[data-slot='breadcrumb-page']");
    expect(page).toBeInTheDocument();
  });

  it('Breadcrumb merges custom className', () => {
    render(
      <Breadcrumb className="my-nav">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Test</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    const nav = document.querySelector("[data-slot='breadcrumb']");
    expect(nav?.className).toContain('my-nav');
  });

  it('BreadcrumbList merges custom className', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList className="my-list">
          <BreadcrumbItem>
            <BreadcrumbPage>Test</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    const list = document.querySelector("[data-slot='breadcrumb-list']");
    expect(list?.className).toContain('my-list');
  });
});
