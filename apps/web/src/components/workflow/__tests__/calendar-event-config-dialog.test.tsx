import { render, screen, setup } from '@/test/test-utils';
import { CalendarEventConfigDialog } from '../calendar-event-config-dialog';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const defaultConfig = {
  calendarEnabled: true,
  titleTemplate: 'Meeting: {task}',
  duration: '1h' as const,
  attendees: ['user@test.com'],
};

describe('CalendarEventConfigDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CalendarEventConfigDialog
        taskTemplateId="t1"
        config={defaultConfig}
        open={false}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(container.querySelector("[role='dialog']")).not.toBeInTheDocument();
  });

  it('renders dialog content when open', () => {
    render(
      <CalendarEventConfigDialog
        taskTemplateId="t1"
        config={defaultConfig}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Calendar Event')).toBeInTheDocument();
    expect(screen.getByText('Event Title')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Attendees')).toBeInTheDocument();
  });

  it('calls onSave with parsed config on save', async () => {
    const onSave = vi.fn();
    const { user } = setup(
      <CalendarEventConfigDialog
        taskTemplateId="t1"
        config={defaultConfig}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByText('Save Event Config'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarEnabled: true,
        duration: '1h',
      }),
    );
  });

  it('renders cancel button', () => {
    render(
      <CalendarEventConfigDialog
        taskTemplateId="t1"
        config={defaultConfig}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});
