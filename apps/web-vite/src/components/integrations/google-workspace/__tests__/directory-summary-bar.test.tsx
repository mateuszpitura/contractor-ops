import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';
import { DirectorySummaryBar } from '../directory-summary-bar';

describe('DirectorySummaryBar', () => {
  it('renders an aria-live polite status region', () => {
    const { container } = render(
      <DirectorySummaryBar total={10} alreadyImported={3} newUsers={7} selected={0} />,
    );
    const status = container.querySelector('[role="status"]');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('renders the total count text', () => {
    render(<DirectorySummaryBar total={10} alreadyImported={3} newUsers={7} selected={0} />);
    expect(screen.getByText(/10 users found/)).toBeInTheDocument();
  });

  it('renders the already-imported and new-user totals', () => {
    render(<DirectorySummaryBar total={10} alreadyImported={3} newUsers={7} selected={0} />);
    expect(screen.getByText(/3 already imported/)).toBeInTheDocument();
    expect(screen.getByText(/7 new/)).toBeInTheDocument();
  });

  it('omits the selected segment when selected is zero', () => {
    render(<DirectorySummaryBar total={10} alreadyImported={3} newUsers={7} selected={0} />);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('renders the selected segment when selected > 0', () => {
    render(<DirectorySummaryBar total={10} alreadyImported={3} newUsers={7} selected={4} />);
    expect(screen.getByText(/4 selected/)).toBeInTheDocument();
  });
});
