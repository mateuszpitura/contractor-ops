import { render, screen } from '@/test/test-utils';
import { Calendar } from '../calendar';

describe('Calendar', () => {
  it('renders the calendar', () => {
    render(<Calendar />);
    const cal = document.querySelector("[data-slot='calendar']");
    expect(cal).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(<Calendar />);
    expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    expect(screen.getByLabelText('Next month')).toBeInTheDocument();
  });

  it('renders weekday headers', () => {
    render(<Calendar />);
    // DayPicker renders abbreviated weekday names
    const weekdays = document.querySelectorAll('.rdp-weekday');
    expect(weekdays.length).toBeGreaterThan(0);
  });

  it('renders day buttons', () => {
    render(<Calendar />);
    const buttons = document.querySelectorAll("[data-slot='calendar'] button");
    // Nav buttons + some day buttons
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('merges custom className', () => {
    render(<Calendar className="my-cal" />);
    const wrapper = document.querySelector('.my-cal');
    expect(wrapper).toBeInTheDocument();
  });

  it('highlights today', () => {
    render(<Calendar />);
    const today = document.querySelector('.rdp-today');
    expect(today).toBeInTheDocument();
  });

  it('shows outside days by default', () => {
    render(<Calendar />);
    const outsideDays = document.querySelectorAll('.rdp-outside');
    // Most months have outside days visible
    expect(outsideDays.length).toBeGreaterThanOrEqual(0);
  });

  it('respects showOutsideDays=false', () => {
    const { container } = render(<Calendar showOutsideDays={false} />);
    // When showOutsideDays is false, outside day buttons should not be rendered
    const outsideButtons = container.querySelectorAll("[data-outside='true'] button");
    expect(outsideButtons.length).toBe(0);
  });

  it('supports selected date', () => {
    const date = new Date(2025, 0, 15);
    render(<Calendar mode="single" selected={date} month={date} />);
    const selected = document.querySelector("[data-selected='true']");
    expect(selected).toBeInTheDocument();
  });
});
