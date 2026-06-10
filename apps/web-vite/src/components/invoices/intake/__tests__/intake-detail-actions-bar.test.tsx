import { render, screen, setup } from '@/test/test-utils';
import type { useIntakeDetailActions } from '../../hooks/use-intake-detail-actions';
import { IntakeDetailActionsBarView } from '../intake-detail-actions-bar';

type ActionsShape = ReturnType<typeof useIntakeDetailActions>;

function makeActions(overrides: Partial<ActionsShape> = {}): ActionsShape {
  return {
    rejectOpen: false,
    setRejectOpen: vi.fn(),
    rejectReason: '',
    setRejectReason: vi.fn(),
    rejectError: null,
    isXmlPending: false,
    isReportPending: false,
    canConvert: false,
    convertTooltip: null,
    showConfirmMatch: false,
    showAccept: false,
    canReject: true,
    isConvertPending: false,
    isConfirmMatchPending: false,
    isAcknowledgePending: false,
    isRejectPending: false,
    onConvert: vi.fn(),
    onConfirmMatch: vi.fn(),
    onAcknowledge: vi.fn(),
    onDownloadXml: vi.fn(),
    onDownloadReport: vi.fn(),
    onRejectConfirm: vi.fn(),
    openRejectDialog: vi.fn(),
    ...overrides,
  } as ActionsShape;
}

describe('IntakeDetailActionsBar', () => {
  it('renders the download-xml + download-report toolbar buttons', () => {
    render(<IntakeDetailActionsBarView actions={makeActions()} />);
    expect(screen.getByTestId('intake-download-xml')).toBeInTheDocument();
    expect(screen.getByTestId('intake-download-report')).toBeInTheDocument();
  });

  it('disables the convert CTA when canConvert is false', () => {
    render(<IntakeDetailActionsBarView actions={makeActions({ canConvert: false })} />);
    expect(screen.getByTestId('intake-convert-cta')).toBeDisabled();
  });

  it('enables the convert CTA when canConvert is true', () => {
    render(<IntakeDetailActionsBarView actions={makeActions({ canConvert: true })} />);
    expect(screen.getByTestId('intake-convert-cta')).not.toBeDisabled();
  });

  it('shows the confirm-match button when showConfirmMatch is true', () => {
    render(<IntakeDetailActionsBarView actions={makeActions({ showConfirmMatch: true })} />);
    expect(screen.getByTestId('intake-confirm-match')).toBeInTheDocument();
  });

  it('shows the accept-despite-issues button when showAccept is true', () => {
    render(<IntakeDetailActionsBarView actions={makeActions({ showAccept: true })} />);
    expect(screen.getByTestId('intake-accept-despite-issues')).toBeInTheDocument();
  });

  it('hides the reject trigger when canReject is false', () => {
    render(<IntakeDetailActionsBarView actions={makeActions({ canReject: false })} />);
    expect(screen.queryByTestId('intake-reject-trigger')).not.toBeInTheDocument();
  });

  it('invokes openRejectDialog when the reject trigger is clicked', async () => {
    const openRejectDialog = vi.fn();
    const { user } = setup(<IntakeDetailActionsBarView actions={makeActions({ openRejectDialog })} />);
    await user.click(screen.getByTestId('intake-reject-trigger'));
    expect(openRejectDialog).toHaveBeenCalledTimes(1);
  });

  it('shows the reject dialog when rejectOpen is true with the reason textarea', () => {
    render(<IntakeDetailActionsBarView actions={makeActions({ rejectOpen: true })} />);
    expect(screen.getByTestId('intake-reject-reason-input')).toBeInTheDocument();
    expect(screen.getByTestId('intake-reject-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('intake-reject-cancel')).toBeInTheDocument();
  });

  it('surfaces the reject inline error', () => {
    render(
      <IntakeDetailActionsBarView
        actions={makeActions({ rejectOpen: true, rejectError: 'too short' })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/too short/i);
  });
});
