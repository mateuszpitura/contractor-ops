import { describe, expect, it } from 'vitest';
import { render } from '@/test/test-utils';
import { TeamsLogo } from '../teams-logo';

/**
 * Web-vite TeamsLogo is `<img>`-based (see `TeamsBrandIcon` in brand-icons.tsx),
 * not the inline `<svg>` of legacy `apps/web`. Assertions target the rendered
 * `<img>` instead.
 */
describe('TeamsLogo', () => {
  it('renders an img element pointing at the brand asset', () => {
    const { container } = render(<TeamsLogo />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/logos/microsoft-teams.svg');
  });

  it('has aria-hidden attribute', () => {
    const { container } = render(<TeamsLogo />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the Microsoft Teams alt text', () => {
    const { container } = render(<TeamsLogo />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', 'Microsoft Teams');
  });

  it('applies custom className to the img', () => {
    const { container } = render(<TeamsLogo className="size-8" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('size-8');
  });
});
