import { render, screen } from '../../../__tests__/test-utils.js';
import { Progress } from '../progress.js';

describe('Progress', () => {
  it('renders a progressbar', () => {
    render(<Progress value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets data-slot=progress', () => {
    render(<Progress value={50} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-slot', 'progress');
  });

  it('sets aria-valuenow to the provided value', () => {
    render(<Progress value={75} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('sets aria-valuemin and aria-valuemax', () => {
    render(<Progress value={30} />);
    const el = screen.getByRole('progressbar');
    expect(el).toHaveAttribute('aria-valuemin', '0');
    expect(el).toHaveAttribute('aria-valuemax', '100');
  });

  it('handles value=0', () => {
    render(<Progress value={0} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('handles value=100', () => {
    render(<Progress value={100} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('merges custom className', () => {
    render(<Progress value={50} className="mt-4" />);
    expect(screen.getByRole('progressbar').className).toContain('mt-4');
  });

  it('renders children alongside the track', () => {
    render(<Progress value={50}>Loading...</Progress>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
