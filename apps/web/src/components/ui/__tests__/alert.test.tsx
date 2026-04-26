import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { Alert, AlertDescription, AlertTitle } from '../alert';

describe('Alert', () => {
  it('renders with role="alert"', () => {
    render(<Alert>Content</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Alert>Alert content</Alert>);
    expect(screen.getByText('Alert content')).toBeInTheDocument();
  });

  it('applies default variant classes', () => {
    render(<Alert>Default</Alert>);
    const el = screen.getByRole('alert');
    expect(el.className).toContain('bg-background');
  });

  it('applies destructive variant classes', () => {
    render(<Alert variant="destructive">Error</Alert>);
    const el = screen.getByRole('alert');
    expect(el.className).toContain('border-destructive');
  });

  it('merges custom className', () => {
    render(<Alert className="my-custom">Custom</Alert>);
    const el = screen.getByRole('alert');
    expect(el.className).toContain('my-custom');
  });
});

describe('AlertTitle', () => {
  it('renders as an h5 element', () => {
    render(<AlertTitle>Title</AlertTitle>);
    const el = screen.getByText('Title');
    expect(el.tagName).toBe('H5');
  });

  it('renders title text', () => {
    render(<AlertTitle>Warning Title</AlertTitle>);
    expect(screen.getByText('Warning Title')).toBeInTheDocument();
  });
});

describe('AlertDescription', () => {
  it('renders as a div element', () => {
    render(<AlertDescription>Description text</AlertDescription>);
    const el = screen.getByText('Description text');
    expect(el.tagName).toBe('DIV');
  });

  it('renders description text', () => {
    render(<AlertDescription>Something went wrong.</AlertDescription>);
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });
});
