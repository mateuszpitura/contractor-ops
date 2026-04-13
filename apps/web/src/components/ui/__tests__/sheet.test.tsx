import { render, screen, setup } from '@/test/test-utils';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../sheet';

function renderSheet({
  defaultOpen = false,
  side = 'right' as const,
  showCloseButton = true,
}: {
  defaultOpen?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  showCloseButton?: boolean;
} = {}) {
  return setup(
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger>Open Sheet</SheetTrigger>
      <SheetContent side={side} showCloseButton={showCloseButton}>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>Sheet description.</SheetDescription>
        </SheetHeader>
        <p>Sheet body</p>
        <SheetFooter>
          <SheetClose>Done</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>,
  );
}

describe('Sheet', () => {
  it('renders the trigger', () => {
    renderSheet();
    expect(screen.getByText('Open Sheet')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderSheet();
    expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument();
  });

  it('renders content when defaultOpen', () => {
    renderSheet({ defaultOpen: true });
    expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    expect(screen.getByText('Sheet description.')).toBeInTheDocument();
    expect(screen.getByText('Sheet body')).toBeInTheDocument();
  });

  it('opens sheet on trigger click', async () => {
    const { user } = renderSheet();
    await user.click(screen.getByText('Open Sheet'));
    expect(screen.getByText('Sheet Title')).toBeInTheDocument();
  });

  it('renders close button with aria-label', () => {
    renderSheet({ defaultOpen: true });
    expect(screen.getByLabelText('Close panel')).toBeInTheDocument();
  });

  it('hides close button when showCloseButton is false', () => {
    renderSheet({ defaultOpen: true, showCloseButton: false });
    expect(screen.queryByLabelText('Close panel')).not.toBeInTheDocument();
  });

  it('sets data-side attribute on content', () => {
    renderSheet({ defaultOpen: true, side: 'left' });
    const content = document.querySelector("[data-slot='sheet-content']");
    expect(content).toHaveAttribute('data-side', 'left');
  });

  it('defaults side to right', () => {
    renderSheet({ defaultOpen: true });
    const content = document.querySelector("[data-slot='sheet-content']");
    expect(content).toHaveAttribute('data-side', 'right');
  });

  it('SheetHeader merges custom className', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetHeader className="custom-hdr">
            <SheetTitle>T</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    const header = document.querySelector("[data-slot='sheet-header']");
    expect(header?.className).toContain('custom-hdr');
  });

  it('SheetFooter merges custom className', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetFooter className="custom-ftr">
            <button type="button">OK</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );
    const footer = document.querySelector("[data-slot='sheet-footer']");
    expect(footer?.className).toContain('custom-ftr');
  });

  it('SheetTitle sets data-slot', () => {
    renderSheet({ defaultOpen: true });
    const title = screen.getByText('Sheet Title').closest("[data-slot='sheet-title']");
    expect(title).toBeInTheDocument();
  });

  it('SheetDescription sets data-slot', () => {
    renderSheet({ defaultOpen: true });
    const desc = screen.getByText('Sheet description.').closest("[data-slot='sheet-description']");
    expect(desc).toBeInTheDocument();
  });
});
