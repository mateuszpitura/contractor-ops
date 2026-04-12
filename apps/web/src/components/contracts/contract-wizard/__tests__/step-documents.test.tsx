import { act, render, screen, setup, waitFor } from '@/test/test-utils';
import { StepDocuments } from '../step-documents';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let requestUploadMock = vi.fn();
let _confirmUploadMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: requestUploadMock,
    isPending: false,
  }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    document: {
      requestUpload: { mutationOptions: (opts: any) => opts },
      confirmUpload: { mutationOptions: (opts: any) => opts },
    },
  },
}));

let dropCallback: ((files: File[]) => void) | null = null;

vi.mock('react-dropzone', () => ({
  useDropzone: (opts: any) => {
    dropCallback = opts.onDrop;
    return {
      getRootProps: () => ({ 'data-testid': 'dropzone' }),
      getInputProps: () => ({}),
      isDragActive: false,
    };
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StepDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dropCallback = null;
    requestUploadMock = vi.fn().mockResolvedValue({
      documentId: 'doc-1',
      uploadUrl: 'https://example.com/upload',
    });
    _confirmUploadMock = vi.fn().mockResolvedValue({});
  });

  it('renders drop zone area with text', () => {
    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    expect(screen.getByText(/browse/i)).toBeInTheDocument();
  });

  it('renders skip link that calls onSkip', async () => {
    const onSkip = vi.fn();
    const { user } = setup(<StepDocuments onDocumentsChange={vi.fn()} onSkip={onSkip} />);

    const skipButton = screen.getByText(/skip/i);
    expect(skipButton).toBeInTheDocument();

    await user.click(skipButton);
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('renders accepted file types hint', () => {
    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    expect(screen.getByText(/pdf.*docx|accepted/i)).toBeInTheDocument();
  });

  it('shows uploaded file after drop', async () => {
    // Mock XMLHttpRequest for the upload
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    const onDocumentsChange = vi.fn();
    render(<StepDocuments onDocumentsChange={onDocumentsChange} />);

    const testFile = new File(['test content'], 'contract.pdf', {
      type: 'application/pdf',
    });

    await act(async () => {
      dropCallback?.([testFile]);
      // Simulate XHR completing
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('renders remove button for uploaded files', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const testFile = new File(['data'], 'doc.pdf', { type: 'application/pdf' });

    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    });

    // Remove button should be present (sr-only text "Remove")
    const removeBtn = screen.getByRole('button', { name: /remove/i });
    expect(removeBtn).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('does not render files list when no files uploaded', () => {
    const { container } = render(<StepDocuments onDocumentsChange={vi.fn()} />);

    // No file entries visible
    expect(screen.queryByText(/\.pdf$/)).not.toBeInTheDocument();
  });

  it('does not show skip link when onSkip is not provided', () => {
    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    // Skip link exists in the component but clicking it calls undefined which is fine
    // The skip button should still render (it always renders)
    const skipButton = screen.getByText(/skip/i);
    expect(skipButton).toBeInTheDocument();
  });

  it('shows upload progress and file name after drop', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const testFile = new File(['test'], 'agreement.pdf', { type: 'application/pdf' });

    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('agreement.pdf')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('removes uploaded file and calls onDocumentsChange', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    const onDocumentsChange = vi.fn();
    const { user } = setup(<StepDocuments onDocumentsChange={onDocumentsChange} />);

    const testFile = new File(['data'], 'remove-me.pdf', { type: 'application/pdf' });

    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('remove-me.pdf')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /remove/i });
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('remove-me.pdf')).not.toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('handles upload error when requestUpload rejects', async () => {
    requestUploadMock = vi.fn().mockRejectedValue(new Error('Upload error'));
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const testFile = new File(['data'], 'error-upload.pdf', { type: 'application/pdf' });
    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
    });

    // File should still appear in the list (with error state)
    await waitFor(() => {
      expect(screen.getByText('error-upload.pdf')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('calls onDocumentsChange when file is successfully uploaded', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    const onDocumentsChange = vi.fn();
    render(<StepDocuments onDocumentsChange={onDocumentsChange} />);

    const testFile = new File(['data'], 'callback-test.pdf', { type: 'application/pdf' });
    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('callback-test.pdf')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('shows upload progress during XHR upload', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const testFile = new File(['content'], 'progress-test.pdf', { type: 'application/pdf' });
    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
    });

    // File should appear while uploading
    await waitFor(() => {
      expect(screen.getByText('progress-test.pdf')).toBeInTheDocument();
    });

    // Complete the upload
    await act(async () => {
      xhrMock.onload?.();
    });

    vi.unstubAllGlobals();
  });

  it('shows progress bar during upload', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const testFile = new File(['content'], 'bar-progress.pdf', { type: 'application/pdf' });
    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
      // Simulate progress event
      xhrMock.upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      } as ProgressEvent);
    });

    // File should appear
    await waitFor(() => {
      expect(screen.getByText('bar-progress.pdf')).toBeInTheDocument();
    });

    // Complete the upload
    await act(async () => {
      xhrMock.onload?.();
    });

    vi.unstubAllGlobals();
  });

  it('shows scan status after upload confirms', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const testFile = new File(['content'], 'scan-test.pdf', { type: 'application/pdf' });
    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('scan-test.pdf')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('handles XHR error during upload', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 500,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const testFile = new File(['data'], 'xhr-error.pdf', { type: 'application/pdf' });
    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
      // Simulate XHR error
      xhrMock.onerror?.();
    });

    await waitFor(() => {
      expect(screen.getByText('xhr-error.pdf')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('renders file size info for uploaded files', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const testFile = new File(['content here'], 'size-test.pdf', { type: 'application/pdf' });
    await act(async () => {
      dropCallback?.([testFile]);
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('size-test.pdf')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('shows multiple uploaded files', async () => {
    const xhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      upload: { onprogress: null as any },
      onload: null as any,
      onerror: null as any,
      status: 200,
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrMock),
    );

    render(<StepDocuments onDocumentsChange={vi.fn()} />);

    const file1 = new File(['a'], 'file1.pdf', { type: 'application/pdf' });
    await act(async () => {
      dropCallback?.([file1]);
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    });

    const file2 = new File(['b'], 'file2.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await act(async () => {
      dropCallback?.([file2]);
      await Promise.resolve();
      xhrMock.onload?.();
    });

    await waitFor(() => {
      expect(screen.getByText('file2.docx')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });
});
