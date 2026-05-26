import { render, screen, setup } from '../../../__tests__/test-utils.js';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog.js';

function renderDialog({
  defaultOpen = false,
  showCloseButton = true,
}: {
  defaultOpen?: boolean;
  showCloseButton?: boolean;
} = {}) {
  return setup(
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog description text.</DialogDescription>
        </DialogHeader>
        <p>Dialog body content</p>
        <DialogFooter>
          <DialogClose>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );
}

describe('Dialog', () => {
  it('renders the trigger', () => {
    renderDialog();
    expect(screen.getByText('Open Dialog')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderDialog();
    expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();
  });

  it('renders content when defaultOpen', () => {
    renderDialog({ defaultOpen: true });
    expect(screen.getByText('Dialog Title')).toBeInTheDocument();
    expect(screen.getByText('Dialog description text.')).toBeInTheDocument();
    expect(screen.getByText('Dialog body content')).toBeInTheDocument();
  });

  it('opens dialog on trigger click', async () => {
    const { user } = renderDialog();
    await user.click(screen.getByText('Open Dialog'));
    expect(screen.getByText('Dialog Title')).toBeInTheDocument();
  });

  it('renders close button with aria-label when showCloseButton is true', () => {
    renderDialog({ defaultOpen: true, showCloseButton: true });
    expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
  });

  it('does not render close button when showCloseButton is false', () => {
    renderDialog({ defaultOpen: true, showCloseButton: false });
    expect(screen.queryByLabelText('Close dialog')).not.toBeInTheDocument();
  });

  it('DialogHeader merges custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader className="my-header">
            <DialogTitle>T</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    const header = document.querySelector("[data-slot='dialog-header']");
    expect(header?.className).toContain('my-header');
  });

  it('DialogFooter merges custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogFooter className="my-footer">
            <button type="button">OK</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const footer = document.querySelector("[data-slot='dialog-footer']");
    expect(footer?.className).toContain('my-footer');
  });

  it('DialogTitle sets data-slot', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Test Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(
      screen.getByText('Test Title').closest("[data-slot='dialog-title']"),
    ).toBeInTheDocument();
  });

  it('DialogContent merges custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent className="custom-dialog">
          <DialogTitle>T</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const content = document.querySelector("[data-slot='dialog-content']");
    expect(content?.className).toContain('custom-dialog');
  });

  it('DialogFooter can render a close button via showCloseButton prop', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogFooter showCloseButton>
            <button type="button">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});
