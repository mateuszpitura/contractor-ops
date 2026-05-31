import { describe, expect, it } from 'vitest';
import { render } from '@/test/test-utils';
import {
  ConfluenceIcon,
  GoogleCalendarIcon,
  LinearIcon,
  NotionIcon,
  OutlookCalendarIcon,
} from '../provider-icons';

/**
 * Provider icons re-export brand icons. In web-vite most resolve to `<img>`
 * elements (LinearIcon is the svg-based exception — an inline Linear logo svg).
 */
describe('ProviderIcons (re-exports from brand-icons)', () => {
  it('renders GoogleCalendarIcon as img', () => {
    const { container } = render(<GoogleCalendarIcon />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('renders LinearIcon as svg', () => {
    const { container } = render(<LinearIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders NotionIcon as img', () => {
    const { container } = render(<NotionIcon />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('renders ConfluenceIcon as img', () => {
    const { container } = render(<ConfluenceIcon />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('renders OutlookCalendarIcon as img', () => {
    const { container } = render(<OutlookCalendarIcon />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('applies className to img-based icon', () => {
    const { container } = render(<NotionIcon className="test-cls" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('test-cls');
  });

  it('applies className to svg-based icon', () => {
    const { container } = render(<LinearIcon className="test-svg-cls" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('test-svg-cls')).toBe(true);
  });
});
