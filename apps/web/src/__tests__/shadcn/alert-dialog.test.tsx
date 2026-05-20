import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { render, screen, setup } from '@/test/test-utils';

function renderAlertDialog({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  return setup(
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger>Open Alert</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );
}

describe('AlertDialog', () => {
  it('renders the trigger button', () => {
    renderAlertDialog();
    expect(screen.getByText('Open Alert')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderAlertDialog();
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('renders content when defaultOpen is true', () => {
    renderAlertDialog({ defaultOpen: true });
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', async () => {
    const { user } = renderAlertDialog();
    await user.click(screen.getByText('Open Alert'));
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders action and cancel buttons in footer', () => {
    renderAlertDialog({ defaultOpen: true });
    expect(screen.getByText('Continue')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('sets data-slot attributes on subcomponents', () => {
    renderAlertDialog({ defaultOpen: true });
    expect(
      screen.getByText('Are you sure?').closest("[data-slot='alert-dialog-title']"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText('This action cannot be undone.')
        .closest("[data-slot='alert-dialog-description']"),
    ).toBeInTheDocument();
  });

  it('AlertDialogHeader merges custom className', () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader className="custom-header">
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const header = document.querySelector("[data-slot='alert-dialog-header']");
    expect(header?.className).toContain('custom-header');
  });

  it('AlertDialogFooter merges custom className', () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogFooter className="custom-footer">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const footer = document.querySelector("[data-slot='alert-dialog-footer']");
    expect(footer?.className).toContain('custom-footer');
  });

  it('AlertDialogContent accepts size prop', () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent size="sm">
          <AlertDialogTitle>Small</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const content = document.querySelector("[data-slot='alert-dialog-content']");
    expect(content).toHaveAttribute('data-size', 'sm');
  });

  it('AlertDialogMedia sets data-slot', () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="media-class">Icon</AlertDialogMedia>
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const media = document.querySelector("[data-slot='alert-dialog-media']");
    expect(media).toBeInTheDocument();
    expect(media?.className).toContain('media-class');
  });

  it('AlertDialogAction fires onClick', async () => {
    const onClick = vi.fn();
    const { user } = setup(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogAction onClick={onClick}>Do it</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await user.click(screen.getByText('Do it'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
