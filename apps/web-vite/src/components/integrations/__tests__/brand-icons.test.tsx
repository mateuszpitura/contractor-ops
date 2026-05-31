import { describe, expect, it } from 'vitest';
import { render } from '@/test/test-utils';
import {
  ConfluenceBrandIcon,
  GoogleCalendarBrandIcon,
  JiraBrandIcon,
  LinearBrandIcon,
  NotionBrandIcon,
  OutlookCalendarBrandIcon,
  SlackBrandIcon,
} from '../brand-icons';

/**
 * Web-vite brand icons are mostly `<img>` from public/logos/. Only
 * LinearBrandIcon uses an inline `<svg>` (the Linear logo mark).
 */
describe('BrandIcons', () => {
  it('renders SlackBrandIcon as img with aria-hidden', () => {
    const { container } = render(<SlackBrandIcon />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('src', '/logos/slack.svg');
  });

  it('renders JiraBrandIcon as img with aria-hidden', () => {
    const { container } = render(<JiraBrandIcon />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('src', '/logos/jira.svg');
  });

  it('renders LinearBrandIcon as svg with aria-hidden', () => {
    const { container } = render(<LinearBrandIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders GoogleCalendarBrandIcon as img', () => {
    const { container } = render(<GoogleCalendarBrandIcon />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/logos/google-calendar.svg');
  });

  it('renders NotionBrandIcon as img', () => {
    const { container } = render(<NotionBrandIcon />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/logos/notion.svg');
  });

  it('renders ConfluenceBrandIcon as img', () => {
    const { container } = render(<ConfluenceBrandIcon />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/logos/confluence.svg');
  });

  it('renders OutlookCalendarBrandIcon as img', () => {
    const { container } = render(<OutlookCalendarBrandIcon />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/logos/microsoft-outlook.svg');
  });

  it('applies custom className to SlackBrandIcon', () => {
    const { container } = render(<SlackBrandIcon className="custom-class" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('custom-class');
  });

  it('applies custom className to JiraBrandIcon', () => {
    const { container } = render(<JiraBrandIcon className="size-8" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('size-8');
  });

  it('applies custom className to LinearBrandIcon', () => {
    const { container } = render(<LinearBrandIcon className="size-6" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('size-6')).toBe(true);
  });
});
