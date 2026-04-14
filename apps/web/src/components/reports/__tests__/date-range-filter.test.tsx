import userEvent from '@testing-library/user-event';
import { render, screen, setup, waitFor, within } from '@/test/test-utils';
import { DateRangeFilter } from '../date-range-filter';

describe('DateRangeFilter', () => {
  const defaultProps = {
    dateFrom: '2025-01-01T00:00:00.000Z',
    dateTo: '2025-03-31T23:59:59.000Z',
    onDateChange: vi.fn(),
  };

  it('renders all preset buttons', () => {
    render(<DateRangeFilter {...defaultProps} />);
    expect(screen.getByText('This month')).toBeInTheDocument();
    expect(screen.getByText('Last 3 months')).toBeInTheDocument();
    expect(screen.getByText('Last 6 months')).toBeInTheDocument();
    expect(screen.getByText('Year to date')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('calls onDateChange when a preset is clicked', async () => {
    const onDateChange = vi.fn();
    const { user } = setup(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    await user.click(screen.getByText('This month'));
    expect(onDateChange).toHaveBeenCalledTimes(1);
    const [from, to] = onDateChange.mock.calls[0];
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
  });

  it('calls onDateChange when Year to date is clicked', async () => {
    const onDateChange = vi.fn();
    const { user } = setup(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    await user.click(screen.getByText('Year to date'));
    expect(onDateChange).toHaveBeenCalledTimes(1);
  });

  it('calls onDateChange when Last 6 months is clicked', async () => {
    const onDateChange = vi.fn();
    const { user } = setup(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    await user.click(screen.getByText('Last 6 months'));
    expect(onDateChange).toHaveBeenCalledTimes(1);
    const [from, to] = onDateChange.mock.calls[0];
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
  });

  it('calls onDateChange when Last 3 months is clicked', async () => {
    const onDateChange = vi.fn();
    const { user } = setup(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    await user.click(screen.getByText('Last 3 months'));
    expect(onDateChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onDateChange when Custom is clicked; opens the calendar popover', async () => {
    const onDateChange = vi.fn();
    const { user } = setup(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    await user.click(screen.getByText('Custom'));
    expect(onDateChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    });
  });

  it('shows formatted range on the Custom trigger when custom is active and both dates are set', async () => {
    const { user } = setup(<DateRangeFilter {...defaultProps} />);
    await user.click(screen.getByText('Custom'));
    await waitFor(() => {
      expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    });
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
  });

  it('calls onDateChange and closes the popover after selecting a full date range in the calendar', async () => {
    const onDateChange = vi.fn();
    // pointerEventsCheck=0 disables the jsdom pointer-events: none check that
    // triggers on base-ui Calendar day buttons when not focused.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<DateRangeFilter {...defaultProps} onDateChange={onDateChange} />);
    await user.click(screen.getByText('Custom'));
    const calendar = await waitFor(() => {
      const el = document.querySelector('[data-slot="calendar"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    const dayButtons = within(calendar)
      .getAllByRole('button')
      .filter((el): el is HTMLButtonElement => {
        const b = el as HTMLButtonElement;
        return b.hasAttribute('data-day') && !b.disabled;
      });
    expect(dayButtons.length).toBeGreaterThan(10);
    await user.click(dayButtons[5]);
    await user.click(dayButtons[20]);
    expect(onDateChange).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByLabelText('Previous month')).not.toBeInTheDocument();
    });
  });
});
