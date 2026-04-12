import { afterAll, beforeAll, beforeEach } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { CopyableField } from '../copyable-field';

// jsdom provides a built-in navigator.clipboard that cannot be easily overridden.
// We spy on the existing implementation instead.
const writeTextSpy = vi.fn().mockResolvedValue(undefined);

beforeAll(() => {
  // In jsdom, navigator.clipboard may not exist; polyfill it for the test
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });
  } else {
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeTextSpy);
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  writeTextSpy.mockClear();
});

describe('CopyableField', () => {
  it('renders the value in a mono span', () => {
    render(<CopyableField value="ABC-123" ariaLabel="Copy ID" />);
    expect(screen.getByText('ABC-123')).toBeInTheDocument();
  });

  it('has the correct aria-label on the button', () => {
    render(<CopyableField value="test" ariaLabel="Copy code" />);
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<CopyableField value="x" ariaLabel="Copy" />);
    const btn = screen.getByRole('button', { name: 'Copy' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('applies custom className', () => {
    render(<CopyableField value="v" ariaLabel="Copy" className="custom" />);
    const btn = screen.getByRole('button', { name: 'Copy' });
    expect(btn.className).toContain('custom');
  });

  it('is clickable without throwing', async () => {
    const { user } = setup(<CopyableField value="click-test" ariaLabel="Copy" />);
    // Should not throw regardless of clipboard availability
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.getByText('click-test')).toBeInTheDocument();
  });
});
