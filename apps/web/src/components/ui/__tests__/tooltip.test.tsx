import { screen, setup, waitFor } from '@/test/test-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';

function renderTooltip(content = 'Tooltip text') {
  return setup(
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe('Tooltip', () => {
  it('renders the trigger', () => {
    renderTooltip();
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('does not show content by default', () => {
    renderTooltip();
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
  });

  it('shows content on hover', async () => {
    const { user } = renderTooltip();
    await user.hover(screen.getByText('Hover me'));
    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
  });

  it('hides content on unhover', async () => {
    const { user } = renderTooltip();
    await user.hover(screen.getByText('Hover me'));
    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
    await user.unhover(screen.getByText('Hover me'));
    await waitFor(() => {
      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    });
  });

  it('shows content on focus', async () => {
    const { user } = renderTooltip();
    await user.tab();
    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
  });
});
