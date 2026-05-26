import { describe, expect, it } from 'vitest';
import { render } from '@/test/test-utils';
import { JiraLogo } from '../jira-logo';

/**
 * Web-vite JiraLogo is `<img>`-based (see `JiraBrandIcon` in brand-icons.tsx),
 * not the inline `<svg>` of legacy `apps/web`.
 */
describe('JiraLogo', () => {
  it('renders an img element pointing at the brand asset', () => {
    const { container } = render(<JiraLogo />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/logos/jira.svg');
  });

  it('has aria-hidden attribute', () => {
    const { container } = render(<JiraLogo />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom className', () => {
    const { container } = render(<JiraLogo className="size-6" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('size-6');
  });
});
