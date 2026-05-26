import { describe, expect, it } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils.js';
import { Bdi } from '../bdi.js';

describe('Bdi', () => {
  it('renders a <bdi> element', () => {
    render(<Bdi data-testid="bdi-el">Test</Bdi>);
    const el = screen.getByTestId('bdi-el');
    expect(el.tagName).toBe('BDI');
  });

  it('renders children', () => {
    render(<Bdi>Hello World</Bdi>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('passes className through', () => {
    render(
      <Bdi className="text-bold" data-testid="bdi-el">
        Styled
      </Bdi>,
    );
    const el = screen.getByTestId('bdi-el');
    expect(el.className).toContain('text-bold');
  });

  it('forwards additional HTML attributes', () => {
    render(
      <Bdi data-testid="bdi-el" dir="rtl">
        RTL text
      </Bdi>,
    );
    const el = screen.getByTestId('bdi-el');
    expect(el).toHaveAttribute('dir', 'rtl');
  });

  it('renders nested elements as children', () => {
    render(
      <Bdi>
        <span data-testid="inner">Nested</span>
      </Bdi>,
    );
    expect(screen.getByTestId('inner')).toBeInTheDocument();
  });
});
