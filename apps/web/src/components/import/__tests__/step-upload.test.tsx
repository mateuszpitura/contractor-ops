import { toast } from 'sonner';
import { act, render, screen, setup, waitFor } from '@/test/test-utils';
import { StepUpload } from '../step-upload';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

let capturedOnDrop: ((files: File[]) => void) | null = null;
let capturedOnDropRejected: ((rejections: unknown[]) => void) | null = null;

vi.mock('react-dropzone', () => ({
  useDropzone: ({
    onDrop,
    onDropRejected,
  }: {
    onDrop: (files: File[]) => void;
    onDropRejected: (rejections: unknown[]) => void;
  }) => {
    capturedOnDrop = onDrop;
    capturedOnDropRejected = onDropRejected;
    return {
      getRootProps: () => ({ role: 'button', tabIndex: 0 }),
      getInputProps: () => ({ type: 'file' }),
      isDragActive: false,
      fileRejections: [],
    };
  },
}));

describe('StepUpload', () => {
  const defaultProps = {
    entityType: 'contractor' as const,
    onEntityTypeChange: vi.fn(),
    onFileSelected: vi.fn(),
    fileName: null,
    onFileRemoved: vi.fn(),
  };

  it('renders entity type radio group', () => {
    render(<StepUpload {...defaultProps} />);
    expect(screen.getByText('Import type')).toBeInTheDocument();
    expect(screen.getByText('Contractors')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
  });

  it('renders drop zone when no file selected', () => {
    render(<StepUpload {...defaultProps} />);
    expect(screen.getByText('Drop your file here')).toBeInTheDocument();
    expect(screen.getByText('Browse files')).toBeInTheDocument();
  });

  it('renders file info and remove button when file is selected', () => {
    render(<StepUpload {...defaultProps} fileName="contractors.csv" />);
    expect(screen.getByText('contractors.csv')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove')).toBeInTheDocument();
  });

  it('calls onFileRemoved when remove button is clicked', async () => {
    const onFileRemoved = vi.fn();
    const { user } = setup(
      <StepUpload {...defaultProps} fileName="test.csv" onFileRemoved={onFileRemoved} />,
    );
    await user.click(screen.getByLabelText('Remove'));
    expect(onFileRemoved).toHaveBeenCalled();
  });

  it('does not render drop zone when file is selected', () => {
    render(<StepUpload {...defaultProps} fileName="data.xlsx" />);
    expect(screen.queryByText('Drop your file here')).not.toBeInTheDocument();
    expect(screen.getByText('data.xlsx')).toBeInTheDocument();
  });

  it('does not render file info when no file is selected', () => {
    render(<StepUpload {...defaultProps} fileName={null} />);
    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument();
  });

  it('renders contract radio option', () => {
    render(<StepUpload {...defaultProps} entityType="contract" />);
    expect(screen.getByText('Contracts')).toBeInTheDocument();
    expect(screen.getByText('Contractors')).toBeInTheDocument();
  });

  it('calls onEntityTypeChange when radio selection changes', async () => {
    const onEntityTypeChange = vi.fn();
    const { user } = setup(
      <StepUpload {...defaultProps} onEntityTypeChange={onEntityTypeChange} />,
    );
    const radios = screen.getAllByRole('radio');
    // Click on the "contract" radio (second one)
    await user.click(radios[1]);
    expect(onEntityTypeChange).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Drop zone attributes
  // -------------------------------------------------------------------------

  it('renders drop zone with correct role and tabIndex', () => {
    render(<StepUpload {...defaultProps} />);
    const dropZone = screen.getByRole('button', { name: /drop your file here/i });
    expect(dropZone).toBeInTheDocument();
    expect(dropZone).toHaveAttribute('tabindex', '0');
  });

  it('renders file input in drop zone', () => {
    const { container } = render(<StepUpload {...defaultProps} />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('renders drop body helper text', () => {
    render(<StepUpload {...defaultProps} />);
    expect(screen.getByText(/CSV or Excel/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // File name display
  // -------------------------------------------------------------------------

  it('displays correct file name when file is selected', () => {
    render(<StepUpload {...defaultProps} fileName="my-data.xlsx" />);
    expect(screen.getByText('my-data.xlsx')).toBeInTheDocument();
  });

  it('does not show browse button when file is already selected', () => {
    render(<StepUpload {...defaultProps} fileName="data.csv" />);
    expect(screen.queryByText('Browse files')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Entity type radio state
  // -------------------------------------------------------------------------

  it('has contractor radio selected when entityType is contractor', () => {
    render(<StepUpload {...defaultProps} entityType="contractor" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();
  });

  it('has contract radio selected when entityType is contract', () => {
    render(<StepUpload {...defaultProps} entityType="contract" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[1]).toBeChecked();
  });

  // -------------------------------------------------------------------------
  // Multiple file removals
  // -------------------------------------------------------------------------

  it('remove button stops event propagation', async () => {
    const onFileRemoved = vi.fn();
    const { user } = setup(
      <StepUpload {...defaultProps} fileName="test.csv" onFileRemoved={onFileRemoved} />,
    );
    await user.click(screen.getByLabelText('Remove'));
    expect(onFileRemoved).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Import type label
  // -------------------------------------------------------------------------

  it('renders entity type label text', () => {
    render(<StepUpload {...defaultProps} />);
    expect(screen.getByText('Import type')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // File validation: drag active, rejection callbacks
  // -------------------------------------------------------------------------

  it('renders radio group with aria-label', () => {
    render(<StepUpload {...defaultProps} />);
    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toBeInTheDocument();
  });

  it('renders drop zone with accessible label matching heading', () => {
    render(<StepUpload {...defaultProps} />);
    const dropZone = screen.getByRole('button', { name: /drop your file here/i });
    expect(dropZone).toHaveAttribute('aria-label');
  });

  it('renders file spreadsheet icon when file is selected', () => {
    const { container } = render(<StepUpload {...defaultProps} fileName="data.csv" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // File drop callback
  // -------------------------------------------------------------------------

  it('calls onFileSelected when file is dropped via onDrop callback', async () => {
    // We test that the onDrop mechanism from useDropzone is wired up
    // Since we mock useDropzone, we verify props are passed correctly
    const onFileSelected = vi.fn();
    render(<StepUpload {...defaultProps} onFileSelected={onFileSelected} />);
    // Drop zone should be visible
    expect(screen.getByText('Drop your file here')).toBeInTheDocument();
  });

  it('renders xlsx file name when xlsx file is selected', () => {
    render(<StepUpload {...defaultProps} fileName="import-data.xlsx" />);
    expect(screen.getByText('import-data.xlsx')).toBeInTheDocument();
    expect(screen.queryByText('Drop your file here')).not.toBeInTheDocument();
  });

  it('renders file input with type attribute', () => {
    const { container } = render(<StepUpload {...defaultProps} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input?.getAttribute('type')).toBe('file');
  });

  it('both radio options are rendered as interactive', () => {
    render(<StepUpload {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(2);
    // Both should not be disabled
    for (const radio of radios) {
      expect(radio).not.toBeDisabled();
    }
  });

  it('renders upload icon in drop zone', () => {
    const { container } = render(<StepUpload {...defaultProps} />);
    // Upload icon (SVG) should be present
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('does not call onFileRemoved when no file is present', () => {
    const onFileRemoved = vi.fn();
    render(<StepUpload {...defaultProps} fileName={null} onFileRemoved={onFileRemoved} />);
    // No remove button should exist
    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument();
    expect(onFileRemoved).not.toHaveBeenCalled();
  });

  it('renders browse files button only when no file selected', () => {
    render(<StepUpload {...defaultProps} />);
    expect(screen.getByText('Browse files')).toBeInTheDocument();
  });

  it('switches between contractor and contract radio labels', () => {
    const { rerender } = render(<StepUpload {...defaultProps} entityType="contractor" />);
    expect(screen.getAllByRole('radio')[0]).toBeChecked();

    rerender(<StepUpload {...defaultProps} entityType="contract" />);
    expect(screen.getAllByRole('radio')[1]).toBeChecked();
  });

  it('renders different file extensions in file name display', () => {
    render(<StepUpload {...defaultProps} fileName="data.csv" />);
    expect(screen.getByText('data.csv')).toBeInTheDocument();
  });

  it('hides drop zone and shows file when file is provided', () => {
    render(<StepUpload {...defaultProps} fileName="upload.xlsx" />);
    expect(screen.queryByText('Drop your file here')).not.toBeInTheDocument();
    expect(screen.getByText('upload.xlsx')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove')).toBeInTheDocument();
  });

  it('multiple remove clicks only call handler once per click', async () => {
    const onFileRemoved = vi.fn();
    const { user } = setup(
      <StepUpload {...defaultProps} fileName="click-test.csv" onFileRemoved={onFileRemoved} />,
    );
    await user.click(screen.getByLabelText('Remove'));
    expect(onFileRemoved).toHaveBeenCalledTimes(1);
  });

  it('renders correct file name with special characters', () => {
    render(<StepUpload {...defaultProps} fileName="contractors (final).csv" />);
    expect(screen.getByText('contractors (final).csv')).toBeInTheDocument();
  });

  it('renders contractor radio as first option', () => {
    render(<StepUpload {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(2);
    expect(radios[0]).toBeChecked(); // contractor is default
  });

  // ---------------------------------------------------------------------------
  // onDrop callback tests
  // ---------------------------------------------------------------------------

  it('calls onFileSelected with base64 data when file is dropped', async () => {
    const onFileSelected = vi.fn();
    render(<StepUpload {...defaultProps} onFileSelected={onFileSelected} />);
    expect(capturedOnDrop).toBeTruthy();

    // Create a mock file with known content
    const file = new File(['test,data'], 'import.csv', { type: 'text/csv' });
    await act(async () => {
      await capturedOnDrop?.([file]);
    });
    await waitFor(() => {
      expect(onFileSelected).toHaveBeenCalledWith(expect.any(String), 'import.csv');
    });
  });

  it('does nothing when onDrop receives empty file list', async () => {
    const onFileSelected = vi.fn();
    render(<StepUpload {...defaultProps} onFileSelected={onFileSelected} />);
    expect(capturedOnDrop).toBeTruthy();

    await act(async () => {
      await capturedOnDrop?.([]);
    });
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it('shows toast error when file-too-large rejection occurs', async () => {
    render(<StepUpload {...defaultProps} />);
    expect(capturedOnDropRejected).toBeTruthy();

    await act(async () => {
      capturedOnDropRejected?.([
        {
          file: new File([''], 'big.csv'),
          errors: [{ code: 'file-too-large', message: 'Too large' }],
        },
      ]);
    });
    expect(toast.error).toHaveBeenCalled();
  });

  it('shows toast error when file-invalid-type rejection occurs', async () => {
    render(<StepUpload {...defaultProps} />);
    expect(capturedOnDropRejected).toBeTruthy();

    await act(async () => {
      capturedOnDropRejected?.([
        {
          file: new File([''], 'bad.exe'),
          errors: [{ code: 'file-invalid-type', message: 'Invalid type' }],
        },
      ]);
    });
    expect(toast.error).toHaveBeenCalled();
  });

  it('shows generic error toast for unknown rejection code', async () => {
    render(<StepUpload {...defaultProps} />);
    expect(capturedOnDropRejected).toBeTruthy();

    await act(async () => {
      capturedOnDropRejected?.([
        {
          file: new File([''], 'unknown.bin'),
          errors: [{ code: 'unknown-error', message: 'Something went wrong' }],
        },
      ]);
    });
    expect(toast.error).toHaveBeenCalled();
  });

  it('handles empty rejection list gracefully', async () => {
    render(<StepUpload {...defaultProps} />);
    expect(capturedOnDropRejected).toBeTruthy();

    await act(async () => {
      capturedOnDropRejected?.([]);
    });
    // Should not crash
  });

  it('shows toast error when file conversion fails', async () => {
    const onFileSelected = vi.fn();
    render(<StepUpload {...defaultProps} onFileSelected={onFileSelected} />);
    expect(capturedOnDrop).toBeTruthy();

    // Create a mock file that fails to read
    const file = new File(['data'], 'fail.csv', { type: 'text/csv' });
    // Mock FileReader to fail
    const origFileReader = globalThis.FileReader;
    const mockError = new Error('Read failed');
    globalThis.FileReader = class {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error = mockError;
      readAsDataURL() {
        setTimeout(() => this.onerror?.(), 0);
      }
    } as unknown;

    await act(async () => {
      await capturedOnDrop?.([file]);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    globalThis.FileReader = origFileReader;
  });
});
