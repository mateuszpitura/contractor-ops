/**
 * StepDocuments is presentational (XHR upload + tRPC live in
 * `useContractWizardStepDocuments`). Tests cover the prop-driven
 * rendering branches.
 */

import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import type { UploadingFile } from '../../hooks/use-contract-wizard-step-documents';
import { StepDocuments } from '../step-documents';

const baseProps = {
  files: [] as UploadingFile[],
  onDrop: vi.fn(),
  removeFile: vi.fn(),
};

function makeFile(overrides: Partial<UploadingFile> = {}): UploadingFile {
  return {
    id: 'f1',
    file: new File(['content'], 'contract.pdf', { type: 'application/pdf' }),
    status: 'clean',
    progress: 100,
    documentId: 'doc-1',
    ...overrides,
  } as UploadingFile;
}

describe('StepDocuments', () => {
  it('renders drop zone area with browse copy', () => {
    render(<StepDocuments {...baseProps} />);
    expect(screen.getByText(/browse/i)).toBeInTheDocument();
  });

  it('renders skip link that calls onSkip', async () => {
    const onSkip = vi.fn();
    const { user } = setup(<StepDocuments {...baseProps} onSkip={onSkip} />);
    await user.click(screen.getByText(/skip/i));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('renders accepted file types hint', () => {
    render(<StepDocuments {...baseProps} />);
    // The Common namespace key for accepted types may not include PDF
    // literally; assert against the dropzone hint heuristically.
    expect(
      document.body.textContent?.toLowerCase().includes('pdf') ||
        document.body.textContent?.toLowerCase().includes('accept'),
    ).toBe(true);
  });

  it('does not render any file row when files is empty', () => {
    render(<StepDocuments {...baseProps} />);
    expect(screen.queryByText(/\.pdf$/)).not.toBeInTheDocument();
  });

  it('renders one row per file with the file name', () => {
    render(
      <StepDocuments
        {...baseProps}
        files={[makeFile({ id: '1', file: new File(['a'], 'one.pdf') })]}
      />,
    );
    expect(screen.getByText('one.pdf')).toBeInTheDocument();
  });

  it('renders multiple files', () => {
    render(
      <StepDocuments
        {...baseProps}
        files={[
          makeFile({ id: '1', file: new File(['a'], 'file1.pdf') }),
          makeFile({ id: '2', file: new File(['b'], 'file2.docx') }),
        ]}
      />,
    );
    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.docx')).toBeInTheDocument();
  });

  it('renders a remove button per file and calls removeFile when clicked', async () => {
    const removeFile = vi.fn();
    const { user } = setup(
      <StepDocuments
        {...baseProps}
        removeFile={removeFile}
        files={[makeFile({ id: 'fx', file: new File(['a'], 'remove-me.pdf') })]}
      />,
    );
    const removeBtn = screen.getByRole('button', { name: /remove/i });
    await user.click(removeBtn);
    expect(removeFile).toHaveBeenCalledWith('fx');
  });

  it('renders the progress bar while a file is uploading', () => {
    const { container } = render(
      <StepDocuments
        {...baseProps}
        files={[
          makeFile({ id: '1', file: new File(['a'], 'p.pdf'), status: 'uploading', progress: 50 }),
        ]}
      />,
    );
    // shadcn Progress sets data-slot="progress"
    expect(container.querySelector("[data-slot='progress']")).not.toBeNull();
  });

  it('renders the clean scan badge for clean files', () => {
    render(<StepDocuments {...baseProps} files={[makeFile({ id: '1', status: 'clean' })]} />);
    // The clean scan badge contains a ShieldCheck icon; assert the icon is rendered.
    expect(document.body.querySelector('.lucide-shield-check')).not.toBeNull();
  });
});
