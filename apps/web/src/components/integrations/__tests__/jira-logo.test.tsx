import { describe, expect, it } from 'vitest';
import { render } from '@/test/test-utils';
import { JiraLogo } from '../jira-logo';

describe('JiraLogo', () => {
  it('renders an SVG element', () => {
    const { container } = render(<JiraLogo />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('has aria-hidden attribute', () => {
    const { container } = render(<JiraLogo />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom className', () => {
    const { container } = render(<JiraLogo className="size-6" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('size-6')).toBe(true);
  });
});
